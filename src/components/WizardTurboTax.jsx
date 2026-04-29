// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · WizardTurboTax.jsx
//
// PROPÓSITO:
//   Wizard conversacional tipo TurboTax que guía a una persona común sin
//   formación tributaria a través de su declaración de renta. UNA pregunta
//   por pantalla, lenguaje natural, sin tecnicismos DIAN.
//
// FILOSOFÍA:
//   - Una sola pregunta por pantalla (foco máximo)
//   - Lenguaje conversacional ("¿Cuánto te pagaron al mes?")
//   - Cada pregunta tiene un "¿Por qué te preguntamos esto?" expandible
//   - Botones grandes, no tipografía pequeña
//   - Skip-friendly: si no aplica, "No, saltame esta"
//   - Progreso visible (paso 4 de 11)
//   - Al final: aplica las respuestas al user (merge no destructivo)
//
// FLUJO DE PASOS:
//   1. Bienvenida
//   2. ¿Cómo trabajaste el año pasado? (empleado/independiente/mixto/sin ingresos)
//   3. ¿Cuánto te pagaron al mes? (salario)
//   4. ¿Cuánto facturaste al mes? (honorarios) [si aplica]
//   5. ¿Tenés personas que dependan de ti?
//   6. ¿Tenés crédito hipotecario sobre tu vivienda?
//   7. ¿Pagás medicina prepagada o seguros médicos?
//   8. ¿Aportás a pensión voluntaria o AFC?
//   9. ¿Tenés ahorros que generen intereses (CDT, etc.)?
//  10. ¿Recibís dinero por arriendos?
//  11. Resumen + aplicar a tu cuenta
//
// AL FINALIZAR: invoca onComplete(answers, mergedUser) — la pantalla padre
// decide qué hacer (aplicar al user real o solo simular).
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";

// Paleta consistente con AgenteTributarioBienvenida (alto contraste WCAG AA)
const C = {
  bg: "#0a0a0c",
  bg2: "#16161a",
  bg3: "#222228",
  txt: "#ffffff",
  txt2: "#d4d4d8",
  txt3: "#a1a1aa",
  border: "rgba(255,255,255,0.10)",
  borderActive: "rgba(255,255,255,0.40)",
  green: "#4ade80",
  greenBg: "rgba(74,222,128,0.10)",
  blue: "#60a5fa",
  blueBg: "rgba(96,165,250,0.10)",
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.10)",
  red: "#f87171",
  purple: "#c4b5fd",
  purpleBg: "rgba(196,181,253,0.10)",
};

const fmt = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────

