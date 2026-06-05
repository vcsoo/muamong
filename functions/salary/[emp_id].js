function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseRecord(row) {
  return {
    year:    row.year,
    month:   row.month,
    service_total:  row.service_total,
    product_total:  row.product_total,
    purchase_total: row.purchase_total,
    product_items:  JSON.parse(row.product_items  || '[]'),
    purchase_items: JSON.parse(row.purchase_items || '[]'),
    payroll:         JSON.parse(row.payroll         || '{}'),
    payment_details: JSON.parse(row.payment_details || '{}'),
    saved_at: row.saved_at,
  };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const empId = params.emp_id;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM salary_records WHERE employee_id=? ORDER BY year DESC, month DESC'
    ).bind(empId).all();

    const obj = {};
    for (const row of results) {
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
      obj[key] = parseRecord(row);
    }
    return json(obj);
  }

  return new Response('Method Not Allowed', { status: 405 });
}
