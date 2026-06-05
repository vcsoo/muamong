function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function calcPayroll(employee, serviceTotal, productTotal, deductTotal = 0) {
  const sRate  = (employee.commission_rate || 47) / 100;
  const pRate  = (employee.product_commission_rate || 50) / 100;
  const sGross = Math.floor(serviceTotal * sRate);
  const pProfit = Math.floor(productTotal * 0.4);
  const pGross  = Math.floor(pProfit * pRate);
  const gross   = sGross + pGross;
  const taxable = gross - Math.floor(deductTotal);
  const incomeTax = Math.floor(taxable * 0.03);
  const localTax  = Math.floor(taxable * 0.003);
  const deduction = incomeTax + localTax;
  const net = taxable - deduction;
  return { s_gross: sGross, p_profit: pProfit, p_gross: pGross, gross, deduct_total: Math.floor(deductTotal), taxable, income_tax: incomeTax, local_tax: localTax, deduction, net };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  if (request.method === 'POST') {
    const d = await request.json();
    const empId   = d.employee_id;
    const year    = parseInt(d.year);
    const month   = parseInt(d.month);
    const productItems  = d.product_items  || [];
    const purchaseItems = d.purchase_items || [];
    const productTotal  = productItems.reduce((s, i) => s + (i.amount || 0), 0);
    const purchaseTotal = purchaseItems.reduce((s, i) => s + (i.amount || 0), 0);
    const serviceTotal  = parseInt(d.service_total || 0);

    const emp = await env.DB.prepare('SELECT * FROM employees WHERE id=?').bind(empId).first();
    const pay = calcPayroll(emp || {}, serviceTotal, productTotal, purchaseTotal);

    await env.DB.prepare(
      `INSERT INTO salary_records
         (employee_id, year, month, service_total, product_total, purchase_total,
          product_items, purchase_items, payroll, payment_details, saved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(employee_id, year, month) DO UPDATE SET
         service_total=excluded.service_total,
         product_total=excluded.product_total,
         purchase_total=excluded.purchase_total,
         product_items=excluded.product_items,
         purchase_items=excluded.purchase_items,
         payroll=excluded.payroll,
         payment_details=excluded.payment_details,
         saved_at=excluded.saved_at`
    ).bind(
      empId, year, month,
      serviceTotal, productTotal, purchaseTotal,
      JSON.stringify(productItems),
      JSON.stringify(purchaseItems),
      JSON.stringify(pay),
      JSON.stringify(d.payment_details || {}),
      new Date().toISOString()
    ).run();

    return json({ ok: true, record: { year, month, service_total: serviceTotal, product_total: productTotal, purchase_total: purchaseTotal, product_items: productItems, purchase_items: purchaseItems, payroll: pay, payment_details: d.payment_details || {} } });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
