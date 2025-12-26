export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { email, password, promoCode } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "נא להזין אימייל" }), { status: 400 });
    }

    // שליפת המשתמש מהמסד
    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    // ---------------------------------------------------------
    // תרחיש א': משתמש קיים (התחברות)
    // ---------------------------------------------------------
    if (user) {
      // 1. בדיקת סיסמה
      if (user.password && user.password !== password) {
         return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
      }

      // 2. בדיקת שדרוג: אם המשתמש הזין קוד הטבה והוא עדיין לא PRO
      if (promoCode && user.plan !== 'PRO') {
        try {
          // בדיקה אם הקוד תקין ולא משומש
          const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ? AND is_used = 0").bind(promoCode).first();
          
          if (codeRecord) {
            // שדרוג המשתמש ב-DB ל-PRO (שמירה קבועה!)
            await env.DB.prepare("UPDATE users SET plan = 'PRO', token_limit = 1000000 WHERE email = ?").bind(email).run();
            
            // סימון הקוד כמשומש
            await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
            
            // עדכון האובייקט המקומי כדי להחזיר למשתמש מיד את הסטטוס החדש
            user.plan = 'PRO';
            user.token_limit = 1000000;
          } else {
             return new Response(JSON.stringify({ error: "קוד הטבה שגוי או שכבר נוצל" }), { status: 400 });
          }
        } catch (e) {
          console.log("Promo check error:", e);
        }
      }

      // החזרת המשתמש (המעודכן או הרגיל)
      return new Response(JSON.stringify(user));
    }

    // ---------------------------------------------------------
    // תרחיש ב': משתמש חדש (הרשמה)
    // ---------------------------------------------------------
    let plan = 'FREE';
    let tokenLimit = 5000;

    // בדיקת קוד הטבה למשתמש חדש
    if (promoCode) {
      try {
        const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ? AND is_used = 0").bind(promoCode).first();
        
        if (codeRecord) {
          plan = 'PRO';
          tokenLimit = 1000000;
          
          // סימון הקוד כמשומש
          await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
        } else {
          return new Response(JSON.stringify({ error: "קוד הטבה שגוי או שכבר נוצל" }), { status: 400 });
        }
      } catch (e) {
        // מתעלמים אם אין טבלת קודים
      }
    }

    if (!password || password.length < 4) {
       return new Response(JSON.stringify({ error: "סיסמה חייבת להכיל לפחות 4 תווים" }), { status: 400 });
    }

    // יצירת המשתמש החדש עם הסטטוס הנכון
    await env.DB.prepare("INSERT INTO users (email, password, plan, tokens_used, token_limit) VALUES (?, ?, ?, 0, ?)")
      .bind(email, password, plan, tokenLimit).run();
      
    return new Response(JSON.stringify({ email, plan, role: 'USER', tokens_used: 0 }));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאת שרת: " + e.message }), { status: 500 });
  }
}
