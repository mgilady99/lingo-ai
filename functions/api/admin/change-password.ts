export async function onRequestPost(context) {
  const { env, request } = context;
  const { email, newPassword } = await request.json();

  // בדיקת תקינות בסיסית
  if (!newPassword || newPassword.length < 4) {
    return new Response(JSON.stringify({ error: "סיסמה קצרה מדי" }), { status: 400 });
  }

  try {
    // עדכון הסיסמה בטבלת המשתמשים
    await env.DB.prepare("UPDATE users SET password = ? WHERE email = ?")
      .bind(newPassword, email).run();
    
    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאה בעדכון" }), { status: 500 });
  }
}
