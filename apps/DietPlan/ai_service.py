"""
AI service helpers for recipe enrichment across supported providers.
"""
import os
from html import escape
from urllib.parse import quote_plus

import httpx

from database import get_db


GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_API_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent"
)
CACHE_VERSION = 2


async def get_default_model():
    db = await get_db()
    model = await db.ai_models.find_one({"is_default": 1})
    if not model:
        model = await db.ai_models.find_one({})
    return model


async def get_all_models():
    db = await get_db()
    cursor = db.ai_models.find({}).sort([("is_default", -1), ("created_at", -1)])
    return await cursor.to_list(length=None)


async def get_cached_recipe(dish_name: str, model_id: str):
    db = await get_db()
    doc = await db.ai_recipe_cache.find_one({
        "dish_name": dish_name.lower().strip(),
        "model_id": model_id,
        "cache_version": CACHE_VERSION,
    })
    return doc["recipe_html"] if doc else None


async def cache_recipe(dish_name: str, model_id: str, recipe_html: str):
    db = await get_db()
    await db.ai_recipe_cache.update_one(
        {"dish_name": dish_name.lower().strip(), "model_id": model_id},
        {
            "$set": {
                "recipe_html": recipe_html,
                "cache_version": CACHE_VERSION,
            }
        },
        upsert=True,
    )


def build_prompt(dish_name: str, include_youtube: bool = True) -> str:
    youtube_line = (
        "Mention one suitable YouTube tutorial in the video note section if a real link is available."
        if include_youtube
        else "Skip any video references."
    )
    return f"""
You are a nutrition expert and chef. Build a concise recipe brief for "{dish_name}".

Return only a clean HTML fragment. Do not use markdown. Do not invent external links.
Use this structure:

<div class="recipe-ai-block">
  <h3>Recipe overview</h3>
  <p>Short intro with cuisine/style and serving context.</p>
  <h4>Nutrition snapshot</h4>
  <ul>
    <li>Calories</li>
    <li>Protein</li>
    <li>Carbohydrates</li>
    <li>Fat</li>
    <li>Fiber</li>
  </ul>
  <h4>Ingredients</h4>
  <ul>...</ul>
  <h4>Method</h4>
  <ol>...</ol>
  <h4>Time and prep notes</h4>
  <p>Prep, cook, and total time.</p>
  <h4>Health notes</h4>
  <ul>...</ul>
  <h4>Dietary notes</h4>
  <p>Allergens, substitutions, vegetarian/vegan/gluten notes.</p>
  <h4>Video note</h4>
  <p>Explain what kind of video tutorial would be useful. {youtube_line}</p>
</div>
""".strip()


def extract_text_from_parts(parts) -> str:
    text_parts = []
    for part in parts or []:
        text = part.get("text")
        if text:
            text_parts.append(text)
    return "\n".join(text_parts).strip()


def extract_grounding_links(candidate) -> list[dict]:
    links = []
    seen = set()

    metadata = candidate.get("groundingMetadata") or {}
    for chunk in metadata.get("groundingChunks") or []:
        web = chunk.get("web") or {}
        url = (web.get("uri") or "").strip()
        title = (web.get("title") or "").strip() or "Source"
        if not url or url in seen:
            continue
        seen.add(url)
        links.append({
            "title": title,
            "url": url,
            "is_youtube": "youtube.com" in url or "youtu.be" in url,
        })

    return links


def ensure_html_fragment(content: str) -> str:
    stripped = (content or "").strip()
    if not stripped:
        return "<p class='error'>No recipe details were returned.</p>"
    if "<" in stripped and ">" in stripped:
        return stripped
    return f"<p>{escape(stripped)}</p>"


def build_grounding_panel(dish_name: str, links: list[dict], include_youtube: bool) -> str:
    if not links and not include_youtube:
        return ""

    youtube_link = next((link for link in links if link["is_youtube"]), None)
    recipe_links = [link for link in links if not link["is_youtube"]][:3]

    if include_youtube and youtube_link is None:
        youtube_link = {
            "title": f"Search YouTube for {dish_name}",
            "url": f"https://www.youtube.com/results?search_query={quote_plus(dish_name + ' recipe')}",
            "is_youtube": True,
        }

    recipe_items = "".join(
        f"<li><a href='{escape(link['url'])}' target='_blank' rel='noopener'>{escape(link['title'])}</a></li>"
        for link in recipe_links
    )
    youtube_html = ""
    if youtube_link:
        youtube_html = (
            "<a class='recipe-video-link' "
            f"href='{escape(youtube_link['url'])}' target='_blank' rel='noopener'>"
            "Watch recipe video"
            "</a>"
        )

    source_html = ""
    if recipe_items:
        source_html = f"""
        <div class="recipe-source-block">
            <h4>Recipe sources</h4>
            <ul class="recipe-source-list">{recipe_items}</ul>
        </div>
        """

    if not source_html and not youtube_html:
        return ""

    return f"""
    <div class="recipe-grounding-panel">
        {youtube_html}
        {source_html}
    </div>
    """


