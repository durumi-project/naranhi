export default async function handler(request) {
  return new Response(JSON.stringify({ ok: true, time: Date.now() }), {
    headers: { 'content-type': 'application/json' }
  });
}
