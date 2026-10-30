import { useEffect, useState } from "react";
import PageHeader from "./PageHeader";
import { C, Cα, F, R } from "../lib/designTokens";
import { Panel } from "./RentaUI";
import InformeContador from "./InformeContador";

/**
 * Para el contador (30-oct-2026, Santiago: "a los contadores, acceso de solo lectura").
 * Lista las cuentas que lo invitaron y muestra, de cada una, solo lo tributario:
 * lo filtra el servidor (RPC contador_datos), no la pantalla.
 */
export default function VistaContador({ supabase, clientes = [] }) {
  const [sel, setSel] = useState(clientes[0]?.account_id || null);
  const [datos, setDatos] = useState(null);
  const [estado, setEstado] = useState("");

  useEffect(() => {
    if (!sel || !supabase) return;
    let vivo = true;
    setDatos(null); setEstado("Cargando…");
    supabase.rpc("contador_datos", { p_account_id: sel }).then(({ data, error }) => {
      if (!vivo) return;
      if (error) { setEstado("No se pudo cargar: " + (error.message || "error")); return; }
      if (data?.cifrado) { setEstado("Este cliente tiene su información cifrada con su contraseña: pídele que te envíe el informe en PDF desde Impuestos › Informe para el contador."); return; }
      if (data?.vacio) { setEstado("Este cliente todavía no tiene información cargada."); return; }
      setDatos(data); setEstado("");
    });
    return () => { vivo = false; };
  }, [sel, supabase]);

  const cliente = clientes.find((c) => c.account_id === sel);
  const nombre = cliente ? (cliente.account_name || cliente.owner_name || cliente.owner_email) : "";

  if (!clientes.length) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <PageHeader label="Contador" title="Clientes que me comparten" compact />
        <Panel titulo="Todavía no tienes clientes">
          <div style={F.body}>Cuando un cliente te invite como contador desde su FINPATHIA, aparece aquí.</div>
        </Panel>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Panel titulo="Clientes que me comparten" sub="Solo lectura. Ves lo tributario de cada uno; no puedes cambiar nada.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {clientes.map((c) => {
            const on = c.account_id === sel;
            return (
              <button key={c.account_id} type="button" onClick={() => setSel(c.account_id)}
                style={{ textAlign: "left", padding: "10px 14px", borderRadius: R.md, cursor: "pointer", border: `1px solid ${on ? Cα.accent25 : C.border}`, background: on ? Cα.accent08 : C.raised, color: C.text }}>
                <div style={F.h3}>{c.account_name || c.owner_name}</div>
                <div style={F.caption}>{c.owner_email}</div>
              </button>
            );
          })}
        </div>
      </Panel>
      {estado && <div style={{ ...F.body, color: C.muted }}>{estado}</div>}
      {datos && <InformeContador key={sel} u={datos} modoContador cliente={nombre} />}
    </div>
  );
}
