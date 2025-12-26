export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    let { email, promoCode } = await request.json();

    if (!email || !promoCode) {
      return new Response(JSON.stringify({ error: "חסר אימייל או קוד" }), { status: 400 });
    }

    email = email.trim().toLowerCase();
    
    // =========================================================
    // 1. טיפול בתשלום PayPal מוצלח
    // =========================================================
    // כאשר הפרונט מדווח שהתשלום עבר בהצלחה, הוא שולח את הקוד הזה.
    // אנו משדרגים את המשתמש מיד ללא בדיקת קודים במסד הנתונים.
    if (promoCode === 'PAYPAL_SUCCESS_BYPASS') {
         await env.DB.prepare("UPDATE users SET plan = 'PRO', token_limit = 1000000 WHERE email = ?").bind(email).run();
         return new Response(JSON.stringify({ success: true, source: 'PAYPAL' }));
    }

    // =========================================================
    // 2. טיפול בקודי הטבה רגילים (Gift Codes)
    // =========================================================
    
    // ניקוי רווחים והמרה לאותיות קטנות (למשל: "GIFT 10003" -> "gift10003")
    promoCode = promoCode.replace(/\s/g, '').toLowerCase(); 

    const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ?").bind(promoCode).first();

    // בדיקות תקינות
    if (!codeRecord) {
      return new Response(JSON.stringify({ error: "קוד לא קיים" }), { status: 400 });
    }

    if (codeRecord.is_used === 1 && promoCode !== 'meir12321') {
      return new Response(JSON.stringify({ error: "הקוד הזה כבר נוצל" }), { status: 400 });
    }

    // ביצוע השדרוג בפועל
    await env.DB.prepare("UPDATE users SET plan = 'PRO', token_limit = 1000000 WHERE email = ?").bind(email).run();

    // סימון הקוד כמשומש (אלא אם זה קוד המאסטר לבדיקות)
    if (promoCode !== 'meir12321') {
      await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
    }

    return new Response(JSON.stringify({ success: true, source: 'CODE' }));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאה בשדרוג: " + e.message }), { status: 500 });
  }
}
