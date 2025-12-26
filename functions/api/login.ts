export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    let { email, password, promoCode } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "נא להזין אימייל" }), { status: 400 });
    }

    // --- ניקוי קלטים (התיקון הקריטי) ---
    email = email.trim().toLowerCase();
    password = password.trim();
    if (promoCode) {
        // הופך לאותיות גדולות ומוחק רווחים לפני ואחרי
        promoCode = promoCode.trim().toUpperCase();
    }
    // ------------------------------------

    // 1. ננסה למצוא את המשתמש
    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    // =========================================================
    // תרחיש א': המשתמש כבר קיים במערכת
    // =========================================================
    if (user) {
      // בדיקת סיסמה
      if (user.password && user.password !== password) {
         return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
      }

      // אם המשתמש הוא כבר PRO, לא בודקים קודים בכלל.
      if (user.plan === 'PRO') {
         return new Response(JSON.stringify(user));
      }

      // אם הוא עדיין FREE ומנסה להשתדרג
      if (promoCode) {
        try {
          // שאילתה לחיפוש הקוד
          const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ?").bind(promoCode).first();
          
          if (!codeRecord) {
              return new Response(JSON.stringify({ error: "קוד ההטבה לא נמצא במערכת" }), { status: 400 });
          }

          if (codeRecord.is_used === 1) {
              return new Response(JSON.stringify({ error: "קוד ההטבה הזה כבר נוצל" }), { status: 400 });
          }

          // הקוד תקין ופנוי! ביצוע השדרוג
          await env.DB.prepare("UPDATE users SET plan = 'PRO', token_limit = 1000000 WHERE email = ?").bind(email).run();
          await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
            
          user.plan = 'PRO';
          user.token_limit = 1000000;
        } catch (e) {
            return new Response(JSON.stringify({ error: "שגיאת בסיס נתונים: " + e.message }), { status: 500 });
        }
      }

      return new Response(JSON.stringify(user));
    }

    // =========================================================
    // תרחיש ב': משתמש חדש לגמרי (הרשמה)
    // =========================================================
    let plan = 'FREE';
    let tokenLimit = 5000;

    if (promoCode) {
      try {
        const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ?").bind(promoCode).first();
        
        if (!codeRecord) {
             return new Response(JSON.stringify({ error: "קוד ההטבה לא נמצא" }), { status: 400 });
        }
        if (codeRecord.is_used === 1) {
             return new Response(JSON.stringify({ error: "קוד ההטבה הזה כבר נוצל" }), { status: 400 });
        }

        // קוד תקין
        plan = 'PRO';
        tokenLimit = 1000000;
        await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();

      } catch (e) {
         // אם יש שגיאה בקוד, נמשיך כמשתמש חינם? לא, עדיף להודיע למשתמש.
         return new Response(JSON.stringify({ error: "שגיאה בבדיקת הקוד" }), { status: 400 });
      }
    }

    if (!password || password.length < 4) {
       return new Response(JSON.stringify({ error: "סיסמה חייבת להכיל לפחות 4 תווים" }), { status: 400 });
    }

    // יצירת המשתמש
    await env.DB.prepare("INSERT INTO users (email, password, plan, tokens_used, token_limit) VALUES (?, ?, ?, 0, ?)")
      .bind(email, password, plan, tokenLimit).run();
      
    return new Response(JSON.stringify({ email, plan, role: 'USER', tokens_used: 0 }));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאת שרת: " + e.message }), { status: 500 });
  }
}
