// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · WizardTributario.jsx — Wizard conversacional tipo TurboTax
//
// PROPÓSITO:
//   Componente que guía al user paso a paso para entender sus impuestos.
//   Una pregunta a la vez, lenguaje natural, progreso visible, navegable.
//
// FLUJO:
//   1. Intro → 2. Trabajo → 3. Pensión (si aplica) → 4. Familia →
//   5. Ahorros → 6. Otros ingresos → 7. Patrimonio → 8. Revisión → 9. Resultado
//
// PROPS:
//   - user: user object actual
//   - onUpdateUser: callback para persistir nuevos datos
//   - onClose: callback cuando user termina o cancela
//   - selectedOwnerId: ID del owner natural a editar
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import {
  getWizardSteps,
  mapearRespuestasAUser,
  mapearRespuestasJuridicaAUser,
  siguientePasoVisible,
  pasoAnteriorVisible,
  totalPasosVisibles,
  posicionPasoVisible,
  precargarRespuestasDesdeUser,
} from "../lib/wizardSteps.js";
import { estimarImpuesto } from "../lib/taxCO.js";

// Paleta de alto contraste sobre fondo oscuro
const C = {
  bg: "#0a0a0c",
  bg2: "#16161a",
  bg3: "#222228",
  txt: "#ffffff",
  txt2: "#d4d4d8",
  txt3: "#a1a1aa",
  border: "rgba(255,255,255,0.10)",
  borderActive: "rgba(255,255,255,0.30)",
  green: "#4ade80",
  greenBg: "rgba(74,222,128,0.10)",
  blue: "#60a5fa",
  blueBg: "rgba(96,165,250,0.10)",
  orange: "#fb923c",
  purple: "#c4b5fd",
  red: "#f87171",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

export default function WizardTributario({ user, selectedOwnerId, onUpdateUser, onClose }) {
  const owner = (user?.owners || []).find(o => o.id === selectedOwnerId);
  const ownerName = owner?.name || "vos";
  const ownerType = owner?.type || "natural";

  // ─── Bifurcación crítica: elegir el wizard correcto según tipo de owner.
  // Antes (BUG): el wizard solo soportaba persona natural y le preguntaba
  // "salario" a una SAS jurídica. Ahora detecta el tipo y usa el set de
  // pasos apropiado: WIZARD_NATURAL (salario, dependientes, etc.) o
  // WIZARD_JURIDICA (régimen, ingresos operacionales, costos, ICA, etc.)
  const STEPS = useMemo(() => getWizardSteps(ownerType), [ownerType]);

  // Sesión 29-abr-2026: precarga inteligente. Si el user ya tiene datos
  // cargados (manualmente o de wizard anterior), los detectamos y precargamos
  // las respuestas del wizard. Así NO repreguntamos cosas que ya sabemos.
  // El user solo confirma/ajusta los valores existentes.
  const { answers: precargInicial, precargados: setPrecargados } = useMemo(
    () => precargarRespuestasDesdeUser(user, selectedOwnerId),
    [user, selectedOwnerId]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState(precargInicial);
  const [showResult, setShowResult] = useState(false);

  // Set de IDs de pasos cuyas respuestas vienen precargadas (para mostrar badge)
  const precargados = setPrecargados;

  // Si no hay owner válido, error
  if (!owner) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: C.txt2 }}>
        No se encontró la persona fiscal seleccionada.
        <br /><br />
        <button onClick={onClose} style={btnStyle(C.bg3, C.txt)}>Volver al resumen</button>
      </div>
    );
  }

  const currentStep = STEPS[stepIndex];
  const totalVisible = useMemo(() => totalPasosVisibles(answers, STEPS), [answers, STEPS]);
  const posActual = useMemo(() => posicionPasoVisible(stepIndex, answers, STEPS), [stepIndex, answers, STEPS]);
  const progreso = (posActual / totalVisible) * 100;

  // ── Manejo de respuestas ─────────────────────────────────────────────
  const handleAnswer = (value) => {
    const newAnswers = { ...answers, [currentStep.id]: value };
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    const next = siguientePasoVisible(stepIndex, answers, STEPS);
    if (next >= STEPS.length) {
      // Llegamos al final → mostrar resultado
      handleFinalizar();
    } else {
      setStepIndex(next);
    }
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      onClose?.();
      return;
    }
    const prev = pasoAnteriorVisible(stepIndex, answers, STEPS);
    setStepIndex(prev);
  };

  // ── Función que mapea respuestas según el tipo de owner.
  // Bifurcación crítica: persona natural usa estructura cedular (salarios,
  // honorarios, dependientes), persona jurídica usa estructura contable
  // (régimen, ingresos op., costos, ICA, patrimonio bruto declarado, etc).
  const mapearRespuestas = (answers) => {
    if (ownerType === "juridica") {
      return mapearRespuestasJuridicaAUser(answers, user, selectedOwnerId);
    }
    return mapearRespuestasAUser(answers, user, selectedOwnerId);
  };

  const handleFinalizar = () => {
    const newUser = mapearRespuestas(answers);
    onUpdateUser?.(newUser);
    setShowResult(true);
  };

  // ── Validación: ¿se puede avanzar? ───────────────────────────────────
  const canAdvance = useMemo(() => {
    if (currentStep.type === "intro" || currentStep.type === "review") return true;
    const a = answers[currentStep.id];
    if (currentStep.type === "single_select" || currentStep.type === "yes_no") {
      return a != null && a !== "";
    }
    if (currentStep.type === "number") {
      return a != null && a !== "" && !isNaN(Number(a)) && Number(a) >= 0;
    }
    return false;
  }, [currentStep, answers]);

  // ── Pantalla de resultado final ──────────────────────────────────────
  if (showResult) {
    const newUser = mapearRespuestas(answers);
    return <PantallaResultado user={newUser} ownerName={ownerName} answers={answers} onClose={onClose} />;
  }

  // ── Render principal del wizard ──────────────────────────────────────
  return (
    <div style={{ padding: "20px 0", maxWidth: 720, margin: "0 auto" }}>
      {/* Barra de progreso */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: C.txt3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Paso {posActual} de {totalVisible}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: C.txt3,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 8px",
            }}
          >
            ✕ Cerrar
          </button>
        </div>
        <div style={{ height: 6, background: C.bg3, borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: progreso + "%",
            background: `linear-gradient(90deg, ${C.green}, ${C.blue})`,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>

      {/* Card del paso actual */}
      <div style={{
        padding: "32px 32px",
        background: C.bg2,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        marginBottom: 20,
      }}>
        {/* Banner de precarga: si esta respuesta vino de datos existentes,
            le avisamos al user para que confirme/ajuste en lugar de empezar de cero */}
        {precargados.has(currentStep.id) && currentStep.type !== "intro" && currentStep.type !== "review" && (
          <div style={{
            background: C.greenBg,
            border: `1px solid ${C.green}40`,
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 16,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>✓</span>
            <div style={{ flex: 1, fontSize: 13, color: C.txt2, lineHeight: 1.5 }}>
              <strong style={{ color: C.green }}>Ya tengo este dato cargado.</strong>{" "}
              Confirmá si está bien o ajustá el valor si cambió.
            </div>
          </div>
        )}

        {currentStep.type === "intro" && <IntroStep step={currentStep} ownerName={ownerName} ownerType={ownerType} cantidadPrecargados={precargados.size} />}
        {currentStep.type === "single_select" && (
          <SingleSelectStep step={currentStep} value={answers[currentStep.id]} onChange={handleAnswer} />
        )}
        {currentStep.type === "yes_no" && (
          <SingleSelectStep step={currentStep} value={answers[currentStep.id]} onChange={handleAnswer} />
        )}
        {currentStep.type === "number" && (
          <NumberStep step={currentStep} value={answers[currentStep.id]} onChange={handleAnswer} onSubmit={handleNext} />
        )}
        {currentStep.type === "review" && (
          <ReviewStep answers={answers} ownerType={ownerType} onEdit={(stepId) => {
            const idx = STEPS.findIndex(s => s.id === stepId);
            if (idx >= 0) setStepIndex(idx);
          }} />
        )}
      </div>

      {/* Botones de navegación */}
      <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
        <button onClick={handleBack} style={btnStyle(C.bg3, C.txt)}>
          {stepIndex === 0 ? "✕ Cancelar" : "← Atrás"}
        </button>
        <button
          onClick={handleNext}
          disabled={!canAdvance}
          style={{
            ...btnStyle(canAdvance ? C.green : C.bg3, canAdvance ? "#000" : C.txt3),
            cursor: canAdvance ? "pointer" : "not-allowed",
            opacity: canAdvance ? 1 : 0.5,
            fontWeight: 800,
            padding: "12px 28px",
          }}
        >
          {currentStep.type === "intro" ? "Empezar →" :
            currentStep.type === "review" ? "Calcular mi impuesto →" :
              "Siguiente →"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES POR TIPO DE PASO
// ─────────────────────────────────────────────────────────────────────────

function IntroStep({ step, ownerName, cantidadPrecargados = 0, ownerType = "natural" }) {
  const tieneDatos = cantidadPrecargados > 0;
  const isJur = ownerType === "juridica";
  return (
    <div>
      <div style={{ fontSize: 48, marginBottom: 16, textAlign: "center" }}>{isJur ? "🏢" : "🤖"}</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: C.txt, margin: "0 0 14px 0", textAlign: "center", lineHeight: 1.3 }}>
        {tieneDatos ? (
          isJur
            ? <>Hola, vamos con la declaración de <span style={{ color: C.purple }}>{ownerName}</span> — ya tengo {cantidadPrecargados} datos cargados</>
            : <>Hola {ownerName !== "vos" ? ownerName : ""} 👋 ya tengo {cantidadPrecargados} datos tuyos cargados</>
        ) : (
          isJur
            ? <>Vamos a preparar la declaración de renta de <span style={{ color: C.purple }}>{ownerName}</span></>
            : <>Hola {ownerName !== "vos" ? ownerName : ""} 👋 vamos a entender tus impuestos juntos</>
        )}
      </h2>
      <p style={{ fontSize: 15, color: C.txt2, lineHeight: 1.6, textAlign: "center", margin: "0 auto", maxWidth: 540 }}>
        {tieneDatos
          ? `Detecté que ya cargaste varios datos ${isJur ? "de la sociedad" : "en la plataforma"}. Vamos a confirmarlos rápido y completar lo que falte. Si algo cambió, lo ajustás en el camino.`
          : step.helpText}
      </p>
      {isJur && (
        <div style={{ marginTop: 14, padding: "12px 16px", background: C.purpleBg || "rgba(196,181,253,0.10)", border: `1px solid ${C.purple}40`, borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: C.purple, fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>
            🏢 PERSONA JURÍDICA · F-110
          </div>
          <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.5 }}>
            Te voy a preguntar sobre régimen tributario, ingresos operacionales, costos, ICA y patrimonio.
            <strong style={{ color: C.txt }}> No te pregunto cosas de persona natural</strong> (salario, dependientes) porque no aplican a una sociedad.
          </div>
        </div>
      )}
      <div style={{ marginTop: 16, padding: "16px 20px", background: C.greenBg, border: `1px solid ${C.green}40`, borderRadius: 10 }}>
        <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginBottom: 6 }}>
          {tieneDatos ? "✨ Cómo va a ir esto:" : "✨ Lo que voy a hacer por vos:"}
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, color: C.txt2, fontSize: 13, lineHeight: 1.7 }}>
          {tieneDatos ? (
            <>
              <li>Los pasos con datos ya cargados muestran <strong style={{ color: C.green }}>✓ Ya tengo este dato</strong></li>
              <li>Solo confirmás (o ajustás si cambió)</li>
              <li>Los datos que falten te los pregunto normalmente</li>
              <li>Al final se actualiza tu cuenta con la nueva información</li>
            </>
          ) : isJur ? (
            <>
              <li>Te hago preguntas profesionales, una por vez</li>
              <li>Cada concepto contable explicado en lenguaje claro</li>
              <li>Detecto automáticamente palancas de optimización (régimen, donaciones, etc)</li>
              <li>Al final tenés un borrador F-110 para tu contador</li>
            </>
          ) : (
            <>
              <li>Te hago preguntas simples, una por vez</li>
              <li>Traduzco los términos técnicos a lenguaje humano</li>
              <li>Detecto automáticamente formas de ahorrar impuestos</li>
              <li>Al final tenés un borrador para mostrarle a tu contador</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

function SingleSelectStep({ step, value, onChange }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: C.txt, margin: "0 0 10px 0", lineHeight: 1.3 }}>
        {step.question}
      </h2>
      {step.helpText && (
        <p style={{ fontSize: 14, color: C.txt2, lineHeight: 1.5, margin: "0 0 24px 0" }}>
          💡 {step.helpText}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(step.options || []).map(opt => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                padding: "16px 18px",
                background: isSelected ? C.greenBg : C.bg3,
                border: `2px solid ${isSelected ? C.green : C.border}`,
                borderRadius: 12,
                color: C.txt,
                cursor: "pointer",
                textAlign: "left",
                fontSize: 15,
                fontWeight: isSelected ? 700 : 500,
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              {opt.emoji && <span style={{ fontSize: 22 }}>{opt.emoji}</span>}
              <span style={{ flex: 1 }}>{opt.label}</span>
              {isSelected && <span style={{ color: C.green, fontSize: 18 }}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberStep({ step, value, onChange, onSubmit }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: C.txt, margin: "0 0 10px 0", lineHeight: 1.3 }}>
        {step.question}
      </h2>
      {step.helpText && (
        <p style={{ fontSize: 14, color: C.txt2, lineHeight: 1.5, margin: "0 0 24px 0" }}>
          💡 {step.helpText}
        </p>
      )}
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute",
          left: 18,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 24,
          color: C.txt3,
          fontWeight: 700,
        }}>$</span>
        <input
          type="number"
          inputMode="numeric"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && Number(value) > 0) onSubmit(); }}
          placeholder={step.placeholder || "0"}
          autoFocus
          style={{
            width: "100%",
            padding: "18px 18px 18px 40px",
            paddingRight: step.suffix ? 100 : 18,
            background: C.bg3,
            border: `2px solid ${value ? C.green : C.border}`,
            borderRadius: 12,
            color: C.txt,
            fontSize: 24,
            fontWeight: 700,
            outline: "none",
            transition: "border 0.15s",
            boxSizing: "border-box",
          }}
        />
        {step.suffix && (
          <span style={{
            position: "absolute",
            right: 18,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 14,
            color: C.txt3,
            fontWeight: 600,
          }}>{step.suffix}</span>
        )}
      </div>
      {value && Number(value) > 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: C.txt2 }}>
          Equivale a <strong style={{ color: C.txt }}>{fm(Number(value))}</strong>
          {step.suffix === "/ mes" && (
            <> ({fm(Number(value) * 12)} al año)</>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewStep({ answers, ownerType, onEdit }) {
  // Construir resumen legible — ramificado por tipo de owner.
  // Persona natural: salario, dependientes, deducciones, etc.
  // Persona jurídica: régimen, ingresos op., costos, ICA, patrimonio.
  const items = [];

  if (ownerType === "juridica") {
    // ─── REVISIÓN PARA PERSONA JURÍDICA ─────────────────────────────────
    if (answers.regimenTributario) {
      const labelsRegimen = {
        ordinario: "Régimen Ordinario (35% sobre utilidad)",
        simple: "Régimen Simple (1.2-14% sobre ingresos)",
        zese_zomac: "Régimen especial (ZESE/ZOMAC)",
        esal: "Entidad Sin Ánimo de Lucro",
        no_se: "Régimen no determinado",
      };
      items.push({ key: "regimenTributario", label: "Régimen tributario", value: labelsRegimen[answers.regimenTributario] || answers.regimenTributario });
    }
    if (answers.actividadEconomica) {
      const labelsAct = {
        comercio_minorista: "Comercio al por menor",
        comercio_mayorista: "Comercio al por mayor",
        servicios_profesionales: "Servicios profesionales",
        tecnologia: "Tecnología / SaaS",
        manufactura: "Manufactura",
        construccion_inmobiliario: "Construcción / inmobiliario",
        alimentos_restaurantes: "Restaurantes / alimentos",
        salud: "Salud",
        educacion: "Educación",
        transporte_logistica: "Transporte / logística",
        agropecuario: "Agropecuario",
        rentas_pasivas: "Inversiones / holding",
        otra: "Otra actividad",
      };
      items.push({ key: "actividadEconomica", label: "Actividad económica", value: labelsAct[answers.actividadEconomica] || answers.actividadEconomica });
    }
    if (answers.ingresosOperacionalesAnual) items.push({ key: "ingresosOperacionalesAnual", label: "Ingresos operacionales", value: fm(answers.ingresosOperacionalesAnual) + " / año" });
    if (answers.tieneIngresosNoOp === "si" && answers.ingresosNoOpAnual) items.push({ key: "ingresosNoOpAnual", label: "Ingresos no operacionales", value: fm(answers.ingresosNoOpAnual) + " / año" });
    if (answers.costoVentasAnual) items.push({ key: "costoVentasAnual", label: "Costo de ventas", value: fm(answers.costoVentasAnual) + " / año" });
    if (answers.gastosOperacionalesAnual) items.push({ key: "gastosOperacionalesAnual", label: "Gastos operacionales", value: fm(answers.gastosOperacionalesAnual) + " / año" });
    if (answers.tieneInteresesPagados === "si" && answers.interesesPagadosAnual) items.push({ key: "interesesPagadosAnual", label: "Intereses pagados", value: fm(answers.interesesPagadosAnual) + " / año" });
    if (answers.icaPagadoAnual) items.push({ key: "icaPagadoAnual", label: "ICA pagado", value: fm(answers.icaPagadoAnual) + " / año" });
    if (answers.patrimonioBrutoCierre) items.push({ key: "patrimonioBrutoCierre", label: "Patrimonio bruto al cierre", value: fm(answers.patrimonioBrutoCierre) });
    if (answers.tieneDeudas === "si" && answers.pasivosTotales) items.push({ key: "pasivosTotales", label: "Pasivos totales", value: fm(answers.pasivosTotales) });
    if (answers.tieneRetenciones === "si" && answers.retencionesAnual) items.push({ key: "retencionesAnual", label: "Retenciones recibidas", value: fm(answers.retencionesAnual) + " / año" });
    if (answers.anticipoAnoAnterior) items.push({ key: "anticipoAnoAnterior", label: "Anticipo año anterior", value: fm(answers.anticipoAnoAnterior) });
    if (answers.tieneDonaciones === "si" && answers.donacionesAnual) items.push({ key: "donacionesAnual", label: "Donaciones a ESAL", value: fm(answers.donacionesAnual) + " / año" });
  } else {
    // ─── REVISIÓN PARA PERSONA NATURAL ──────────────────────────────────
    if (answers.tipoTrabajo) {
      const labels = {
        empleado: "Empleado con contrato",
        independiente: "Independiente con honorarios",
        ambos: "Empleo + honorarios",
        pensionado: "Pensionado",
        ninguno: "No trabajaste",
      };
      items.push({ key: "tipoTrabajo", label: "Tipo de trabajo", value: labels[answers.tipoTrabajo] });
    }
    if (answers.salarioMensual) items.push({ key: "salarioMensual", label: "Salario mensual", value: fm(answers.salarioMensual) });
    if (answers.honorariosAnual) items.push({ key: "honorariosAnual", label: "Honorarios anuales", value: fm(answers.honorariosAnual) });
    if (answers.pensionMensual) items.push({ key: "pensionMensual", label: "Pensión mensual", value: fm(answers.pensionMensual) });
    if (answers.tieneDependientes === "si") items.push({ key: "cantidadDependientes", label: "Dependientes", value: `${answers.cantidadDependientes || 1} personas` });
    if (answers.medicinaMensual) items.push({ key: "medicinaMensual", label: "Medicina prepagada", value: fm(answers.medicinaMensual) + "/mes" });
    if (answers.interesesViviendaAnual) items.push({ key: "interesesViviendaAnual", label: "Intereses vivienda", value: fm(answers.interesesViviendaAnual) + " anual" });
    if (answers.aportesPVMensual) items.push({ key: "aportesPVMensual", label: "Aportes pensión voluntaria", value: fm(answers.aportesPVMensual) + "/mes" });
    if (answers.rendimientosAnual) items.push({ key: "rendimientosAnual", label: "Rendimientos financieros", value: fm(answers.rendimientosAnual) + " anual" });
    if (answers.arriendosMensual) items.push({ key: "arriendosMensual", label: "Arriendos", value: fm(answers.arriendosMensual) + "/mes" });
  }

  return (
    <div>
      <div style={{ fontSize: 36, marginBottom: 12, textAlign: "center" }}>📋</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: C.txt, margin: "0 0 12px 0", lineHeight: 1.3, textAlign: "center" }}>
        {ownerType === "juridica" ? "Revisemos los datos de la sociedad" : "Revisemos lo que me contaste"}
      </h2>
      <p style={{ fontSize: 13, color: C.txt2, textAlign: "center", margin: "0 0 24px 0" }}>
        Si algo está mal, podés editarlo antes de calcular tu impuesto
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 && (
          <div style={{ textAlign: "center", color: C.txt3, padding: 20 }}>
            No respondiste preguntas con datos. Volvé atrás y completá al menos una.
          </div>
        )}
        {items.map((item) => (
          <div key={item.key} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            background: C.bg3,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.txt3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 15, color: C.txt, fontWeight: 700, marginTop: 2 }}>
                {item.value}
              </div>
            </div>
            <button onClick={() => onEdit(item.key)} style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: C.txt2,
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}>
              ✏️ Editar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PANTALLA DE RESULTADO FINAL
// ─────────────────────────────────────────────────────────────────────────

function PantallaResultado({ user, ownerName, answers, onClose }) {
  const estimacion = useMemo(() => estimarImpuesto(user), [user]);
  const det = estimacion?.detalle?.[0];

  if (!det) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.txt2 }}>
        No pude calcular tu impuesto con los datos. ¿Volvemos al inicio?
        <br /><br />
        <button onClick={onClose} style={btnStyle(C.bg3, C.txt)}>Volver</button>
      </div>
    );
  }

  const ingresoTotal = det.ingreso || 0;
  const retencionTotal = det.retefuenteNat || 0;
  const saldoFinal = det.impuesto || 0;
  const impuestoBruto = det.impBruto || 0;
  const tasaEfectiva = ingresoTotal > 0 ? (saldoFinal / ingresoTotal * 100) : 0;

  return (
    <div style={{ padding: "20px 0", maxWidth: 720, margin: "0 auto" }}>
      {/* Header celebratorio */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.txt, margin: "0 0 8px 0" }}>
          Listo, {ownerName !== "vos" ? ownerName : "ya"} terminamos
        </h1>
        <p style={{ fontSize: 15, color: C.txt2, margin: 0 }}>
          Acá está tu cálculo de impuestos para 2025
        </p>
      </div>

      {/* Tarjeta principal del saldo */}
      <div style={{
        padding: "32px 28px",
        background: C.bg2,
        border: `2px solid ${saldoFinal > 0 ? C.orange : C.green}`,
        borderRadius: 16,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, color: C.txt2, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {saldoFinal > 0 ? "💰 Lo que te toca pagar" : "✨ Tu situación"}
        </div>
        <div style={{
          fontSize: 56,
          fontWeight: 800,
          color: saldoFinal > 0 ? C.orange : C.green,
          lineHeight: 1.0,
          marginBottom: 12,
          letterSpacing: -1,
        }}>
          {fm(saldoFinal)}
        </div>
        <div style={{ fontSize: 14, color: C.txt2, lineHeight: 1.6 }}>
          {saldoFinal > 0 ? (
            <>Esto es <strong style={{ color: C.txt }}>{tasaEfectiva.toFixed(1)}%</strong> de
              tus ingresos totales del año. {tasaEfectiva < 5
                ? "Pagás muy poco efectivo — tu situación está optimizada."
                : tasaEfectiva < 15
                  ? "Es un nivel típico para alguien con tu perfil."
                  : "Es relativamente alto — vale la pena explorar palancas legales."}</>
          ) : (
            <>No tenés saldo a pagar este año. Tus retenciones cubren el impuesto.</>
          )}
        </div>
      </div>

      {/* Desglose simple */}
      <div style={{
        padding: "20px 24px",
        background: C.bg2,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, color: C.txt2, fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
          📊 Cómo llegamos a este número
        </div>
        <DesgloseRow label="Lo que ganaste en total" value={ingresoTotal} color={C.blue} />
        <DesgloseRow label="Impuesto calculado (antes de descuentos)" value={impuestoBruto} color={C.txt2} />
        <DesgloseRow label="Ya pagaste durante el año (retenciones)" value={retencionTotal} color={C.green} prefix="-" />
        <div style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: `2px solid ${C.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div style={{ fontSize: 14, color: C.txt, fontWeight: 700 }}>Saldo final a pagar</div>
          <div style={{ fontSize: 22, color: saldoFinal > 0 ? C.orange : C.green, fontWeight: 800, fontFamily: "monospace" }}>
            {fm(saldoFinal)}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        padding: "14px 18px",
        background: C.bg2,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${C.orange}`,
        borderRadius: 10,
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.6 }}>
          <strong style={{ color: C.orange }}>Recordá:</strong> este es un cálculo estimado con
          base en lo que me contaste. Antes de presentar a la DIAN, validalo siempre con tu
          contador. FINPATHIA es una herramienta de apoyo, no reemplaza la asesoría profesional.
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
        <button onClick={onClose} style={btnStyle(C.green, "#000")}>
          📋 Ver resumen completo y modo experto
        </button>
      </div>
    </div>
  );
}

function DesgloseRow({ label, value, color, prefix = "" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
      <div style={{ fontSize: 13, color: C.txt2, flex: 1 }}>{label}</div>
      <div style={{ fontSize: 14, color, fontWeight: 700, fontFamily: "monospace" }}>
        {prefix}{fm(value)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function btnStyle(bg, color) {
  return {
    background: bg,
    color: color,
    border: "none",
    padding: "12px 20px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s",
  };
}
