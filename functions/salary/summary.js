export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  const { results } = await env.DB.prepare(`
    SELECT sr.employee_id, sr.year, sr.month, sr.payroll,
           e.name AS emp_name
    FROM salary_records sr
    JOIN employees e ON sr.employee_id = e.id
    ORDER BY sr.year DESC, sr.month DESC
  `).all();

  const data = results.map(r => {
    const pay = JSON.parse(r.payroll || '{}');
    return {
      emp_id:   r.employee_id,
      emp_name: r.emp_name,
      year:     r.year,
      month:    r.month,
      net:      pay.net   || 0,
      gross:    pay.gross || 0,
    };
  });

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
