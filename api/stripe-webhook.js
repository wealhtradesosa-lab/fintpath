import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role for admin access
);

export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const plan = session.metadata?.plan || "pro";
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId) {
          await supabase.from("profiles").update({
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          }).eq("id", userId);
          console.log(`✅ User ${userId} upgraded to ${plan}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId = sub.customer;
        const status = sub.status;

        if (status === "active") {
          // Subscription renewed or updated
          console.log(`✅ Subscription active for customer ${customerId}`);
        } else if (status === "past_due" || status === "canceled" || status === "unpaid") {
          // Downgrade to free
          await supabase.from("profiles").update({
            plan: "free",
            updated_at: new Date().toISOString(),
          }).eq("stripe_customer_id", customerId);
          console.log(`⚠️ Customer ${customerId} downgraded to free (${status})`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await supabase.from("profiles").update({
          plan: "free",
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        }).eq("stripe_customer_id", sub.customer);
        console.log(`🗑️ Subscription deleted for ${sub.customer}`);
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: "Processing failed" });
  }
}
