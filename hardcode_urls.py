import os
import re

base_dir = r"c:\Users\nisha\OneDrive\Documents\Softwares\Coding\one page apps\render-dashboard-app\apps\DietPlan\templates"

files_to_process = os.listdir(base_dir)
for fname in files_to_process:
    if fname.endswith('.html'):
        p = os.path.join(base_dir, fname)
        with open(p, 'r', encoding='utf-8') as f:
            content = f.read()
        
        content = content.replace("{{ base_url }}/", "/dietplan/")
        content = content.replace("{{ base_url }}", "/dietplan")
            
        with open(p, 'w', encoding='utf-8') as f:
            f.write(content)

print("Hardcoded prefixes successfully")
