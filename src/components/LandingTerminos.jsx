// ═══════════════════════════════════════════════════════════════════════════
// LandingTerminos.jsx · Sesión 4-may-2026
//
// Términos y Condiciones de Uso de FINPATHIA.
//
// MARCO LEGAL:
//   - Colombia: Código Civil, Ley 527/1999 (comercio electrónico), Ley 1480/2011
//     (Estatuto del Consumidor), Decreto 1377/2013 (datos personales).
//   - Estados Unidos: Estado de incorporación es Delaware. Aplican leyes federales
//     y de Delaware en lo que no contradiga regulación local del usuario.
//
// PRINCIPIOS DE REDACCIÓN:
//   - Lenguaje claro y sencillo (Estatuto del Consumidor exige claridad).
//   - Evitar cláusulas abusivas (Art. 42-43 Ley 1480).
//   - Renuncia a clase no es válida en Colombia → no la incluimos.
//   - Consentimiento expreso para tratamiento de datos (referencia a Privacidad).
//   - Preservar derechos del consumidor (devolución, reembolso, garantía).
//
// IMPORTANTE: Este documento tiene validez legal pero NO sustituye una revisión
// por abogado especializado en SaaS. Recomendamos antes de tener 100+ usuarios
// pagos pasarlo por un abogado en Colombia (~$500K-$1.5M COP el ajuste).
//
// Accesible vía:
//   - finpathia.com/terminos
//   - Link en footer del home
//   - Link en modal de signup (checkbox obligatorio)
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

const T = {
  bg: "#09090b", bg2: "#141418",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", amber: "#f59e0b",
};

const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

const Section = ({ number, title, children }) => (
  <section style={{ marginBottom: 40 }}>
    <h2
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 22,
        fontWeight: 800,
        color: T.txt,
        margin: "0 0 16px",
        letterSpacing: -0.5,
        display: "flex",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <span style={{ color: T.green, fontFamily: "monospace", fontSize: 16, fontWeight: 700, opacity: 0.6 }}>
        {number}
      </span>
      {title}
    </h2>
    <div style={{ color: T.txt2, fontSize: 14, lineHeight: 1.75, fontFamily: FONT_BODY }}>{children}</div>
  </section>
);

const SubSection = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <h3
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 15,
        fontWeight: 700,
        color: T.txt,
        margin: "0 0 8px",
      }}
    >
      {title}
    </h3>
    <div>{children}</div>
  </div>
);

