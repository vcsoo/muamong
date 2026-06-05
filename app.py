import json
import os
import re
from datetime import datetime
from io import BytesIO
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, render_template, request, send_file

app = Flask(__name__)
_data_dir = Path(os.environ.get('DATA_DIR', str(Path(__file__).parent / 'data')))
_data_dir.mkdir(parents=True, exist_ok=True)
(Path(__file__).parent / 'uploads').mkdir(parents=True, exist_ok=True)

app.config['UPLOAD_FOLDER'] = Path(__file__).parent / 'uploads'
app.config['DATA_FILE']     = _data_dir / 'employees.json'
app.config['SALARY_FILE']   = _data_dir / 'salary_records.json'

# ── 직원 데이터 ───────────────────────────────────────────────────────────────

def load_employees():
    f = app.config['DATA_FILE']
    return json.loads(f.read_text(encoding='utf-8')) if f.exists() else []

def save_employees(data):
    app.config['DATA_FILE'].write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

# ── 급여 기록 ─────────────────────────────────────────────────────────────────

def load_salary_records():
    f = app.config['SALARY_FILE']
    return json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}

def save_salary_records(data):
    app.config['SALARY_FILE'].write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

# ── XLS 파싱 ──────────────────────────────────────────────────────────────────

MONTH_MAP = {f'{i}월': i for i in range(1, 13)}

def parse_filename(filename):
    stem = Path(filename).stem
    m = re.match(r'^(.+?)_(\d{1,2}월)$', stem)
    if m:
        return m.group(1), MONTH_MAP.get(m.group(2), 0), datetime.now().year
    return None, 0, datetime.now().year

def _to_int(val):
    try:
        s = str(val).replace(',', '').strip()
        return int(float(s)) if s not in ('nan', '-', '', 'None') else 0
    except:
        return 0

def parse_sales_xls(filepath):
    filename = Path(filepath).name
    emp_name, month, year = parse_filename(filename)

    df = pd.read_html(filepath, encoding='euc-kr')[0]

    def cat_type(val):
        s = str(val)
        if '점판소계' in s: return 'subtotal_product'
        if '시술소계' in s: return 'subtotal_service'
        if '합계소계' in s: return 'subtotal_all'
        if '합계'    in s: return 'total'
        if '점판'    in s: return 'product'
        if '시술'    in s: return 'service'
        return 'other'

    total_row = df.iloc[-1]
    service_rows, product_rows = [], []
    service_sub = product_sub = None

    for _, row in df.iloc[1:].iterrows():
        t = cat_type(str(row.iloc[1]))
        if   t == 'service':          service_rows.append(row)
        elif t == 'product':          product_rows.append(row)
        elif t == 'subtotal_service': service_sub = row
        elif t == 'subtotal_product': product_sub = row

    def sub(r, i): return _to_int(r.iloc[i]) if r is not None else 0

    def row_detail(row, kind):
        # col0 = 담당자명(가영) → 사용 안 함
        # col2 = 대분류(컷/펌/헤어케어...)
        # col3 = 실제 메뉴/상품명(미니펌/나들이헤어마스크...)
        main_cat = str(row.iloc[2]).strip()
        detail   = str(row.iloc[3]).strip()
        # 대분류와 상세명이 같으면 하나만, 다르면 "대분류 - 상세" 형식
        if main_cat and detail and main_cat != detail:
            menu_name = f"{main_cat} - {detail}"
        else:
            menu_name = detail or main_cat
        return {
            'menu':      menu_name,
            'category':  kind,
            'amount':    _to_int(row.iloc[4]),
            'count':     _to_int(row.iloc[5]),
            'cash':      _to_int(row.iloc[9]),
            'card':      _to_int(row.iloc[10]),
            'bank':      _to_int(row.iloc[11]),
            'pay':       _to_int(row.iloc[12]),
            'avg_price': _to_int(row.iloc[19]),
        }

    details = (
        [row_detail(r, 'service') for r in service_rows if _to_int(r.iloc[4]) > 0] +
        [row_detail(r, 'product') for r in product_rows if _to_int(r.iloc[4]) > 0]
    )

    original_stem = Path(filepath).stem   # e.g. 이가영_1월

    return {
        'emp_name':     emp_name,
        'month':        month,
        'year':         year,
        'xls_filename': original_stem,     # PDF 다운로드 파일명에 사용
        'total':          _to_int(total_row.iloc[4]),
        'count':          _to_int(total_row.iloc[5]),
        'cash':           _to_int(total_row.iloc[9]),
        'card':           _to_int(total_row.iloc[10]),
        'bank':           _to_int(total_row.iloc[11]),
        'pay':            _to_int(total_row.iloc[12]),
        'service_total':  sub(service_sub, 4),
        'service_count':  sub(service_sub, 5),
        'service_cash':   sub(service_sub, 9),
        'service_card':   sub(service_sub, 10),
        'service_bank':   sub(service_sub, 11),
        'service_pay':    sub(service_sub, 12),
        'product_total':  sub(product_sub, 4),
        'product_count':  sub(product_sub, 5),
        'product_cash':   sub(product_sub, 9),
        'product_card':   sub(product_sub, 10),
        'product_bank':   sub(product_sub, 11),
        'product_pay':    sub(product_sub, 12),
        'details': details,
    }

