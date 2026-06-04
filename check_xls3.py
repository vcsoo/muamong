import pandas as pd, re

# h1 타이틀과 분류 구조 상세 확인
for fname, path in [('5월', r'C:\Users\V\Downloads\이가영_5월.xls'),
                    ('1월', r'C:\Users\V\Downloads\이가영_1월.xls'),
                    ('3월', r'C:\Users\V\Downloads\이가영_3월.xls')]:
    raw = open(path, 'rb').read()
    text = raw.decode('euc-kr', errors='replace')

    # h1 타이틀 추출
    h1 = re.findall(r'<h1[^>]*>(.*?)</h1>', text, re.DOTALL)
    print(f'{fname} h1: {h1}')

    # 테이블 구조: col1 분류별로 행 정리
    df = pd.read_html(path, encoding='euc-kr')[0]
    print(f'{fname} 전체행 col1 목록:')
    for i, row in df.iterrows():
        c1 = str(row.iloc[1])
        c4 = row.iloc[4]
        print(f'  [{i:02d}] 분류={c1:<12} 금액={c4}')
    print()
