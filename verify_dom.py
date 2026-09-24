import re

with open('static/index.html', encoding='utf-8') as f:
    html = f.read()

for js_file in ['app.js', 'student.js', 'admin.js']:
    with open(f'static/js/{js_file}', encoding='utf-8') as f:
        js = f.read()
    ids = set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", js))
    # Some IDs are dynamically generated or inside other templates
    dynamic_or_ok = {'toast-container'}
    missing = [i for i in ids if f'id="{i}"' not in html and f"id='{i}'" not in html and i not in dynamic_or_ok]
    print(f"{js_file}: {len(ids)} unique IDs checked. Missing: {missing}")

print("\nDOM element ID verification completed.")
