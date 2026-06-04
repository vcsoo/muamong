import re

with open(r'C:\muamong\salon_app\templates\index.html', encoding='utf-8') as f:
    html = f.read()

scripts = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
js = '\n'.join(scripts)
lines = js.split('\n')

# 함수 정의 순서와 변수 선언 위치 매핑
print('=== 함수 정의 및 주요 변수 위치 ===')
for i, line in enumerate(lines, 1):
    s = line.strip()
    if re.match(r'(async\s+)?function\s+\w+', s) or s.startswith('let history') or s.startswith('const history'):
        print(f'L{i}: {s[:80]}')

# script 태그 위치 확인
print('\n=== script 태그 위치 ===')
for i, line in enumerate(html.split('\n'), 1):
    if '<script' in line or '</script' in line:
        print(f'HTML L{i}: {line.strip()[:80]}')
