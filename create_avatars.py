import os

os.makedirs('static/images/avatars', exist_ok=True)

avatars = {
    'student1.svg': ('#3b82f6', '#1d4ed8', 'AV', 'Aman Verma'),
    'student2.svg': ('#ec4899', '#be185d', 'PS', 'Priya Sharma'),
    'student3.svg': ('#10b981', '#047857', 'RG', 'Rohan Gupta'),
    'student4.svg': ('#8b5cf6', '#6d28d9', 'AI', 'Ananya Iyer'),
    'student5.svg': ('#f59e0b', '#b45309', 'VP', 'Vikram Patel'),
    'default.svg': ('#64748b', '#334155', 'ST', 'Student'),
    'admin.svg': ('#0284c7', '#0369a1', 'ADM', 'Admin Officer')
}

for filename, (c1, c2, initials, name) in avatars.items():
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="bg_{initials}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{c1}"/>
      <stop offset="100%" stop-color="{c2}"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="url(#bg_{initials})" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
  <text x="50" y="58" font-family="'Segoe UI', -apple-system, sans-serif" font-size="32" font-weight="bold" fill="#ffffff" text-anchor="middle">{initials}</text>
</svg>"""
    with open(os.path.join('static', 'images', 'avatars', filename), 'w', encoding='utf-8') as f:
        f.write(svg)

print("Avatars created!")
