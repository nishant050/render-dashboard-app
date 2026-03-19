import os

p = r"c:\Users\nisha\OneDrive\Documents\Softwares\Coding\one page apps\render-dashboard-app\apps\DietPlan\main.py"
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()

old_block = """app = FastAPI(title="Diet Plan Dashboard", lifespan=lifespan)

# Static files & templates
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
templates.env.globals["timedelta"] = timedelta
templates.env.globals["date"] = date
templates.env.globals["str"] = str"""

new_block = """app = FastAPI(title="Diet Plan Dashboard", lifespan=lifespan, root_path="/dietplan")

# Static files & templates
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
templates.env.globals["base_url"] = "/dietplan"
templates.env.globals["timedelta"] = timedelta
templates.env.globals["date"] = date
templates.env.globals["str"] = str"""

c = c.replace(old_block, new_block)
with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print("Replaced successfully" if new_block in c else "Failed to find block")
