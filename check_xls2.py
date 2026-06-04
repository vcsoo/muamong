import pandas as pd

# 모든 파일에서 col1(분류) 유니크값과 시트명 찾기
files = {
    '1월': r'C:\Users\V\Downloads\이가영_1월.xls',
    '2월': r'C:\Users\V\Downloads\이가영_2월.xls',
    '3월': r'C:\Users\V\Downloads\이가영_3월.xls',
    '4월': r'C:\Users\V\Downloads\이가영_4월.xls',
    '5월': r'C:\Users\V\Downloads\이가영_5월.xls',
}

for name, path in files.items():
    print(f'\n=== {name} ===')
    df = pd.read_html(path, encoding='euc-kr')[0]

    # col1 유니크값 (분류)
    cats = df.iloc[1:, 1].unique().tolist()
    print(f'  분류(col1) 유니크: {cats}')

    # col0 유니크값 (메뉴명 상위)
    menus = df.iloc[1:, 0].unique().tolist()
    print(f'  메뉴(col0) 유니크: {menus}')

# 시트명은 HTML 원본에서 다른 방법으로
import re
print('\n\n=== 시트명 탐색 ===')
for name, path in files.items():
    raw = open(path, 'rb').read()
    for enc in ['euc-kr', 'cp949', 'utf-8']:
        try:
            text = raw.decode(enc)
            break
        except:
            continue

    # 다양한 패턴으로 시트명 탐색
    patterns = [
        r'<title>(.*?)</title>',
        r'WorksheetSource.*?hr:ref="([^"]+)"',
        r'SheetTab.*?value="([^"]+)"',
        r'x:WorksheetSource.*?hr:ref=\'([^\']+)\'',
        r'<Sheet[^>]*Name="([^"]+)"',
        r'tab.*?title="([^"]+)"',
    ]
    found = []
    for pat in patterns:
        m = re.findall(pat, text, re.IGNORECASE)
        if m:
            found.extend(m[:2])
    print(f'  {name}: {found[:5] if found else "패턴 미발견"}')
    # 처음 500자 출력
    print(f'  첫500자: {repr(text[:300])}')
    print()
