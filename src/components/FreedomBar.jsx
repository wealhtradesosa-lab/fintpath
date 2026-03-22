import { useMemo } from "react";

/* ═══════════════════════════════════════════════════
   FINANCIAL FREEDOM BAR — Tony Robbins 5 Levels
   Money: Master the Game
   
   1. Seguridad Financiera — Pasivos cubren necesidades básicas
   2. Vitalidad Financiera — Seguridad + mitad del estilo de vida
   3. Independencia Financiera — Pasivos cubren TODO
   4. Libertad Financiera — Independencia + lujos extras
   5. Libertad Absoluta — Sin límites
   ═══════════════════════════════════════════════════ */

const T = {
  bg3: "#1e1e24", bg4: "#2a2a32",
  card: "#141418", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", blue: "#3b82f6", purple: "#a78bfa",
  orange: "#f97316", gold: "#eab308", cyan: "#22d3ee",
};

const LEVELS = [
  {
    id: 1, name: "Seguridad Financiera", nameEn: "Financial Security",
    icon: "🛡️", color: "#3b82f6",
    desc: "Tus ingresos pasivos cubren necesidades básicas: vivienda, comida, servicios, seguros, transporte",
    robbins: "El primer sueño: nunca preocuparte por las cuentas básicas",
    // % of total expenses that count as "basic needs" — typically 60-70%
    factor: 0.65,
  },
  {
    id: 2, name: "Vitalidad Financiera", nameEn: "Financial Vitality",
    icon: "⚡", color: "#22d3ee",
    desc: "Seguridad + la mitad de tus gastos de estilo de vida (entretenimiento, paseos, extras)",
    robbins: "Empiezas a disfrutar sin culpa — la mitad de tus lujos están cubiertos",
    factor: 0.825, // 65% + half of remaining 35% = 82.5%
  },
  {
    id: 3, name: "Independencia Financiera", nameEn: "Financial Independence",
    icon: "🏆", color: "#22c55e",
    desc: "Tus ingresos pasivos cubren el 100% de tu estilo de vida actual",
    robbins: "Ya no NECESITAS trabajar. Trabajas porque QUIERES, no porque DEBES",
    factor: 1.0,
  },
  {
    id: 4, name: "Libertad Financiera", nameEn: "Financial Freedom",
    icon: "🚀", color: "#f97316",
    desc: "Independencia + 2-3 lujos grandes: mejor casa, viajes premium, educación top, vehículo soñado",
    robbins: "Vives exactamente como soñabas. Sin compromisos. Sin excusas",
    factor: 1.5,
  },
  {
    id: 5, name: "Libertad Absoluta", nameEn: "Absolute Freedom",
    icon: "👑", color: "#eab308",
    desc: "Puedes hacer literalmente lo que quieras, cuando quieras, donde quieras. Sin límites",
    robbins: "El sueño máximo: cada día es exactamente como tú lo diseñas",
    factor: 2.5,
  },
];

