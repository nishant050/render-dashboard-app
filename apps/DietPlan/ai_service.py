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
