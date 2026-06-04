import pandas as pd

# 1월(점판 있음) 점판 행 상세 확인
for fname, path in [('1월', r'C:\Users\V\Downloads\이가영_1월.xls'),
                    ('3월', r'C:\Users\V\Downloads\이가영_3월.xls')]:
    print(f'\n====== {fname} ======')
    df = pd.read_html(path, encoding='euc-kr')[0]

    print('전체 컬럼수:', len(df.columns))
    print('헤더행(row0):')
    for i, v in enumerate(df.iloc[0]):
        print(f'  col{i}: {v}')

    print('\n점판 관련 행 (col1에 점판 포함):')
    for i, row in df.iterrows():
        c1 = str(row.iloc[1])
        # 점판 관련 행 찾기 (바이트 기반)
        c1_bytes = c1.encode('utf-8', errors='ignore')
        if i > 0:
            # col1 raw bytes 확인
            raw = c1.encode('raw_unicode_escape')
            # 한글 여부 체크
            has_korean = any(ord(c) > 0x1000 for c in c1)
            print(f'  [{i:02d}] col0={str(row.iloc[0])[:15]} | col1={c1[:20]} | col4={row.iloc[4]} | has_korean={has_korean}')
            if has_korean and i > len(df)-5:
                break
