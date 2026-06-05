function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const eid = params.eid;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  if (request.method === 'PUT') {
    const data = await request.json();
    await env.DB.prepare(
      `UPDATE employees SET name=?, salon=?, role=?, commission_rate=?, product_commission_rate=?
       WHERE id=?`
    ).bind(
      data.name,
      data.salon || '',
      data.role || '',
      data.commission_rate,
      data.product_commission_rate || 50,
      eid
    ).run();
    const row = await env.DB.prepare('SELECT * FROM employees WHERE id=?').bind(eid).first();
    return row ? json(row) : json({ error: 'not found' }, 404);
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM employees WHERE id=?').bind(eid).run();
    return json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
