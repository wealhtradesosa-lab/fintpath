export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  
  try {
    const body = await req.text();
    const event = JSON.parse(body);
    
    // Handle subscription events
    if (event.type === "checkout.session.completed") {
      console.log("Checkout completed:", event.data.object.customer_email);
    }
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
}

