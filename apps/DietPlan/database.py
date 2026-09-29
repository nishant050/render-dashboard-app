"""
Database module — MongoDB with Motor for async operations.
Collections: admin, profiles, device_profile_map, meal_plans, meal_checks, ai_models, activity_logs, ai_recipe_cache
"""
import os
import secrets
import motor.motor_asyncio
from datetime import datetime

DEFAULT_MONGO_URI = "mongodb://localhost:27017"

MONGO_URI = os.environ.get("MONGO_URI", DEFAULT_MONGO_URI)
DB_NAME = os.environ.get("DB_NAME", "dietplan")

# Global variables to store the client and db instances
client = None
db = None

async def init_db():
    global client, db
    if client is None:
        client = motor.motor_asyncio.AsyncIOMotorClient(
            MONGO_URI,
            serverSelectionTimeoutMS=10000,
        )
        await client.admin.command("ping")
        # Global db links
        db = client[DB_NAME]
        db.central = client["render-dashboard"]
        
    # Create indexes for performance and uniqueness
    await db.admin.create_index("username", unique=True)
    await db.meal_plans.create_index("plan_date")
    await db.meal_plans.create_index("profile_id")
    await db.meal_plans.create_index([("plan_date", 1), ("meal_type", 1)])
    await db.meal_plans.create_index([("profile_id", 1), ("plan_date", 1)])
    await db.meal_checks.create_index([("profile_id", 1), ("meal_plan_id", 1)], unique=True)
    await db.meal_checks.create_index("profile_id")
    await db.activity_logs.create_index("profile_id")
    await db.device_profile_map.create_index("device_fingerprint")
    await db.ai_recipe_cache.create_index([("dish_name", 1), ("model_id", 1)], unique=True)

    # Seed default AI models
    if await db.ai_models.count_documents({}) == 0:
        await db.ai_models.insert_many([
            {
                "provider": "groq", 
                "model_id": "openai/gpt-oss-120b", 
                "display_name": "GPT-OSS 120B (Groq)", 
                "api_key": "",
                "is_default": 1,
                "created_at": datetime.utcnow()
            },
            {
                "provider": "openrouter",   
                "model_id": "arcee-ai/trinity-large-preview:free", 
                "display_name": "Trinity Large Preview (Free)", 
                "api_key": "",
                "is_default": 0,
                "created_at": datetime.utcnow()
            },
            {
                "provider": "gemini",
                "model_id": "gemini-2.5-flash-lite",
                "display_name": "Gemini 2.5 Flash Lite",
                "api_key": "",
                "is_default": 0,
                "search_grounding": 1,
                "include_youtube": 1,
                "created_at": datetime.utcnow()
            }
        ])

    await db.ai_models.update_many(
        {"provider": "gemini", "search_grounding": {"$exists": False}},
        {"$set": {"search_grounding": 1, "include_youtube": 1}}
    )
    await db.ai_models.update_many(
        {"provider": "gemini", "model_id": "gemini-3.1-flash-lite-preview"},
        {
            "$set": {
                "model_id": "gemini-2.5-flash-lite",
                "display_name": "Gemini 2.5 Flash Lite",
            }
        }
    )

    # Seed default admin. There is no well-known fallback password: without
    # DIETPLAN_ADMIN_PASSWORD / DASHBOARD_PASSWORD a random one is generated and logged once.
    from passlib.hash import bcrypt
    configured_admin_pass = (
        os.environ.get("DIETPLAN_ADMIN_PASSWORD")
        or os.environ.get("DASHBOARD_PASSWORD")
    )
    if await db.admin.count_documents({}) == 0:
        default_admin_pass = configured_admin_pass
        if not default_admin_pass:
            default_admin_pass = secrets.token_urlsafe(12)
            print(f"[DietPlan] No DIETPLAN_ADMIN_PASSWORD or DASHBOARD_PASSWORD set. Generated admin password: {default_admin_pass}", flush=True)
        hashed = bcrypt.hash(default_admin_pass)
        await db.admin.insert_one({
            "username": "admin",
            "password_hash": hashed,
            "created_at": datetime.utcnow()
        })
    else:
        # Replace the old public default ("admin123") if an earlier version seeded it.
        legacy_admin = await db.admin.find_one({"username": "admin"})
        try:
            uses_default = bool(legacy_admin) and bcrypt.verify("admin123", legacy_admin.get("password_hash") or "")
        except ValueError:
            uses_default = False
        if uses_default:
            new_pass = configured_admin_pass or secrets.token_urlsafe(12)
            await db.admin.update_one({"_id": legacy_admin["_id"]}, {"$set": {"password_hash": bcrypt.hash(new_pass)}})
            if configured_admin_pass:
                print("[DietPlan] Replaced the default admin password with the configured one.", flush=True)
            else:
                print(f"[DietPlan] Replaced the default admin password. New admin password: {new_pass}", flush=True)

async def get_db():
    """Dependency to get the database instance."""
    global db
    if db is None:
        await init_db()
    return db
