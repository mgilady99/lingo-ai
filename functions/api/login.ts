export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { email, password } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "נא להזין אימייל" }), { status: 400 });
    }

    // 1. בדיקה אם המשתמש קיים
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    // 2. משתמש חדש? ניצור אותו ונישמור את הסיסמה שלו!
    if (!user) {
      if (!password || password.length < 4) {
         return new Response(JSON.stringify({ error: "סיסמה קצרה מדי למשתמש חדש" }), { status: 400 });
      }

      await env.DB.prepare("INSERT INTO users (email, password, plan, tokens_used, token_limit) VALUES (?, ?, 'FREE', 0, 5000)")
        .bind(email, password).run();
        
      return new Response(JSON.stringify({ email, plan: 'FREE', role: 'USER', tokens_used: 0 }));
    }

    // 3. משתמש קיים? נבדוק שהסיסמה תואמת למה ששמור ב-DB
    if (user.password && user.password !== password) {
       return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
    }

    return new Response(JSON.stringify(user));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאת שרת" }), { status: 500 });
  }
}
