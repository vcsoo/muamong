from bs4 import BeautifulSoup
import re, pandas as pd

path = r'C:\Users\V\Downloads\이가영_5월.xls'

with open(path, 'rb') as f:
    raw = f.read()

for enc in ['euc-kr', 'utf-8', 'cp949']:
    try:
        text = raw.decode(enc)
        break
    except:
        continue

# 시트명 찾기
m1 = re.findall(r'<x:Name>(.*?)</x:Name>', text, re.IGNORECASE)
print("x:Name:", m1)

m2 = re.findall(r'ss:Name="([^"]+)"', text)
print("ss:Name:", m2[:5])

soup = BeautifulSoup(text, 'lxml')
print("title:", soup.title.string if soup.title else None)

# 모든 테이블 헤더 확인 (점판 구조 파악)
tables = pd.read_html(path, encoding='euc-kr')
df = tables[0]
print("\n=== 전체 행 (col0=메뉴명, col1=분류) ===")
for i, row in df.iterrows():
    print(f"  [{i:02d}] col0={str(row.iloc[0])[:20]:<22} col1={str(row.iloc[1])[:15]:<16} col4(금액)={row.iloc[4]}")