# ── 급여 계산 ─────────────────────────────────────────────────────────────────

def calc_payroll(employee, service_total, product_total, deduct_total=0):
    """
    점판 계산: 판매가 - 부가세(10%) - 원가(50%) = 이익(40%) × 수수료율
    차감항목: 급여합계에서 먼저 차감 → 차감 후 금액에 3.3% 세금 적용
              실입금 = (급여합계 - 차감합계) × (1 - 3.3%)
    """
    s_rate   = employee.get('commission_rate', 47) / 100
    p_rate   = employee.get('product_commission_rate', 50) / 100
    s_gross  = int(service_total * s_rate)
    p_profit = int(product_total * 0.4)
    p_gross  = int(p_profit * p_rate)
    gross    = s_gross + p_gross

    # 차감항목 먼저 빼고 → 남은 금액에 세금 부과
    taxable    = gross - int(deduct_total)
    income_tax = int(taxable * 0.03)
    local_tax  = int(taxable * 0.003)
    deduction  = income_tax + local_tax
    net        = taxable - deduction

    return {
        's_gross':      s_gross,
        'p_profit':     p_profit,
        'p_gross':      p_gross,
        'gross':        gross,
        'deduct_total': int(deduct_total),
        'taxable':      taxable,
        'income_tax':   income_tax,
        'local_tax':    local_tax,
        'deduction':    deduction,
        'net':          net,
    }

# ── PDF 생성 ──────────────────────────────────────────────────────────────────

LOGO_DIR = Path(__file__).parent / 'static' / 'logo'

