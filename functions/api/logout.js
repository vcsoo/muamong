export async function onRequest(context) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'sess=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0',
    },
  });
}
