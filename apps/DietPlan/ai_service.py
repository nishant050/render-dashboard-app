"""
AI service helpers for recipe enrichment and nutrition workflows.
"""
import json
import os
import re
import time
from html import escape
from typing import Any, Callable
from urllib.parse import quote_plus

import httpx

from database import get_db


GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_API_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent"
)
CACHE_VERSION = 3
RETRYABLE_STATUS_CODES = {400, 401, 403, 404, 408, 409, 429, 500, 502, 503, 504}
MEAL_TYPES = {
    "breakfast",
    "morning_snack",
    "lunch",
    "afternoon_snack",
    "dinner",
    "evening_snack",
}
PRIMARY_NUTRIENTS = ["Calories", "Protein", "Carbs", "Fat", "Fiber", "Sugar", "Sodium"]
MICRONUTRIENTS = ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin B12", "Folate", "Iron", "Calcium"]


class RetryableAIError(Exception):
    """Signals that another configured model should be tried."""


class ParseAIError(RetryableAIError):
    """Signals that a response was received but unusable."""


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


def get_api_key(model: dict) -> str:
    provider = (model.get("provider") or "").lower()
    env_map = {
        "gemini": "GEMINI_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
        "groq": "GROQ_API_KEY",
    }
    env_name = env_map.get(provider, f"{provider.upper()}_API_KEY")
    return (model.get("api_key") or os.environ.get(env_name, "")).strip()


def has_configured_key(model: dict) -> bool:
    return bool(get_api_key(model))


async def get_candidate_models() -> list[dict]:
    default_model = await get_default_model()
    all_models = await get_all_models()
    ordered: list[dict] = []
    seen: set[tuple[str, str]] = set()

    def add_model(model: dict | None):
        if not model:
            return
        provider = (model.get("provider") or "").lower()
        model_id = (model.get("model_id") or "").strip()
        if not provider or not model_id or not has_configured_key(model):
            return
        key = (provider, model_id)
        if key in seen:
            return
        seen.add(key)
        ordered.append(model)

    add_model(default_model)

    for provider_name in ("openrouter", "groq"):
        for model in all_models:
            if (model.get("provider") or "").lower() == provider_name:
                add_model(model)

    return ordered


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


def build_recipe_prompt(dish_name: str, include_youtube: bool = True) -> str:
    youtube_line = (
        "Add one short video note only if a trustworthy real link is available."
        if include_youtube
        else "Do not mention videos."
    )
    return f"""
Create a short, useful recipe brief for "{dish_name}".

Return only a compact HTML fragment with this structure:
<div class="recipe-ai-block">
  <h3>Recipe overview</h3>
  <p>1-2 sentence summary.</p>
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
  <h4>Health notes</h4>
  <ul>...</ul>
  <h4>Video note</h4>
  <p>{youtube_line}</p>
</div>

If you are unsure, keep the answer simple and practical.
""".strip()


