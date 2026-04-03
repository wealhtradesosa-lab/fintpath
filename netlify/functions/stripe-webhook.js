const Stripe = require("stripe");

exports.handler = async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const userId = session.metadata?.userId;
    const customerEmail = session.customer_email;
    console.log(`✅ Subscription activated for ${customerEmail} (user: ${userId})`);
    
    // Update plan in Supabase
    if (userId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      try {
        const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_data?id=eq.${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": process.env.SUPABASE_SERVICE_KEY,
            "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ plan: "pro", stripe_customer_id: session.customer }),
        });
        console.log(`Supabase update: ${res.status}`);
      } catch (e) { console.error("Supabase update failed:", e); }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
