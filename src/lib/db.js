import { supabase, isSupabaseConfigured } from "./supabase";

const SK = "finpath-v3";

/* ═══════════════════════════════════════════════════
   DATA LAYER — Supabase when configured, localStorage fallback
   This means the app works identically in both modes.
   ═══════════════════════════════════════════════════ */

// ─── AUTH ───
export const auth = {
  async signUp(email, password, name) {
    if (!isSupabaseConfigured) {
      // Demo mode: store in localStorage
      const user = { id: "local_" + Date.now(), email, name };
      return { user, error: null };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { user: data?.user, error };
  },

  async signIn(email, password) {
    if (!isSupabaseConfigured) {
      // Demo mode
      const stored = localStorage.getItem(SK);
      if (stored) {
        const d = JSON.parse(stored);
        if (d.profile?.email === email) return { user: { id: "local", email }, error: null };
      }
      return { user: { id: "local_" + Date.now(), email }, error: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { user: data?.user, error };
  },

  async signOut() {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(SK);
      return { error: null };
    }
    return await supabase.auth.signOut();
  },

  async getSession() {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(SK);
      if (stored) {
        const d = JSON.parse(stored);
        return { user: { id: "local", email: d.profile?.email || "" }, profile: d.profile };
      }
      return { user: null };
    }
    const { data } = await supabase.auth.getSession();
    return { user: data?.session?.user || null };
  },

  async resetPassword(email) {
    if (!isSupabaseConfigured) return { error: null };
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
  },

  onAuthChange(callback) {
    if (!isSupabaseConfigured) return { unsubscribe: () => {} };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return data.subscription;
  },
};

// ─── DATA CRUD ───
export const db = {
  // ── Profile ──
  async getProfile(userId) {
    if (!isSupabaseConfigured) {
      const d = JSON.parse(localStorage.getItem(SK) || "null");
      return d?.profile || null;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    return data;
  },

  async updateProfile(userId, updates) {
    if (!isSupabaseConfigured) {
      const d = JSON.parse(localStorage.getItem(SK) || "{}");
      d.profile = { ...d.profile, ...updates };
      localStorage.setItem(SK, JSON.stringify(d));
      return d.profile;
    }
    const { data } = await supabase.from("profiles").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", userId).select().single();
    return data;
  },

  // ── Generic table CRUD ──
  async getAll(table, userId) {
    if (!isSupabaseConfigured) {
      const d = JSON.parse(localStorage.getItem(SK) || "{}");
      const map = { investments: "inv", ingresos: "ingresos", deudas: "deu", gastos: "gas", trading: "ibk", pension_settings: "pen" };
      return d[map[table] || table] || (table === "gastos" ? {} : []);
    }
    const { data } = await supabase.from(table).select("*").eq("user_id", userId).order("created_at");
    // For gastos, convert rows to object format { category: [items] }
    if (table === "gastos" && data) {
      const obj = {};
      data.forEach((row) => { obj[row.categoria] = row.items || []; });
      return obj;
    }
    return data || [];
  },

  async insert(table, userId, item) {
    if (!isSupabaseConfigured) {
      const d = JSON.parse(localStorage.getItem(SK) || "{}");
      const map = { investments: "inv", ingresos: "ingresos", deudas: "deu", trading: "ibk" };
      const key = map[table] || table;
      if (!d[key]) d[key] = [];
      const newItem = { ...item, id: table[0] + "_" + Date.now() };
      d[key].push(newItem);
      localStorage.setItem(SK, JSON.stringify(d));
      return newItem;
    }
    const { data } = await supabase.from(table).insert({ ...item, user_id: userId }).select().single();
    return data;
  },

  async update(table, id, updates) {
    if (!isSupabaseConfigured) {
      const d = JSON.parse(localStorage.getItem(SK) || "{}");
      // Find and update in the right array
      for (const key of Object.keys(d)) {
        if (Array.isArray(d[key])) {
          const idx = d[key].findIndex((i) => i.id === id);
          if (idx >= 0) {
            d[key][idx] = { ...d[key][idx], ...updates };
            localStorage.setItem(SK, JSON.stringify(d));
            return d[key][idx];
          }
        }
      }
      return null;
    }
    const { data } = await supabase.from(table).update(updates).eq("id", id).select().single();
    return data;
  },

  async remove(table, id) {
    if (!isSupabaseConfigured) {
      const d = JSON.parse(localStorage.getItem(SK) || "{}");
      for (const key of Object.keys(d)) {
        if (Array.isArray(d[key])) {
          d[key] = d[key].filter((i) => i.id !== id);
        }
      }
      localStorage.setItem(SK, JSON.stringify(d));
      return true;
    }
    await supabase.from(table).delete().eq("id", id);
    return true;
  },

  // ── Gastos (special: category-based) ──
  async updateGastos(userId, gastosObj) {
    if (!isSupabaseConfigured) {
      const d = JSON.parse(localStorage.getItem(SK) || "{}");
      d.gas = gastosObj;
      localStorage.setItem(SK, JSON.stringify(d));
      return gastosObj;
    }
    // Upsert each category
    for (const [cat, items] of Object.entries(gastosObj)) {
      const { data: existing } = await supabase.from("gastos").select("id").eq("user_id", userId).eq("categoria", cat).single();
      if (existing) {
        await supabase.from("gastos").update({ items, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("gastos").insert({ user_id: userId, categoria: cat, items });
      }
    }
    return gastosObj;
  },

  // ── Pension settings (single record per user) ──
  async getPension(userId) {
    if (!isSupabaseConfigured) {
      const d = JSON.parse(localStorage.getItem(SK) || "{}");
      return d.pen || {};
    }
    const { data } = await supabase.from("pension_settings").select("*").eq("user_id", userId).single();
    return data || {};
  },

  async updatePension(userId, settings) {
    if (!isSupabaseConfigured) {
      const d = JSON.parse(localStorage.getItem(SK) || "{}");
      d.pen = { ...d.pen, ...settings };
      localStorage.setItem(SK, JSON.stringify(d));
      return d.pen;
    }
    const { data: existing } = await supabase.from("pension_settings").select("id").eq("user_id", userId).single();
    if (existing) {
      const { data } = await supabase.from("pension_settings").update({ ...settings, updated_at: new Date().toISOString() }).eq("user_id", userId).select().single();
      return data;
    }
    const { data } = await supabase.from("pension_settings").insert({ user_id: userId, ...settings }).select().single();
    return data;
  },

  // ── Bulk save (for demo data load) ──
  async loadDemoData(userId, { inv, deu, gas, ibk, ingresos }) {
    if (!isSupabaseConfigured) {
      const d = JSON.parse(localStorage.getItem(SK) || "{}");
      d.inv = inv; d.deu = deu; d.gas = gas; d.ibk = ibk; d.ingresos = ingresos;
      localStorage.setItem(SK, JSON.stringify(d));
      return true;
    }
    // Clear existing data
    await Promise.all([
      supabase.from("investments").delete().eq("user_id", userId),
      supabase.from("deudas").delete().eq("user_id", userId),
      supabase.from("gastos").delete().eq("user_id", userId),
      supabase.from("trading").delete().eq("user_id", userId),
      supabase.from("ingresos").delete().eq("user_id", userId),
    ]);
    // Insert demo data
    if (inv?.length) await supabase.from("investments").insert(inv.map((i) => ({ ...i, user_id: userId })));
    if (deu?.length) await supabase.from("deudas").insert(deu.map((d) => ({ ...d, user_id: userId })));
    if (ibk?.length) await supabase.from("trading").insert(ibk.map((t) => ({ ...t, user_id: userId })));
    if (ingresos?.length) await supabase.from("ingresos").insert(ingresos.map((i) => ({ ...i, user_id: userId })));
    if (gas) {
      for (const [cat, items] of Object.entries(gas)) {
        await supabase.from("gastos").insert({ user_id: userId, categoria: cat, items });
      }
    }
    return true;
  },
};