def build_gemini_html(dish_name: str, candidate, include_youtube: bool) -> str:
    content = extract_text_from_parts((candidate.get("content") or {}).get("parts") or [])
    recipe_html = ensure_html_fragment(content)
    grounding_html = build_grounding_panel(
        dish_name,
        extract_grounding_links(candidate),
        include_youtube,
    )
    return f"{recipe_html}{grounding_html}"


async def query_ai(dish_name: str) -> str:
    model = await get_default_model()
    if not model:
        return "<p class='error'>No AI model configured. Ask admin to add one.</p>"

    model_id = model["model_id"]
    cached = await get_cached_recipe(dish_name, model_id)
    if cached:
        return cached

    provider = model["provider"]
    api_key = model.get("api_key", "")
    headers = {"Content-Type": "application/json"}

    if provider == "groq":
        api_url = GROQ_API_URL
        api_key = api_key or os.environ.get("GROQ_API_KEY", "")
    elif provider == "openrouter":
        api_url = OPENROUTER_API_URL
        api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
    elif provider == "gemini":
        api_url = GEMINI_API_URL_TEMPLATE.format(model_id=model_id)
        api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
    else:
        return "<p class='error'>Unknown AI provider configured.</p>"

    if not api_key:
        return (
            f"<p class='error'>API key not configured for {escape(provider)}. "
            "Set it in admin settings or an environment variable.</p>"
        )

    if provider in ("groq", "openrouter"):
        headers["Authorization"] = f"Bearer {api_key}"
    if provider == "openrouter":
        headers["HTTP-Referer"] = os.environ.get("APP_URL", "http://localhost:8000")
        headers["X-Title"] = "Diet Plan Dashboard"
    if provider == "gemini":
        headers["x-goog-api-key"] = api_key

    if provider == "gemini":
        search_grounding = bool(model.get("search_grounding", 1))
        include_youtube = bool(model.get("include_youtube", 1))
        payload = {
            "systemInstruction": {
                "parts": [{
                    "text": (
                        "You are a nutrition expert and chef. "
                        "Respond with valid HTML only. "
                        "When grounding is enabled, use Google Search results to support the recipe summary."
                    )
                }]
            },
            "contents": [{"parts": [{"text": build_prompt(dish_name, include_youtube)}]}],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 2048,
            },
        }
        if search_grounding:
            payload["tools"] = [{"google_search": {}}]
    else:
        payload = {
            "model": model_id,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a nutrition expert and professional chef. Respond only in clean HTML format.",
                },
                {"role": "user", "content": build_prompt(dish_name, include_youtube=True)},
            ],
            "max_tokens": 2000,
            "temperature": 0.7,
        }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        if provider == "gemini":
            candidates = data.get("candidates") or []
            if not candidates:
                return "<p class='error'>Gemini did not return a recipe.</p>"
            recipe_html = build_gemini_html(
                dish_name,
                candidates[0],
                bool(model.get("include_youtube", 1)),
            )
        else:
            recipe_html = ensure_html_fragment(data["choices"][0]["message"]["content"])

        await cache_recipe(dish_name, model_id, recipe_html)
        return recipe_html
    except httpx.TimeoutException:
        return "<p class='error'>AI service timed out. Please try again.</p>"
    except httpx.HTTPStatusError as exc:
        return (
            f"<p class='error'>AI service error: {exc.response.status_code} "
            f"- {escape(exc.response.text[:200])}</p>"
        )
    except Exception as exc:
        return f"<p class='error'>Error querying AI: {escape(str(exc))}</p>"

