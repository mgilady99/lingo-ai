export async function onRequest(context) {
  const { env } = context;

  try {
    // שליפת כל הקודים, מסודרים לפי: קודם הפנויים, ואז לפי האלף-בית
    const result = await env.DB.prepare(
      "SELECT * FROM promo_codes ORDER BY is_used ASC, code ASC"
    ).all();

    return new Response(JSON.stringify(result.results));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
