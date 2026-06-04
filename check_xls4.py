import re

# h1 내용과 디자이너명 패턴 찾기
for fname, path in [('1월', r'C:\Users\V\Downloads\이가영_1월.xls'),
                    ('5월', r'C:\Users\V\Downloads\이가영_5월.xls')]:
    raw = open(path, 'rb').read()
    text = raw.decode('euc-kr', errors='replace')

    # h1 태그 내용 바이트로 직접 추출
    h1_match = re.search(rb'<h1[^>]*>(.*?)</h1>', raw, re.DOTALL)
    if h1_match:
        h1_bytes = h1_match.group(1).strip()
        print(f'{fname} h1 raw bytes: {h1_bytes}')
        print(f'{fname} h1 euc-kr: {h1_bytes.decode("euc-kr", errors="replace")}')

    # "이가영" 을 euc-kr로 인코딩해서 파일에서 검색
    name_bytes = '이가영'.encode('euc-kr')
    if name_bytes in raw:
        # 이가영 주변 50바이트
        pos = raw.find(name_bytes)
        context = raw[max(0,pos-30):pos+60]
        print(f'{fname} "이가영" 발견 위치={pos}: {context.decode("euc-kr", errors="replace")}')
    else:
        print(f'{fname} "이가영" 미발견')

    # 컬럼2 (1담당자) 내용 확인
    import pandas as pd
    df = pd.read_html(path, encoding='euc-kr')[0]
    print(f'{fname} col2(1담당자) 유니크: {df.iloc[1:,2].unique()[:5].tolist()}')
    print(f'{fname} col3(2담당자) 유니크: {df.iloc[1:,3].unique()[:5].tolist()}')
    print()
