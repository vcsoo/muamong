with open(r'C:\muamong\salon_app\templates\index.html', encoding='utf-8') as f:
    lines = f.readlines()

script_line = None
sel_year_line = None
sel_month_line = None

for i, line in enumerate(lines, 1):
    if '<script>' in line and script_line is None:
        script_line = i
    if 'id="sel-year"' in line:
        sel_year_line = i
    if 'id="sel-month"' in line:
        sel_month_line = i

print(f'script tag: line {script_line}')
print(f'sel-year element: line {sel_year_line}')
print(f'sel-month element: line {sel_month_line}')
print(f'sel-year BEFORE script: {sel_year_line and sel_year_line < script_line}')

# script 태그 시작 주변 3줄
print('\n스크립트 태그 주변:')
for i in range(max(0, script_line-3), min(len(lines), script_line+3)):
    print(f'  L{i+1}: {lines[i].rstrip()[:80]}')

# 실제로 loadEmployees가 호출되는 마지막 라인
for i, line in enumerate(reversed(lines), 1):
    if 'loadEmployees()' in line:
        actual_line = len(lines) - i + 1
        print(f'\nloadEmployees() 마지막 호출: L{actual_line}: {line.strip()}')
        break

# 혹시 오류메시지 배너가 뜨는지 확인용 - 현재 페이지 HTML 가져오기
import urllib.request
html = urllib.request.urlopen('http://localhost:5050').read().decode('utf-8', errors='replace')
if 'JS 오류' in html or 'Promise 오류' in html:
    print('\n오류 배너 HTML에 포함됨!')
else:
    print('\n오류 배너 없음 (초기 HTML에 포함 안됨 - 동적 생성)')
print('HTML 길이:', len(html))