def generate_payslip_pdf(employee, year, month, record):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer,
                                    Table, TableStyle, Image, HRFlowable)

    for fp in [r'C:\Windows\Fonts\malgun.ttf', r'C:\Windows\Fonts\NanumGothic.ttf',
               r'C:\Windows\Fonts\gulim.ttc']:
        if os.path.exists(fp):
            try: pdfmetrics.registerFont(TTFont('KR', fp)); break
            except: continue
    F = 'KR'

    pay     = record['payroll']
    s_total = record['service_total']
    p_total = record['product_total']
    deduct_items = record.get('purchase_items', [])   # 차감항목
    deduct_total = pay.get('deduct_total', 0)
    s_rate  = employee.get('commission_rate', 47)
    p_rate  = employee.get('product_commission_rate', 50)
    name    = employee['name']

    def fmt(n): return f"{int(n):,}"

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=22*mm, rightMargin=22*mm,
                            topMargin=12*mm, bottomMargin=12*mm)

    def P(txt, size=10, align=1, space=2, bold=False, color='#1a1a1a'):
        fn = F
        return Paragraph(txt, ParagraphStyle('_', fontName=fn, fontSize=size,
                         alignment=align, textColor=color, spaceAfter=space,
                         leading=size*1.4))

    DARK  = colors.HexColor('#231815')
    HDR   = colors.HexColor('#2C3E50')
    ALT   = colors.HexColor('#F7F9FC')
    SUM   = colors.HexColor('#E8ECF0')
    RED_B = colors.HexColor('#FDECEA')
    RED   = colors.HexColor('#C0392B')
    BLUE  = colors.HexColor('#1a5276')

    # A4(210mm) - 좌우마진(22mm×2) = 사용가능 166mm
    PW = 166 * mm

    def part_header(title):
        """파트 구분 — 배경 없음, 검정 볼드 텍스트만"""
        hps = ParagraphStyle('ph', fontName=F, fontSize=10,
                             textColor=colors.black, leading=14, spaceAfter=2)
        return Paragraph(f'<b>{title}</b>', hps)

    def mktbl(data, widths, extra=[]):
        t = Table(data, colWidths=widths)
        t.setStyle(TableStyle([
            ('FONTNAME',     (0,0),(-1,-1), F),
            ('FONTSIZE',     (0,0),(-1,-1), 9),
            ('ALIGN',        (0,0),(-1,-1), 'CENTER'),
            ('VALIGN',       (0,0),(-1,-1), 'MIDDLE'),
            ('BOX',          (0,0),(-1,-1), 0.5, colors.HexColor('#AAAAAA')),
            ('INNERGRID',    (0,0),(-1,-1), 0.3, colors.HexColor('#DDDDDD')),
            ('TOPPADDING',   (0,0),(-1,-1), 6),
            ('BOTTOMPADDING',(0,0),(-1,-1), 6),
            ('LEFTPADDING',  (0,0),(-1,-1), 7),
            ('RIGHTPADDING', (0,0),(-1,-1), 7),
        ] + extra))
        return t

    story = []

    wm_path  = str(LOGO_DIR / 'wordmark.png')   # MUAMONG_B.png  1943×215
    sym_path = str(LOGO_DIR / 'symbol.png')     # 심볼_B.png      231×543
    wm_exists  = os.path.exists(wm_path)
    sym_exists = os.path.exists(sym_path)

    # ① 워드마크 — 가운데 정렬 ─────────────────────────────────────────────────
    if wm_exists:
        wm_h = 9 * mm
        wm_w = wm_h * (1943 / 215)
        wm_row = Table([[Image(wm_path, width=wm_w, height=wm_h)]], colWidths=[PW])
        wm_row.setStyle(TableStyle([
            ('ALIGN',(0,0),(0,0),'CENTER'), ('VALIGN',(0,0),(0,0),'MIDDLE'),
            ('LEFTPADDING',(0,0),(-1,-1),0), ('RIGHTPADDING',(0,0),(-1,-1),0),
            ('TOPPADDING',(0,0),(-1,-1),0), ('BOTTOMPADDING',(0,0),(-1,-1),0),
        ]))
        story.append(wm_row)
    else:
        story.append(P('MUAMONG HAIR', 16, align=1))

    story.append(Spacer(1, 2*mm))
    story.append(HRFlowable(width='100%', thickness=1, color=DARK, spaceAfter=4*mm))

    # ② 제목 — 가운데 ──────────────────────────────────────────────────────────
    story.append(P(f"{year}년 {month:02d}월 급여 명세표", 14, align=1, space=5))

    # ③ 미용실/직책 — 우측 정렬 (두 줄, role 필드 자동 반영) ───────────────────
    salon = employee.get('salon') or '무아몽헤어'
    role  = employee.get('role') or '디자이너'
    info_style = ParagraphStyle('info', fontName=F, fontSize=10,
                                alignment=2, leading=18, textColor=colors.HexColor('#333333'))
    story.append(Paragraph(f"미용실 : {salon}", info_style))
    story.append(Paragraph(f"{role} : {name}", info_style))
    story.append(Spacer(1, 3*mm))

    p_profit = pay.get('p_profit', 0)
    taxable  = pay.get('taxable', pay['gross'])

    # 공통 컬럼 폭 — 전체 PW=166mm 안에서 파트별 정의
    W4 = [50*mm, 38*mm, 26*mm, 52*mm]          # Part1: 항목|매출|수수료율|실입금
    W2 = [116*mm, 50*mm]                        # Part2~4: 항목|금액
    # (합계 확인) 50+38+26+52=166 ✓  116+50=166 ✓

    note_ps = ParagraphStyle('note', fontName=F, fontSize=8, alignment=0,
                             textColor=colors.HexColor('#999999'), leftIndent=6)

    # 색상 체계
    # 섹션 헤더: 검정(black)
    # 테이블 컬럼 헤더: 네이비(#34495E) — 섹션 헤더와 시각적으로 구분
    # 빨간색: - 값만 (소득세, 차감 등 음수)
    # 과세기준처럼 양수인 항목은 기본색

    COL_HDR = colors.HexColor('#3A3A3A')   # 테이블 컬럼 헤더 (더 진한 회색)
    DARK_TXT = colors.HexColor('#1a1a1a')

    # ── PART 1 : 매출 ─────────────────────────────────────────────────────────
    story.append(part_header('1. 매출 내역'))
    p1_rows = [['시술 매출', fmt(s_total), f"{s_rate}%", fmt(pay['s_gross'])]]
    if p_total:
        p1_rows.append(['점판 매출', fmt(p_total), f"{p_rate}%", fmt(pay['p_gross'])])
    n1 = len(p1_rows)
    p1_rows.append(['급여 합계', '', '', fmt(pay['gross'])])

    t1 = mktbl([['수입 항목', '매출 금액', '수수료율', '실입금']] + p1_rows, W4, [
        # 컬럼 헤더: 네이비
        ('BACKGROUND', (0,0),(-1,0),       COL_HDR),
        ('TEXTCOLOR',  (0,0),(-1,0),       colors.white),
        # 데이터 행
        ('BACKGROUND', (0,1),(-1,1),       colors.white),
        ('BACKGROUND', (0,2),(-1,2),       ALT),
        # 급여합계 행
        ('BACKGROUND', (0,n1+1),(-1,n1+1), SUM),
        ('FONTSIZE',   (0,n1+1),(-1,n1+1), 10),
        ('ALIGN',      (0,1),(0,-1),        'LEFT'),
        ('SPAN',       (0,n1+1),(2,n1+1)),
        ('ALIGN',      (0,n1+1),(0,n1+1),  'RIGHT'),
    ])
    story.append(t1)
    if p_total:
        story.append(Paragraph(
            f"  ※ 점판 : {fmt(p_total)} − 부가세({fmt(int(p_total*0.1))}) − 원가({fmt(int(p_total*0.5))}) = {fmt(p_profit)} × {p_rate}% = {fmt(pay['p_gross'])}원",
            note_ps))
    story.append(Spacer(1, 2*mm))

    # ── PART 2 : 차감 항목 ────────────────────────────────────────────────────
    if deduct_items:
        story.append(part_header('2. 차감 항목'))
        p2_rows = []
        for item in deduct_items:
            p2_rows.append([item.get('name','차감'), f"- {fmt(item.get('amount',0))}원"])
        p2_rows.append(['차감 합계', f"- {fmt(deduct_total)}원"])
        n2 = len(p2_rows)
        t2 = mktbl([['차감 항목', '차감 금액']] + p2_rows, W2, [
            # 컬럼 헤더: 네이비
            ('BACKGROUND', (0,0),(-1,0),       COL_HDR),
            ('TEXTCOLOR',  (0,0),(-1,0),       colors.white),
            # 합계 행 배경
            ('BACKGROUND', (0,n2),(-1,n2),     RED_B),
            # 차감 금액(- 값)만 빨간색
            ('TEXTCOLOR',  (1,1),(1,-1),        RED),
            ('ALIGN',      (0,1),(0,-1),        'LEFT'),
        ])
        story.append(t2)
        story.append(Spacer(1, 2*mm))

    # ── PART 3 : 세금 공제 ────────────────────────────────────────────────────
    story.append(part_header('3. 세금 공제  (3.3%)'))
    p3_rows = []
    taxable_row_idx = None
    if deduct_total:
        p3_rows.append([f'과세 기준  ({fmt(pay["gross"])} − 차감 {fmt(deduct_total)})',
                        fmt(taxable) + '원'])
        taxable_row_idx = 1   # 과세기준은 양수 → 빨강 제외

    # 소득세, 지방소득세, 공제합계 = 음수 → 빨강
    p3_rows.append(['소득세  (3%)',       f"- {fmt(pay['income_tax'])}원"])
    p3_rows.append(['지방소득세  (0.3%)', f"- {fmt(pay['local_tax'])}원"])
    p3_rows.append(['공제 합계',          f"- {fmt(pay['deduction'])}원"])
    n3 = len(p3_rows)

    # 빨강 적용 범위: 과세기준(양수) 제외, 나머지 금액만
    red_start = 2 if deduct_total else 1   # 과세기준 행 있으면 그 다음부터

    t3 = mktbl([['공제 항목', '공제 금액']] + p3_rows, W2, [
        ('BACKGROUND', (0,0),(-1,0),             COL_HDR),
        ('TEXTCOLOR',  (0,0),(-1,0),             colors.white),
        ('BACKGROUND', (0,1),(-1,1),             ALT),
        ('BACKGROUND', (0,n3),(-1,n3),           RED_B),
        # 소득세~공제합계 금액만 빨간색 (과세기준 제외)
        ('TEXTCOLOR',  (1,red_start),(1,-1),     RED),
        ('ALIGN',      (0,1),(0,-1),              'LEFT'),
    ])
    story.append(t3)
    story.append(Spacer(1, 2*mm))

    # ── PART 4 : 간략 정리 (한 줄, 빨간색 = - 값만) ──────────────────────────
    story.append(part_header('4. 산출내역 요약'))

    # Paragraph 마크업으로 - 값만 빨간색
    red = '#C0392B'
    s_part  = f"{fmt(pay['s_gross'])}(시술매출)"
    p_part  = f" + {fmt(pay['p_gross'])}(점판매출)" if p_total else ''
    d_part  = f" <font color='{red}'>- {fmt(deduct_total)}(차감항목)</font>" if deduct_total else ''
    t_part  = f" <font color='{red}'>- {fmt(pay['deduction'])}(세금공제 3.3%)</font>"
    net_part= f" = <b>{fmt(pay['net'])}원</b>(실입금액)"
    summary_markup = s_part + p_part + d_part + t_part + net_part

    sum_ps = ParagraphStyle('sum', fontName=F, fontSize=7.5, alignment=1,
                            textColor=DARK_TXT, leading=11)
    t4 = Table([[Paragraph(summary_markup, sum_ps)]], colWidths=[PW])
    t4.setStyle(TableStyle([
        ('BACKGROUND',   (0,0),(-1,-1), SUM),
        ('TOPPADDING',   (0,0),(-1,-1), 7),
        ('BOTTOMPADDING',(0,0),(-1,-1), 7),
        ('LEFTPADDING',  (0,0),(-1,-1), 6),
        ('RIGHTPADDING', (0,0),(-1,-1), 6),
        ('BOX',          (0,0),(-1,-1), 0.5, colors.HexColor('#AAAAAA')),
    ]))
    story.append(t4)
    story.append(Spacer(1, 3*mm))

    # ── PART 5 : 실입금액 강조 박스 ──────────────────────────────────────────
    net_ps = ParagraphStyle('net', fontName=F, fontSize=18, alignment=1,
                            leading=26, textColor=BLUE)
    net_tbl = Table(
        [[Paragraph(f'<b>실입금액　　{fmt(pay["net"])}원</b>', net_ps)]],
        colWidths=[PW])
    net_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0),(-1,-1), colors.HexColor('#EAF4FB')),
        ('BOX',          (0,0),(-1,-1), 2, colors.HexColor('#4472C4')),
        ('TOPPADDING',   (0,0),(-1,-1), 14),
        ('BOTTOMPADDING',(0,0),(-1,-1), 14),
    ]))
    story += [net_tbl, Spacer(1, 6*mm)]

    # ── 마무리 멘트 ────────────────────────────────────────────────────────────
    story.append(HRFlowable(width='100%', thickness=0.5,
                            color=colors.HexColor('#BBBBBB'), spaceAfter=8*mm))
    story.append(P(f"{name} 선생님 수고하셨습니다.", 13, align=1, space=10))

    # ⑧ 심볼 — 맨 아래 가운데 ─────────────────────────────────────────────────
    if sym_exists:
        sym_h = 8 * mm
        sym_w = sym_h * (231 / 543)
        sym_row = Table([[Image(sym_path, width=sym_w, height=sym_h)]], colWidths=[PW])
        sym_row.setStyle(TableStyle([
            ('ALIGN',(0,0),(0,0),'CENTER'), ('VALIGN',(0,0),(0,0),'MIDDLE'),
            ('LEFTPADDING',(0,0),(-1,-1),0), ('RIGHTPADDING',(0,0),(-1,-1),0),
            ('TOPPADDING',(0,0),(-1,-1),0), ('BOTTOMPADDING',(0,0),(-1,-1),0),
        ]))
        story.append(sym_row)

    doc.build(story)
    buf.seek(0)
    return buf

