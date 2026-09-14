# Diet Plan Dashboard 🥗

A personalized daily meal planner with AI-powered recipe info, built with **FastAPI + Jinja2 + HTMX**.

## Features

- **User Profiles** — Just enter your name, no password needed
- **Device Auto-Login** — Your profile is remembered per device
- **Daily Meal Plans** — See today's meals, check off what you've prepared
- **AI Recipe Info** — Click any dish to get AI-generated recipe, nutrition, and cooking instructions
- **Weekly History** — Track which meals you prepared and missed
- **Admin Panel** — Upload meal plans via CSV/XLSX, manage AI models, track user activity
- **Mobile-First** — Optimized for mobile (users) and desktop (admin)

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
uvicorn main:app --reload --port 8000
```

Visit: http://localhost:8000

## Admin Access

- **URL:** /admin/login
- **Username:** admin
- **Password:** admin123

⚠️ Change the default password after first login!

## Environment Variables

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Your Groq API key for AI features |
| `OPENROUTER_API_KEY` | Your OpenRouter API key (free models available) |
| `DB_PATH` | SQLite database path (default: `dietplan.db`) |

## Deploy to Koyeb

1. Push to GitHub
2. Create a new Koyeb app → Docker
3. Set environment variables (API keys)
4. Deploy!

## Meal Plan Upload

1. Login to admin panel
2. Download CSV template
3. Fill in your meals
4. Upload the file

### CSV Format

```csv
plan_date,meal_type,dish_name,description,calories,protein_g,carbs_g,fat_g,fiber_g
2026-02-22,breakfast,Oatmeal with Berries,Warm oatmeal,350,12,55,8,6
```

**Valid meal_type values:** breakfast, morning_snack, lunch, afternoon_snack, dinner, evening_snack