def build_nutrition_prompt(profile: dict, macros: dict, meals_list: list) -> str:
    meals_str = "\n".join([f"- {m}" for m in meals_list]) if meals_list else "None assigned yet."
    return f"""
You are a clinical nutritionist and doctor. Evaluate this daily nutritional intake against WHO guidelines for a patient.
Patient Profile:
- Age: {profile.get('age', 'Unknown')}
- Height: {profile.get('height_cm', 'Unknown')} cm
- Weight: {profile.get('weight_kg', 'Unknown')} kg
- Condition: {profile.get('current_disease', 'None')}
- Treatment: {profile.get('treatment_status', 'None')}

Assigned Meals for Today:
{meals_str}

Today's Total Planned Macros:
- Calories: {macros['calories']} kcal
- Protein: {macros['protein']} g
- Carbs: {macros['carbs']} g
- Fat: {macros['fat']} g
- Fiber: {macros['fiber']} g

Return a clean HTML snippet (no markdown wrapping) containing:
1. A brief medical assessment, explaining any discrepancies between their medical needs and the plan.
2. Progress bars for each macro showing % filled based on their specific WHO need. (e.g. <progress value="80" max="100"></progress>) Include estimates for Sugar and Sodium based on the meals list!
3. 2-3 specific recommendations on what to adjust. If there are missing nutrients, recommend *specific meal names* the user can add to solve the discrepancies.
Use this exact HTML structure:
<div class='ai-nutrition'>
  <h3 style="margin-top:0;">🩺 WHO Nutrition Analysis</h3>
  <p class='ai-assess'>[Assessment explaining discrepancies]</p>
  <div class='nutrition-bars' style='display:grid; gap:0.5rem; margin-bottom:1rem;'>
    <div style='display:flex; justify-content:space-between;'><label>Calories</label><progress value='[x]' max='100'></progress><span>[x]%</span></div>
    <div style='display:flex; justify-content:space-between;'><label>Protein</label><progress value='[x]' max='100'></progress><span>[x]%</span></div>
    <div style='display:flex; justify-content:space-between;'><label>Carbs</label><progress value='[x]' max='100'></progress><span>[x]%</span></div>
    <div style='display:flex; justify-content:space-between;'><label>Fat</label><progress value='[x]' max='100'></progress><span>[x]%</span></div>
    <div style='display:flex; justify-content:space-between;'><label>Fiber</label><progress value='[x]' max='100'></progress><span>[x]%</span></div>
    <div style='display:flex; justify-content:space-between;'><label>Sugar</label><progress value='[x]' max='100'></progress><span>[x]%</span></div>
    <div style='display:flex; justify-content:space-between;'><label>Sodium</label><progress value='[x]' max='100'></progress><span>[x]%</span></div>
  </div>
  <ul class='ai-recs'><li>[Specific tip / recipe to fix deficits]</li></ul>
</div>
"""

async def evaluate_nutrition(profile: dict, macros: dict, meals_list: list) -> str:
    model = await get_default_model()
    if not model:
        return "<p class='error'>No AI model configured.</p>"

    model_id = model["model_id"]
    provider = model["provider"]
    api_key = model.get("api_key", "")
    headers = {"Content-Type": "application/json"}

    if provider == "groq":
        api_url = GROQ_API_URL
        api_key = api_key or os.environ.get("GROQ_API_KEY", "")
    elif provider == "openrouter":
        api_url = OPENROUTER_API_URL
        api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
    elif provider == "gemini":
        api_url = GEMINI_API_URL_TEMPLATE.format(model_id=model_id)
        api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
    else:
        return "<p class='error'>Unknown AI provider.</p>"

    if provider in ("groq", "openrouter"):
        headers["Authorization"] = f"Bearer {api_key}"
    if provider == "openrouter":
        headers["HTTP-Referer"] = os.environ.get("APP_URL", "http://localhost:8000")
        headers["X-Title"] = "Diet Plan Dashboard"
    if provider == "gemini":
        headers["x-goog-api-key"] = api_key

    prompt = build_nutrition_prompt(profile, macros, meals_list)

    if provider == "gemini":
        payload = {
            "systemInstruction": {"parts": [{"text": "You are a top clinical nutritionist. Respond with valid HTML only."}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2048}
        }
    else:
        payload = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": "You are a clinical nutritionist. Respond only in clean HTML."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 1000,
            "temperature": 0.3,
        }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        if provider == "gemini":
            candidates = data.get("candidates") or []
            if not candidates:
                return "<p class='error'>Gemini did not return an analysis.</p>"
            html_res = extract_text_from_parts((candidates[0].get("content") or {}).get("parts") or [])
            return ensure_html_fragment(html_res)
        else:
            html_res = data["choices"][0]["message"]["content"]
            return ensure_html_fragment(html_res)
    except Exception as exc:
        return f"<p class='error'>Nutrition analysis failed: {escape(str(exc))}</p>"

