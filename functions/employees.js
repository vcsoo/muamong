function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM employees ORDER BY name'
    ).all();
    return json(results);
  }

  if (request.method === 'POST') {
    const data = await request.json();
    const id = String(Date.now());
    await env.DB.prepare(
      `INSERT INTO employees (id, name, salon, role, commission_rate, product_commission_rate)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      data.name,
      data.salon || '',
      data.role || '',
      data.commission_rate,
      data.product_commission_rate || 50
    ).run();
    return json({ ...data, id });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