export default function FreedomBar({ totals, compact }) {
  const { ni = 0, te = 0, cf = 0, nw = 0 } = totals || {};

  // Calculate which level the user is at
  const analysis = useMemo(() => {
    if (!te || te === 0) return { currentLevel: 0, progress: 0, nextLevel: LEVELS[0], passiveRatio: 0 };

    const passiveRatio = ni / te; // ratio of passive income to total expenses
    
    let currentLevel = 0;
    let nextLevel = LEVELS[0];
    let progressInLevel = 0;

    for (let i = 0; i < LEVELS.length; i++) {
      if (passiveRatio >= LEVELS[i].factor) {
        currentLevel = i + 1;
        nextLevel = i < LEVELS.length - 1 ? LEVELS[i + 1] : LEVELS[i];
      }
    }

    // Calculate progress to next level
    if (currentLevel === 0) {
      progressInLevel = (passiveRatio / LEVELS[0].factor) * 100;
    } else if (currentLevel >= 5) {
      progressInLevel = 100;
    } else {
      const prevFactor = LEVELS[currentLevel - 1].factor;
      const nextFactor = LEVELS[currentLevel].factor;
      progressInLevel = ((passiveRatio - prevFactor) / (nextFactor - prevFactor)) * 100;
    }

    // Overall progress (0-100 across all 5 levels)
    const overallProgress = Math.min((passiveRatio / LEVELS[4].factor) * 100, 100);

    // Monthly gap to next level
    const nextRequiredIncome = nextLevel.factor * te;
    const monthlyGap = Math.max(0, nextRequiredIncome - ni);

    // Estimated time to next level (assuming current savings rate invested at 8% return)
    const annualSavings = cf * 12;
    const additionalIncomeNeeded = monthlyGap;
    // At 8% return, need capital of: additionalIncomeNeeded * 12 / 0.08
    const capitalNeeded = (additionalIncomeNeeded * 12) / 0.08;
    const yearsToNext = annualSavings > 0 ? capitalNeeded / annualSavings : 999;

    return {
      currentLevel,
      currentLevelData: currentLevel > 0 ? LEVELS[currentLevel - 1] : null,
      nextLevel,
      passiveRatio,
      progressInLevel: Math.min(Math.max(progressInLevel, 0), 100),
      overallProgress,
      monthlyGap,
      capitalNeeded,
      yearsToNext: Math.max(0, yearsToNext),
    };
  }, [ni, te, cf]);

  const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");

  // ─── COMPACT VERSION (for header/sidebar) ──
  if (compact) {
    const level = analysis.currentLevelData;
    const color = level?.color || T.txt3;
    return (
      <div style={{ padding: "12px 16px", background: T.bg3, borderRadius: 12, border: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: T.txt3 }}>Nivel Financiero</span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{level?.icon} {level?.name || "Iniciando"}</span>
        </div>
        <div style={{ height: 8, background: T.bg4, borderRadius: 4, overflow: "hidden", position: "relative" }}>
          {LEVELS.map((l, i) => (
            <div key={i} style={{ position: "absolute", left: `${(l.factor / LEVELS[4].factor) * 100}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.1)" }} />
          ))}
          <div style={{ width: `${analysis.overallProgress}%`, height: "100%", background: `linear-gradient(90deg, ${T.blue}, ${T.green}, ${T.orange}, ${T.gold})`, borderRadius: 4, transition: "width 0.5s ease" }} />
        </div>
      </div>
    );
  }

  // ─── FULL VERSION ──
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 28, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: T.txt }}>Tu Camino a la Libertad Financiera</h3>
          <p style={{ fontSize: 13, color: T.txt3, margin: "4px 0 0" }}>Basado en los 5 niveles de Tony Robbins — "Money: Master the Game"</p>
        </div>
        {analysis.currentLevelData && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: analysis.currentLevelData.color + "15", border: `1px solid ${analysis.currentLevelData.color}25`, borderRadius: 12, padding: "8px 16px" }}>
            <span style={{ fontSize: 24 }}>{analysis.currentLevelData.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: analysis.currentLevelData.color }}>{analysis.currentLevelData.name}</div>
              <div style={{ fontSize: 11, color: T.txt3 }}>Nivel {analysis.currentLevel} de 5</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Progress Bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ height: 32, background: T.bg3, borderRadius: 16, overflow: "hidden", position: "relative" }}>
          {/* Level markers */}
          {LEVELS.map((l, i) => {
            const pos = (l.factor / LEVELS[4].factor) * 100;
            return (
              <div key={i} style={{ position: "absolute", left: `${pos}%`, top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.08)", zIndex: 2 }}>
                <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", fontSize: 14 }}>{l.icon}</div>
              </div>
            );
          })}
          {/* Fill */}
          <div style={{
            width: `${analysis.overallProgress}%`, height: "100%",
            background: `linear-gradient(90deg, ${T.blue} 0%, ${T.cyan} 25%, ${T.green} 50%, ${T.orange} 75%, ${T.gold} 100%)`,
            borderRadius: 16, transition: "width 0.8s ease",
            display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 12,
            minWidth: analysis.overallProgress > 5 ? 60 : 0,
          }}>
            {analysis.overallProgress > 10 && (
              <span style={{ fontSize: 12, fontWeight: 800, color: "#000", textShadow: "0 0 4px rgba(255,255,255,0.3)" }}>
                {analysis.passiveRatio >= 1 ? (analysis.passiveRatio * 100).toFixed(0) + "%" : (analysis.passiveRatio * 100).toFixed(0) + "%"}
              </span>
            )}
          </div>
        </div>

        {/* Level labels under bar */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, position: "relative" }}>
          {LEVELS.map((l, i) => {
            const pos = (l.factor / LEVELS[4].factor) * 100;
            const reached = analysis.currentLevel >= l.id;
            return (
              <div key={i} style={{ position: "absolute", left: `${pos}%`, transform: "translateX(-50%)", textAlign: "center", width: 80 }}>
                <div style={{ fontSize: 10, fontWeight: reached ? 700 : 500, color: reached ? l.color : T.txt3, lineHeight: 1.2 }}>{l.name.split(" ")[0]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5 Level Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 32, marginBottom: 20 }}>
        {LEVELS.map((l) => {
          const reached = analysis.currentLevel >= l.id;
          const current = analysis.currentLevel === l.id;
          const required = l.factor * te;
          return (
            <div key={l.id} style={{
              background: current ? l.color + "12" : reached ? "rgba(255,255,255,0.02)" : T.bg3,
              border: `1px solid ${current ? l.color + "40" : reached ? l.color + "20" : T.border}`,
              borderRadius: 14, padding: "14px 12px", textAlign: "center", position: "relative",
              opacity: reached || current ? 1 : 0.5,
            }}>
              {reached && <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: l.color }} />}
              <div style={{ fontSize: 22, marginBottom: 6 }}>{l.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: reached ? l.color : T.txt3, marginBottom: 4, lineHeight: 1.2 }}>{l.name}</div>
              <div style={{ fontSize: 10, color: T.txt3 }}>Necesitas</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: reached ? l.color : T.txt2, fontFamily: "monospace" }}>{fmt(required)}<span style={{ fontSize: 10, fontWeight: 400 }}>/mes</span></div>
            </div>
          );
        })}
      </div>

      {/* Status / Next Steps */}
      {analysis.currentLevel < 5 && (
        <div style={{
          background: `linear-gradient(135deg, ${analysis.nextLevel.color}08, ${analysis.nextLevel.color}04)`,
          border: `1px solid ${analysis.nextLevel.color}20`,
          borderRadius: 14, padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: analysis.nextLevel.color, marginBottom: 4 }}>
              {analysis.nextLevel.icon} Siguiente: {analysis.nextLevel.name}
            </div>
            <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5 }}>
              {analysis.nextLevel.robbins}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: T.txt3 }}>Te faltan</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: analysis.nextLevel.color }}>{fmt(analysis.monthlyGap)}<span style={{ fontSize: 11 }}>/mes</span></div>
            </div>
            {analysis.yearsToNext < 50 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.txt3 }}>Estimado</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.txt }}>{analysis.yearsToNext.toFixed(1)} <span style={{ fontSize: 11, color: T.txt3 }}>años</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      {analysis.currentLevel >= 5 && (
        <div style={{
          background: "linear-gradient(135deg, rgba(234,179,8,0.1), rgba(234,179,8,0.04))",
          border: "1px solid rgba(234,179,8,0.25)",
          borderRadius: 14, padding: 24, textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👑</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.gold }}>¡Libertad Absoluta!</div>
          <div style={{ fontSize: 14, color: T.txt2, marginTop: 4 }}>
            Tus ingresos pasivos son {(analysis.passiveRatio * 100).toFixed(0)}% de tus gastos. Cada día es como tú lo diseñas.
          </div>
        </div>
      )}
    </div>
  );
}
