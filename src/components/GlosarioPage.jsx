// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · GlosarioPage.jsx
//
// PROPÓSITO:
//   Página dedicada que muestra todos los términos del glosario tributario
//   en lenguaje humano. Sirve como referencia central para que el user pueda
//   aprender términos en cualquier momento (no solo cuando aparecen inline
//   en otra pantalla).
//
//   Soporta búsqueda en tiempo real (filtra por nombre, sinónimos, categoría)
//   y agrupa los términos por categoría visual (Unidades, Cédulas, Tipos
//   de impuesto, Deducciones, Documentos, etc.).
//
// FILOSOFÍA:
//   - Búsqueda fuzzy: "uvt", "valor", "tributario" → todos llevan a UVT
//   - Agrupación visual por categoría con íconos
//   - Cada término en card limpia con: nombre completo, explicación, ejemplo
//   - Mobile-first: tarjetas que se adaptan
//   - Sin links externos: el contenido es autónomo
//
// USO:
//   Se monta como una nueva "page" en App.jsx vía pg === "glosario".
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import GLOSARIO from "../lib/glosario.js";

// Paleta consistente con el resto de la app
const C = {
  bg: "#0a0a0c",
  bg2: "#16161a",
  bg3: "#222228",
  txt: "#ffffff",
  txt2: "#d4d4d8",
  txt3: "#a1a1aa",
  border: "rgba(255,255,255,0.10)",
  green: "#4ade80",
  greenBg: "rgba(74,222,128,0.10)",
  blue: "#60a5fa",
  blueBg: "rgba(96,165,250,0.10)",
  purple: "#c4b5fd",
  purpleBg: "rgba(196,181,253,0.10)",
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.10)",
};

// ─────────────────────────────────────────────────────────────────────────
// CATEGORIZACIÓN DE TÉRMINOS
// El glosario.js no tiene metadata de categoría por término. Acá la
// agregamos para que el agrupamiento visual sea coherente. Los keys
// que no estén en este map caen en "Otros".
// ─────────────────────────────────────────────────────────────────────────

const CATEGORIAS = [
  {
    id: "unidades",
    titulo: "Unidades y Constantes",
    icono: "📐",
    color: C.blue,
    descripcion: "Las 'monedas fiscales' y bases con las que la DIAN expresa todos los topes y sanciones.",
    keys: ["uvt", "smmlv", "trm"],
  },
  {
    id: "cedulas",
    titulo: "Cédulas Tributarias",
    icono: "📂",
    color: C.purple,
    descripcion: "Los 'cajones' donde se clasifican tus ingresos. Cada cédula tributa con sus propias reglas.",
    keys: ["cedula", "cedulaGeneral", "cedulaCapital", "cedulaNoLaboral", "cedulaDividendos"],
  },
  {
    id: "rentas",
    titulo: "Tipos de Renta",
    icono: "💰",
    color: C.green,
    descripcion: "Categorías profesionales de ingresos que la ley colombiana trata distinto.",
    keys: ["gananciaOcasional", "rentaExenta", "incrngo", "rentaPresuntiva", "componenteInflacionario"],
  },
  {
    id: "deducciones",
    titulo: "Deducciones y Beneficios",
    icono: "💎",
    color: C.green,
    descripcion: "Mecanismos legales para reducir tu base gravable y pagar menos impuesto.",
    keys: ["deduccion", "afc", "pensionVoluntaria", "dependientes"],
  },
  {
    id: "operaciones",
    titulo: "Operaciones Tributarias",
    icono: "🔁",
    color: C.orange,
    descripcion: "Mecanismos de pago, retención y ajuste que aparecen en tu día a día fiscal.",
    keys: ["retencion", "autoretencion", "anticipo", "saldoAFavor", "tasaEfectiva"],
  },
  {
    id: "impuestos",
    titulo: "Impuestos y Cargas",
    icono: "🏛️",
    color: C.orange,
    descripcion: "Los distintos tributos colombianos que pueden afectar tu declaración.",
    keys: ["gmf", "ica"],
  },
  {
    id: "personas",
    titulo: "Tipos de Contribuyente",
    icono: "👥",
    color: C.purple,
    descripcion: "Las categorías legales de quienes declaran impuestos en Colombia.",
    keys: ["personaNatural", "personaJuridica", "holding"],
  },
  {
    id: "regimenes",
    titulo: "Regímenes Tributarios",
    icono: "⚖️",
    color: C.purple,
    descripcion: "Los esquemas fiscales que aplican a sociedades. Definen tu tarifa y obligaciones.",
    keys: ["regimenOrdinario", "regimenSimple"],
  },
  {
    id: "patrimonio",
    titulo: "Patrimonio",
    icono: "🏦",
    color: C.blue,
    descripcion: "Los conceptos de balance que aparecen al declarar tu patrimonio fiscal.",
    keys: ["patrimonioBruto", "patrimonioLiquido", "pasivos"],
  },
  {
    id: "documentos",
    titulo: "Formularios DIAN",
    icono: "📄",
    color: C.blue,
    descripcion: "Los formatos oficiales que usás para declarar.",
    keys: ["f110", "f210"],
  },
  {
    id: "entidades",
    titulo: "Entidades y Organismos",
    icono: "🏢",
    color: C.txt2,
    descripcion: "Las instituciones que regulan o intervienen en tu vida fiscal.",
    keys: ["dian"],
  },
];

