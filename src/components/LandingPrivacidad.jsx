// ═══════════════════════════════════════════════════════════════════════════
// LandingPrivacidad.jsx · Sesión 4-may-2026
//
// Política de Privacidad y Tratamiento de Datos Personales de FINPATHIA.
//
// MARCO LEGAL DE REFERENCIA:
//   - Colombia: Ley 1581/2012, Decreto Reglamentario 1377/2013, Decreto 1074/2015
//     ("Régimen General de Protección de Datos Personales").
//   - Estados Unidos: aplican principios CCPA-equivalentes para residentes de
//     California; las leyes federales sectoriales (GLBA para datos financieros,
//     HIPAA NO aplica porque no somos covered entity).
//   - Unión Europea (si llegan usuarios EU): aplicamos principios GDPR-equivalentes.
//
// ESTRUCTURA Ley 1581:
//   1. Identificación del Responsable
//   2. Finalidades del tratamiento
//   3. Datos sensibles (informados)
//   4. Derechos del Titular (Art. 8)
//   5. Procedimiento para ejercer derechos
//   6. Política de seguridad
//   7. Vigencia
//
// IMPORTANTE: Este documento debe registrarse en el Registro Nacional de Bases
// de Datos (RNBD) de la SIC para empresas con ingresos > 100 SMMLV anuales.
// FINPATHIA aún no necesita registrar pero lo hará al cruzar ese umbral.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

