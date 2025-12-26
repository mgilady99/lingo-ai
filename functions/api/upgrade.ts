export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    let { email, promoCode } = await request.json();

    if (!email || !promoCode) {
      return new Response(JSON.stringify({ error: "חסר אימייל או קוד" }), { status: 400 });
    }

    // ניקוי: הכל לאותיות קטנות כדי להתאים למסד הנתונים
    email = email.trim().toLowerCase();
    promoCode = promoCode.trim().toLowerCase();

    // 1. בדיקת הקוד
    const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ?").bind(promoCode).first();

    if (!codeRecord) {
      return new Response(JSON.stringify({ error: "קוד לא קיים" }), { status: 400 });
    }

    // בדיקה אם נוצל (למעט קוד המאסטר)
    if (codeRecord.is_used === 1 && promoCode !== 'meir12321') {
      return new Response(JSON.stringify({ error: "הקוד הזה כבר נוצל" }), { status: 400 });
    }

    // 2. ביצוע השדרוג
    await env.DB.prepare("UPDATE users SET plan = 'PRO', token_limit = 1000000 WHERE email = ?").bind(email).run();

    // 3. סימון הקוד כמשומש
    if (promoCode !== 'meir12321') {
      await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
    }

    return new Response(JSON.stringify({ success: true }));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאה בשדרוג: " + e.message }), { status: 500 });
  }
}
