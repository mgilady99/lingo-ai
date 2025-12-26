export async function onRequestPost(context) {
  const { env, request } = context;
  const { plan, email } = await request.json();

  // הגדרת מחירים (לפי החישוב השנתי שביקשת)
  const prices = {
    'BASIC': { amount: 5880, name: 'Standard Plan - Annual' }, // 4.90 * 12
    'PRO': { amount: 14280, name: 'Premium Plan - Annual' }   // 11.90 * 12
  };

  try {
    // כאן מתבצעת הפנייה ל-Stripe ליצירת דף תשלום
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'success_url': `${new URL(request.url).origin}/?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${new URL(request.url).origin}/pricing`,
        'payment_method_types[]': 'card',
        'mode': 'payment',
        'customer_email': email,
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': prices[plan].amount.toString(),
        'line_items[0][price_data][product_data][name]': prices[plan].name,
        'line_items[0][quantity]': '1',
      })
    });

    const session = await response.json();
    return new Response(JSON.stringify({ url: session.url }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
