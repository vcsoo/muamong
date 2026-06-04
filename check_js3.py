import re

with open(r'C:\muamong\salon_app\templates\index.html', encoding='utf-8') as f:
    html = f.read()

scripts = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
js = '\n'.join(scripts)
lines = js.split('\n')

# 전역 변수 선언 확인
print('=== 전역 변수 선언 ===')
for i, line in enumerate(lines, 1):
    s = line.strip()
    if s.startswith('let ') or s.startswith('const ') or s.startswith('var '):
        if i < 30 or 'history' in s.lower():
            print(f'L{i}: {s[:80]}')

# resetUploadZone 함수 확인
print('\n=== resetUploadZone ===')
for i, line in enumerate(lines, 1):
    if 'resetUploadZone' in line:
        print(f'L{i}: {line.strip()[:100]}')

# 에러 발생 가능한 null 접근 패턴
print('\n=== 초기 실행 시 null 가능성 ===')
top_level_access = []
in_func = False
depth = 0
for i, line in enumerate(lines, 1):
    stripped = line.strip()
    if re.match(r'(async\s+)?function\s+\w+|^\s*\w+\s*=\s*function|\w+\s*:\s*function', stripped):
        in_func = True
    depth += stripped.count('{') - stripped.count('}')
    if depth <= 0:
        in_func = False
        depth = 0
    if not in_func and 'document.getElementById' in stripped and '.value' in stripped:
        print(f'L{i}: {stripped[:100]}')