def build_nutrition_prompt(profile: dict, macros: dict, meals_list: list[str]) -> str:
    meals_str = "\n".join([f"- {meal}" for meal in meals_list]) if meals_list else "- None assigned yet"
    return f"""
Review this patient's meal plan against general WHO-style nutrition guidance.

Patient:
- Age: {profile.get('age', 'Unknown')}
- Height: {profile.get('height_cm', 'Unknown')} cm
- Weight: {profile.get('weight_kg', 'Unknown')} kg
- Condition: {profile.get('current_disease', 'None')}
- Treatment: {profile.get('treatment_status', 'None')}

Meals today:
{meals_str}

Planned totals:
- Calories: {macros['calories']} kcal
- Protein: {macros['protein']} g
- Carbs: {macros['carbs']} g
- Fat: {macros['fat']} g
- Fiber: {macros['fiber']} g

Return only HTML using this structure:
<div class='ai-nutrition'>
  <div class='ai-nutrition-top'>
    <div>
      <p class='ai-kicker'>Today's nutrition snapshot</p>
      <h3>WHO Nutrition Analysis</h3>
    </div>
    <button type='button' class='btn btn-ghost btn-sm ai-depth-toggle' onclick='toggleAiNutritionDetails(this)'>In Depth</button>
  </div>
  <p class='ai-summary'>One short summary sentence only.</p>
  <div class='nutrition-bars'>
    <div class='nutrition-metric'>
      <div class='nutrition-metric-head'><label>Calories</label><span>x%</span></div>
      <progress value='x' max='100'></progress>
      <p>x kcal vs target</p>
    </div>
    <div class='nutrition-metric'>
      <div class='nutrition-metric-head'><label>Protein</label><span>x%</span></div>
      <progress value='x' max='100'></progress>
      <p>x g vs target</p>
    </div>
    <div class='nutrition-metric'>
      <div class='nutrition-metric-head'><label>Carbs</label><span>x%</span></div>
      <progress value='x' max='100'></progress>
      <p>x g vs target</p>
    </div>
    <div class='nutrition-metric'>
      <div class='nutrition-metric-head'><label>Fat</label><span>x%</span></div>
      <progress value='x' max='100'></progress>
      <p>x g vs target</p>
    </div>
    <div class='nutrition-metric'>
      <div class='nutrition-metric-head'><label>Fiber</label><span>x%</span></div>
      <progress value='x' max='100'></progress>
      <p>x g vs target</p>
    </div>
    <div class='nutrition-metric'>
      <div class='nutrition-metric-head'><label>Sugar</label><span>x%</span></div>
      <progress value='x' max='100'></progress>
      <p>x g vs target</p>
    </div>
    <div class='nutrition-metric'>
      <div class='nutrition-metric-head'><label>Sodium</label><span>x%</span></div>
      <progress value='x' max='100'></progress>
      <p>x mg vs target</p>
    </div>
  </div>
  <div class='vitamin-grid'>
    <div class='vitamin-chip'><span>Vitamin A</span><strong>x%</strong></div>
    <div class='vitamin-chip'><span>Vitamin C</span><strong>x%</strong></div>
    <div class='vitamin-chip'><span>Vitamin D</span><strong>x%</strong></div>
    <div class='vitamin-chip'><span>Vitamin B12</span><strong>x%</strong></div>
    <div class='vitamin-chip'><span>Folate</span><strong>x%</strong></div>
    <div class='vitamin-chip'><span>Iron</span><strong>x%</strong></div>
    <div class='vitamin-chip'><span>Calcium</span><strong>x%</strong></div>
  </div>
  <div class='ai-depth-panel hidden'>
    <p class='ai-assess'>2-3 sentence explanation focused on accuracy, deficits, and excesses.</p>
    <ul class='ai-recs'>
      <li>2-4 practical adjustments.</li>
    </ul>
  </div>
</div>

After the HTML, include one JSON array wrapped in these exact markers:
<!--JSON_START-->
[{{"dish_name":"Example Dish","meal_type":"lunch","calories":320,"protein_g":18,"carbs_g":26,"fat_g":12,"fiber_g":7,"reason":"Short reason","is_vegetarian":true,"alternative_to":"Current lunch"}}]
<!--JSON_END-->

Rules for recommendations:
- Every recommendation must be vegetarian.
- Suggestions should be easy to cook or easy to source.
- Prefer alternatives that directly fix the biggest nutrient gaps.
- Keep the top summary visually compact and save the explanation for the hidden detail panel.
""".strip()


def extract_text_from_parts(parts: list[dict] | None) -> str:
    text_parts = []
    for part in parts or []:
        text = part.get("text")
        if text:
            text_parts.append(str(text))
    return "\n".join(text_parts).strip()


def extract_grounding_links(candidate: dict) -> list[dict]:
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
        source_html = (
            "<div class='recipe-source-block'>"
            "<h4>Recipe sources</h4>"
            f"<ul class='recipe-source-list'>{recipe_items}</ul>"
            "</div>"
        )

    if not source_html and not youtube_html:
        return ""

    return f"<div class='recipe-grounding-panel'>{youtube_html}{source_html}</div>"


def ensure_html_fragment(content: str, wrapper_class: str = "ai-fallback-text") -> str:
    stripped = (content or "").strip()
    if not stripped:
        raise ParseAIError("empty response")
    if "<" in stripped and ">" in stripped:
        return stripped
    return f"<div class='{wrapper_class}'><p>{escape(stripped)}</p></div>"