# ── 라우트: 직원 ──────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/employees', methods=['GET'])
def get_employees():
    return jsonify(load_employees())

@app.route('/employees', methods=['POST'])
def add_employee():
    data = request.json
    employees = load_employees()
    data['id'] = str(int(datetime.now().timestamp() * 1000))
    employees.append(data)
    save_employees(employees)
    return jsonify(data)

@app.route('/employees/<eid>', methods=['PUT'])
def update_employee(eid):
    data = request.json
    employees = load_employees()
    for i, e in enumerate(employees):
        if e['id'] == eid:
            employees[i].update(data)
            save_employees(employees)
            return jsonify(employees[i])
    return jsonify({'error': 'not found'}), 404

@app.route('/employees/<eid>', methods=['DELETE'])
def delete_employee(eid):
    employees = [e for e in load_employees() if e['id'] != eid]
    save_employees(employees)
    return jsonify({'ok': True})

# ── 라우트: 파일 업로드 ───────────────────────────────────────────────────────

@app.route('/upload', methods=['POST'])
def upload_sales():
    if 'file' not in request.files or not request.files['file'].filename:
        return jsonify({'error': '파일 없음'}), 400
    f = request.files['file']
    save_path = app.config['UPLOAD_FOLDER'] / f.filename
    f.save(str(save_path))
    try:
        return jsonify(parse_sales_xls(str(save_path)))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── 라우트: 급여 저장/조회/삭제 ──────────────────────────────────────────────

