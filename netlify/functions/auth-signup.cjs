const FT_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "landing_path"];
function cleanFirstTouch(a) {
  if (!a || typeof a !== "object") return null;
  const o = {};
  for (const k of FT_KEYS) if (typeof a[k] === "string" && a[k]) o[k] = a[k].slice(0, 200);
  if (Number.isFinite(a.ts)) o.ts = a.ts;
  return Object.keys(o).length ? o : null;
}
exports.cleanFirstTouch = cleanFirstTouch;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const { email, password, name, attribution } = JSON.parse(event.body);
    if (!email || !password) return { statusCode: 400, headers, body: JSON.stringify({ error: "Email y contraseña requeridos" }) };

    // Sesión 4-may-2026: validación de password en backend (defense in depth).
    // Aunque el frontend ya valida, alguien podría bypasear con curl directo.
    // Bloqueamos passwords débiles aquí también para garantizar el mínimo.
    if (password.length < 8) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Password should be at least 8 characters" }) };
    }
    const weakPasswords = ["12345678","password","qwerty12","11111111","00000000","abcdefgh","87654321","password1","password2","contrasena","password123","qwertyuiop","asdfghjkl","zxcvbnm123","12345abc","abc12345"];
    if (weakPasswords.includes(password.toLowerCase())) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Password should be more secure" }) };
    }
    if (/^\d+$/.test(password)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Password should not be only numbers" }) };
    }

    // Validación email básica (Supabase también valida pero damos error claro antes)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid email" }) };
    }

    // Primer toque (brief /patrimonio): solo claves permitidas, cadenas cortas.
    const firstTouch = cleanFirstTouch(attribution);

    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    // Create user via admin API (auto-confirms email)
    const res = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || "", ...(firstTouch ? { first_touch: firstTouch } : {}) },
      }),
    });

    const data = await res.json();
    if (!res.ok) return { statusCode: 400, headers, body: JSON.stringify({ error: data.msg || data.message || "Error creando cuenta" }) };

    return { statusCode: 200, headers, body: JSON.stringify({ user: { id: data.id, email: data.email }, message: "Cuenta creada. Ya puedes ingresar." }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
