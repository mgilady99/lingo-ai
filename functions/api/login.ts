
export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    let { email, password, promoCode } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "נא להזין אימייל" }), { status: 400 });
    }

    // ניקוי קלטים
    email = email.trim().toLowerCase();
    password = password.trim();
    if (promoCode) promoCode = promoCode.trim().toUpperCase();

    // 1. חיפוש המשתמש
    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    // =========================================================
    // תרחיש א': משתמש קיים
    // =========================================================
    if (user) {
      if (user.password && user.password !== password) {
         return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
      }

      // --- התיקון הקריטי: זיהוי מנהל לפי אימייל ---
      if (email === 'mgilady@gmail.com') {
          user.role = 'ADMIN';
          user.plan = 'PRO';
      }
      // ---------------------------------------------

      // בדיקת שדרוג למשתמש רגיל
      if (user.plan !== 'PRO' && user.role !== 'ADMIN' && promoCode) {
        try {
          const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ?").bind(promoCode).first();
          
          if (!codeRecord) return new Response(JSON.stringify({ error: "קוד לא נמצא" }), { status: 400 });
          if (codeRecord.is_used === 1) return new Response(JSON.stringify({ error: "קוד משומש" }), { status: 400 });

          // ביצוע שדרוג
          await env.DB.prepare("UPDATE users SET plan = 'PRO', token_limit = 1000000 WHERE email = ?").bind(email).run();
          await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
            
          user.plan = 'PRO';
          user.token_limit = 1000000;
        } catch (e) {}
      }

      return new Response(JSON.stringify(user));
    }

    // =========================================================
    // תרחיש ב': משתמש חדש
    // =========================================================
    let plan = 'FREE';
    let role = 'USER'; // ברירת מחדל
    let tokenLimit = 5000;

    // אם זה אתה שנרשם מחדש - אתה ישר אדמין
    if (email === 'mgilady@gmail.com') {
        role = 'ADMIN';
        plan = 'PRO';
    }

    // בדיקת קוד הטבה למשתמש חדש
    if (promoCode && role !== 'ADMIN') {
      try {
        const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ?").bind(promoCode).first();
        if (codeRecord && codeRecord.is_used === 0) {
          plan = 'PRO';
          tokenLimit = 1000000;
          await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
        } else {
           return new Response(JSON.stringify({ error: "קוד שגוי או משומש" }), { status: 400 });
        }
      } catch (e) {}
    }

    if (!password || password.length < 4) {
       return new Response(JSON.stringify({ error: "סיסמה קצרה מדי" }), { status: 400 });
    }

    // שמירה ב-DB
    await env.DB.prepare("INSERT INTO users (email, password, plan, tokens_used, token_limit) VALUES (?, ?, ?, 0, ?)")
      .bind(email, password, plan, tokenLimit).run();
      
    // החזרת תשובה ללקוח (כולל ה-Role)
    return new Response(JSON.stringify({ email, plan, role, tokens_used: 0 }));

  } catch (e) {
    return new Response(JSON.stringify({ error: "Error: " + e.message }), { status: 500 });
  }
}
