const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(response) {
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
  return r;
}

function isProtected(path) {
  return path.startsWith('/employees') || path.startsWith('/salary');
}

export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (isProtected(path)) {
    const AUTH_SECRET = env.AUTH_SECRET || 'muamong-sess-2026';
    const cookie = request.headers.get('Cookie') || '';
    const match  = cookie.match(/(?:^|;\s*)sess=([^;]+)/);
    const sess   = match ? match[1] : null;

    if (sess !== AUTH_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
  }

  return withCors(await context.next());
}
