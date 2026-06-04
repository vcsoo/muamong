import sys; sys.path.insert(0, r'C:\muamong\salon_app')
from app import calc_payroll, generate_payslip_pdf

emp = {'name':'이가영','salon':'무아몽헤어','commission_rate':47,'product_commission_rate':50}
purchase_items = [
    {'name': '샴푸 구매', 'amount': 30000},
    {'name': '트리트먼트', 'amount': 20000},
]
pay = calc_payroll(emp, 5451500, 82000, 50000)
record = {
    'service_total': 5451500, 'product_total': 82000,
    'purchase_items': purchase_items,
    'payroll': pay,
}
print(f"급여: {pay['gross']:,}  세금: {pay['deduction']:,}  차감: {pay['deduct_total']:,}  실입금: {pay['net']:,}")
buf = generate_payslip_pdf(emp, 2026, 5, record)
out = r'C:\Users\V\Downloads\test_payslip_v2.pdf'
open(out, 'wb').write(buf.read())
print(f'PDF 저장: {out}')
