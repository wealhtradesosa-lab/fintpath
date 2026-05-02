// ═══════════════════════════════════════════════════════════════════════════
// PageHeader.jsx · Sesión 2-may-2026
//
// Header reusable para páginas internas con look "Optimus" (HeroVariantC).
//
// Captura los 3 elementos firma del estilo:
//   1. Em-dash + label pequeño arriba ("—— Dashboard")
//   2. Título MASIVO con letter-spacing apretado y fuente Plus Jakarta Sans
//   3. Subtítulo opcional con color secundario
//
// Drop-in: reemplaza patrones inconsistentes como
//   <h2 style={{fontSize:22, fontWeight:700}}>Título</h2>
//   <p style={{color:T.tx3}}>Subtítulo</p>
//
// Por:
//   <PageHeader label="Sección" title="Título Principal" subtitle="..." />
//
// La fuente Plus Jakarta Sans se carga vía Google Fonts en LandingPage
// (que es donde se imprime el <style> con @import). Para páginas internas,
// el Inter ya está cargado globalmente y Plus Jakarta Sans hace fallback
// a Inter si no está disponible.
// ═══════════════════════════════════════════════════════════════════════════

const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

export default function PageHeader({
  label,           // texto pequeño arriba ("—— Dashboard", "—— Patrimonio")
  title,           // título masivo
  subtitle,        // descripción debajo (opcional)
  accent,          // palabra del título a destacar con gradient (opcional)
  rightSlot,       // contenido a la derecha (botones de acción, opcional)
  compact = false, // versión compacta para módulos secundarios
}) {
  const titleSize = compact
    ? "clamp(1.75rem, 3.5vw, 2.5rem)"
    : "clamp(2rem, 5vw, 3.5rem)";

  return (
    <div style={{
      marginBottom: compact ? 24 : 36,
      paddingBottom: compact ? 0 : 4,
      display: "grid",
      gridTemplateColumns: rightSlot ? "1fr auto" : "1fr",
      gap: 24,
      alignItems: "end",
    }}>
      <div>
        {/* Em-dash + label (firma del estilo Optimus) */}
        {label && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: compact ? 12 : 16,
          }}>
            <span style={{
              width: compact ? 24 : 32,
              height: 1,
              background: "rgba(255,255,255,0.3)",
              display: "inline-block",
            }} />
            <span style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}>
              {label}
            </span>
          </div>
        )}

        {/* Título masivo */}
        <h1 style={{
          fontFamily: FONT_DISPLAY,
          fontSize: titleSize,
          fontWeight: 800,
          lineHeight: 1.0,
          letterSpacing: "-0.04em",
          margin: 0,
          color: "#fafafa",
        }}>
          {accent ? (
            <>
              {title.split(accent)[0]}
              <span style={{
                background: "linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {accent}
              </span>
              {title.split(accent)[1]}
            </>
          ) : title}
        </h1>

        {/* Subtítulo */}
        {subtitle && (
          <p style={{
            marginTop: 12,
            fontSize: compact ? 14 : 16,
            color: "rgba(255,255,255,0.65)",
            lineHeight: 1.5,
            maxWidth: 640,
            margin: "12px 0 0",
          }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Slot para botones de acción a la derecha (ej: "+ Agregar", "Importar Excel") */}
      {rightSlot && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {rightSlot}
        </div>
      )}
    </div>
  );
}