@app.route('/salary', methods=['POST'])
def save_salary():
    """월별 급여 저장"""
    d = request.json
    emp_id = d['employee_id']
    year   = int(d['year'])
    month  = int(d['month'])
    key    = f"{year}-{month:02d}"

    records = load_salary_records()
    if emp_id not in records:
        records[emp_id] = {}

    # 점판 항목 (수정된 값 사용)
    product_items  = d.get('product_items', [])
    purchase_items = d.get('purchase_items', [])   # 직원 구매 차감
    product_total  = sum(item.get('amount', 0) for item in product_items)
    purchase_total = sum(item.get('amount', 0) for item in purchase_items)
    service_total  = int(d.get('service_total', 0))

    employees = load_employees()
    emp = next((e for e in employees if e['id'] == emp_id), {})
    pay = calc_payroll(emp, service_total, product_total, purchase_total)

    records[emp_id][key] = {
        'year': year, 'month': month,
        'service_total':  service_total,
        'product_items':  product_items,
        'product_total':  product_total,
        'purchase_items': purchase_items,
        'purchase_total': purchase_total,
        'payroll': pay,
        'payment_details': d.get('payment_details', {}),
        'saved_at': datetime.now().isoformat(),
    }
    save_salary_records(records)
    return jsonify({'ok': True, 'record': records[emp_id][key]})

