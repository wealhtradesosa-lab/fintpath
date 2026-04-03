const Stripe = require("stripe");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { priceId, email, userId, successUrl, cancelUrl } = JSON.parse(event.body);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || (process.env.SITE_URL || "https://finpathia.netlify.app") + "/?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancelUrl || (process.env.SITE_URL || "https://finpathia.netlify.app") + "/",
      metadata: { userId },
    });

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
