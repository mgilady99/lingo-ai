export async function onRequest(context) {
  const { env } = context;
  try {
    const result = await env.DB.prepare("SELECT * FROM promo_codes ORDER BY is_used ASC, code ASC").all();
    return new Response(JSON.stringify(result.results || []));
  } catch (e) {
    return new Response(JSON.stringify([])); 
  }
}