@app.route('/salary/<emp_id>', methods=['GET'])
def get_salary(emp_id):
    """직원의 전체 급여 기록 조회"""
    records = load_salary_records()
    emp_records = records.get(emp_id, {})
    # 최신순 정렬
    sorted_records = dict(sorted(emp_records.items(), reverse=True))
    return jsonify(sorted_records)

@app.route('/salary/<emp_id>/<year>/<month>', methods=['GET'])
def get_salary_month(emp_id, year, month):
    """특정 월 급여 기록 조회"""
    key = f"{year}-{int(month):02d}"
    records = load_salary_records()
    rec = records.get(emp_id, {}).get(key)
    return jsonify(rec) if rec else ('', 204)

@app.route('/salary/<emp_id>/<year>/<month>', methods=['DELETE'])
def delete_salary(emp_id, year, month):
    key = f"{year}-{int(month):02d}"
    records = load_salary_records()
    if emp_id in records and key in records[emp_id]:
        del records[emp_id][key]
        save_salary_records(records)
    return jsonify({'ok': True})

@app.route('/payslip', methods=['POST'])
def make_payslip():
    d = request.json
    employees = load_employees()
    emp = next((e for e in employees if e['id'] == d['employee_id']), None)
    if not emp:
        return jsonify({'error': '직원 없음'}), 404

    # 저장된 기록 또는 현재 계산값으로 PDF 생성
    year  = int(d['year'])
    month = int(d['month'])

    product_items  = d.get('product_items', [])
    purchase_items = d.get('purchase_items', [])
    product_total  = sum(item.get('amount',0) for item in product_items)
    purchase_total = sum(item.get('amount',0) for item in purchase_items)
    service_total  = int(d.get('service_total', 0))
    pay = calc_payroll(emp, service_total, product_total, purchase_total)

    record = {
        'service_total':  service_total,
        'product_total':  product_total,
        'purchase_items': purchase_items,
        'payroll': pay,
    }
    try:
        buf = generate_payslip_pdf(emp, year, month, record)
        # XLS 원본 파일명 기반 (이가영_1월.xls → 이가영_1월.pdf)
        xls_stem = d.get('xls_filename', '').strip()
        pdf_name = f"{xls_stem}.pdf" if xls_stem else f"{year}년{month:02d}월_{emp['name']}.pdf"
        return send_file(buf, mimetype='application/pdf',
                         as_attachment=True,
                         download_name=pdf_name)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5050)
