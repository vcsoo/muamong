import re

with open(r'C:\muamong\salon_app\templates\index.html', encoding='utf-8') as f:
    html = f.read()

# 1. onclick에서 참조하는 함수명 목록
onclick_funcs = set(re.findall(r'onclick="(\w+)\(', html))
print('onclick 참조 함수:', sorted(onclick_funcs))

# 2. 정의된 함수명 목록
scripts = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
js = '\n'.join(scripts)
defined_funcs = set(re.findall(r'(?:async\s+)?function\s+(\w+)\s*\(', js))
print('정의된 함수:', sorted(defined_funcs))

# 3. onclick에 있지만 정의 안 된 함수
missing = onclick_funcs - defined_funcs
print('누락된 함수(onclick에는 있지만 정의 없음):', missing)

# 4. 혹시 filterDetail 남아있는지
filter_refs = [line.strip() for line in html.split('\n') if 'filterDetail' in line]
print('filterDetail 참조:', filter_refs[:5])
