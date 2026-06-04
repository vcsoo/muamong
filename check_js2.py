import re

with open(r'C:\muamong\salon_app\templates\index.html', encoding='utf-8') as f:
    html = f.read()

scripts = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
js = '\n'.join(scripts)
lines = js.split('\n')

# 처음 15줄 (전역 초기화 코드)
print('=== 처음 15줄 ===')
for i, line in enumerate(lines[:15], 1):
    print(f'L{i}: {repr(line[:100])}')

# loadEmployees 호출 위치
print('\n=== loadEmployees 호출 ===')
for i, line in enumerate(lines, 1):
    if 'loadEmployees' in line and '()' in line and 'function' not in line:
        print(f'L{i}: {line.strip()}')

# 마지막 20줄
print('\n=== 마지막 20줄 ===')
for i, line in enumerate(lines[-20:], len(lines)-19):
    print(f'L{i}: {repr(line[:100])}')