const fmt = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

export default function GlosarioPage({ onClose }) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("todas");

  // ── Construir índice categorizado (con detección de "Otros") ─────────
  const categoriasConTerminos = useMemo(() => {
    const claveACategoria = {};
    CATEGORIAS.forEach(cat => {
      cat.keys.forEach(k => { claveACategoria[k] = cat.id; });
    });

    // Mapa categoría -> términos. Inicializamos con todas las categorías + "otros"
    const result = {};
    CATEGORIAS.forEach(cat => { result[cat.id] = { ...cat, terminos: [] }; });
    result.otros = {
      id: "otros",
      titulo: "Otros términos",
      icono: "📌",
      color: C.txt3,
      descripcion: "Términos adicionales que aparecen en la app.",
      terminos: [],
    };

    // Distribuir las claves del GLOSARIO en sus categorías
    Object.entries(GLOSARIO).forEach(([clave, definicion]) => {
      const catId = claveACategoria[clave] || "otros";
      if (!result[catId]) result[catId] = result.otros;
      result[catId].terminos.push({ clave, ...definicion });
    });

    // Filtrar categorías sin términos para no mostrar bloques vacíos
    return Object.values(result).filter(c => c.terminos.length > 0);
  }, []);

  // ── Aplicar filtro de búsqueda ────────────────────────────────────────
  const categoriasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q && categoriaActiva === "todas") return categoriasConTerminos;

    return categoriasConTerminos
      .filter(c => categoriaActiva === "todas" || c.id === categoriaActiva)
      .map(c => ({
        ...c,
        terminos: c.terminos.filter(t => {
          if (!q) return true;
          // Búsqueda fuzzy: clave + nombre + nombre completo + explicación
          const haystack = [
            t.clave,
            t.termino || "",
            t.nombreCompleto || "",
            t.explicacion || "",
            t.ejemplo || "",
          ].join(" ").toLowerCase();
          return haystack.includes(q);
        }),
      }))
      .filter(c => c.terminos.length > 0);
  }, [busqueda, categoriaActiva, categoriasConTerminos]);

  const totalTerminos = categoriasConTerminos.reduce((s, c) => s + c.terminos.length, 0);
  const totalFiltrados = categoriasFiltradas.reduce((s, c) => s + c.terminos.length, 0);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* ─────── HEADER ─────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: C.greenBg, border: `1px solid ${C.green}40`, borderRadius: 999 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: 0.5 }}>📚 GLOSARIO TRIBUTARIO</span>
          </div>
          <span style={{ fontSize: 12, color: C.txt3 }}>{totalTerminos} términos · Actualizado 2026</span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.2 }}>
          Aprendé el lenguaje de tu declaración
        </h1>
        <p style={{ fontSize: 15, color: C.txt2, marginTop: 8, lineHeight: 1.5, maxWidth: 720 }}>
          La declaración de renta usa palabras técnicas que rara vez se explican bien.
          Acá tenés todos los términos que aparecen en la app traducidos a lenguaje humano,
          con ejemplos concretos. Sin DIAN-speak.
        </p>
      </div>

      {/* ─────── BARRA DE BÚSQUEDA ─────── */}
      <div style={{
        marginBottom: 20,
        padding: "14px 16px",
        background: C.bg2,
        border: `1.5px solid ${C.border}`,
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 18, color: C.txt3 }}>🔍</span>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscá un término... (ej: UVT, retención, dependientes, ICA)"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: C.txt,
            fontSize: 15,
            outline: "none",
            fontFamily: "inherit",
          }}
          autoFocus
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda("")}
            style={{
              background: C.bg3,
              border: `1px solid ${C.border}`,
              color: C.txt2,
              padding: "5px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* ─────── CHIPS DE CATEGORÍAS ─────── */}
      <div style={{ marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ChipCategoria
          activo={categoriaActiva === "todas"}
          onClick={() => setCategoriaActiva("todas")}
          color={C.green}
        >
          ✨ Todas ({totalTerminos})
        </ChipCategoria>
        {categoriasConTerminos.map(c => (
          <ChipCategoria
            key={c.id}
            activo={categoriaActiva === c.id}
            onClick={() => setCategoriaActiva(c.id)}
            color={c.color}
          >
            {c.icono} {c.titulo} ({c.terminos.length})
          </ChipCategoria>
        ))}
      </div>

      {/* ─────── RESULTADO DE BÚSQUEDA ─────── */}
      {busqueda && (
        <div style={{
          marginBottom: 20,
          padding: "10px 14px",
          background: C.blueBg,
          border: `1px solid ${C.blue}40`,
          borderRadius: 8,
          fontSize: 13,
          color: C.txt2,
        }}>
          {totalFiltrados === 0 ? (
            <span>No encontré nada para <strong style={{ color: C.txt }}>"{busqueda}"</strong>. Probá con otra palabra clave.</span>
          ) : (
            <span>
              {totalFiltrados} {totalFiltrados === 1 ? "término encontrado" : "términos encontrados"} para <strong style={{ color: C.txt }}>"{busqueda}"</strong>
            </span>
          )}
        </div>
      )}

      {/* ─────── LISTADO POR CATEGORÍA ─────── */}
      {categoriasFiltradas.length === 0 && !busqueda && (
        <div style={{ padding: 40, textAlign: "center", color: C.txt3 }}>
          No hay términos en esta categoría.
        </div>
      )}

      {categoriasFiltradas.map(cat => (
        <SeccionCategoria key={cat.id} categoria={cat} />
      ))}

      {/* ─────── FOOTER EDUCATIVO ─────── */}
      <div style={{
        marginTop: 40,
        padding: "20px 24px",
        background: C.bg2,
        border: `1px dashed ${C.border}`,
        borderRadius: 12,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 13, color: C.txt2, lineHeight: 1.6, maxWidth: 600, margin: "0 auto" }}>
          <strong style={{ color: C.txt }}>¿Falta algún término?</strong> El glosario crece según lo que pidan los users.
          Si encontraste una palabra que no entendés mientras usás la app, escribinos y la agregamos.
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: C.txt3 }}>
          Las definiciones reflejan el Estatuto Tributario vigente en 2026 y la jurisprudencia DIAN actual.
          Para dudas específicas de tu caso, siempre conviene confirmar con tu contador.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────────

function ChipCategoria({ activo, onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: `1.5px solid ${activo ? color : C.border}`,
        background: activo ? `${color}20` : "transparent",
        color: activo ? color : C.txt2,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function SeccionCategoria({ categoria }) {
  return (
    <div style={{ marginBottom: 32 }}>
      {/* Header de categoría */}
      <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>{categoria.icono}</span>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.2 }}>
              {categoria.titulo}
            </h2>
            {categoria.descripcion && (
              <p style={{ fontSize: 12, color: C.txt3, marginTop: 4, marginBottom: 0, lineHeight: 1.4 }}>
                {categoria.descripcion}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tarjetas de términos */}
      <div style={{ display: "grid", gap: 10 }}>
        {categoria.terminos.map(t => (
          <TarjetaTermino key={t.clave} termino={t} color={categoria.color} />
        ))}
      </div>
    </div>
  );
}

function TarjetaTermino({ termino, color }) {
  return (
    <div style={{
      padding: "16px 18px",
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
    }}>
      {/* Nombre del término */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: C.txt }}>
          {termino.termino || termino.clave}
        </span>
        {termino.nombreCompleto && termino.nombreCompleto !== termino.termino && (
          <span style={{ fontSize: 12, color: C.txt3, fontStyle: "italic" }}>
            {termino.nombreCompleto}
          </span>
        )}
      </div>

      {/* Explicación */}
      <p style={{ fontSize: 13, color: C.txt2, lineHeight: 1.6, margin: 0 }}>
        {termino.explicacion}
      </p>

      {/* Ejemplo si existe */}
      {termino.ejemplo && (
        <div style={{
          marginTop: 10,
          padding: "8px 12px",
          background: C.bg3,
          borderRadius: 6,
          fontSize: 12,
          color: C.txt2,
          lineHeight: 1.5,
        }}>
          <span style={{ color, fontWeight: 700, marginRight: 6 }}>📝 Ejemplo:</span>
          {termino.ejemplo}
        </div>
      )}
    </div>
  );
}
