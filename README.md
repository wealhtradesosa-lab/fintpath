# FINPATHIA

**Tu camino a la libertad financiera** 🚀

Plataforma fintech premium para personas, familias y sociedades en Colombia y Estados Unidos. Permite entender, organizar, optimizar y proyectar tu patrimonio con foco fiscal, multi-usuario y proyecciones cuantitativas.

🌐 **Producción**: [finpathia.com](https://finpathia.com)

---

## ✨ Features principales

### Personal y patrimonial
- 📊 **Dashboard** — Patrimonio neto, cash flow, salud financiera, indicadores clave
- 💰 **Ingresos** — Sueldos, rentas, dividendos, honorarios con clasificación fiscal
- 💳 **Gastos** — 11 categorías + sub-categorías con causalidad fiscal Art. 107 ET
- 📈 **Inversiones** — Portfolio diversificado (real estate, equity, BTC, commodities, cash)
- 📋 **Deudas** — Préstamos hipotecarios, vehiculares, tarjetas con TIR y amortización
- 🎯 **Metas** — Objetivos a corto/largo plazo con plan de aporte
- 🖥️ **Simulador avanzado** — Sliders para cada palanca (ingresos, gastos, deudas, impuestos)

### Pensión y retiro
- 🏛️ **Colombia** — Colpensiones (RPM) + RAIS con cálculo de aportes obligatorios y voluntarios
- 🇺🇸 **US** — 401(k) + IRA + Social Security con proyecciones a 30 años
- ₿ **Bitcoin pension** — Modelo DCA + regla 4% con ciclos halving

### Trading y mercados
- 💹 **Trading portfolio** — Acciones US (NYSE/NASDAQ) + crypto con P/L en tiempo real
- 📊 **Watchlists** — Cotizaciones live con webhook a stock-prices

### IA financiera (planes Pro+)
- 🤖 **Asesor Financiero IA** — Análisis personalizado de tus números reales
- 🧠 **5 Coaches IA** — Cashflowista, Estratega, Auditor, Fundamentalista, Contrarian
- 📸 **Lectura de facturas** — OCR con clasificación fiscal automática
- 📥 **Importar Excel/CSV** — Con detección de columnas via IA

### Plan Tributario completo
- 🇨🇴 **Colombia** — Cálculo automático de impuesto de renta personas naturales (cédula general, cédulas exentas, dividendos) + personas jurídicas (ordinario, SIMPLE, zona franca, CHC, exenta, holding)
- 🇺🇸 **US** — Federal + state tax planning con deducciones estándar/itemized
- 📋 **Importación de declaraciones** — Sube tu F-110 / F-210 / F-1040 y el motor lee los renglones
- 🧮 **6 palancas tributarias jurídicas**:
  - Provisión cartera (Art. 145 ET)
  - Inversión CT&I 175% (Art. 158-1 inciso 1)
  - Salarios discapacidad 200% (Ley 361/97)
  - Bonificaciones extralegales (Art. 107 ET)
  - Capacitación 175% (Art. 158-1 inciso 2)
  - IVA en activos productivos (Art. 258-2)
- 💡 **Recomendaciones inteligentes** — Detecta automáticamente palancas no aprovechadas
- ⚠️ **Tope 25% Art. 259 ET** — Aplicado correctamente en todos los regímenes

### Multi-usuario (Plan Pro Familiar)
- 👨‍👩‍👧 **Hasta 10 personas** compartiendo la misma información patrimonial
- 🔐 **Roles** — Administrador (edita) y solo lectura (ve sin tocar)
- 🧾 **Acceso para tu contador** — Sin que tenga que tocar tus datos
- 📊 **Auditoría** — Quién cambió qué y cuándo

---

## 💎 Planes

Todos los precios en USD. Stripe cobra USD; usuarios CO ven equivalente COP dinámico calculado con TRM del Banco de la República en tiempo real.

| Plan | Precio | Slots | Para |
|---|---|---|---|
| **Free** | Gratis | 1 usuario | Empezar a organizarte |
| **Básico** | $8/mes · $6 anual | 1 usuario | Vida financiera completa |
| **Pro** | $16/mes · $12 anual | Hasta 3 usuarios | Planificar como experto |
| **Pro Familiar** | $27/mes · $20 anual | Hasta 10 usuarios | Familia + contador |

Trial 14 días sin tarjeta para Pro Familiar. Grace period 30 días post-cancelación.

---

## 🛠 Tech Stack

| Capa | Tecnología |
|---|---|
| **Frontend** | React 18 + Vite |
| **Charts** | Recharts |
| **Auth + DB** | Supabase (Postgres + Row-Level Security) |
| **Pagos** | Stripe (Live mode, multi-plan, lifecycle completo) |
| **Hosting** | Netlify (custom domain `finpathia.com`) |
| **Functions** | Netlify serverless (16 functions) |
| **Email** | Resend (con DNS configurado · `noreply@finpathia.com`) |
| **TRM** | Endpoint propio `/api/trm` con cache server-side |

### Netlify Functions
- **Pagos**: `stripe-checkout`, `stripe-webhook`, `stripe-customer-portal`, `stripe-recover-activation`
- **Cron**: `expire-canceled-cron` (diario 6 AM UTC)
- **Multi-usuario**: `family-invite-email`, `advisor-invite`, `advisor-accept-invite`, `advisor-lead`
- **IA**: `ai-chat`, `analyze-excel`, `analyze-image`, `parse-declaration`
- **Auth**: `auth-signup`, `support-ticket`
- **Datos**: `stock-prices`, `trm.js`

### Supabase
- Tablas: `user_data`, `accounts`, `account_members`, `account_invitations`, `account_audit_log`, `advisor_leads`
- 6 RPCs Stripe lifecycle (todas SECURITY DEFINER, idempotentes)
- Constraints + triggers de seguridad (`protect_last_admin_trigger`, `handle_new_user`)

---

## 🚀 Getting Started (desarrollo local)

```bash
# Clonar
git clone https://github.com/wealhtradesosa-lab/fintpath.git
cd fintpath

# Instalar dependencias
npm install

# Variables de entorno (crear .env.local)
cp .env.example .env.local
# Editar .env.local con tus claves de Supabase

# Dev server
npm run dev
# → http://localhost:5173

# Pre-push obligatorio
python3 audit.py    # 19 checks
npm run build       # Verificar que el build pasa
```

---

## 📦 Deploy

Push a `main` → Netlify auto-deploya en ~80 segundos. Bundle activo aparece en `<head>` del HTML.

```bash
# Push directo
git push origin main
```

**Reglas absolutas pre-push**:
- `python3 audit.py` debe dar 19/19 OK
- `npm run build` debe pasar sin errores
- Nunca usar `React.xxx` (siempre imports directos)
- Nunca poner `authUser` en useEffect deps
- Sliders deben usar el componente custom `Slider` (no `<input type="range">`)

---

## 📊 Constantes vigentes (Colombia 2026)

- **UVT**: $52,374 COP
- **SMMLV**: $1,750,905 COP
- **Componente inflacionario PN**: 50.88% (Decreto 0771/2025)

---

## 📚 Estructura del repo

```
fintpath/
├── src/
│   ├── App.jsx               # Componente principal (~2800 líneas)
│   ├── components/           # 40+ componentes (módulos por feature)
│   ├── lib/
│   │   ├── plans.js          # Source of truth pricing
│   │   ├── taxCO.js          # Motor fiscal Colombia (920+ líneas)
│   │   ├── recomendaciones.js # Detección palancas no aprovechadas
│   │   ├── normalize.js      # getFiscalWarnings + utilidades
│   │   ├── supabase.js       # Cliente + helpers
│   │   ├── useAccount.js     # Hook multi-usuario
│   │   └── analytics.js      # Tracking de eventos
│   └── ...
├── netlify/
│   └── functions/            # 16 serverless functions
├── public/
└── audit.py                  # 19 checks pre-push
```

---

## 🔐 Política de privacidad y seguridad

- 🔒 Encriptación E2E de datos sensibles
- 🛡️ Row-Level Security en Supabase
- 🔑 Service-role keys solo en serverless functions (nunca en frontend)
- 💳 PCI compliance via Stripe (no almacenamos tarjetas)
- 📧 DKIM + SPF configurados en `finpathia.com`

---

## 🤝 Contribuir

Este es un repo privado de [@wealhtradesosa-lab](https://github.com/wealhtradesosa-lab). Para sugerencias de feature o reportes de bug:
- Email: soporte@finpathia.com
- Bug reports: con steps to reproduce + screenshot si aplica

---

Built with 🔥 by [FINPATHIA](https://finpathia.com) · 2026