const T = {
  bg: "#09090b", bg2: "#141418",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", amber: "#f59e0b", red: "#ef4444",
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

export default function LandingPrivacidad() {
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
          padding: "24px 32px",
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
        <a href="/" style={{ color: T.txt3, fontSize: 13, textDecoration: "none" }}>
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
              fontSize: 42,
              fontWeight: 800,
              color: T.txt,
              margin: "0 0 12px",
              lineHeight: 1.1,
              letterSpacing: -1.5,
            }}
          >
            Política de Privacidad
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
          <strong style={{ color: T.txt }}>🔒 En lenguaje claro:</strong> tus datos son tuyos.
          Nosotros los usamos solo para que FINPATHIA funcione. No los vendemos. No los compartimos
          con anunciantes. Vos podés exportarlos o borrarlos cuando quieras. Esta política te explica
          en detalle qué guardamos, por qué, por cuánto tiempo, y cómo ejercer tus derechos.
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section number="1." title="Quién es responsable de tus datos">
          <p>
            <strong style={{ color: T.txt }}>FINPATHIA</strong>, operada por <strong style={{ color: T.txt }}>SOSALABS</strong>, es la responsable del
            tratamiento de los datos personales que recolectamos.
          </p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>Email para asuntos de privacidad: <a href="mailto:hola@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>hola@finpathia.com</a></li>
            <li style={{ marginBottom: 4 }}>Sitio web: <a href="https://finpathia.com" style={{ color: T.green, textDecoration: "none" }}>finpathia.com</a></li>
            <li>Marco legal aplicable: Ley 1581/2012 (Colombia), CCPA (California, USA), principios GDPR (UE)</li>
          </ul>
        </Section>

        <Section number="2." title="Qué datos recolectamos">
          <SubSection title="2.1 Datos de identificación y contacto">
            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>Nombre completo</li>
              <li style={{ marginBottom: 4 }}>Correo electrónico</li>
              <li style={{ marginBottom: 4 }}>País de residencia (jurisdicción fiscal)</li>
              <li>Contraseña (almacenada con hash bcrypt, nunca en texto plano)</li>
            </ul>
          </SubSection>

          <SubSection title="2.2 Datos financieros que vos cargás voluntariamente">
            <p>Esta es información que vos decidís ingresar para que la plataforma funcione:</p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>Ingresos, gastos, deudas y patrimonio</li>
              <li style={{ marginBottom: 4 }}>Inversiones, propiedades, cuentas bancarias (los detalles que decidas registrar)</li>
              <li style={{ marginBottom: 4 }}>Información de pensión y planes de retiro</li>
              <li style={{ marginBottom: 4 }}>Datos de declaraciones fiscales pasadas (si los cargás)</li>
              <li>Documentos que subas (Excel, facturas, comprobantes para procesamiento)</li>
            </ul>
            <p style={{ marginTop: 12, color: T.amber, fontSize: 13 }}>
              ⚠️ Estos datos son <strong>sensibles</strong>. Los protegemos con encriptación AES-256 en tránsito y en reposo.
            </p>
          </SubSection>

          <SubSection title="2.3 Datos técnicos automáticos">
            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>Dirección IP (anonimizada para Google Analytics)</li>
              <li style={{ marginBottom: 4 }}>Tipo de navegador y dispositivo</li>
              <li style={{ marginBottom: 4 }}>Páginas visitadas y tiempo de uso (anonimizado)</li>
              <li>UTM parameters (si llegaste vía un link de campaña)</li>
            </ul>
          </SubSection>

          <SubSection title="2.4 Datos de pago">
            <p>
              <strong style={{ color: T.txt }}>NO almacenamos números de tarjeta.</strong> El procesamiento de pagos lo realiza{" "}
              <strong style={{ color: T.txt }}>Stripe Inc.</strong>, certificada PCI-DSS Nivel 1 (el estándar más alto). Stripe nos comparte
              solo: tu nombre, email, los últimos 4 dígitos de la tarjeta y el estado del pago.
            </p>
          </SubSection>
        </Section>

        <Section number="3." title="Para qué usamos tus datos (finalidades)">
          <p>Tus datos se usan exclusivamente para:</p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: T.txt }}>Prestar el servicio:</strong> calcular tu patrimonio, proyectar pensiones, optimizar impuestos,
              ejecutar el Asesor IA con tus números reales.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: T.txt }}>Gestión de tu cuenta:</strong> autenticarte, mantener tu sesión, gestionar tu plan, procesar pagos.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: T.txt }}>Comunicación operativa:</strong> mandarte emails de bienvenida, recordatorios de fin de trial,
              confirmación de pago, avisos importantes sobre tu cuenta.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: T.txt }}>Mejora del servicio:</strong> entender qué funcionalidades se usan más, detectar errores,
              priorizar mejoras. Siempre con datos agregados y anonimizados.
            </li>
            <li>
              <strong style={{ color: T.txt }}>Cumplimiento legal:</strong> retener información cuando una ley nos obliga
              (ej. registros contables, prevención de lavado de activos).
            </li>
          </ul>
          <p
            style={{
              marginTop: 16,
              padding: 16,
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: 10,
              fontSize: 13,
              color: T.txt2,
            }}
          >
            <strong style={{ color: T.txt }}>Lo que NO hacemos:</strong> NO vendemos tus datos a terceros. NO los compartimos con anunciantes
            o redes sociales. NO usamos tus datos financieros para entrenar modelos de inteligencia artificial.
            NO te perfilamos para marketing externo.
          </p>
        </Section>

        <Section number="4." title="Inteligencia artificial y tus datos">
          <p>
            Cuando usás el <strong style={{ color: T.txt }}>Asesor IA</strong> o los <strong style={{ color: T.txt }}>Coaches IA</strong>, tu pregunta y los datos
            financieros relevantes se envían a <strong style={{ color: T.txt }}>Anthropic (Claude API)</strong>, nuestro proveedor de IA.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong style={{ color: T.green }}>Compromiso de Anthropic con FINPATHIA:</strong>
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>Anthropic <strong>NO usa tus datos</strong> para entrenar sus modelos de IA.</li>
            <li style={{ marginBottom: 4 }}>Tus consultas se procesan en infraestructura segura (SOC 2 Type II).</li>
            <li>Anthropic retiene los datos solo el tiempo necesario para procesar tu consulta y para detección de abuso (máximo 30 días).</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Más detalles en la{" "}
            <a
              href="https://www.anthropic.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: T.green, textDecoration: "none" }}
            >
              política de privacidad de Anthropic
            </a>
            .
          </p>
        </Section>

        <Section number="5." title="Con quién compartimos tus datos (encargados)">
          <p>
            Solo compartimos información con proveedores que nos ayudan a operar la plataforma. Cada uno
            firma cláusulas contractuales para proteger tus datos:
          </p>
          <div style={{ marginTop: 16 }}>
            {[
              { name: "Stripe (USA)", role: "Procesamiento de pagos", cert: "PCI-DSS Nivel 1" },
              { name: "Supabase (USA)", role: "Base de datos y autenticación", cert: "SOC 2 Type II" },
              { name: "Netlify / AWS (USA)", role: "Hosting de la aplicación", cert: "ISO 27001, SOC 2" },
              { name: "Anthropic (USA)", role: "Inteligencia artificial (Asesor IA)", cert: "SOC 2 Type II — sin uso para entrenamiento" },
              { name: "Resend (USA)", role: "Envío de emails transaccionales", cert: "SOC 2" },
              { name: "Google (USA)", role: "Analytics anonimizados (Google Analytics 4)", cert: "ISO 27001, IP anonimizada" },
            ].map((p, i) => (
              <div
                key={i}
                style={{
                  padding: "12px 16px",
                  background: T.bg2,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.txt }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: T.txt2 }}>{p.role}</div>
                </div>
                <div style={{ fontSize: 11, color: T.txt3, alignSelf: "center" }}>{p.cert}</div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13 }}>
            Algunos proveedores procesan datos en territorio de Estados Unidos. Esto se considera{" "}
            <strong style={{ color: T.txt }}>transferencia internacional</strong>. Solo trabajamos con proveedores que demuestren niveles
            de protección equivalentes o superiores a los exigidos por la Ley 1581 colombiana
            (Decreto 1377/2013, Art. 26).
          </p>
        </Section>

        <Section number="6." title="Tus derechos como titular de datos (Art. 8 Ley 1581)">
          <p>Como titular de tus datos, tenés derecho a:</p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: T.txt }}>Conocer (acceso):</strong> ver qué datos tenemos sobre vos. Lo hacés en cualquier momento desde
              tu cuenta o pidiéndonos un export.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: T.txt }}>Actualizar y rectificar:</strong> corregir datos imprecisos o desactualizados desde tu cuenta o
              escribiéndonos.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: T.txt }}>Solicitar la prueba de la autorización:</strong> en cualquier momento podés pedir copia del
              consentimiento que diste al registrarte.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: T.txt }}>Ser informado:</strong> sobre el uso que se le da a tus datos.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: T.txt }}>Presentar quejas:</strong> ante la Superintendencia de Industria y Comercio (SIC) si considerás que
              violamos tus derechos.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: T.txt }}>Revocar la autorización y solicitar supresión:</strong> podés borrar tu cuenta y todos tus
              datos en cualquier momento.
            </li>
            <li>
              <strong style={{ color: T.txt }}>Portabilidad:</strong> exportar todos tus datos en formato JSON o Excel para llevártelos a otra
              plataforma.
            </li>
          </ul>
        </Section>

        <Section number="7." title="Cómo ejercer tus derechos">
          <p>Tenés dos formas:</p>
          <SubSection title="7.1 Desde tu cuenta (autoservicio)">
            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>
                <strong style={{ color: T.txt }}>Exportar tus datos:</strong> Mi Cuenta → "Exportar Datos (JSON)"
              </li>
              <li style={{ marginBottom: 4 }}>
                <strong style={{ color: T.txt }}>Eliminar tu cuenta:</strong> Mi Cuenta → "Eliminar mi cuenta"
              </li>
              <li>
                <strong style={{ color: T.txt }}>Gestionar tu suscripción:</strong> Mi Cuenta → "Gestionar suscripción" (Stripe Customer Portal)
              </li>
            </ul>
          </SubSection>

          <SubSection title="7.2 Por email (asistencia personalizada)">
            <p>
              Escribinos a <a href="mailto:hola@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>hola@finpathia.com</a> con
              asunto <strong style={{ color: T.txt }}>"Solicitud de Datos Personales"</strong>. Indicanos:
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>El email asociado a tu cuenta</li>
              <li style={{ marginBottom: 4 }}>Qué derecho querés ejercer (acceso, rectificación, supresión, etc.)</li>
              <li>Detalles específicos si aplica</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              Tiempos de respuesta según Ley 1581/2012 colombiana:
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}><strong style={{ color: T.txt }}>Consulta (acceso a tu información):</strong> 10 días hábiles</li>
              <li><strong style={{ color: T.txt }}>Reclamo (corrección, supresión, revocatoria):</strong> 15 días hábiles</li>
            </ul>
          </SubSection>
        </Section>

        <Section number="8." title="Por cuánto tiempo guardamos tus datos">
          <ul style={{ paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: T.txt }}>Mientras tu cuenta esté activa:</strong> conservamos tus datos para que la plataforma funcione.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: T.txt }}>Si cancelás tu suscripción pero no eliminás la cuenta:</strong> conservamos tus datos para que
              puedas reactivar más adelante. Te avisamos por email cada 6 meses para que decidás.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: T.txt }}>Si eliminás tu cuenta:</strong> borramos todos tus datos en máximo <strong>30 días</strong>, salvo
              información mínima requerida por ley (registros de facturación electrónica DIAN: 5 años).
            </li>
            <li>
              <strong style={{ color: T.txt }}>Backups:</strong> los respaldos se conservan máximo 30 días después de la eliminación.
            </li>
          </ul>
        </Section>

        <Section number="9." title="Cómo protegemos tus datos">
          <p>Aplicamos medidas técnicas y organizativas razonables:</p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}><strong style={{ color: T.txt }}>Encriptación TLS 1.3</strong> para todos los datos en tránsito.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: T.txt }}>Encriptación AES-256</strong> para datos sensibles en reposo.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: T.txt }}>Hash bcrypt</strong> para contraseñas (nunca almacenadas en texto plano).</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: T.txt }}>Acceso mínimo necesario</strong>: solo personal autorizado accede a sistemas con tus datos.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: T.txt }}>Auditoría de accesos</strong>: registramos quién accede a qué.</li>
            <li><strong style={{ color: T.txt }}>Backups diarios</strong> con retención de 30 días.</li>
          </ul>
          <p style={{ marginTop: 16 }}>
            En caso de un incidente de seguridad que afecte tus datos personales, te notificaremos por
            email dentro de las <strong style={{ color: T.txt }}>72 horas</strong> siguientes a su detección, según las mejores
            prácticas internacionales (estándar GDPR aplicado voluntariamente).
          </p>
          <p style={{ marginTop: 12 }}>
            Más detalles técnicos sobre nuestra seguridad en{" "}
            <a href="/seguridad" style={{ color: T.green, textDecoration: "none" }}>finpathia.com/seguridad</a>.
          </p>
        </Section>

        <Section number="10." title="Cookies y tecnologías similares">
          <p>Usamos cookies y almacenamiento local del navegador para:</p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: T.txt }}>Funcionamiento esencial:</strong> mantener tu sesión iniciada, recordar tus preferencias, evitar
              recargas innecesarias. Sin estas, la plataforma no funciona.
            </li>
            <li>
              <strong style={{ color: T.txt }}>Analytics anonimizados:</strong> Google Analytics 4 con IP anonimizada para entender uso agregado de
              la plataforma. Podés bloquearlas con extensiones tipo Privacy Badger.
            </li>
          </ul>
          <p style={{ marginTop: 12 }}>
            <strong style={{ color: T.txt }}>NO usamos cookies de publicidad ni tracking de terceros</strong> para perfilamiento comercial.
          </p>
        </Section>

        <Section number="11." title="Datos de menores de edad">
          <p>
            FINPATHIA <strong style={{ color: T.txt }}>NO está dirigida a menores de 18 años</strong>. No recolectamos intencionalmente datos de
            menores. Si te das cuenta de que un menor creó una cuenta sin permiso de sus padres,
            escribinos a <a href="mailto:hola@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>hola@finpathia.com</a> y eliminaremos la cuenta inmediatamente.
          </p>
          <p style={{ marginTop: 12 }}>
            En el plan Pro Familiar, los administradores de cuenta confirman bajo su responsabilidad que
            los miembros agregados son mayores de edad o que tienen autorización paterna documentada.
          </p>
        </Section>

        <Section number="12." title="Cambios a esta política">
          <p>
            Podemos actualizar esta política para reflejar cambios en nuestras prácticas, en la
            regulación o en los proveedores que usamos. Cuando los cambios sean sustanciales:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>Te avisaremos por email con al menos 30 días de anticipación.</li>
            <li style={{ marginBottom: 4 }}>Publicaremos la nueva versión en esta página.</li>
            <li>Si los cambios afectan el tratamiento de tus datos, te pediremos un nuevo consentimiento expreso.</li>
          </ul>
        </Section>

        <Section number="13." title="Cómo presentar reclamos">
          <SubSection title="13.1 A nosotros primero">
            <p>
              Escribinos a <a href="mailto:hola@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>hola@finpathia.com</a> y
              respondemos en máximo 15 días hábiles.
            </p>
          </SubSection>

          <SubSection title="13.2 A la autoridad colombiana">
            <p>
              Si no quedás conforme con nuestra respuesta, podés acudir a la <strong style={{ color: T.txt }}>Superintendencia de Industria
              y Comercio (SIC)</strong>, ente de control en materia de protección de datos personales en Colombia:
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>Sitio web: <a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer" style={{ color: T.green, textDecoration: "none" }}>www.sic.gov.co</a></li>
              <li>PQRS: presentar Petición/Queja/Reclamo en línea</li>
            </ul>
          </SubSection>

          <SubSection title="13.3 Para usuarios en USA">
            <p>
              California residents may exercise rights under the California Consumer Privacy Act (CCPA) by
              contacting us at <a href="mailto:hola@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>hola@finpathia.com</a>.
              We do not sell personal information.
            </p>
          </SubSection>
        </Section>

        <Section number="14." title="Contacto">
          <ul style={{ paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>Email: <a href="mailto:hola@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>hola@finpathia.com</a></li>
            <li style={{ marginBottom: 4 }}>Términos y Condiciones: <a href="/terminos" style={{ color: T.green, textDecoration: "none" }}>finpathia.com/terminos</a></li>
            <li>Seguridad: <a href="/seguridad" style={{ color: T.green, textDecoration: "none" }}>finpathia.com/seguridad</a></li>
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
          FINPATHIA es operada por SOSALABS · Cumple con Ley 1581/2012 (Colombia) y principios CCPA/GDPR
        </div>
      </main>

      {/* Footer común */}
      <footer
        style={{
          padding: "24px 32px",
          borderTop: `1px solid ${T.border}`,
          background: T.bg2,
          textAlign: "center",
          fontSize: 12,
          color: T.txt3,
        }}
      >
        © 2026 FINPATHIA · <a href="/" style={{ color: T.txt3, textDecoration: "none" }}>Inicio</a> ·{" "}
        <a href="/seguridad" style={{ color: T.txt3, textDecoration: "none" }}>Seguridad</a> ·{" "}
        <a href="/privacidad" style={{ color: T.green, textDecoration: "none", fontWeight: 600 }}>Privacidad</a> ·{" "}
        <a href="/terminos" style={{ color: T.txt3, textDecoration: "none" }}>Términos</a>
      </footer>
    </div>
  );
}
