import os
import re

base_dir = r"c:\Users\nisha\OneDrive\Documents\Softwares\Coding\one page apps\render-dashboard-app\apps\DietPlan\templates"

# Fix broken replacements from previous fuzzy patch application
fixes = {
    "admin_activity.html": [
        ('methx-post="{{ base_url }}/get"', 'method="get"'),
        ('onchx-get="{{ base_url }}/this.form.submit()"', 'onchange="this.form.submit()"'),
        ('class="activityhx-delete="{{ base_url }}/', 'class="activity-device"'),
    ],
    "admin_login.html": [
        ('method="hx-post="{{ base_url }}/', 'method="post"'),
    ],
    "admin_meals.html": [
        ('hx-get="{{ base_url }}/{{ base_url }}/admin/meal/save"', 'hx-post="{{ base_url }}/admin/meal/save"'),
    ]
}

for fname, reps in fixes.items():
    p = os.path.join(base_dir, fname)
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            content = f.read()
        for old, new in reps:
            content = content.replace(old, new)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(content)

# Regex replace for remaining un-prefixed URLs
patterns = [
    (re.compile(r'href="/'), r'href="{{ base_url }}/'),
    (re.compile(r'hx-get="/'), r'hx-get="{{ base_url }}/'),
    (re.compile(r'hx-post="/'), r'hx-post="{{ base_url }}/'),
    (re.compile(r'hx-delete="/'), r'hx-delete="{{ base_url }}/'),
    (re.compile(r'action="/'), r'action="{{ base_url }}/'),
    (re.compile(r'src="/'), r'src="{{ base_url }}/'),
]

files_to_process = os.listdir(base_dir)
for fname in files_to_process:
    if fname.endswith('.html'):
        p = os.path.join(base_dir, fname)
        with open(p, 'r', encoding='utf-8') as f:
            content = f.read()
        
        for pat, repl in patterns:
            content = pat.sub(repl, content)
            
        with open(p, 'w', encoding='utf-8') as f:
            f.write(content)

print("Done")