export default function LandingTerminos() {
  const [pageLoaded, setPageLoaded] = useState(false);

  useEffect(() => {
    setPageLoaded(true);
    window.scrollTo(0, 0);
  }, []);

  return (
    <div
      style={{
        background: T.bg,
        minHeight: "100vh",
        color: T.txt,
        fontFamily: FONT_BODY,
        opacity: pageLoaded ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Header simple */}
      <header
        style={{
          padding: "20px clamp(16px, 4vw, 32px)",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <a
          href="/"
          style={{ color: T.green, fontWeight: 800, fontSize: 20, textDecoration: "none", letterSpacing: -0.5 }}
        >
          FINPATHIA
        </a>
        <a
          href="/"
          style={{ color: T.txt3, fontSize: 13, textDecoration: "none" }}
        >
          ← Volver al sitio
        </a>
      </header>

      {/* Contenido */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 96px" }}>
        {/* Title */}
        <div style={{ marginBottom: 48 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: T.green,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Documento legal
          </div>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: "clamp(28px, 7vw, 42px)",
              fontWeight: 800,
              color: T.txt,
              margin: "0 0 12px",
              lineHeight: 1.1,
              letterSpacing: -1.5,
            }}
          >
            Términos y Condiciones
          </h1>
          <p style={{ fontSize: 14, color: T.txt3, margin: 0, lineHeight: 1.6 }}>
            Última actualización: 4 de mayo de 2026 · Versión 1.0
          </p>
        </div>

        {/* Aviso destacado */}
        <div
          style={{
            background: "rgba(34,197,94,0.06)",
            border: `1px solid rgba(34,197,94,0.2)`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 40,
            fontSize: 14,
            color: T.txt2,
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: T.txt }}>📜 En lenguaje claro:</strong> al crear una cuenta y usar
          FINPATHIA, aceptás estos términos. Te explicamos qué somos, qué te ofrecemos, qué esperamos
          de vos, qué pasa si querés cancelar, y cómo resolvemos diferencias. Si algo no te queda
          claro, escribinos a <a href="mailto:soporte@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>soporte@finpathia.com</a>.
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section number="1." title="Quiénes somos">
          <p>
            <strong style={{ color: T.txt }}>FINPATHIA</strong> es una plataforma SaaS (Software como
            Servicio) de gestión patrimonial inteligente operada por <strong style={{ color: T.txt }}>SOSALABS</strong>,
            empresa con presencia en Colombia y Estados Unidos.
          </p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>Sitio web oficial: <a href="https://finpathia.com" style={{ color: T.green, textDecoration: "none" }}>finpathia.com</a></li>
            <li style={{ marginBottom: 6 }}>Email de contacto: <a href="mailto:soporte@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>soporte@finpathia.com</a></li>
            <li>Procesamiento de pagos: Stripe Inc. (Delaware, USA)</li>
          </ul>
        </Section>

        <Section number="2." title="Aceptación de los términos">
          <p>
            Al registrarte, ingresar o usar FINPATHIA, declarás que leíste, entendiste y aceptás estos
            Términos y Condiciones, así como nuestra <a href="/privacidad" style={{ color: T.green, textDecoration: "none" }}>Política de Privacidad</a>.
            Si no estás de acuerdo, te pedimos no usar la plataforma.
          </p>
          <p style={{ marginTop: 12 }}>
            Para crear una cuenta debés ser <strong style={{ color: T.txt }}>mayor de edad</strong> (18 años en Colombia, 18 en la mayoría de
            estados de USA) y tener capacidad legal para contratar.
          </p>
        </Section>

        <Section number="3." title="Qué te ofrecemos">
          <SubSection title="3.1 Planes y funcionalidades">
            <p>
              FINPATHIA ofrece distintos planes (Free, Básico, Pro, Pro Familiar) con funcionalidades que
              pueden incluir, entre otras:
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>Gestión y visualización de tu patrimonio personal o familiar</li>
              <li style={{ marginBottom: 4 }}>Cálculo y proyección de impuestos (Colombia: IRPF, ICA, GMF; USA: federal + state)</li>
              <li style={{ marginBottom: 4 }}>Cálculo de pensiones (Colpensiones, RAIS, 401(k), IRA)</li>
              <li style={{ marginBottom: 4 }}>Asesor financiero IA y coaches especializados</li>
              <li style={{ marginBottom: 4 }}>Simuladores financieros, optimización tributaria y planeación FIRE</li>
              <li>Acceso multi-usuario con roles diferenciados (planes superiores)</li>
            </ul>
          </SubSection>

          <SubSection title="3.2 Carácter informativo, NO asesoría financiera regulada">
            <p>
              <strong style={{ color: T.amber }}>⚠️ Importante:</strong> FINPATHIA es una herramienta de
              análisis e información financiera. <strong style={{ color: T.txt }}>NO somos una entidad financiera, casa de bolsa,
              comisionista, asesor de inversión registrado ante la Superintendencia Financiera de
              Colombia (SFC) ni el SEC/FINRA en USA.</strong>
            </p>
            <p style={{ marginTop: 12 }}>
              La información, cálculos, proyecciones y sugerencias son <strong style={{ color: T.txt }}>orientativas y educativas</strong>,
              basadas en los datos que vos cargás y en reglas tributarias/financieras vigentes a la fecha
              de la última actualización del software. Para decisiones de alto valor (inversiones grandes,
              estructuración patrimonial, declaración de renta compleja), recomendamos consultar a un
              profesional certificado (Contador Público, CPA, Enrolled Agent, asesor SFC-aprobado).
            </p>
          </SubSection>

          <SubSection title="3.3 Versión beta y cambios al servicio">
            <p>
              FINPATHIA está en mejora continua. Podemos agregar, modificar o eliminar funcionalidades
              con o sin previo aviso. Los cambios sustanciales que afecten tu plan pago serán
              comunicados por email con al menos <strong style={{ color: T.txt }}>15 días de anticipación</strong>.
            </p>
          </SubSection>
        </Section>

        <Section number="4." title="Tu cuenta y responsabilidades">
          <SubSection title="4.1 Información veraz">
            <p>
              Te comprometés a proveer información veraz y actualizada al registrarte y al cargar datos
              en la plataforma. Los cálculos, sugerencias e informes generados dependen de la precisión
              de tus datos.
            </p>
          </SubSection>

          <SubSection title="4.2 Seguridad de tu cuenta">
            <p>
              Sos responsable de mantener confidencial tu contraseña y de toda la actividad realizada
              desde tu cuenta. Si sospechás de un acceso no autorizado, escribinos inmediatamente a{" "}
              <a href="mailto:soporte@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>soporte@finpathia.com</a>.
            </p>
          </SubSection>

          <SubSection title="4.3 Uso permitido">
            <p>Te comprometés a usar FINPATHIA solo para fines lícitos y personales o profesionales legítimos. Está prohibido:</p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>Usar la plataforma para actividades ilegales (lavado de activos, evasión fiscal, fraude)</li>
              <li style={{ marginBottom: 4 }}>Realizar ingeniería inversa, scraping, copia o redistribución del software</li>
              <li style={{ marginBottom: 4 }}>Compartir credenciales con terceros fuera de los usuarios autorizados de tu plan</li>
              <li style={{ marginBottom: 4 }}>Intentar acceder a datos de otros usuarios</li>
              <li>Sobrecargar intencionalmente nuestros servidores (DDoS, scraping masivo)</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              El incumplimiento de estas obligaciones puede llevar a la <strong style={{ color: T.txt }}>suspensión o cancelación
              inmediata</strong> de tu cuenta sin reembolso.
            </p>
          </SubSection>
        </Section>

        <Section number="5." title="Pagos, planes y reembolsos">
          <SubSection title="5.1 Planes y precios">
            <p>
              Los precios vigentes están publicados en <a href="/" style={{ color: T.green, textDecoration: "none" }}>finpathia.com</a>.
              Los precios pueden ser ajustados con notificación previa de al menos 30 días para suscripciones existentes.
            </p>
          </SubSection>

          <SubSection title="5.2 Período de prueba (trial)">
            <p>
              Ofrecemos un período de prueba gratuito de <strong style={{ color: T.txt }}>14 días</strong> para los planes pagos. Durante
              el trial:
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>No se requiere tarjeta de crédito al registrarse</li>
              <li style={{ marginBottom: 4 }}>Tenés acceso completo al plan elegido</li>
              <li style={{ marginBottom: 4 }}>Si no activás un plan al final del trial, tu cuenta vuelve automáticamente al plan Free</li>
              <li>Tus datos se conservan</li>
            </ul>
          </SubSection>

          <SubSection title="5.3 Cobros recurrentes">
            <p>
              Una vez activado un plan pago, autorizás a FINPATHIA (vía Stripe) a cobrar automáticamente la
              tarifa correspondiente al inicio de cada período (mensual o anual según elijas). Recibirás
              factura electrónica por cada cobro.
            </p>
          </SubSection>

          <SubSection title="5.4 Cancelación">
            <p>
              Podés cancelar tu suscripción en cualquier momento desde la sección{" "}
              <strong style={{ color: T.txt }}>"Mi Cuenta → Gestionar suscripción"</strong>. Tu acceso continuará hasta el final del período
              ya pagado. <strong style={{ color: T.txt }}>No hay permanencia ni penalización por cancelar.</strong>
            </p>
          </SubSection>

          <SubSection title="5.5 Política de reembolsos (Estatuto del Consumidor Colombia)">
            <p>
              <strong style={{ color: T.txt }}>Derecho de retracto (Ley 1480/2011, Art. 47):</strong> los consumidores en Colombia tienen
              derecho a retractarse dentro de los 5 días hábiles siguientes a la activación del plan,
              sin necesidad de justificación, recibiendo reembolso íntegro.
            </p>
            <p style={{ marginTop: 12 }}>
              <strong style={{ color: T.txt }}>Reembolsos por insatisfacción:</strong> aunque no estamos legalmente obligados, evaluamos
              caso por caso. Escribinos a <a href="mailto:soporte@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>soporte@finpathia.com</a> y
              respondemos en máximo 5 días hábiles.
            </p>
            <p style={{ marginTop: 12 }}>
              <strong style={{ color: T.txt }}>Reembolsos por fallas técnicas graves no resueltas:</strong> si la plataforma presenta una
              falla que impida el uso por más de 5 días continuos sin solución, reembolsamos el período
              afectado proporcionalmente.
            </p>
          </SubSection>
        </Section>

        <Section number="6." title="Tus datos y privacidad">
          <p>
            Tus datos personales y financieros son procesados según nuestra{" "}
            <a href="/privacidad" style={{ color: T.green, textDecoration: "none" }}>Política de Privacidad</a>, que
            cumple con la <strong style={{ color: T.txt }}>Ley 1581/2012 de Colombia</strong> y aplica principios equivalentes a GDPR/CCPA
            para usuarios internacionales.
          </p>
          <p style={{ marginTop: 12 }}>
            En resumen:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>Tus datos son <strong style={{ color: T.txt }}>tuyos</strong>. Podés exportarlos o eliminarlos cuando quieras.</li>
            <li style={{ marginBottom: 4 }}>No vendemos ni compartimos tu información con terceros para publicidad.</li>
            <li style={{ marginBottom: 4 }}>Usamos encriptación de extremo a extremo para datos sensibles.</li>
            <li>Las consultas al Asesor IA NO se usan para entrenar modelos.</li>
          </ul>
        </Section>

        <Section number="7." title="Propiedad intelectual">
          <p>
            FINPATHIA, su código fuente, marca, diseños, contenido educativo y los algoritmos de cálculo
            son propiedad de SOSALABS y están protegidos por leyes de propiedad intelectual. La licencia
            que te otorgamos es de <strong style={{ color: T.txt }}>uso personal, limitada, no exclusiva, intransferible y revocable</strong>.
          </p>
          <p style={{ marginTop: 12 }}>
            El contenido y datos que vos cargás siguen siendo de tu propiedad. Nos otorgás solo los
            permisos mínimos necesarios para procesarlos y mostrártelos según la funcionalidad de la
            plataforma.
          </p>
        </Section>

        <Section number="8." title="Limitación de responsabilidad">
          <p>
            En la máxima medida permitida por la ley aplicable:
          </p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              FINPATHIA se entrega <strong style={{ color: T.txt }}>"tal cual" (as-is)</strong> sin garantía implícita de comerciabilidad o
              idoneidad para un fin particular.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: T.txt }}>No nos hacemos responsables</strong> por decisiones de inversión, tributarias o financieras que
              tomes basándote en información de la plataforma. Las proyecciones y simulaciones son
              estimativas.
            </li>
            <li style={{ marginBottom: 8 }}>
              No garantizamos disponibilidad ininterrumpida (apuntamos a 99.5% uptime) ni ausencia
              total de errores.
            </li>
            <li>
              Nuestra responsabilidad económica máxima frente a vos por cualquier reclamo, en cualquier
              período de 12 meses, está limitada a lo que hayas pagado a FINPATHIA en ese período.
              Esta limitación no aplica a daños causados por dolo o culpa grave probada de nuestra parte
              (límite del derecho colombiano según Art. 1604 Código Civil).
            </li>
          </ul>
        </Section>

        <Section number="9." title="Modificaciones a estos términos">
          <p>
            Podemos actualizar estos términos para reflejar cambios en el servicio, regulaciones o por
            mejoras en redacción. Cuando los cambios sean sustanciales:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>Te avisaremos por email con al menos 15 días de anticipación.</li>
            <li style={{ marginBottom: 4 }}>Publicaremos la nueva versión en esta página con fecha actualizada.</li>
            <li>Si no estás de acuerdo con los cambios, podés cancelar tu suscripción antes de su entrada en vigor.</li>
          </ul>
        </Section>

        <Section number="10." title="Resolución de conflictos y ley aplicable">
          <SubSection title="10.1 Intentemos resolverlo amigablemente primero">
            <p>
              Si tenés un problema, escribinos a <a href="mailto:soporte@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>soporte@finpathia.com</a>.
              Nos comprometemos a responder en máximo 5 días hábiles e intentar resolver el caso en máximo 30 días.
            </p>
          </SubSection>

          <SubSection title="10.2 Para usuarios en Colombia">
            <p>
              Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia
              se resolverá ante los jueces civiles competentes de la <strong style={{ color: T.txt }}>ciudad de Bogotá D.C.</strong>, sin
              perjuicio del derecho del consumidor a acudir a la <strong style={{ color: T.txt }}>Superintendencia de Industria y
              Comercio (SIC)</strong> para reclamos amparados por el Estatuto del Consumidor.
            </p>
          </SubSection>

          <SubSection title="10.3 Para usuarios en Estados Unidos">
            <p>
              For US users, these terms are governed by the laws of the State of Delaware. Any dispute
              will be resolved in the state or federal courts located in Wilmington, Delaware. US users
              retain consumer rights under their state's applicable consumer protection laws.
            </p>
          </SubSection>
        </Section>

        <Section number="11." title="Contacto">
          <p>
            Para cualquier pregunta sobre estos términos:
          </p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>Email: <a href="mailto:soporte@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>soporte@finpathia.com</a></li>
            <li style={{ marginBottom: 4 }}>Sitio: <a href="https://finpathia.com" style={{ color: T.green, textDecoration: "none" }}>finpathia.com</a></li>
            <li>Privacidad: <a href="/privacidad" style={{ color: T.green, textDecoration: "none" }}>finpathia.com/privacidad</a></li>
          </ul>
        </Section>

        {/* Footer del documento */}
        <div
          style={{
            marginTop: 64,
            paddingTop: 24,
            borderTop: `1px solid ${T.border}`,
            textAlign: "center",
            fontSize: 12,
            color: T.txt3,
            lineHeight: 1.6,
          }}
        >
          Documento generado el 4 de mayo de 2026 · Versión 1.0<br />
          FINPATHIA es operada por SOSALABS · Colombia & Delaware (USA)
        </div>
      </main>

      {/* Footer común */}
      <footer
        style={{
          padding: "20px clamp(16px, 4vw, 32px)",
          borderTop: `1px solid ${T.border}`,
          background: T.bg2,
          textAlign: "center",
          fontSize: 12,
          color: T.txt3,
        }}
      >
        © 2026 FINPATHIA · <a href="/" style={{ color: T.txt3, textDecoration: "none" }}>Inicio</a> ·{" "}
        <a href="/seguridad" style={{ color: T.txt3, textDecoration: "none" }}>Seguridad</a> ·{" "}
        <a href="/privacidad" style={{ color: T.txt3, textDecoration: "none" }}>Privacidad</a> ·{" "}
        <a href="/terminos" style={{ color: T.green, textDecoration: "none", fontWeight: 600 }}>Términos</a>
      </footer>
    </div>
  );
}