export default function WizardTurboTax({ user, onComplete, onCancel }) {
  const [answers, setAnswers] = useState({});
  const [stepIndex, setStepIndex] = useState(0);

  // Definición de pasos con condiciones de visibilidad
  const allSteps = [
    { id: "welcome", Component: StepWelcome },
    { id: "tipoTrabajo", Component: StepTipoTrabajo },
    {
      id: "salario",
      Component: StepSalario,
      shownIf: (a) => ["empleado", "mixto"].includes(a.tipoTrabajo),
    },
    {
      id: "honorarios",
      Component: StepHonorarios,
      shownIf: (a) => ["independiente", "mixto"].includes(a.tipoTrabajo),
    },
    { id: "dependientes", Component: StepDependientes },
    { id: "vivienda", Component: StepVivienda },
    { id: "salud", Component: StepSalud },
    { id: "pensionVoluntaria", Component: StepPensionVoluntaria },
    { id: "ahorros", Component: StepAhorros },
    { id: "arriendos", Component: StepArriendos },
    { id: "review", Component: StepReview },
  ];

  // Filtrar pasos visibles según respuestas hasta ahora
  const visibleSteps = useMemo(
    () => allSteps.filter((s) => !s.shownIf || s.shownIf(answers)),
    [answers]
  );

  const currentStep = visibleSteps[stepIndex];
  const totalSteps = visibleSteps.length;
  const progressPct = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;

  const handleNext = (updates) => {
    const newAnswers = { ...answers, ...updates };
    setAnswers(newAnswers);

    // Si el paso siguiente cambia con las nuevas respuestas, recalcular
    const newVisibleSteps = allSteps.filter(
      (s) => !s.shownIf || s.shownIf(newAnswers)
    );
    const newIndex = stepIndex + 1;

    if (newIndex >= newVisibleSteps.length) {
      // Wizard completado
      onComplete(newAnswers);
    } else {
      setStepIndex(newIndex);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  if (!currentStep) {
    return <div style={{ padding: 40, color: C.txt }}>Cargando...</div>;
  }

  const StepComponent = currentStep.Component;

  return (
    <div style={{ minHeight: "70vh", padding: "20px 0" }}>
      {/* Barra de progreso fija arriba */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 13, color: C.txt, fontWeight: 700 }}>
            Paso {stepIndex + 1} de {totalSteps}
          </div>
          <button
            onClick={() => {
              if (stepIndex === 0 || confirm("¿Salir del wizard? Tu progreso no se guardará.")) {
                onCancel();
              }
            }}
            style={{
              background: C.bg3,
              border: `1.5px solid ${C.border}`,
              color: C.txt,
              padding: "8px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ← Salir
          </button>
        </div>
        <div
          style={{
            height: 6,
            background: C.bg3,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${C.green}, ${C.blue})`,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Contenido del paso actual */}
      <div
        style={{
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: "32px 32px",
        }}
      >
        <StepComponent
          answers={answers}
          onNext={handleNext}
          onBack={handleBack}
          isFirst={stepIndex === 0}
          user={user}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTES REUSABLES PARA PASOS
// ─────────────────────────────────────────────────────────────────────────

function PreguntaTitle({ children, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: C.txt,
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {children}
      </h2>
      {subtitle && (
        <p
          style={{
            fontSize: 15,
            color: C.txt2,
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function PorQueExpandible({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: "none",
          color: C.blue,
          fontSize: 13,
          cursor: "pointer",
          fontWeight: 600,
          padding: 0,
        }}
      >
        {open ? "▼" : "▶"} ¿Por qué te preguntamos esto?
      </button>
      {open && (
        <div
          style={{
            marginTop: 10,
            padding: "12px 16px",
            background: C.blueBg,
            border: `1px solid ${C.blue}40`,
            borderRadius: 10,
            fontSize: 13,
            color: C.txt2,
            lineHeight: 1.6,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function OptionCard({ icon, title, description, onClick, selected }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "18px 20px",
        background: selected ? C.greenBg : C.bg3,
        border: `1.5px solid ${selected ? C.green : C.border}`,
        borderRadius: 12,
        cursor: "pointer",
        width: "100%",
        transition: "all 0.15s",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
      onMouseOver={(e) => {
        if (!selected) e.currentTarget.style.borderColor = C.borderActive;
      }}
      onMouseOut={(e) => {
        if (!selected) e.currentTarget.style.borderColor = C.border;
      }}
    >
      {icon && <span style={{ fontSize: 26, flexShrink: 0 }}>{icon}</span>}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: C.txt,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        {description && (
          <div style={{ fontSize: 13, color: C.txt2, lineHeight: 1.5 }}>
            {description}
          </div>
        )}
      </div>
    </button>
  );
}

function NumberInput({ value, onChange, placeholder, label, prefix = "$" }) {
  return (
    <div>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            color: C.txt2,
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        {prefix && (
          <span
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              color: C.txt3,
              fontSize: 18,
              fontWeight: 700,
              pointerEvents: "none",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: prefix ? "16px 16px 16px 36px" : "16px",
            fontSize: 18,
            fontWeight: 600,
            background: C.bg3,
            border: `1.5px solid ${C.border}`,
            borderRadius: 10,
            color: C.txt,
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = C.blue)}
          onBlur={(e) => (e.target.style.borderColor = C.border)}
        />
      </div>
    </div>
  );
}

function ButtonRow({
  onBack,
  onNext,
  nextLabel = "Siguiente",
  nextDisabled = false,
  showBack = true,
  showSkip = false,
  onSkip,
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginTop: 28,
        flexWrap: "wrap",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", gap: 10 }}>
        {showBack && (
          <button
            onClick={onBack}
            style={{
              padding: "12px 20px",
              background: "transparent",
              border: `1.5px solid ${C.border}`,
              borderRadius: 10,
              color: C.txt2,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Atrás
          </button>
        )}
        {showSkip && (
          <button
            onClick={onSkip}
            style={{
              padding: "12px 20px",
              background: "transparent",
              border: "none",
              color: C.txt3,
              cursor: "pointer",
              fontSize: 13,
              textDecoration: "underline",
            }}
          >
            Saltar esta pregunta
          </button>
        )}
      </div>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        style={{
          padding: "14px 28px",
          background: nextDisabled ? C.bg3 : C.green,
          border: "none",
          borderRadius: 10,
          color: nextDisabled ? C.txt3 : "#000",
          cursor: nextDisabled ? "not-allowed" : "pointer",
          fontSize: 15,
          fontWeight: 800,
          opacity: nextDisabled ? 0.5 : 1,
        }}
      >
        {nextLabel} →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 1: Bienvenida
// ─────────────────────────────────────────────────────────────────────────

function StepWelcome({ onNext, isFirst, user }) {
  const nombre = user?.owners?.[0]?.name || "";
  return (
    <div>
      <div style={{ fontSize: 56, marginBottom: 16 }}>👋</div>
      <PreguntaTitle subtitle="Te voy a hacer unas preguntas simples sobre tu año. Tarda 5-10 minutos. Al final tenés un cálculo de tu impuesto que tu contador puede revisar.">
        Hola{nombre ? ` ${nombre}` : ""}, vamos a hacer tu declaración juntos
      </PreguntaTitle>
      <div
        style={{
          background: C.greenBg,
          border: `1px solid ${C.green}40`,
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 14, color: C.txt, lineHeight: 1.6 }}>
          <strong style={{ color: C.green }}>✨ Lo que vamos a lograr:</strong>
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, color: C.txt2 }}>
            <li>Entender cuánto te tocaría pagar este año</li>
            <li>Detectar formas legales de pagar menos</li>
            <li>Tener un borrador para validar con tu contador</li>
          </ul>
        </div>
      </div>
      <ButtonRow onNext={() => onNext({})} nextLabel="Empezar" showBack={false} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 2: Tipo de trabajo
// ─────────────────────────────────────────────────────────────────────────

function StepTipoTrabajo({ answers, onNext, onBack }) {
  const [selected, setSelected] = useState(answers.tipoTrabajo || null);
  return (
    <div>
      <PreguntaTitle subtitle="Esto nos ayuda a entender qué tipo de impuesto te corresponde y qué deducciones podés usar.">
        ¿Cómo trabajaste el año pasado?
      </PreguntaTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <OptionCard
          icon="💼"
          title="Empleado con sueldo fijo"
          description="Te pagan salario mensual. Trabajás para una empresa."
          onClick={() => setSelected("empleado")}
          selected={selected === "empleado"}
        />
        <OptionCard
          icon="🧑‍💻"
          title="Independiente / freelance"
          description="Facturás por servicios o proyectos. No tenés salario fijo."
          onClick={() => setSelected("independiente")}
          selected={selected === "independiente"}
        />
        <OptionCard
          icon="🔀"
          title="Las dos cosas"
          description="Tuviste salario y además facturaste por tu cuenta."
          onClick={() => setSelected("mixto")}
          selected={selected === "mixto"}
        />
        <OptionCard
          icon="🏖️"
          title="No tuve ingresos por trabajo"
          description="Vivís de rentas, ahorros, herencia, pensión, etc."
          onClick={() => setSelected("sin_ingresos")}
          selected={selected === "sin_ingresos"}
        />
      </div>
      <PorQueExpandible>
        Las personas con sueldo tienen una <strong>deducción extra del 25%</strong>{" "}
        que los independientes no tienen. Los independientes pueden deducir gastos
        de su actividad. Saber tu situación nos permite aplicar las reglas correctas.
      </PorQueExpandible>
      <ButtonRow
        onBack={onBack}
        onNext={() => onNext({ tipoTrabajo: selected })}
        nextDisabled={!selected}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 3: Salario mensual
// ─────────────────────────────────────────────────────────────────────────

function StepSalario({ answers, onNext, onBack }) {
  const [valor, setValor] = useState(answers.salarioMensual || "");
  const num = Number(valor) || 0;
  return (
    <div>
      <PreguntaTitle subtitle="Tu salario BRUTO antes de los descuentos de pensión y salud. Si te pagan distinto cada mes, poné un promedio.">
        ¿Más o menos cuánto te pagaron al mes?
      </PreguntaTitle>
      <NumberInput
        value={valor}
        onChange={setValor}
        placeholder="Ej: 5,000,000"
        label="Salario mensual bruto (en pesos)"
      />
      {num > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: C.blueBg,
            borderRadius: 8,
            fontSize: 13,
            color: C.txt2,
          }}
        >
          💡 Eso es <strong style={{ color: C.txt }}>{fmt(num * 12)}</strong> al
          año. Lo usaremos como base de tu cálculo.
        </div>
      )}
      <PorQueExpandible>
        El salario es la base del impuesto de renta para empleados. Acá usamos el{" "}
        <strong>bruto</strong> (antes de descuentos) porque las leyes tributarias
        parten de ese valor y luego restan automáticamente los aportes obligatorios
        (4% pensión + 4% salud).
      </PorQueExpandible>
      <ButtonRow
        onBack={onBack}
        onNext={() => onNext({ salarioMensual: num })}
        nextDisabled={num <= 0}
        showSkip
        onSkip={() => onNext({ salarioMensual: 0 })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 4: Honorarios
// ─────────────────────────────────────────────────────────────────────────

function StepHonorarios({ answers, onNext, onBack }) {
  const [valor, setValor] = useState(answers.honorariosMensual || "");
  const num = Number(valor) || 0;
  return (
    <div>
      <PreguntaTitle subtitle="Lo que facturaste por servicios profesionales o proyectos. Promedio mensual.">
        ¿Cuánto facturaste al mes en promedio?
      </PreguntaTitle>
      <NumberInput
        value={valor}
        onChange={setValor}
        placeholder="Ej: 8,000,000"
        label="Honorarios mensuales (promedio)"
      />
      {num > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: C.blueBg,
            borderRadius: 8,
            fontSize: 13,
            color: C.txt2,
          }}
        >
          💡 Eso es <strong style={{ color: C.txt }}>{fmt(num * 12)}</strong> al
          año en honorarios.
        </div>
      )}
      <PorQueExpandible>
        Como independiente, lo que facturás se considera <strong>renta de trabajo</strong>{" "}
        igual que un salario, pero podés deducir los gastos de tu actividad
        (oficina, transporte, materiales). En pasos avanzados podés cargarlos.
      </PorQueExpandible>
      <ButtonRow
        onBack={onBack}
        onNext={() => onNext({ honorariosMensual: num })}
        nextDisabled={num <= 0}
        showSkip
        onSkip={() => onNext({ honorariosMensual: 0 })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 5: Dependientes
// ─────────────────────────────────────────────────────────────────────────

function StepDependientes({ answers, onNext, onBack }) {
  const [tiene, setTiene] = useState(answers.dependientes?.tiene ?? null);
  const [cantidad, setCantidad] = useState(
    answers.dependientes?.cantidad || ""
  );
  const [conDiscapacidad, setConDiscapacidad] = useState(
    answers.dependientes?.conDiscapacidad || false
  );
  return (
    <div>
      <PreguntaTitle subtitle="Hijos menores de 23 años, padres mayores que dependan económicamente de vos, cónyuge sin ingresos, etc.">
        ¿Hay personas que dependan económicamente de vos?
      </PreguntaTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <OptionCard
          icon="👨‍👩‍👧‍👦"
          title="Sí, tengo dependientes"
          description="Por ejemplo: hijos, padres, cónyuge sin ingresos"
          onClick={() => setTiene(true)}
          selected={tiene === true}
        />
        <OptionCard
          icon="🚫"
          title="No tengo dependientes"
          description="Vivo solo o nadie depende de mí económicamente"
          onClick={() => setTiene(false)}
          selected={tiene === false}
        />
      </div>

      {tiene === true && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: C.bg3,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
          }}
        >
          <NumberInput
            value={cantidad}
            onChange={setCantidad}
            placeholder="Ej: 2"
            label="¿Cuántas personas?"
            prefix=""
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 14,
              cursor: "pointer",
              fontSize: 14,
              color: C.txt2,
            }}
          >
            <input
              type="checkbox"
              checked={conDiscapacidad}
              onChange={(e) => setConDiscapacidad(e.target.checked)}
              style={{ width: 18, height: 18, cursor: "pointer" }}
            />
            Alguno tiene una discapacidad (la deducción es el doble en este caso)
          </label>
        </div>
      )}

      <PorQueExpandible>
        Si tenés dependientes podés deducir hasta el <strong>10% de tu ingreso</strong>{" "}
        anual (con tope ~$20M). Si hay discapacidad, el tope se duplica. Es una de
        las deducciones más fáciles de aplicar y mucha gente la deja sin usar.
      </PorQueExpandible>
      <ButtonRow
        onBack={onBack}
        onNext={() =>
          onNext({
            dependientes: {
              tiene: tiene === true,
              cantidad: tiene ? Number(cantidad) || 0 : 0,
              conDiscapacidad: tiene ? conDiscapacidad : false,
            },
          })
        }
        nextDisabled={tiene === null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 6: Vivienda
// ─────────────────────────────────────────────────────────────────────────

function StepVivienda({ answers, onNext, onBack }) {
  const [tieneCredito, setTieneCredito] = useState(
    answers.vivienda?.tieneCredito ?? null
  );
  const [interesAnual, setInteresAnual] = useState(
    answers.vivienda?.interesAnual || ""
  );
  return (
    <div>
      <PreguntaTitle subtitle="Si tenés un crédito hipotecario sobre la casa donde VIVÍS (no de inversión), los intereses son deducibles.">
        ¿Estás pagando crédito hipotecario de tu vivienda?
      </PreguntaTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <OptionCard
          icon="🏠"
          title="Sí, tengo crédito hipotecario"
          description="Estoy pagando una hipoteca de mi casa donde vivo"
          onClick={() => setTieneCredito(true)}
          selected={tieneCredito === true}
        />
        <OptionCard
          icon="🚫"
          title="No / Mi casa está pagada / Vivo en alquiler"
          description="No tengo crédito hipotecario de vivienda habitual"
          onClick={() => setTieneCredito(false)}
          selected={tieneCredito === false}
        />
      </div>

      {tieneCredito === true && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: C.bg3,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
          }}
        >
          <NumberInput
            value={interesAnual}
            onChange={setInteresAnual}
            placeholder="Ej: 12,000,000"
            label="¿Cuánto pagaste de intereses durante todo el año?"
          />
          <div style={{ fontSize: 12, color: C.txt3, marginTop: 8 }}>
            💡 Lo encontrás en el certificado del banco. Es solo la parte de
            intereses, no el capital ni el seguro.
          </div>
        </div>
      )}

      <PorQueExpandible>
        Solo aplica para tu <strong>vivienda habitual</strong> (donde vivís). Si es
        casa de descanso o de inversión NO aplica. El tope de la deducción es de
        ~$50M anuales (1200 UVT). Es de las deducciones más usadas en Colombia.
      </PorQueExpandible>
      <ButtonRow
        onBack={onBack}
        onNext={() =>
          onNext({
            vivienda: {
              tieneCredito: tieneCredito === true,
              interesAnual: tieneCredito ? Number(interesAnual) || 0 : 0,
            },
          })
        }
        nextDisabled={tieneCredito === null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 7: Salud
// ─────────────────────────────────────────────────────────────────────────

function StepSalud({ answers, onNext, onBack }) {
  const [paga, setPaga] = useState(answers.salud?.paga ?? null);
  const [mensual, setMensual] = useState(answers.salud?.mensual || "");
  return (
    <div>
      <PreguntaTitle subtitle="Medicina prepagada (Colsanitas, Coomeva, Sura, etc.) o seguros de salud privados son deducibles hasta cierto tope.">
        ¿Pagás medicina prepagada o seguros médicos?
      </PreguntaTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <OptionCard
          icon="🏥"
          title="Sí, pago medicina prepagada o seguro médico"
          onClick={() => setPaga(true)}
          selected={paga === true}
        />
        <OptionCard
          icon="🚫"
          title="No, solo tengo EPS"
          onClick={() => setPaga(false)}
          selected={paga === false}
        />
      </div>

      {paga === true && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: C.bg3,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
          }}
        >
          <NumberInput
            value={mensual}
            onChange={setMensual}
            placeholder="Ej: 500,000"
            label="¿Cuánto pagás al mes en promedio?"
          />
        </div>
      )}

      <PorQueExpandible>
        El tope conjunto es <strong>16 UVT/mes</strong> (~$10M al año). Cubre
        medicina prepagada + seguros de salud + seguros de vida + gastos médicos
        no cubiertos por POS. Si pagás todo eso junto, igual el tope es 16 UVT.
      </PorQueExpandible>
      <ButtonRow
        onBack={onBack}
        onNext={() =>
          onNext({
            salud: {
              paga: paga === true,
              mensual: paga ? Number(mensual) || 0 : 0,
            },
          })
        }
        nextDisabled={paga === null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 8: Pensión Voluntaria / AFC
// ─────────────────────────────────────────────────────────────────────────

function StepPensionVoluntaria({ answers, onNext, onBack }) {
  const [aporta, setAporta] = useState(answers.pensionVoluntaria?.aporta ?? null);
  const [mensual, setMensual] = useState(
    answers.pensionVoluntaria?.mensual || ""
  );
  return (
    <div>
      <PreguntaTitle subtitle="Cuentas tipo AFC (Ahorro al Fomento de la Construcción) o aportes a tu fondo de pensión por encima del obligatorio.">
        ¿Aportás a Pensión Voluntaria o cuenta AFC?
      </PreguntaTitle>
      <div
        style={{
          background: C.purpleBg,
          border: `1px solid ${C.purple}40`,
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
          fontSize: 13,
          color: C.txt2,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: C.purple }}>💎 Tip:</strong> esta es la palanca{" "}
        <strong>más poderosa</strong> para reducir tu impuesto. Por cada $1 que
        aportás, ahorrás hasta $0.39 de impuesto. Si no aportás, considerá empezar.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <OptionCard
          icon="✅"
          title="Sí, aporto"
          onClick={() => setAporta(true)}
          selected={aporta === true}
        />
        <OptionCard
          icon="❌"
          title="No aporto (todavía)"
          onClick={() => setAporta(false)}
          selected={aporta === false}
        />
      </div>

      {aporta === true && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: C.bg3,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
          }}
        >
          <NumberInput
            value={mensual}
            onChange={setMensual}
            placeholder="Ej: 1,000,000"
            label="¿Cuánto aportás al mes en total (PV + AFC)?"
          />
        </div>
      )}

      <PorQueExpandible>
        Estos aportes son <strong>renta exenta</strong>: la plata que metés ahí no
        paga impuesto. El tope es alto: 30% de tu ingreso (hasta 3800 UVT) para AFC,
        25% (hasta 2500 UVT) para PV. Combinado: hasta 1340 UVT (~$70M al año).
      </PorQueExpandible>
      <ButtonRow
        onBack={onBack}
        onNext={() =>
          onNext({
            pensionVoluntaria: {
              aporta: aporta === true,
              mensual: aporta ? Number(mensual) || 0 : 0,
            },
          })
        }
        nextDisabled={aporta === null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 9: Ahorros / intereses
// ─────────────────────────────────────────────────────────────────────────

function StepAhorros({ answers, onNext, onBack }) {
  const [tiene, setTiene] = useState(answers.ahorros?.tiene ?? null);
  const [interesAnual, setInteresAnual] = useState(
    answers.ahorros?.interesAnual || ""
  );
  return (
    <div>
      <PreguntaTitle subtitle="CDT, cuentas remuneradas, fondos de inversión, bonos. Lo que te genere intereses durante el año.">
        ¿Tenés ahorros que generen intereses?
      </PreguntaTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <OptionCard
          icon="🏦"
          title="Sí, tengo ahorros con rendimientos"
          description="CDT, cuentas remuneradas, fondos, etc."
          onClick={() => setTiene(true)}
          selected={tiene === true}
        />
        <OptionCard
          icon="🚫"
          title="No / Solo cuenta de ahorro normal"
          onClick={() => setTiene(false)}
          selected={tiene === false}
        />
      </div>

      {tiene === true && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: C.bg3,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
          }}
        >
          <NumberInput
            value={interesAnual}
            onChange={setInteresAnual}
            placeholder="Ej: 5,000,000"
            label="¿Cuánto te generaron de intereses durante todo el año?"
          />
          <div style={{ fontSize: 12, color: C.txt3, marginTop: 8 }}>
            💡 Lo encontrás en los certificados del banco. Si tenés varios, sumalos.
          </div>
        </div>
      )}

      <PorQueExpandible>
        Los intereses son ingreso gravable, PERO en Colombia hay un{" "}
        <strong>componente inflacionario</strong> que excluye automáticamente el
        ~50% (Art. 38 ET). O sea: solo la mitad de tus intereses paga impuesto.
        Esto es un alivio que muchos no saben.
      </PorQueExpandible>
      <ButtonRow
        onBack={onBack}
        onNext={() =>
          onNext({
            ahorros: {
              tiene: tiene === true,
              interesAnual: tiene ? Number(interesAnual) || 0 : 0,
            },
          })
        }
        nextDisabled={tiene === null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 10: Arriendos
// ─────────────────────────────────────────────────────────────────────────

function StepArriendos({ answers, onNext, onBack }) {
  const [recibe, setRecibe] = useState(answers.arriendos?.recibe ?? null);
  const [mensual, setMensual] = useState(answers.arriendos?.mensual || "");
  return (
    <div>
      <PreguntaTitle subtitle="Si alquilás un apartamento, casa, local o cualquier propiedad tuya, lo que te paga el inquilino.">
        ¿Recibís dinero por arriendos?
      </PreguntaTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <OptionCard
          icon="🏠"
          title="Sí, alquilo una propiedad"
          description="Apartamento, casa, local, garaje, etc."
          onClick={() => setRecibe(true)}
          selected={recibe === true}
        />
        <OptionCard
          icon="🚫"
          title="No"
          onClick={() => setRecibe(false)}
          selected={recibe === false}
        />
      </div>

      {recibe === true && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: C.bg3,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
          }}
        >
          <NumberInput
            value={mensual}
            onChange={setMensual}
            placeholder="Ej: 2,500,000"
            label="¿Cuánto recibís de arriendo al mes?"
          />
          <div style={{ fontSize: 12, color: C.txt3, marginTop: 8 }}>
            Si tenés varias propiedades, sumá todos los arriendos.
          </div>
        </div>
      )}

      <PorQueExpandible>
        El arriendo es <strong>cédula no laboral</strong>: tributa con sus propias
        reglas. Si quien te paga es persona jurídica (una empresa), te retiene 3.5%
        durante el año, lo que reduce el saldo final.
      </PorQueExpandible>
      <ButtonRow
        onBack={onBack}
        onNext={() =>
          onNext({
            arriendos: {
              recibe: recibe === true,
              mensual: recibe ? Number(mensual) || 0 : 0,
            },
          })
        }
        nextDisabled={recibe === null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 11: Review final
// ─────────────────────────────────────────────────────────────────────────

function StepReview({ answers, onNext, onBack }) {
  const items = [];
  if (answers.tipoTrabajo) {
    const labels = {
      empleado: "Empleado con sueldo",
      independiente: "Independiente / freelance",
      mixto: "Empleado + independiente",
      sin_ingresos: "Sin ingresos por trabajo",
    };
    items.push({ label: "Tipo de trabajo", value: labels[answers.tipoTrabajo] });
  }
  if (answers.salarioMensual)
    items.push({
      label: "Salario mensual",
      value: fmt(answers.salarioMensual),
      detalle: fmt(answers.salarioMensual * 12) + " al año",
    });
  if (answers.honorariosMensual)
    items.push({
      label: "Honorarios mensuales",
      value: fmt(answers.honorariosMensual),
      detalle: fmt(answers.honorariosMensual * 12) + " al año",
    });
  if (answers.dependientes?.tiene)
    items.push({
      label: "Dependientes",
      value: `${answers.dependientes.cantidad} persona${answers.dependientes.cantidad > 1 ? "s" : ""}`,
      detalle: answers.dependientes.conDiscapacidad ? "Con discapacidad" : null,
    });
  if (answers.vivienda?.tieneCredito)
    items.push({
      label: "Intereses vivienda",
      value: fmt(answers.vivienda.interesAnual) + " / año",
    });
  if (answers.salud?.paga)
    items.push({
      label: "Medicina prepagada / seguros",
      value: fmt(answers.salud.mensual) + " / mes",
    });
  if (answers.pensionVoluntaria?.aporta)
    items.push({
      label: "Pensión Voluntaria + AFC",
      value: fmt(answers.pensionVoluntaria.mensual) + " / mes",
    });
  if (answers.ahorros?.tiene)
    items.push({
      label: "Intereses de ahorros",
      value: fmt(answers.ahorros.interesAnual) + " / año",
    });
  if (answers.arriendos?.recibe)
    items.push({
      label: "Arriendos recibidos",
      value: fmt(answers.arriendos.mensual) + " / mes",
    });

  return (
    <div>
      <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
      <PreguntaTitle subtitle="Esto es lo que entendí. Si está todo bien, aplicamos esta información a tu cuenta y vemos el cálculo final.">
        Revisemos lo que me contaste
      </PreguntaTitle>

      <div
        style={{
          background: C.bg3,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "8px 0",
          marginBottom: 16,
        }}
      >
        {items.length === 0 ? (
          <div style={{ padding: 16, color: C.txt3, fontSize: 13 }}>
            (Sin datos cargados aún)
          </div>
        ) : (
          items.map((it, i) => (
            <div
              key={i}
              style={{
                padding: "12px 20px",
                borderBottom:
                  i < items.length - 1 ? `1px solid ${C.border}` : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 13, color: C.txt2, fontWeight: 600 }}>
                {it.label}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, color: C.txt, fontWeight: 700 }}>
                  {it.value}
                </div>
                {it.detalle && (
                  <div style={{ fontSize: 11, color: C.txt3, marginTop: 2 }}>
                    {it.detalle}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          background: C.greenBg,
          border: `1px solid ${C.green}40`,
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 13,
          color: C.txt2,
          lineHeight: 1.5,
        }}
      >
        ✨ Al hacer click en <strong style={{ color: C.green }}>Aplicar</strong>,
        guardamos esta información en tu cuenta y vas a ver tu resumen tributario
        completo con tu impuesto estimado y oportunidades de ahorro detectadas.
      </div>

      <ButtonRow
        onBack={onBack}
        onNext={() => onNext({})}
        nextLabel="Aplicar a mi cuenta"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER: convertir las respuestas del wizard en updates al user
// ─────────────────────────────────────────────────────────────────────────

/**
 * Toma las respuestas del wizard y las aplica al user, creando/actualizando
 * los datos correspondientes (ingresos, gastos, deudas, fiscalProfile).
 * Es NO destructivo: agrega nuevos items con flag wizardOrigin para identificarlos.
 *
 * @param {object} user - User actual
 * @param {object} answers - Respuestas del wizard
 * @returns {object} Nuevo user con los datos del wizard aplicados
 */
export function aplicarRespuestasWizard(user, answers) {
  const newUser = { ...user };
  const ts = Date.now();

  // Asegurar que existe al menos un owner natural
  let ownerId = (user.owners || []).find((o) => o.type === "natural")?.id;
  if (!ownerId) {
    ownerId = "own_wizard_" + ts;
    newUser.owners = [
      ...(user.owners || []),
      {
        id: ownerId,
        name: "Yo (persona natural)",
        type: "natural",
        fiscalProfile: {},
      },
    ];
  }

  // ─── INGRESOS ─────────────────────────────────────────────────────────
  newUser.ingresos = [...(user.ingresos || [])];

  if (answers.salarioMensual > 0) {
    newUser.ingresos.push({
      id: "ing_wizard_sal_" + ts,
      owner: ownerId,
      categoria: "Salario",
      fiscalCode: "LAB_SALARIO",
      mensual: answers.salarioMensual,
      tipo: "fijo",
      moneda: "COP",
      fuente: "Wizard TurboTax",
      wizardOrigin: true,
    });
  }

  if (answers.honorariosMensual > 0) {
    newUser.ingresos.push({
      id: "ing_wizard_hon_" + ts,
      owner: ownerId,
      categoria: "Honorarios",
      fiscalCode: "LAB_HONORARIOS_SIN_EMPLEADOS",
      mensual: answers.honorariosMensual,
      tipo: "variable",
      moneda: "COP",
      fuente: "Wizard TurboTax",
      wizardOrigin: true,
    });
  }

  if (answers.ahorros?.tiene && answers.ahorros.interesAnual > 0) {
    newUser.ingresos.push({
      id: "ing_wizard_ahorros_" + ts,
      owner: ownerId,
      categoria: "Intereses bancarios",
      fiscalCode: "CAP_INTERESES_BANCARIOS",
      mensual: Math.round(answers.ahorros.interesAnual / 12),
      tipo: "variable",
      moneda: "COP",
      fuente: "Wizard TurboTax",
      wizardOrigin: true,
    });
  }

  if (answers.arriendos?.recibe && answers.arriendos.mensual > 0) {
    newUser.ingresos.push({
      id: "ing_wizard_arriendo_" + ts,
      owner: ownerId,
      categoria: "Arrendamientos",
      fiscalCode: "NOL_ARRIENDO_INMUEBLE",
      mensual: answers.arriendos.mensual,
      tipo: "fijo",
      moneda: "COP",
      fuente: "Wizard TurboTax",
      wizardOrigin: true,
    });
  }

  // ─── GASTOS / APORTES ─────────────────────────────────────────────────
  newUser.gas = { ...(user.gas || {}) };

  if (answers.salud?.paga && answers.salud.mensual > 0) {
    newUser.gas["Salud"] = [
      ...(newUser.gas["Salud"] || []),
      {
        id: "gas_wizard_salud_" + ts,
        owner: ownerId,
        cat: "Salud",
        m: answers.salud.mensual,
        wizardOrigin: true,
      },
    ];
  }

  if (
    answers.pensionVoluntaria?.aporta &&
    answers.pensionVoluntaria.mensual > 0
  ) {
    newUser.gas["Aporte tributario"] = [
      ...(newUser.gas["Aporte tributario"] || []),
      {
        id: "gas_wizard_pv_" + ts,
        owner: ownerId,
        cat: "Aporte tributario",
        m: answers.pensionVoluntaria.mensual,
        fiscalCode: "AP_TRIB_PV",
        wizardOrigin: true,
      },
    ];
  }

  // ─── DEUDAS ──────────────────────────────────────────────────────────
  if (answers.vivienda?.tieneCredito && answers.vivienda.interesAnual > 0) {
    newUser.deu = [
      ...(user.deu || []),
      {
        id: "deu_wizard_vivienda_" + ts,
        owner: ownerId,
        nombre: "Crédito hipotecario vivienda",
        fiscalCode: "DEU_NAT_VIVIENDA_HABITACIONAL",
        // Estimación: si pagás $X de intereses al año a tasa promedio 12%,
        // el saldo aproximado es X / 0.12. NO es exacto pero da una base
        // para que el motor calcule la deducción.
        mt: Math.round(answers.vivienda.interesAnual / 0.12),
        ts: 12,
        wizardOrigin: true,
      },
    ];
  }

  // ─── FISCAL PROFILE (DEPENDIENTES) ───────────────────────────────────
  if (answers.dependientes?.tiene && answers.dependientes.cantidad > 0) {
    newUser.owners = newUser.owners.map((o) => {
      if (o.id !== ownerId) return o;
      return {
        ...o,
        fiscalProfile: {
          ...(o.fiscalProfile || {}),
          dependientes: {
            cantidad: answers.dependientes.cantidad,
            conDiscapacidad: answers.dependientes.conDiscapacidad,
          },
        },
      };
    });
  }

  return newUser;
}
