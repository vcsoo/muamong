export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const { id, pass } = await request.json();
  const AUTH_USER   = env.AUTH_USER   || 'muamong';
  const AUTH_PASS   = env.AUTH_PASS   || 'muamong';
  const AUTH_SECRET = env.AUTH_SECRET || 'muamong-sess-2026';

  if (id === AUTH_USER && pass === AUTH_PASS) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `sess=${AUTH_SECRET}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`,
      },
    });
  }

  return new Response(JSON.stringify({ ok: false }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
