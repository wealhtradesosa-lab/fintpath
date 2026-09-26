// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Registro — versión Vercel (api/auth-signup)
//
// 26-sep-2026 (P0). Equivalente de netlify/functions/auth-signup.cjs para
// Vercel, donde /.netlify/functions/* no existe (405) y el registro fallaba.
// El frontend ahora llama a /api/auth-signup: en Netlify se redirige a la
// función (netlify.toml), en Vercel cae aquí. Misma lógica y validaciones.
//
// ENV VARS (Vercel): VITE_SUPABASE_URL (o SUPABASE_URL) y
//   SUPABASE_SERVICE_KEY (o SUPABASE_SERVICE_ROLE_KEY). Solo servidor.
// ═══════════════════════════════════════════════════════════════════════════
const WEAK = ["12345678","password","qwerty12","11111111","00000000","abcdefgh","87654321","password1","password2","contrasena","password123","qwertyuiop","asdfghjkl","zxcvbnm123","12345abc","abc12345"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { email, password, name } = body;
    if (!email || !password) return res.status(400).json({ error: "Email y contraseña requeridos" });
    if (password.length < 8) return res.status(400).json({ error: "Password should be at least 8 characters" });
    if (WEAK.includes(password.toLowerCase())) return res.status(400).json({ error: "Password should be more secure" });
    if (/^\d+$/.test(password)) return res.status(400).json({ error: "Password should not be only numbers" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email" });

    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPA_URL || !SERVICE_KEY) return res.status(500).json({ error: "Supabase no configurado en el servidor" });

    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name: name || "" } }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data.msg || data.message || "Error creando cuenta" });
    return res.status(200).json({ user: { id: data.id, email: data.email }, message: "Cuenta creada. Ya puedes ingresar." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
