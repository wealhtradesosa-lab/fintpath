// ═══════════════════════════════════════════════════════════════════════════
// AJUSTES FISCALES PERSONALIZADOS — Calculadora de impuestos, Fase 2 (Commit 8.2)
// ─────────────────────────────────────────────────────────────────────────
// 12 switches que un contador profesional preguntaría para optimizar
// legalmente el impuesto. Organizados en 3 grupos colapsables:
//
//   Grupo A — Personal (dependientes, auxilios)
//   Grupo B — Eventos del año (herencia, venta inmueble, lotería)
//   Grupo C — Estatus y beneficios (contabilidad, ESAL, CTI, zonas)
//
// Persistencia:
//   Grupo A y C → owner.fiscalProfile (dato permanente)
//   Grupo B     → owner.fiscalProfile.eventosAno (eventos del año gravable)
//
// En Fase 2 la UI captura y guarda los datos. En Fase 3 el motor los lee
// y los aplica al cálculo real. Hoy el impacto estimado que se muestra
// en cada switch es textual/informativo, no re-calcula el motor aún.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  border: "rgba(255,255,255,0.06)",
  green: "#22c55e", red: "#ef4444", orange: "#f97316", blue: "#3b82f6", purple: "#a78bfa",
};

const UVT = 52_374; // 2026
const fm = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  return "$" + Math.round(n).toLocaleString("es-CO");
};