async def suggest_meal_alternatives(profile: dict, meal: dict, reason: str) -> list[dict]:
    import json
    model = await get_default_model()
    if not model:
        return []

    prefs = profile.get("permanent_preferences", [])
    prefs_str = ", ".join(prefs) if prefs else "None"
    
    prompt = f"""
You are a clinical nutritionist and chef. A patient needs to replace their planned meal.
Patient Profile:
- Age: {profile.get('age', 'Unknown')}
- Disease: {profile.get('current_disease', 'None')}
- Treatment: {profile.get('treatment_status', 'None')}
- Known Allergies/Preferences: {prefs_str}

Meal to replace: {meal['dish_name']} ({meal['meal_type']})
Patient's reason for replacement: {reason}

Provide 3 completely different, healthy recipe alternatives that match the meal type, fit their medical constraints, avoid all their allergies, and explicitly resolve their reason for replacement.

Return ONLY a valid JSON array of objects (no markdown blocks, no extra text). Format exact:
[
  {{
    "dish_name": "New Recipe Name",
    "description": "Short appetizing description",
    "calories": 400,
    "protein_g": 30,
    "carbs_g": 40,
    "fat_g": 10,
    "fiber_g": 5
  }}
]
"""
    model_id = model["model_id"]
    provider = model["provider"]
    api_key = model.get("api_key", os.environ.get(f"{provider.upper()}_API_KEY", ""))
    
    headers = {"Content-Type": "application/json"}
    if provider in ("groq", "openrouter"):
        headers["Authorization"] = f"Bearer {api_key}"
    if provider == "openrouter":
        headers["HTTP-Referer"] = os.environ.get("APP_URL", "http://localhost:8000")
        api_url = OPENROUTER_API_URL
    elif provider == "groq":
        api_url = GROQ_API_URL
    elif provider == "gemini":
        api_url = GEMINI_API_URL_TEMPLATE.format(model_id=model_id)
        headers["x-goog-api-key"] = api_key
    else:
        return []

    if provider == "gemini":
        payload = {
            "systemInstruction": {"parts": [{"text": "You are a JSON API. Respond only with a raw valid JSON array."}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4}
        }
    else:
        payload = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": "You are a JSON API. Return only raw JSON arrays."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.4
        }
        
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            
        if provider == "gemini":
            res_str = ((data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")))
        else:
            res_str = data["choices"][0]["message"]["content"]
            
        # Clean JSON from markdown if exists
        res_str = res_str.strip()
        if res_str.startswith("```json"):
            res_str = res_str[7:]
        elif res_str.startswith("```"):
            res_str = res_str[3:]
        if res_str.endswith("```"):
            res_str = res_str[:-3]
            
        return json.loads(res_str.strip())
    except Exception as e:
        print(f"AI Meal Suggest error: {e}")
        return []

async def screen_admin_meal(profile: dict, meal: dict) -> dict:
    import json
    model = await get_default_model()
    if not model:
        return {"is_safe": True}

    prefs = profile.get("permanent_preferences", [])
    if not prefs and not profile.get("current_disease") and not profile.get("treatment_status"):
        return {"is_safe": True} # No medical constraints

    prefs_str = ", ".join(prefs) if prefs else "None"
    
    prompt = f"""
You are a top clinical nutritionist evaluating a meal an admin wants to assign to a patient.
Patient Profile:
- Age: {profile.get('age', 'Unknown')}
- Disease: {profile.get('current_disease', 'None')}
- Treatment: {profile.get('treatment_status', 'None')}
- Known Allergies/Preferences: {prefs_str}

Proposed Meal:
- Dish: {meal['dish_name']}
- Desc: {meal['description']}
- Calories: {meal['calories']}

Is this meal safe for this patient?
If YES: Return strictly {{"is_safe": true}}
If NO (dangerous or major conflict): Return {{"is_safe": false, "reason": "Brief reason", "auto_fixed_meal": {{"dish_name": "Safe Dish Name", "description": "Safe desc", "calories": {meal['calories']}, "protein_g": {meal['protein_g']}, "carbs_g": {meal['carbs_g']}, "fat_g": {meal['fat_g']}, "fiber_g": {meal['fiber_g']}}}}}

ONLY return raw JSON object.
"""
    model_id = model["model_id"]
    provider = model["provider"]
    api_key = model.get("api_key", os.environ.get(f"{provider.upper()}_API_KEY", ""))
    
    headers = {"Content-Type": "application/json"}
    if provider in ("groq", "openrouter"):
        headers["Authorization"] = f"Bearer {api_key}"
    if provider == "openrouter":
        headers["HTTP-Referer"] = os.environ.get("APP_URL", "http://localhost:8000")
        api_url = OPENROUTER_API_URL
    elif provider == "groq":
        api_url = GROQ_API_URL
    elif provider == "gemini":
        api_url = GEMINI_API_URL_TEMPLATE.format(model_id=model_id)
        headers["x-goog-api-key"] = api_key

    if provider == "gemini":
        payload = {
            "systemInstruction": {"parts": [{"text": "You are a JSON API. Respond only with a single raw JSON object."}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2}
        }
    else:
        payload = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": "You are a JSON API. Return exactly one valid JSON object."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        }
        
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            
        if provider == "gemini":
            res_str = ((data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")))
        else:
            res_str = data["choices"][0]["message"]["content"]
            
        res_str = res_str.strip()
        if res_str.startswith("```json"): res_str = res_str[7:]
        elif res_str.startswith("```"): res_str = res_str[3:]
        if res_str.endswith("```"): res_str = res_str[:-3]
            
        return json.loads(res_str.strip())
    except Exception as e:
        print(f"AI Screen admin meal error: {e}")
        return {"is_safe": True}