def clean_code_fences(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```html"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def find_json_candidates(text: str) -> list[str]:
    decoder = json.JSONDecoder()
    matches: list[str] = []
    for idx, char in enumerate(text):
        if char not in "[{":
            continue
        try:
            _, end = decoder.raw_decode(text[idx:])
            matches.append(text[idx:idx + end])
        except json.JSONDecodeError:
            continue
    return matches


def strip_tags(value: str) -> str:
    return re.sub(r"<[^>]+>", " ", value or "")


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def parse_json_payload(raw_text: str, expected_type: str) -> Any:
    cleaned = clean_code_fences(raw_text)
    candidates = [cleaned, *find_json_candidates(cleaned)]
    for candidate in candidates:
        if not candidate:
            continue
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if expected_type == "array" and isinstance(parsed, list):
            return parsed
        if expected_type == "object" and isinstance(parsed, dict):
            return parsed
    raise ParseAIError(f"invalid {expected_type} response")


def parse_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def normalize_meal_type(value: Any, default: str = "lunch") -> str:
    meal_type = str(value or default).strip().lower()
    return meal_type if meal_type in MEAL_TYPES else default


def normalize_meal_candidate(item: dict) -> dict | None:
    dish_name = str(item.get("dish_name", "")).strip()
    if not dish_name:
        return None
    description = str(item.get("description") or item.get("reason") or "").strip()
    return {
        "dish_name": dish_name,
        "description": description,
        "meal_type": normalize_meal_type(item.get("meal_type")),
        "calories": parse_int(item.get("calories", 0)),
        "protein_g": round(parse_float(item.get("protein_g", 0.0)), 1),
        "carbs_g": round(parse_float(item.get("carbs_g", 0.0)), 1),
        "fat_g": round(parse_float(item.get("fat_g", 0.0)), 1),
        "fiber_g": round(parse_float(item.get("fiber_g", 0.0)), 1),
        "reason": str(item.get("reason", "")).strip(),
        "is_vegetarian": bool(item.get("is_vegetarian", True)),
        "alternative_to": str(item.get("alternative_to", "")).strip(),
    }


def extract_actionable_meals(raw_text: str) -> list[dict]:
    marker_match = re.search(
        r"<!--JSON_START-->\s*(.*?)\s*<!--JSON_END-->",
        raw_text or "",
        flags=re.DOTALL,
    )
    payload = marker_match.group(1) if marker_match else raw_text
    meals = []
    try:
        parsed = parse_json_payload(payload, "array")
        for item in parsed:
            if isinstance(item, dict):
                normalized = normalize_meal_candidate(item)
                if normalized:
                    meals.append(normalized)
    except ParseAIError:
        for candidate in find_json_candidates(clean_code_fences(payload)):
            try:
                item = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            if isinstance(item, dict):
                normalized = normalize_meal_candidate(item)
                if normalized:
                    meals.append(normalized)

    unique_meals = []
    seen = set()
    for meal in meals:
        key = (meal["dish_name"].lower(), meal["meal_type"])
        if key in seen:
            continue
        seen.add(key)
        unique_meals.append(meal)
    return unique_meals[:3]


def strip_hidden_json(raw_html: str) -> str:
    return re.sub(
        r"<!--JSON_START-->\s*.*?\s*<!--JSON_END-->",
        "",
        raw_html or "",
        flags=re.DOTALL,
    ).strip()


def append_inside_root(html_fragment: str, addition: str) -> str:
    stripped = html_fragment.strip()
    if stripped.endswith("</div>"):
        return re.sub(r"</div>\s*$", f"{addition}</div>", stripped, count=1)
    return f"{stripped}{addition}"


def extract_percentage_map(raw_text: str, labels: list[str]) -> dict[str, int]:
    text = strip_hidden_json(raw_text)
    values = {}
    for label in labels:
        pattern = re.compile(rf"{re.escape(label)}\s*[:\-]?\s*(\d{{1,3}})%", re.IGNORECASE)
        match = pattern.search(text)
        if match:
            values[label] = max(0, min(100, parse_int(match.group(1), 0)))
    return values


def extract_list_items(raw_text: str) -> list[str]:
    html_items = re.findall(r"<li[^>]*>(.*?)</li>", raw_text or "", flags=re.IGNORECASE | re.DOTALL)
    cleaned_html_items = [normalize_whitespace(strip_tags(item)) for item in html_items]
    cleaned_html_items = [item for item in cleaned_html_items if item]
    if cleaned_html_items:
        return cleaned_html_items

    plain = normalize_whitespace(strip_tags(strip_hidden_json(raw_text)))
    if not plain:
        return []
    candidates = re.split(r"(?<=[.!?])\s+", plain)
    items = []
    for candidate in candidates:
        line = candidate.strip(" -\t")
        if not line:
            continue
        if line == "WHO Nutrition Analysis":
            continue
        if any(re.search(rf"{re.escape(label)}\s*\d{{1,3}}%", line, re.IGNORECASE) for label in PRIMARY_NUTRIENTS):
            continue
        if line.startswith("[") or line.startswith("{"):
            continue
        items.append(line)
    return items


def split_summary_and_detail(raw_text: str) -> tuple[str, str]:
    plain = normalize_whitespace(strip_tags(strip_hidden_json(raw_text)))
    for label in PRIMARY_NUTRIENTS:
        plain = re.sub(rf"{re.escape(label)}\s*(\d{{1,3}})%", "", plain, flags=re.IGNORECASE)
    plain = re.sub(r"\[\s*{.*", "", plain).strip()
    plain = plain.replace("WHO Nutrition Analysis", "").strip()
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", plain) if part.strip()]
    if not sentences:
        return (
            "Your tracked meals were analyzed against a general WHO-style nutrition target.",
            "The model did not provide a clean written explanation, so this card is showing the parsed nutrient summary only.",
        )
    summary = sentences[0]
    detail = " ".join(sentences[:3])
    return summary, detail


def build_metric_cards_html(percentages: dict[str, int]) -> str:
    cards = []
    for label in PRIMARY_NUTRIENTS:
        value = percentages.get(label, 0)
        cards.append(
            "<div class='nutrition-metric'>"
            f"<div class='nutrition-metric-head'><label>{escape(label)}</label><span>{value}%</span></div>"
            f"<progress value='{value}' max='100'></progress>"
            f"<p>{value}% of the estimated target</p>"
            "</div>"
        )
    return "".join(cards)


def build_vitamin_cards_html(percentages: dict[str, int]) -> str:
    cards = []
    for label in MICRONUTRIENTS:
        if label in percentages:
            value = f"{percentages[label]}%"
        else:
            value = "AI est."
        cards.append(
            "<div class='vitamin-chip'>"
            f"<span>{escape(label)}</span><strong>{escape(value)}</strong>"
            "</div>"
        )
    return "".join(cards)


def build_recommendation_list_html(items: list[str]) -> str:
    if not items:
        items = [
            "Add one vegetarian protein source to raise protein intake without making the plan heavy.",
            "Use fruit, unsalted nuts, or roasted chickpeas instead of salty packaged snacks.",
        ]
    return "".join(f"<li>{escape(item)}</li>" for item in items[:4])


def build_rule_based_actionable_meals(primary: dict[str, int], micro: dict[str, int]) -> list[dict]:
    suggestions: list[dict] = []

    def add(meal: dict):
        normalized = normalize_meal_candidate(meal)
        if normalized and all(existing["dish_name"] != normalized["dish_name"] for existing in suggestions):
            suggestions.append(normalized)

    if primary.get("Protein", 100) < 80:
        add({
            "dish_name": "Moong Dal Khichdi Bowl",
            "meal_type": "lunch",
            "calories": 380,
            "protein_g": 18,
            "carbs_g": 52,
            "fat_g": 9,
            "fiber_g": 10,
            "reason": "Easy vegetarian protein to close the protein gap.",
            "is_vegetarian": True,
        })
    if primary.get("Fiber", 100) < 80 or micro.get("Iron", 100) < 80 or micro.get("Folate", 100) < 80:
        add({
            "dish_name": "Spinach Chickpea Salad",
            "meal_type": "dinner",
            "calories": 320,
            "protein_g": 14,
            "carbs_g": 34,
            "fat_g": 11,
            "fiber_g": 11,
            "reason": "Helps with fiber, iron, and folate using vegetarian ingredients.",
            "is_vegetarian": True,
        })
    if micro.get("Calcium", 100) < 80 or micro.get("Vitamin B12", 100) < 80:
        add({
            "dish_name": "Paneer Veggie Wrap",
            "meal_type": "lunch",
            "calories": 410,
            "protein_g": 22,
            "carbs_g": 32,
            "fat_g": 18,
            "fiber_g": 7,
            "reason": "Adds calcium and a stronger vegetarian protein source.",
            "is_vegetarian": True,
        })
    if primary.get("Calories", 100) < 70:
        add({
            "dish_name": "Peanut Banana Oats Smoothie",
            "meal_type": "breakfast",
            "calories": 350,
            "protein_g": 15,
            "carbs_g": 38,
            "fat_g": 14,
            "fiber_g": 6,
            "reason": "Easy way to lift total calories with a vegetarian add-on.",
            "is_vegetarian": True,
        })
    return suggestions[:3]


def render_nutrition_dashboard(raw_text: str) -> str:
    primary = extract_percentage_map(raw_text, PRIMARY_NUTRIENTS)
    micro = extract_percentage_map(raw_text, MICRONUTRIENTS)
    summary, detail = split_summary_and_detail(raw_text)
    recommendations = extract_list_items(raw_text)
    return f"""
<div class='ai-nutrition'>
  <div class='ai-nutrition-top'>
    <div>
      <p class='ai-kicker'>Today's nutrition snapshot</p>
      <h3>WHO Nutrition Analysis</h3>
    </div>
    <button type='button' class='btn btn-ghost btn-sm ai-depth-toggle' onclick='toggleAiNutritionDetails(this)'>In Depth</button>
  </div>
  <p class='ai-summary'>{escape(summary)}</p>
  <div class='nutrition-bars'>
    {build_metric_cards_html(primary)}
  </div>
  <div class='vitamin-grid'>
    {build_vitamin_cards_html(micro)}
  </div>
  <div class='ai-depth-panel hidden'>
    <p class='ai-assess'>{escape(detail)}</p>
    <ul class='ai-recs'>
      {build_recommendation_list_html(recommendations)}
    </ul>
  </div>
</div>
""".strip()


def build_quick_add_html(actionable_meals: list[dict], plan_date: str | None) -> str:
    if not actionable_meals:
        return ""

    forms = []
    for meal in actionable_meals:
        meal_json = escape(json.dumps(meal), quote=True)
        date_input = ""
        if plan_date:
            date_input = f"<input type='hidden' name='plan_date' value='{escape(plan_date)}'>"
        badges = ["<span class='ai-rec-badge ai-rec-badge-veg'>Vegetarian</span>"]
        if meal.get("alternative_to"):
            badges.append(f"<span class='ai-rec-badge'>Alt for {escape(meal['alternative_to'])}</span>")
        reason_html = ""
        if meal.get("reason"):
            reason_html = f"<p class='ai-rec-reason'>{escape(meal['reason'])}</p>"
        forms.append(
            "<form class='quick-add-form ai-rec-card' hx-post='/dietplan/meal/quick_add' "
            "hx-target='#quick-add-msg' hx-swap='innerHTML'>"
            f"<input type='hidden' name='meal_json' value='{meal_json}'>"
            f"{date_input}"
            "<div class='ai-rec-card-top'>"
            f"<div><h4>{escape(meal['dish_name'])}</h4>{reason_html}</div>"
            f"<div class='ai-rec-badges'>{''.join(badges)}</div>"
            "</div>"
            "<div class='ai-rec-macros'>"
            f"<span>{meal['calories']} kcal</span>"
            f"<span>P {meal['protein_g']}g</span>"
            f"<span>C {meal['carbs_g']}g</span>"
            f"<span>F {meal['fat_g']}g</span>"
            "</div>"
            "<button type='submit' class='btn btn-sm btn-primary'>Add to today's plan</button>"
            "</form>"
        )

    joined_forms = "".join(forms)
    return (
        "<div class='ai-quick-add'>"
        "<p class='ai-quick-add-title'>Vegetarian recommendations you can add right now</p>"
        f"<div class='ai-quick-add-actions'>{joined_forms}</div>"
        "<div id='quick-add-msg'></div>"
        "</div>"
    )


def build_recipe_unavailable_html(dish_name: str) -> str:
    return (
        "<div class='recipe-ai-block'>"
        "<h3>Recipe overview</h3>"
        f"<p>AI recipe details for {escape(dish_name)} are unavailable right now.</p>"
        "<h4>What to do next</h4>"
        "<ul><li>Try again in a moment.</li><li>Use the dish description and macros already shown on the dashboard.</li></ul>"
        "</div>"
    )


def build_nutrition_fallback_html(macros: dict, meals_list: list[str]) -> str:
    meal_items = "".join(f"<li>{escape(item)}</li>" for item in meals_list[:5]) or "<li>No meals planned yet.</li>"
    return f"""
<div class='ai-nutrition'>
  <div class='ai-nutrition-top'>
    <div>
      <p class='ai-kicker'>Today's nutrition snapshot</p>
      <h3>WHO Nutrition Analysis</h3>
    </div>
    <button type='button' class='btn btn-ghost btn-sm ai-depth-toggle' onclick='toggleAiNutritionDetails(this)'>In Depth</button>
  </div>
  <p class='ai-summary'>Live AI guidance is unavailable, so this view is showing a clean summary of today's tracked nutrition only.</p>
  <div class='nutrition-bars'>
    <div class='nutrition-metric'><div class='nutrition-metric-head'><label>Calories</label><span>Tracked</span></div><progress value='100' max='100'></progress><p>{escape(str(macros['calories']))} kcal logged</p></div>
    <div class='nutrition-metric'><div class='nutrition-metric-head'><label>Protein</label><span>Tracked</span></div><progress value='100' max='100'></progress><p>{escape(str(round(macros['protein'], 1)))} g logged</p></div>
    <div class='nutrition-metric'><div class='nutrition-metric-head'><label>Carbs</label><span>Tracked</span></div><progress value='100' max='100'></progress><p>{escape(str(round(macros['carbs'], 1)))} g logged</p></div>
    <div class='nutrition-metric'><div class='nutrition-metric-head'><label>Fat</label><span>Tracked</span></div><progress value='100' max='100'></progress><p>{escape(str(round(macros['fat'], 1)))} g logged</p></div>
    <div class='nutrition-metric'><div class='nutrition-metric-head'><label>Fiber</label><span>Tracked</span></div><progress value='100' max='100'></progress><p>{escape(str(round(macros['fiber'], 1)))} g logged</p></div>
  </div>
  <div class='vitamin-grid'>
    <div class='vitamin-chip'><span>Vitamin A</span><strong>AI needed</strong></div>
    <div class='vitamin-chip'><span>Vitamin C</span><strong>AI needed</strong></div>
    <div class='vitamin-chip'><span>Vitamin D</span><strong>AI needed</strong></div>
    <div class='vitamin-chip'><span>Vitamin B12</span><strong>AI needed</strong></div>
    <div class='vitamin-chip'><span>Iron</span><strong>AI needed</strong></div>
    <div class='vitamin-chip'><span>Calcium</span><strong>AI needed</strong></div>
  </div>
  <div class='ai-depth-panel hidden'>
    <p class='ai-assess'>Review meal balance manually and try the AI analysis again later.</p>
    <ul class='ai-recs'>
      <li>Focus on protein, fiber, and hydration as a simple fallback rule.</li>
      <li>Consider adding a vegetarian protein source and leafy vegetables if the day looks light.</li>
    </ul>
    <div class='ai-meal-fallback'><strong>Meals today</strong><ul>{meal_items}</ul></div>
  </div>
</div>
""".strip()


def get_retryable_reason(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code}"
    if isinstance(exc, httpx.TimeoutException):
        return "timeout"
    if isinstance(exc, httpx.RequestError):
        return "connection error"
    return str(exc)


def log_attempt(feature_name: str, model: dict, started_at: float, exc: Exception):
    provider = model.get("provider", "unknown")
    model_id = model.get("model_id", "unknown")
    elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    print(
        f"[AI][{feature_name}] {provider}:{model_id} failed after {elapsed_ms}ms"
        f" ({get_retryable_reason(exc)})"
    )


def get_endpoint_and_headers(model: dict) -> tuple[str, dict]:
    provider = model["provider"]
    api_key = get_api_key(model)
    headers = {"Content-Type": "application/json"}

    if provider == "groq":
        headers["Authorization"] = f"Bearer {api_key}"
        return GROQ_API_URL, headers
    if provider == "openrouter":
        headers["Authorization"] = f"Bearer {api_key}"
        headers["HTTP-Referer"] = os.environ.get("APP_URL", "http://localhost:8000")
        headers["X-Title"] = "Diet Plan Dashboard"
        return OPENROUTER_API_URL, headers
    if provider == "gemini":
        headers["x-goog-api-key"] = api_key
        return GEMINI_API_URL_TEMPLATE.format(model_id=model["model_id"]), headers
    raise RetryableAIError(f"unsupported provider {provider}")


def build_payload(
    model: dict,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
    enable_grounding: bool = False,
) -> dict:
    if model["provider"] == "gemini":
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if enable_grounding and bool(model.get("search_grounding", 1)):
            payload["tools"] = [{"google_search": {}}]
        return payload

    return {
        "model": model["model_id"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }


def extract_model_text(model: dict, data: dict) -> str:
    if model["provider"] == "gemini":
        candidates = data.get("candidates") or []
        if not candidates:
            raise ParseAIError("empty candidates")
        return extract_text_from_parts((candidates[0].get("content") or {}).get("parts") or [])

    choices = data.get("choices") or []
    if not choices:
        raise ParseAIError("empty choices")
    message = choices[0].get("message") or {}
    content = message.get("content", "")
    if isinstance(content, list):
        content = "\n".join(
            item.get("text", "")
            for item in content
            if isinstance(item, dict) and item.get("text")
        )
    return str(content or "").strip()


async def call_model(
    feature_name: str,
    model: dict,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
    enable_grounding: bool = False,
) -> tuple[str, dict]:
    api_url, headers = get_endpoint_and_headers(model)
    payload = build_payload(
        model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        enable_grounding=enable_grounding,
    )

    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        raw_text = extract_model_text(model, data)
        if not raw_text.strip():
            raise ParseAIError("empty text")
        return raw_text, data
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in RETRYABLE_STATUS_CODES or exc.response.status_code >= 400:
            raise RetryableAIError(get_retryable_reason(exc)) from exc
        raise
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        raise RetryableAIError(get_retryable_reason(exc)) from exc


async def run_with_failover(
    feature_name: str,
    system_prompt: str,
    user_prompt: str,
    parser: Callable[[str, dict], Any],
    temperature: float = 0.2,
    max_tokens: int = 1200,
    enable_grounding: bool = False,
) -> tuple[Any | None, dict | None]:
    models = await get_candidate_models()
    for model in models:
        started_at = time.perf_counter()
        try:
            raw_text, data = await call_model(
                feature_name=feature_name,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                enable_grounding=enable_grounding,
            )
            parsed = parser(raw_text, data)
            if parsed is None:
                raise ParseAIError("parser returned no result")
            return parsed, model
        except (RetryableAIError, ParseAIError) as exc:
            log_attempt(feature_name, model, started_at, exc)
            continue
        except Exception as exc:
            log_attempt(feature_name, model, started_at, exc)
            continue
    return None, None


def parse_recipe_response(dish_name: str, include_youtube: bool) -> Callable[[str, dict], str]:
    def parser(raw_text: str, data: dict) -> str:
        recipe_html = ensure_html_fragment(raw_text, wrapper_class="recipe-ai-block")
        if include_youtube:
            candidates = data.get("candidates") or []
            if candidates:
                grounding_html = build_grounding_panel(
                    dish_name,
                    extract_grounding_links(candidates[0]),
                    include_youtube,
                )
                if grounding_html:
                    recipe_html = f"{recipe_html}{grounding_html}"
        return recipe_html

    return parser


def parse_nutrition_response(raw_text: str, _: dict) -> dict:
    primary = extract_percentage_map(raw_text, PRIMARY_NUTRIENTS)
    micro = extract_percentage_map(raw_text, MICRONUTRIENTS)
    html_fragment = render_nutrition_dashboard(raw_text)
    try:
        meals = extract_actionable_meals(raw_text)
    except ParseAIError:
        meals = []
    if not meals:
        meals = build_rule_based_actionable_meals(primary, micro)
    return {"html": html_fragment, "meals": meals}


def parse_json_array_response(normalizer: Callable[[dict], dict | None]) -> Callable[[str, dict], list[dict]]:
    def parser(raw_text: str, _: dict) -> list[dict]:
        parsed = parse_json_payload(raw_text, "array")
        normalized = []
        for item in parsed:
            if isinstance(item, dict):
                value = normalizer(item)
                if value:
                    normalized.append(value)
        if not normalized:
            raise ParseAIError("no valid array items")
        return normalized

    return parser


def parse_json_object_response(normalizer: Callable[[dict], dict]) -> Callable[[str, dict], dict]:
    def parser(raw_text: str, _: dict) -> dict:
        parsed = parse_json_payload(raw_text, "object")
        normalized = normalizer(parsed)
        if not normalized:
            raise ParseAIError("invalid object")
        return normalized

    return parser


def normalize_screening_result(raw: dict, meal: dict) -> dict:
    is_safe = bool(raw.get("is_safe", True))
    reason = str(raw.get("reason", "")).strip()
    fixed = raw.get("auto_fixed_meal")
    normalized = {"is_safe": is_safe, "reason": reason}
    if isinstance(fixed, dict):
        fixed_candidate = normalize_meal_candidate({
            **meal,
            **fixed,
            "meal_type": meal.get("meal_type", "lunch"),
        })
        if fixed_candidate:
            normalized["auto_fixed_meal"] = fixed_candidate
    return normalized


def normalize_classification(raw: dict, reason: str) -> dict:
    cleaned = str(raw.get("cleaned_preference") or reason).strip() or reason
    return {
        "is_permanent": bool(raw.get("is_permanent", True)),
        "cleaned_preference": cleaned,
    }


async def query_ai(dish_name: str) -> str:
    candidates = await get_candidate_models()
    if not candidates:
        return "<p class='error'>No configured AI model with an API key is available.</p>"

    for candidate in candidates:
        cached = await get_cached_recipe(dish_name, candidate["model_id"])
        if cached:
            return cached

    include_youtube = bool(candidates[0].get("include_youtube", 1))
    system_prompt = (
        "You are a practical cooking assistant. "
        "Return only clean HTML. Keep the structure exact and keep the advice concise."
    )
    result, winning_model = await run_with_failover(
        feature_name="recipe",
        system_prompt=system_prompt,
        user_prompt=build_recipe_prompt(dish_name, include_youtube),
        parser=parse_recipe_response(dish_name, include_youtube),
        temperature=0.2,
        max_tokens=1800,
        enable_grounding=True,
    )

    if not result:
        return build_recipe_unavailable_html(dish_name)

    if winning_model:
        await cache_recipe(dish_name, winning_model["model_id"], result)
    return result


async def evaluate_nutrition(
    profile: dict,
    macros: dict,
    meals_list: list[str],
    plan_date: str | None = None,
) -> str:
    system_prompt = (
        "You are a careful clinical nutrition assistant. "
        "Return predictable HTML followed by one JSON array wrapped in the requested markers."
    )
    result, _ = await run_with_failover(
        feature_name="nutrition",
        system_prompt=system_prompt,
        user_prompt=build_nutrition_prompt(profile, macros, meals_list),
        parser=parse_nutrition_response,
        temperature=0.1,
        max_tokens=1800,
    )
    if not result:
        return build_nutrition_fallback_html(macros, meals_list)

    html_fragment = result["html"]
    quick_add_html = build_quick_add_html(result["meals"], plan_date)
    if quick_add_html:
        html_fragment = append_inside_root(html_fragment, quick_add_html)
    return html_fragment


async def get_rule_based_alternatives(meal: dict) -> list[dict]:
    db = await get_db()
    meal_type = normalize_meal_type(meal.get("meal_type"))
    current_name = str(meal.get("dish_name", "")).strip()
    alternatives = []

    cursor = db.dishes.find({
        "meal_type": meal_type,
        "dish_name": {"$ne": current_name},
    }).limit(3)
    for item in await cursor.to_list(length=3):
        normalized = normalize_meal_candidate(item)
        if normalized:
            alternatives.append(normalized)

    if alternatives:
        return alternatives

    cursor = db.meal_plans.find({
        "meal_type": meal_type,
        "dish_name": {"$ne": current_name},
    }).sort([("created_at", -1)]).limit(3)
    for item in await cursor.to_list(length=3):
        normalized = normalize_meal_candidate(item)
        if normalized:
            alternatives.append(normalized)
    return alternatives[:3]


async def suggest_meal_alternatives(profile: dict, meal: dict, reason: str) -> list[dict]:
    prefs = profile.get("permanent_preferences", [])
    prefs_str = ", ".join(prefs) if prefs else "None"
    prompt = f"""
Suggest 3 healthy meal replacements.

Patient:
- Age: {profile.get('age', 'Unknown')}
- Disease: {profile.get('current_disease', 'None')}
- Treatment: {profile.get('treatment_status', 'None')}
- Allergies or permanent preferences: {prefs_str}

Current meal: {meal['dish_name']} ({meal['meal_type']})
Reason for replacement: {reason}

Return only a JSON array of 3 objects with:
- dish_name
- description
- meal_type
- calories
- protein_g
- carbs_g
- fat_g
- fiber_g
""".strip()

    result, _ = await run_with_failover(
        feature_name="meal_replace",
        system_prompt=(
            "You are a nutrition planning assistant. "
            "Return only a raw JSON array. Keep dishes realistic and medically cautious."
        ),
        user_prompt=prompt,
        parser=parse_json_array_response(normalize_meal_candidate),
        temperature=0.1,
        max_tokens=1200,
    )
    if result:
        return result[:3]
    return await get_rule_based_alternatives(meal)


async def screen_admin_meal(profile: dict, meal: dict) -> dict:
    prefs = profile.get("permanent_preferences", [])
    if not prefs and not profile.get("current_disease") and not profile.get("treatment_status"):
        return {"is_safe": True}

    prefs_str = ", ".join(prefs) if prefs else "None"
    prompt = f"""
Review this meal for medical fit.

Patient:
- Age: {profile.get('age', 'Unknown')}
- Disease: {profile.get('current_disease', 'None')}
- Treatment: {profile.get('treatment_status', 'None')}
- Allergies or permanent preferences: {prefs_str}

Meal:
- Dish: {meal['dish_name']}
- Description: {meal.get('description', '')}
- Calories: {meal.get('calories', 0)}
- Protein: {meal.get('protein_g', 0)}
- Carbs: {meal.get('carbs_g', 0)}
- Fat: {meal.get('fat_g', 0)}
- Fiber: {meal.get('fiber_g', 0)}

Return only one JSON object:
{{"is_safe": true}}
or
{{"is_safe": false, "reason": "short reason", "auto_fixed_meal": {{"dish_name": "...", "description": "...", "meal_type": "{normalize_meal_type(meal.get('meal_type'))}", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0}}}}
""".strip()

    result, _ = await run_with_failover(
        feature_name="admin_screen",
        system_prompt=(
            "You are a cautious nutrition safety reviewer. "
            "Return only one raw JSON object."
        ),
        user_prompt=prompt,
        parser=parse_json_object_response(lambda raw: normalize_screening_result(raw, meal)),
        temperature=0.1,
        max_tokens=900,
    )
    if result:
        return result
    return {
        "is_safe": False,
        "reason": "AI screening could not verify this meal safely. Manual review is required.",
    }


async def classify_preference(reason: str, dish_name: str) -> dict:
    prompt = f"""
Classify this meal-avoidance reason.

Dish: {dish_name}
Reason: "{reason}"

Return only one JSON object:
{{"is_permanent": true, "cleaned_preference": "short permanent preference"}}
or
{{"is_permanent": false, "cleaned_preference": "short temporary reason"}}
""".strip()

    result, _ = await run_with_failover(
        feature_name="classify_preference",
        system_prompt=(
            "You are a dietary preference classifier. "
            "Return only one raw JSON object."
        ),
        user_prompt=prompt,
        parser=parse_json_object_response(lambda raw: normalize_classification(raw, reason)),
        temperature=0.0,
        max_tokens=500,
    )
    if result:
        return result
    return {"is_permanent": True, "cleaned_preference": reason.strip() or "Meal preference"}
