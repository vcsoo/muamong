import re

# col2 1담당자 실제 값 바이트 확인 + 파일 앞부분 넓게 탐색
path = r'C:\Users\V\Downloads\이가영_1월.xls'
raw = open(path, 'rb').read()

# col2 unique 바이트값 decode
import pandas as pd
df = pd.read_html(path, encoding='euc-kr')[0]

print("=== col2 (1담당자) 값들 ===")
for v in df.iloc[1:, 2].unique():
    b = str(v).encode('euc-kr', errors='replace')
    try:
        print(f"  '{v}' -> decoded: '{b.decode('euc-kr')}'")
    except:
        print(f"  '{v}'")

print("\n=== col0 (메뉴명) 첫 5개 ===")
for v in df.iloc[1:6, 0]:
    print(f"  '{v}'")

# 파일 내 디자이너명 가능한 패턴 탐색 (이가영 = \xc0\xcc\xb0\xa1\xbf\xb5 in euc-kr)
name_bytes = '이가영'.encode('euc-kr')
print(f"\n'이가영' euc-kr bytes: {name_bytes.hex()}")
print(f"파일에서 발견: {name_bytes in raw}")

# 파일 앞 2000바이트 출력
print("\n=== 파일 앞부분 (euc-kr) ===")
head = raw[:2000].decode('euc-kr', errors='replace')
# 줄바꿈 기준으로 출력
for line in head.split('\n')[:40]:
    line = line.strip()
    if line:
        print(f"  {line[:120]}")