// ─────────────────────────────────────────────────────────────────────────
// Row de switch toggle simple
// ─────────────────────────────────────────────────────────────────────────
function SwitchRow({ label, descripcion, baseLegal, impactoTexto, value, onChange, children }) {
  return (
    <div style={{ padding: "12px 14px", background: T.bg3, borderRadius: 8, marginBottom: 8, border: "1px solid " + (value ? "rgba(34,197,94,0.3)" : T.border) }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <button
          type="button"
          onClick={() => onChange(!value)}
          style={{
            flexShrink: 0, width: 38, height: 22, borderRadius: 11,
            background: value ? T.green : T.bg2,
            border: "1px solid " + (value ? T.green : T.border),
            position: "relative", cursor: "pointer", padding: 0, marginTop: 2,
            transition: "background 0.2s",
          }}
        >
          <div style={{
            position: "absolute", top: 2, left: value ? 18 : 2,
            width: 16, height: 16, borderRadius: 8,
            background: value ? "#000" : T.txt3, transition: "left 0.2s",
          }} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.txt, lineHeight: 1.4 }}>{label}</div>
          {descripcion && <div style={{ fontSize: 11, color: T.txt2, marginTop: 3, lineHeight: 1.5 }}>{descripcion}</div>}
          {baseLegal && <div style={{ fontSize: 9, color: T.txt3, marginTop: 4, fontFamily: "monospace" }}>📖 {baseLegal}</div>}
          {impactoTexto && value && <div style={{ fontSize: 10, color: T.green, marginTop: 4, fontWeight: 600 }}>💚 {impactoTexto}</div>}
          {value && children && <div style={{ marginTop: 10 }}>{children}</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// NumberInput integrado
// ─────────────────────────────────────────────────────────────────────────
function NumberInput({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      {label && <div style={{ fontSize: 10, color: T.txt3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>}
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder={placeholder}
        style={{
          width: "100%", background: T.bg2, border: "1px solid " + T.border,
          color: T.txt, padding: "8px 10px", borderRadius: 6, fontSize: 12,
          fontFamily: "monospace", outline: "none",
        }}
      />
      {hint && <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sección colapsable
// ─────────────────────────────────────────────────────────────────────────
function Collapsible({ icono, titulo, descripcion, cantActivos, total, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ marginBottom: 14, border: "1px solid " + T.border, borderRadius: 10, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "14px 16px", background: T.bg2, border: "none",
          color: T.txt, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 18 }}>{icono}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{titulo}</div>
          {descripcion && <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>{descripcion}</div>}
        </div>
        <div style={{ fontSize: 11, color: cantActivos > 0 ? T.green : T.txt3, fontWeight: 600 }}>
          {cantActivos > 0 ? `${cantActivos} activos` : `${total} preguntas`}
        </div>
        <span style={{ fontSize: 14, color: T.txt3, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>▶</span>
      </button>
      {open && <div style={{ padding: "14px 16px", background: T.bg }}>{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────
export default function AjustesFiscalesPersonalizados({ owner, onUpdate }) {
  const profile = owner?.fiscalProfile || {};
  const eventos = profile.eventosAno || {};

  // Helpers de update
  const updateProfile = (patch) => {
    const newProfile = { ...profile, ...patch };
    onUpdate?.(newProfile);
  };
  const updateEvento = (patch) => {
    const newEventos = { ...eventos, ...patch };
    updateProfile({ eventosAno: newEventos });
  };

  // Contadores para cada sección
  const cantGrupoA = useMemo(() => {
    let n = 0;
    if ((profile.dependientes?.cantidad || 0) > 0) n++;
    if (profile.dependientes?.conDiscapacidad) n++;
    if (profile.auxilios?.alimentacion) n++;
    if (profile.auxilios?.transporte) n++;
    return n;
  }, [profile]);

  const cantGrupoB = useMemo(() => {
    let n = 0;
    if (eventos.recibioHerencia) n++;
    if (eventos.vendioInmuebleAntiguo) n++;
    if (eventos.ganoLoteria) n++;
    return n;
  }, [eventos]);

  const cantGrupoC = useMemo(() => {
    let n = 0;
    if (profile.obligadoContabilidad) n++;
    if (profile.honorariosConPersonal) n++;
    if ((profile.donaciones?.monto || 0) > 0) n++;
    if ((profile.inversionesCTI?.monto || 0) > 0) n++;
    if (profile.regimenEspecial) n++;
    return n;
  }, [profile]);

  const totalActivos = cantGrupoA + cantGrupoB + cantGrupoC;

  const esNatural = owner?.type !== "juridica";

  return (
    <div>
      {/* Header del módulo */}
      <div style={{ marginBottom: 14, padding: "12px 14px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.blue, marginBottom: 4 }}>
          ⚙️ Ajustes fiscales personalizados {totalActivos > 0 && <span style={{ color: T.green }}>({totalActivos} activos)</span>}
        </div>
        <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          Un contador senior te haría estas preguntas para optimizar tu impuesto legalmente. Contestá solo las que apliquen a vos — el resto quedan vacías y no afectan el cálculo.
        </div>
      </div>

      {/* ═══════════════ GRUPO A — Personal ═══════════════ */}
      {esNatural && (
        <Collapsible
          icono="👨‍👩‍👧"
          titulo="Familia y auxilios laborales"
          descripcion="Dependientes económicos y beneficios laborales exentos"
          cantActivos={cantGrupoA}
          total={4}
        >
          {/* 1 y 2: Dependientes */}
          <SwitchRow
            label="Tengo dependientes económicos a cargo"
            descripcion="Cónyuge sin ingresos, hijos menores, hijos hasta 25 años estudiando, o padres dependientes económicamente."
            baseLegal="Art. 387 parr 2 ET"
            impactoTexto={(profile.dependientes?.cantidad || 0) > 0 ? `Deducción hasta 10% del ingreso laboral, tope 384 UVT/año (${fm(384 * UVT)})` : ""}
            value={(profile.dependientes?.cantidad || 0) > 0}
            onChange={(v) => updateProfile({ dependientes: v ? { cantidad: 1, conDiscapacidad: profile.dependientes?.conDiscapacidad } : { cantidad: 0 } })}
          >
            <NumberInput
              label="¿Cuántos dependientes?"
              value={profile.dependientes?.cantidad}
              onChange={(v) => updateProfile({ dependientes: { ...profile.dependientes, cantidad: v } })}
              placeholder="Ej: 2"
              hint="Número total de personas que dependen económicamente de vos."
            />
            <div style={{ marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, color: T.txt2 }}>
                <input
                  type="checkbox"
                  checked={!!profile.dependientes?.conDiscapacidad}
                  onChange={(e) => updateProfile({ dependientes: { ...profile.dependientes, conDiscapacidad: e.target.checked } })}
                />
                Alguno tiene <strong style={{ color: T.txt }}>discapacidad certificada</strong> (amplía la deducción)
              </label>
            </div>
          </SwitchRow>

          {/* 3: Auxilio alimentación */}
          <SwitchRow
            label="Mi empleador me paga auxilio de alimentación"
            descripcion="Exento hasta 41 UVT mensuales. Si recibís vales, bonos o pagos específicos para alimentación."
            baseLegal="Art. 387-1 ET"
            impactoTexto={profile.auxilios?.alimentacion ? `Exento hasta ${fm(41 * UVT)}/mes` : ""}
            value={!!profile.auxilios?.alimentacion}
            onChange={(v) => updateProfile({ auxilios: { ...profile.auxilios, alimentacion: v } })}
          >
            <NumberInput
              label="Monto mensual recibido"
              value={profile.auxilios?.alimentacionMonto}
              onChange={(v) => updateProfile({ auxilios: { ...profile.auxilios, alimentacionMonto: v } })}
              placeholder="Ej: 800000"
              hint={`Tope exento: ${fm(41 * UVT)}/mes. Lo que exceda sí se grava.`}
            />
          </SwitchRow>

          {/* 4: Auxilio transporte */}
          <SwitchRow
            label="Recibo auxilio de transporte"
            descripcion="Obligatorio para salarios hasta 2 SMLMV. Es exento por naturaleza salarial."
            baseLegal="Art. 206 ET"
            impactoTexto={profile.auxilios?.transporte ? "Exento en su totalidad si aplica" : ""}
            value={!!profile.auxilios?.transporte}
            onChange={(v) => updateProfile({ auxilios: { ...profile.auxilios, transporte: v } })}
          />
        </Collapsible>
      )}

      {/* ═══════════════ GRUPO B — Eventos del año ═══════════════ */}
      {esNatural && (
        <Collapsible
          icono="📅"
          titulo="Eventos del año gravable"
          descripcion="Hechos que generan ganancias ocasionales (tarifa 15% / 20%)"
          cantActivos={cantGrupoB}
          total={3}
        >
          {/* 5: Herencia */}
          <SwitchRow
            label="Recibí herencia, legado o donación"
            descripcion="Se gravan como ganancia ocasional al 15%. Hay un monto exento dependiendo del tipo de bien."
            baseLegal="Arts. 302, 307, 313 ET"
            impactoTexto="Tarifa 15% sobre el valor que exceda el tope exento"
            value={!!eventos.recibioHerencia}
            onChange={(v) => updateEvento({ recibioHerencia: v })}
          >
            <NumberInput
              label="Valor total recibido"
              value={eventos.herenciaMonto}
              onChange={(v) => updateEvento({ herenciaMonto: v })}
              placeholder="Ej: 100000000"
              hint="Antes de aplicar exenciones."
            />
          </SwitchRow>

          {/* 6: Venta inmueble > 2 años */}
          <SwitchRow
            label="Vendí un inmueble que tenía hace más de 2 años"
            descripcion="La utilidad se grava como ganancia ocasional al 15%, no como renta ordinaria (Art. 300). Mucho más favorable."
            baseLegal="Arts. 300, 311-1, 313 ET"
            impactoTexto="Tarifa 15% sobre la utilidad (valor venta - costo fiscal)"
            value={!!eventos.vendioInmuebleAntiguo}
            onChange={(v) => updateEvento({ vendioInmuebleAntiguo: v })}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <NumberInput label="Valor venta" value={eventos.inmuebleValorVenta} onChange={(v) => updateEvento({ inmuebleValorVenta: v })} placeholder="$" />
              <NumberInput label="Costo fiscal" value={eventos.inmuebleCostoFiscal} onChange={(v) => updateEvento({ inmuebleCostoFiscal: v })} placeholder="$" hint="Valor de adquisición + mejoras documentadas" />
            </div>
          </SwitchRow>

          {/* 7: Lotería */}
          <SwitchRow
            label="Gané lotería, rifa, apuesta o concurso"
            descripcion="Tarifa fija del 20% sobre el premio. Se paga por anticipado al retirar el premio."
            baseLegal="Art. 317 ET"
            impactoTexto="Tarifa 20% sobre el total del premio"
            value={!!eventos.ganoLoteria}
            onChange={(v) => updateEvento({ ganoLoteria: v })}
          >
            <NumberInput
              label="Monto del premio bruto"
              value={eventos.loteriaMonto}
              onChange={(v) => updateEvento({ loteriaMonto: v })}
              placeholder="$"
              hint="Premio antes de retenciones aplicadas."
            />
          </SwitchRow>
        </Collapsible>
      )}

      {/* ═══════════════ GRUPO C — Estatus y beneficios ═══════════════ */}
      <Collapsible
        icono="⚖️"
        titulo="Estatus del contribuyente y beneficios especiales"
        descripcion="Situaciones que cambian tu régimen o te dan descuentos tributarios"
        cantActivos={cantGrupoC}
        total={5}
      >
        {/* 8: Contabilidad */}
        {esNatural && (
          <SwitchRow
            label="Estoy obligado a llevar contabilidad"
            descripcion="Cambia el tratamiento de rendimientos financieros — NO se aplica componente inflacionario a los intereses recibidos."
            baseLegal="Arts. 38-39 ET"
            impactoTexto="Los intereses bancarios tributan 100% (sin componente inflacionario del 50.88%)"
            value={!!profile.obligadoContabilidad}
            onChange={(v) => updateProfile({ obligadoContabilidad: v })}
          />
        )}

        {/* 9: Honorarios con personal */}
        {esNatural && (
          <SwitchRow
            label="Mis honorarios requieren contratar personal"
            descripcion="Si tenés 2 o más empleados contratados por 90+ días para ejercer tu actividad, se amplían las deducciones permitidas."
            baseLegal="Art. 336 ET (régimen CON vs SIN empleados)"
            impactoTexto="Permite deducir costos y gastos de la actividad (Art. 107 ET) más amplios"
            value={!!profile.honorariosConPersonal}
            onChange={(v) => updateProfile({ honorariosConPersonal: v })}
          />
        )}

        {/* 10: Donaciones ESAL */}
        <SwitchRow
          label="Hice donaciones a entidades sin ánimo de lucro calificadas"
          descripcion="Las donaciones a ESAL del régimen tributario especial (fundaciones calificadas) dan descuento tributario del 25%."
          baseLegal="Art. 257 ET"
          impactoTexto="Descuento directo del 25% del valor donado sobre el impuesto a pagar"
          value={(profile.donaciones?.monto || 0) > 0}
          onChange={(v) => updateProfile({ donaciones: v ? { monto: profile.donaciones?.monto || 0 } : { monto: 0 } })}
        >
          <NumberInput
            label="Total donado en el año"
            value={profile.donaciones?.monto}
            onChange={(v) => updateProfile({ donaciones: { ...profile.donaciones, monto: v } })}
            placeholder="$"
            hint="Asegurate que la ESAL esté en el régimen tributario especial y te dé certificado de donación."
          />
        </SwitchRow>

        {/* 11: CTI / cine / primera infancia */}
        <SwitchRow
          label="Invertí en CTI, cine colombiano o primera infancia"
          descripcion="Inversiones en Ciencia/Tecnología/Innovación, producciones cinematográficas (Ley 814), o programas de primera infancia dan descuentos tributarios importantes."
          baseLegal="Arts. 256, 114-2 ET; Ley 814/2003"
          impactoTexto="Descuento tributario entre 25% y 50% según el programa (con topes)"
          value={(profile.inversionesCTI?.monto || 0) > 0}
          onChange={(v) => updateProfile({ inversionesCTI: v ? { monto: profile.inversionesCTI?.monto || 0, tipo: profile.inversionesCTI?.tipo || "cti" } : { monto: 0 } })}
        >
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: T.txt3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Tipo</div>
            <select
              value={profile.inversionesCTI?.tipo || "cti"}
              onChange={(e) => updateProfile({ inversionesCTI: { ...profile.inversionesCTI, tipo: e.target.value } })}
              style={{ width: "100%", background: T.bg2, border: "1px solid " + T.border, color: T.txt, padding: "8px 10px", borderRadius: 6, fontSize: 12 }}
            >
              <option value="cti">Ciencia, Tecnología e Innovación (Art. 256)</option>
              <option value="cine">Producción cinematográfica (Ley 814)</option>
              <option value="primera_infancia">Primera infancia (Art. 114-2)</option>
            </select>
          </div>
          <NumberInput
            label="Monto invertido"
            value={profile.inversionesCTI?.monto}
            onChange={(v) => updateProfile({ inversionesCTI: { ...profile.inversionesCTI, monto: v } })}
            placeholder="$"
            hint="Requiere certificación del programa al momento de declarar."
          />
        </SwitchRow>

        {/* 12: Régimen especial */}
        <SwitchRow
          label="Estoy en un régimen tributario especial"
          descripcion="Zona Franca, ZOMAC (Zonas Más Afectadas por el Conflicto), CHC (Compañías Holding Colombianas) — cada uno con su tarifa preferencial."
          baseLegal="Arts. 240-1 (ZF), 150-237 Ley 1819 (ZOMAC), 894-898 ET (CHC)"
          impactoTexto="Tarifas reducidas: ZF 20%, ZOMAC progresivo 0-50%, CHC exenciones específicas"
          value={!!profile.regimenEspecial}
          onChange={(v) => updateProfile({ regimenEspecial: v ? (profile.regimenEspecial || "zona_franca") : null })}
        >
          <div>
            <div style={{ fontSize: 10, color: T.txt3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Régimen</div>
            <select
              value={profile.regimenEspecial || "zona_franca"}
              onChange={(e) => updateProfile({ regimenEspecial: e.target.value })}
              style={{ width: "100%", background: T.bg2, border: "1px solid " + T.border, color: T.txt, padding: "8px 10px", borderRadius: 6, fontSize: 12 }}
            >
              <option value="zona_franca">Zona Franca (tarifa 20%)</option>
              <option value="zomac">ZOMAC (tarifa progresiva)</option>
              <option value="chc">CHC — Compañía Holding Colombiana</option>
              <option value="mega_inversion">Mega-inversión (Art. 235-3)</option>
            </select>
          </div>
        </SwitchRow>
      </Collapsible>

      {/* Nota Fase 2 */}
      <div style={{ padding: "12px 14px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, fontSize: 11, color: T.txt2, lineHeight: 1.6 }}>
        ⚠️ <strong style={{ color: T.orange }}>Fase 2 en progreso:</strong> por ahora los ajustes que activás se <strong>guardan en tu perfil</strong> pero el motor de cálculo todavía no los aplica al impuesto mostrado arriba. Eso viene en Fase 3 (arreglo de los bugs fiscales pendientes). Contestá las preguntas que apliquen — cuando el motor los consuma, tus datos ya estarán cargados.
      </div>
    </div>
  );
}
