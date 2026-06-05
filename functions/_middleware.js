export async function onRequest(context) {
  const response = await context.next();
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return newResponse;
}
