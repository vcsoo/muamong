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
  const { emp_id, year, month } = params;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  if (request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT * FROM salary_records WHERE employee_id=? AND year=? AND month=?'
    ).bind(emp_id, parseInt(year), parseInt(month)).first();
    if (!row) return new Response(null, { status: 204 });
    return json(parseRecord(row));
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare(
      'DELETE FROM salary_records WHERE employee_id=? AND year=? AND month=?'
    ).bind(emp_id, parseInt(year), parseInt(month)).run();
    return json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
