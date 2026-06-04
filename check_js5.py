import re

with open(r'C:\muamong\salon_app\templates\index.html', encoding='utf-8') as f:
    html = f.read()

scripts = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
js = '\n'.join(scripts)
lines = js.split('\n')

# document.getElementById 가 null일 가능성 있는 초기 실행 코드 확인
# (함수 밖에서 직접 실행되는 코드만)
print('=== 함수 밖 실행 코드 ===')
depth = 0
for i, line in enumerate(lines, 1):
    s = line.strip()
    # 함수 진입
    if re.match(r'(async\s+)?function\s+\w+\s*\(', s):
        depth += 1
    # 화살표 함수 등 중괄호
    open_b  = s.count('{')
    close_b = s.count('}')
    if depth == 0 and s and not s.startswith('//') and not s.startswith('let ') and not s.startswith('const ') and not s.startswith('var ') and s != '':
        print(f'L{i}: {s[:100]}')
    depth = max(0, depth + open_b - close_b)
    if depth < 0:
        depth = 0
