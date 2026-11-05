import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense} from "react"; // arriba: en desarrollo Vite convierte este import en const (los lazy() de abajo lo necesitan ya)
import AvisoVersion from "./components/AvisoVersion";
import { Trash2 } from "./components/Iconos.jsx";
import InputDecimalEs from "./components/InputDecimalEs.jsx";
import { fmtTasaEs, fmtAniosEs } from "./lib/formato.js";
import LandingPage from "./components/LandingPage";
import { fetchAuth } from "./lib/apiFetch";
import BitcoinRetirementUS from "./components/BitcoinRetirementUS";

// ═══ CARGA DIFERIDA (25-jul-2026) ═══════════════════════════════════════════
// Santiago: "se demora mucho en cargar desde cel". El bundle pesaba 2,05 MB a
// PROCESAR (530 KB comprimidos: descargar era rápido, pero analizar y ejecutar
// 2 MB de JS en un celular son 2-3 segundos de CPU antes de poder tocar nada).
// Y Analytics mostraba que el tráfico de la pauta se iba a los 2 SEGUNDOS.
// Estos módulos no se necesitan para ver la portada ni el dashboard: se cargan
// cuando el usuario entra a su sección.
const TuNorte = lazy(() => import("./components/TuNorte"));
import { migratePrimaBonoAnual } from "./lib/primaBono.js";
import AvisoCambioNivel from "./components/AvisoCambioNivel.jsx";
const IngresosModule = lazy(() => import("./components/IngresosModule"));
const GastosModule = lazy(() => import("./components/GastosModule"));
const DeudasModule = lazy(() => import("./components/DeudasModule"));
const InversionesModule = lazy(() => import("./components/InversionesModule"));
const MiCuenta = lazy(() => import("./components/MiCuenta"));
const TarjetaMP = lazy(() => import("./components/TarjetaMP"));
const AdminMetrics = lazy(() => import("./components/AdminMetrics"));
const FlujoAnual = lazy(() => import("./components/FlujoAnual"));
const CsvImport = lazy(() => import("./components/CsvImport"));
const CalculadoraWizard = lazy(() => import("./components/CalculadoraWizard"));
const SimuladorAvanzado = lazy(() => import("./components/SimuladorAvanzado"));
const SimuladorFuturo = lazy(() => import("./components/SimuladorFuturo"));
const MiFuturo10 = lazy(() => import("./components/MiFuturo10"));
const DeclaracionFlow = lazy(() => import("./components/DeclaracionFlow"));
const PensionesColpensiones = lazy(() => import("./components/PensionesColpensiones"));
const BorradorDeclaracionF110 = lazy(() => import("./components/BorradorDeclaracionF110"));
const TaxOptimizerUS = lazy(() => import("./components/TaxOptimizerUS"));
const OptimizadorGananciaOcasional = lazy(() => import("./components/OptimizadorGananciaOcasional"));
const InformeContador = lazy(() => import("./components/InformeContador"));
const VistaContador = lazy(() => import("./components/VistaContador"));
const EstimadoRenta = lazy(() => import("./components/EstimadoRenta"));
const HistorialDeclaraciones = lazy(() => import("./components/HistorialDeclaraciones"));
import NotaFuenteImpuesto from "./components/NotaFuenteImpuesto";
const DashboardUS = lazy(() => import("./components/DashboardUS"));
const AssetsModuleUS = lazy(() => import("./components/AssetsModuleUS"));
const VistaFamiliarConsolidada = lazy(() => import("./components/VistaFamiliarConsolidada"));
const EstrategiaTributaria = lazy(() => import("./components/EstrategiaTributaria"));
const AsesorIA = lazy(() => import("./components/AsesorIA"));
const MetasModule = lazy(() => import("./components/MetasModule"));
import LandingAsesores from "./components/LandingAsesores";
import HeroVariantA from "./components/HeroVariantA";
import HeroVariantB from "./components/HeroVariantB";
import HeroVariantC from "./components/HeroVariantC";
import LandingPioneros from "./components/LandingPioneros";
import LandingPatrimonio from "./components/LandingPatrimonio";
const LandingLibertad = lazy(() => import("./components/LandingLibertad"));
import LandingSeguridad from "./components/LandingSeguridad";
import LandingTerminos from "./components/LandingTerminos";
import LandingPrivacidad from "./components/LandingPrivacidad";
import OnboardingTour from "./components/OnboardingTour";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { track, trackSignup, trackCheckoutStarted, trackPurchase, captureUTMs, identifyUser, readFirstTouch, guardarEntrada, leerEntrada } from "./lib/analytics";
import PageHeader from "./components/PageHeader";
import StatCard from "./components/StatCard";
import { ChartGradients, ChartTooltip, axisProps, gridProps, CHART, sinCorte, MARGEN_EJE } from "./lib/chartTheme.jsx";
import AdvisorWorkspace from "./components/AdvisorWorkspace";
import AcceptInvite from "./components/AcceptInvite";
import DashboardObservabilidad from "./components/DashboardObservabilidad";
import EditarDescuentosTributarios from "./components/EditarDescuentosTributarios";
import EditarAportesManuales from "./components/EditarAportesManuales";
import AyudaDeclaracion from "./components/AyudaDeclaracion";

// Build tag: sprint-2c-context-switch-2026-04-22
const __FINPATHIA_BUILD_ID__ = "fp-build-sprint-2c-context-switch-20260422";
if (typeof window !== "undefined") {
  window.__FINPATHIA_BUILD__ = __FINPATHIA_BUILD_ID__;
  console.log("[FINPATHIA] Build:", __FINPATHIA_BUILD_ID__);
}
import PensionColombia from "./components/PensionColombia";
import BuyVsInvest from "./components/BuyVsInvest";
import HallazgosProactivos from "./components/HallazgosProactivos";
import ContrarianHomeCard from "./components/ContrarianHomeCard";
import { getTopContrarianAlert, hasContrarianHomeData } from "./lib/contrarianHome.js";
import TreemapPatrimonio from "./components/TreemapPatrimonio";
import BarraComposicion from "./components/BarraComposicion";
import AnoEnCurso from "./components/AnoEnCurso";
import { generarHallazgos } from "./lib/hallazgos.js";
import { generarRecomendaciones } from "./lib/recomendaciones.js";
import SimuladorUS from "./components/SimuladorUS";
import AportesCalculadora from "./components/AportesCalculadora";
import CalculadoraPDF from "./components/CalculadoraPDF"; // 5-nov-2026: calculadoras exportables a PDF
import TaxPlanningUS from "./components/TaxPlanningUS";
import IncomeModuleUS from "./components/IncomeModuleUS";
import ExpensesModuleUS from "./components/ExpensesModuleUS";
import { normalizeFiscalData, getFiscalWarnings } from "./lib/normalize.js";
import { montoPromedioMensual, añosParaMeta, ingresoInversionAnual, mesesLibreDeuda, vaCOP, vcCOP } from "./lib/flowHelpers.js";
import { calcularMetricas, saludFinanciera, rentaYYield, gananciaVsInflacion, inflacionGlobal, fmtPctEs, fmtMeses, umbralNivel } from "./lib/metrics.js";
import RetirementModuleUS from "./components/RetirementModuleUS";
import GoalsModuleUS from "./components/GoalsModuleUS";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { esDemo, leerCache, guardarReal, datosAlSalir } from "./lib/modoDemo";
import { AVISO_NO_SINCRONIZADO, datosNoSincronizados, marcarNoSincronizados, alCambiarSincronizacion, leerUserData } from "./lib/sincronizacion";
import { useAccount } from "./lib/useAccount";
import { RoleProvider } from "./lib/RoleContext.jsx";
import RoleBanner from "./components/RoleBanner";
import AccountSwitcher from "./components/AccountSwitcher";
import { useJurisdiction } from "./hooks/useJurisdiction";
import { UVT, DEFAULT_AG, calcImpRenta, estimarImpuesto } from "./lib/taxCO";
import { calibracionReferente, estimarImpuestoReferente } from "./lib/impuestoReferente";
import { setRegion, plataCorta as plataRegion, tx, nombreMes, pct as pctR, localeCifras } from "./lib/region.js";
import { leerNorte, borrarNorte, itemsDesdeNorte, calcularNorte, RETORNO_SUPUESTO } from "./lib/norteUnMinuto.js";
import PrimerMinuto from "./components/PrimerMinuto.jsx";
import AfinaTuNumero from "./components/AfinaTuNumero.jsx";
import { tieneEstimados } from "./lib/afinaNumero.js";
import BotonTema from "./components/BotonTema.jsx";
import { IconoMenu, DefsIconos } from "./components/Iconos.jsx";
import { Eye, EyeOff, Menu as IconoMenuHamburguesa, X as IconoCerrar } from "lucide-react";
import NavRecorrido from "./components/NavRecorrido.jsx";
import { TRM_PROVISIONAL, usdPendienteDeTasa, NOTA_TRM_PENDIENTE } from "./lib/trm.js";
import { registrarMes, resumenHistoria, etiquetaMes, fotoPatrimonio } from "./lib/historiaPatrimonio.js";
import { migrateInvFiscalCodeTipo } from "./lib/invFiscalCode.js";
import { migrateAportesVoluntariosV17, migrateDeclaracionesV55, migrateFiscalCodePVLegacy, migratePlanOptimizacionNamespace, migrateDeudaViviendaWizardLegacy, migrateAporteTributarioNombre, migrateInversionUnica } from "./lib/migrations";
import { getPlansForApp, STRIPE_PRICE_IDS, planDesdePriceId, PRECIOS_COP, fmtCOP } from "./lib/plans.js";
import DeclaracionUpload from "./components/DeclaracionUpload";
import GlosarioPage from "./components/GlosarioPage";
import MedidorLibertad from "./components/infografia/MedidorLibertad";
import FlujoDinero from "./components/infografia/FlujoDinero";
import MapaPatrimonio from "./components/infografia/MapaPatrimonio";
import RentasMesAMes from "./components/infografia/RentasMesAMes";
import IndicadoresSalud from "./components/infografia/IndicadoresSalud";
import FireNumero from "./components/infografia/FireNumero";
import CaminoIndependencia from "./components/infografia/CaminoIndependencia";
import LineaDeudas from "./components/infografia/LineaDeudas";
import { rentasPorMes, nombreCategoria } from "./lib/infografia.js";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend } from "recharts";

// ═══════════════════════════════════════════════════════════════════════════
// PALETA DEL SHELL — alineada a los tokens (27-sep-2026)
// ─────────────────────────────────────────────────────────────────────────
// Esta T se pasa como prop a los módulos hijos, así que sus valores son los
// que más superficie pintan en toda la app. Estaban desalineados de
// designTokens.js y de :root, que es lo que producía el efecto de "cada
// pantalla se ve distinta":
//
//   bg      var(--fp-bg) → var(--fp-bg)   (--fp-bg)
//   bg2     var(--fp-card) → var(--fp-card)   (--fp-surface)
//   card    var(--fp-bg) → var(--fp-card)   (--fp-surface)  · era el mismo rol que bg2
//   bg3     var(--fp-raised) → var(--fp-raised)   (--fp-raised)
//   border  0.06    → 0.08      (--fp-border)
//   borderL 0.1     → 0.15      (--fp-border-strong)
//   or      #f59e0b → #f59e0b   (--fp-warn)
//
// NO se tocan, y no son deriva:
//   · gd #f59e0b — acento dorado; sin token propio todavía. Sin uso en este
//     archivo, pero los hijos lo reciben por prop.
//   · Los grises claros (#e5e7eb, #f9fafb, var(--fp-line), #d1d5db…) viven dentro de
//     las plantillas HTML de impresión y PDF, que son un lienzo CLARO aparte.
//     Contarlos como deriva del tema oscuro fue un error de mi medición.
//   · #25d366 es el verde de marca de WhatsApp.
//   · #0f2a1a / #2a2416 / #12203a son tintes de estado de pago, deliberados.
// ═══════════════════════════════════════════════════════════════════════════
// Link de pago de Mercado Pago para pioneros (Santiago, 25-oct-2026). Cambiar aquí precio o link.
const PIONEROS_MP={url:"https://mpago.li/1EhDTCo"};
const T={bg:"var(--fp-bg)",bg2:"var(--fp-card)",bg3:"var(--fp-raised)",card:"var(--fp-card)",border:"rgba(var(--fp-ink),0.08)",borderL:"rgba(var(--fp-ink),0.15)",tx:"var(--fp-txt)",tx2:"var(--fp-txt2)",tx3:"var(--fp-txt3)",gn:"#00c805",gnB:"rgba(0,200,5,0.08)",rd:"#ff5000",rdB:"rgba(255,80,0,0.06)",bl:"#3b82f6",pr:"#3b82f6",or:"#f59e0b",gd:"#f59e0b",ch:["#00c805","#3b82f6","#64748b","#94a3b8","#475569","#b4bfcc","#334155","#7a8699"]};
const fm=n=>n==null?"$0":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
// 3-nov-2026: porcentaje, meses y tasa con el formato del país de la sesión (lib/region.js). En Colombia, idénticos a antes.
const pc=n=>pctR(n);
const mesesR=n=>{const v=Math.round((Number(n)||0)*10)/10;return v.toLocaleString(localeCifras(),{minimumFractionDigits:0,maximumFractionDigits:1})+(v===1?tx(" mes"," month"):tx(" meses"," months"))};
const tasaR=n=>{if(n===""||n==null)return"";const v=Number(n);if(!Number.isFinite(v))return String(n)+"%";return v.toLocaleString(localeCifras(),{minimumFractionDigits:0,maximumFractionDigits:2})+"%"};
const SK="fp3";
// 26-oct-2026 — La contraseña NO se guarda en el navegador (antes iba en claro
// a localStorage "fp3_enc_key"). Vive solo en memoria y muere al recargar o
// cerrar la pestaña. Solo la usa el lector de abajo para descifrar payloads
// legacy: `E2E.encrypt` ya no se llama en ninguna parte y el producto declara
// que NO hay cifrado de extremo a extremo (LandingPrivacidad, LandingSeguridad).
// Una fila legacy se migra sola a texto plano en el primer guardado tras
// descifrarla, porque sS siempre escribe plano.
let _encKey=null;
// Barrido al cargar el módulo: las versiones anteriores dejaron la contraseña
// en claro en el navegador de cada usuario que ya entró. Dejar de escribirla no
// la borra, así que la sacamos en el primer render de cualquier pestaña.
const CLAVES_PROHIBIDAS=["fp3_enc_key"];
try{for(const k of CLAVES_PROHIBIDAS){localStorage.removeItem(k);sessionStorage.removeItem(k)}}catch{/* storage bloqueado */}
// sLR: lectura con estado. "error" (fallo, timeout o cifrado sin llave) nunca
// se confunde con "nuevo" (el servidor respondió y no hay fila). En "error" la
// copia local (fp3) solo se muestra para leer y se bloquean los guardados.
const sLR=async(uid,accountId)=>{
  const cache=()=>{try{const r=leerCache(localStorage.getItem(SK));return r?sanitize(r):null}catch{return null}};
  if(!(isSupabaseConfigured&&uid))return{estado:"local",datos:cache()};
  // Multi-cuenta (Fase 2): si tenemos accountId, leer por account_id.
  // Sino, fallback legacy a leer por uid.
  const r=await leerUserData({
    leer:()=>{const q=supabase.from("user_data").select("data,jurisdiction,updated_at");return accountId?q.eq("account_id",accountId).maybeSingle():q.eq("id",uid).maybeSingle()},
    procesar:async(row)=>{
      _versionServidor=row.updated_at||null;
      let sd=row.data;
      if(sd._encrypted&&sd.payload){
        // La llave vive en memoria desde el #66; nunca en storage.
        const encKey=_encKey;
        if(!encKey)return null;
        try{sd=await E2E.decrypt(sd.payload,encKey,uid)}catch{return null}
      }
      sd=sanitize(sd);
      if(row.jurisdiction)sd.jurisdiction=row.jurisdiction;
      return sd;
    },
  });
  if(r.estado==="ok"){marcarNoSincronizados(false);try{localStorage.setItem(SK,JSON.stringify(r.datos))}catch{}return r}
  if(r.estado==="nuevo"){marcarNoSincronizados(false);return r}
  console.warn("[fp3] user_data no se pudo leer; solo lectura hasta reconectar:",r.error);
  marcarNoSincronizados(true);
  return{estado:"error",datos:cache(),error:r.error};
};
const sL=async(uid,accountId)=>{try{return(await sLR(uid,accountId)).datos}catch{return null}};
export { sLR as _sLR };
export const AvisoNoSincronizado=({onReintentar,cargando})=><div role="alert" style={{background:"rgba(255,80,0,0.1)",borderBottom:"1px solid rgba(255,80,0,0.3)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",fontSize:12,color:"#fca5a5"}}><span>{AVISO_NO_SINCRONIZADO}</span><button onClick={onReintentar} disabled={cargando} style={{background:"#ff5000",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>{cargando?"Reintentando…":"Reintentar"}</button></div>;

// LoadingScreen: splash minimalista mientras el useEffect inicial resuelve.
// El timeout defensivo (Promise.race 8s) en el useEffect garantiza que
// setLd(false) siempre se ejecute; este splash nunca debería quedarse
// visible por más de 1-2 segundos en condiciones normales.
function LoadingScreen(){
  return <div style={{background:"var(--fp-bg)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui"}}>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:32,fontWeight:700,background:"linear-gradient(135deg,#00c805,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>FINPATHIA</div>
      <div style={{width:40,height:3,background:"linear-gradient(90deg,#00c805,#3b82f6)",borderRadius:3,margin:"16px auto",animation:"pulse 1.5s infinite"}}/>
      <div style={{color:"var(--fp-txt3)",fontSize:12}}>Cargando tu patrimonio...</div>
    </div>
  </div>;
}


// Hotfix TRM: 4200 era el valor por defecto mientras el efecto de TRM estaba
// roto. No es una tasa real: no se guarda y, si viene guardado, se descarta.
// 26-oct-2026 — La constante vive en src/lib/trm.js, único lugar donde está
// escrita. Se reexporta porque los tests del #70 la consumen desde acá.
export { TRM_PROVISIONAL } from "./lib/trm.js";
export const trmReal=(d)=>{const t=Number(d&&d.trm);return Number.isFinite(t)&&t>0&&t!==TRM_PROVISIONAL?t:null};
// 26-oct-2026 — `fetch("/api/trm")` iba pelado: sin timeout ni AbortController.
// Si la red cuelga, la promesa no se resuelve NUNCA y el `catch {}` tampoco
// corre, así que la tasa no llega y nadie se entera. Importa desde que el #70
// revivió el efecto (estaba después de un `return`, inalcanzable). Diseño
// tomado del PR #56 (src/lib/tasaDolar.js), que no se mergeó.
export const TRM_TIMEOUT_MS=5000;
export async function traerTrm(ms=TRM_TIMEOUT_MS){
  const ctl=typeof AbortController!=="undefined"?new AbortController():null;
  let id;
  const limite=new Promise((_,rej)=>{id=setTimeout(()=>{try{ctl&&ctl.abort()}catch{}rej(new Error("timeout /api/trm"))},ms)});
  try{
    const r=await Promise.race([fetch("/api/trm",ctl?{signal:ctl.signal}:undefined),limite]);
    return await Promise.race([r.json(),limite]);
  }finally{clearTimeout(id)}
}
export const trmDeApi=(j)=>j&&j.source!=="default"&&trmReal(j)?{trm:Number(j.trm),trmSrc:j.source,trmFecha:j.date||null}:null;
const MESES_CORTOS=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
export const fechaTrmCorta=(f)=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(f||""));return m?`${m[3]}-${MESES_CORTOS[+m[2]-1]}`:null};
const tieneUSD=(u)=>!!u&&["inv","deu","ingresos","ibk"].some(k=>(u[k]||[]).some(i=>i&&i.moneda==="USD"))||!!u&&Object.values(u.gas||{}).some(g=>Array.isArray(g)?g.some(i=>i&&i.moneda==="USD"):g&&g.moneda==="USD");
// Qué tasa se usa para mostrar: la viva de esta sesión, si no la última real
// guardada (con su fecha), si no ninguna. Nunca 4200.
export const estadoTrm=(u,viva)=>{const t=trmReal(u);if(t)return{trm:t,modo:viva?"viva":"guardada",fecha:fechaTrmCorta(u.trmFecha)};return{trm:0,modo:tieneUSD(u)?"pendiente":"sin_usd",fecha:null}};
// Sin tasa real: los montos USD no se convierten. Los totales quedan marcados
// «pendiente de tasa» (subtotal solo COP) y el nivel se congela en el último
// conocido, para no bajarlo en falso ni disparar el aviso de cambio de nivel.
export const totalesConTasa=(t,est,ultimoNivel)=>{if(!t||est.modo!=="pendiente")return t;return{...t,pendienteTasa:true,nivel:ultimoNivel||{nombre:"Pendiente de tasa",pendienteTasa:true}}};
export const sinTrmProvisional=(d)=>{if(!d||typeof d!=="object"||trmReal(d))return d;const{trm,trmSrc,...resto}=d;return resto};
const sanitize=(d)=>{if(!d||typeof d!=="object")return null;if(d.trm!=null&&!trmReal(d)){delete d.trm;delete d.trmSrc}if(!d.p)d.p={};if(!d.p.name)d.p.name="Usuario";if(!d.p.email)d.p.email="";if(!d.p.plan)d.p.plan="free";if(!d.owners)d.owners=[{id:"own_1",name:"Personal",type:"natural",regimen:"ordinario"}];d.owners=d.owners.map(o=>({...o,regimen:o.regimen||"ordinario"}));if(!d.inv)d.inv=[];d.inv=d.inv.map(i=>{if(i.tp&&!isNaN(Number(i.tp))){i.tp=inferType(i);i.tipo=i.tp}return i});if(!d.deu)d.deu=[];
// Commit 18 Tarea 3: migración silenciosa para deudas legacy sin fiscalCode.
// El bug latente del Commit 19 (handleSave no persistía fiscalCode) dejó deudas
// guardadas SIN ese campo. Aquí derivamos el fiscalCode automáticamente del
// campo tp (mortgage→VIVIENDA_HABITACIONAL, otros→CONSUMO) cuando falta.
// Esto es DEFENSIVO: si el campo ya existe, no se toca. Sin riesgo de regresión.
d.deu=d.deu.map(deuda=>{if(deuda.fiscalCode)return deuda;const fcInferido=deuda.tp==="mortgage"?"DEU_NAT_VIVIENDA_HABITACIONAL":"DEU_NAT_CONSUMO";return {...deuda,fiscalCode:fcInferido}});
if(!d.gas)d.gas={};
// Commit 22 Tarea 3: migración silenciosa para gastos legacy sin fiscalCode.
// Mismo patrón que Commit 18 (deudas) y Commit 16 (UI fallback). Items
// creados antes de que se persistiera fiscalCode quedaron sin ese campo.
// Aquí derivamos el fiscalCode desde la categoría según el OWNER del item.
//
// IMPORTANTE: necesitamos saber si el owner es natural o jurídica para
// asignar el fiscalCode correcto. Si el owner ya no existe (eliminado),
// asumimos natural por default (más conservador).
//
// Reglas (mismas que defaultFiscalCode en GastosModule.jsx):
//   Universal:
//     - Aporte tributario → AP_TRIB_PV (más común)
//   Natural:
//     - Salud → GAS_NAT_SALUD_MEDICINA
//     - Vivienda/Arrendamiento/Mantenimiento/Servicios → GAS_NAT_PERSONAL (conservador)
//     - Seguros → SEG_GENERICO (sub-selector clarifica)
//     - Impuesto (legacy: Predial) → GAS_NAT_PERSONAL (sub-selector clarifica)
//     - Ahorro → GAS_NAT_AHORRO
//     - Resto → GAS_NAT_PERSONAL
//   Jurídica:
//     - Nómina → GAS_JUR_NOMINA
//     - Honorarios → GAS_JUR_HONORARIOS_PROF
//     - Impuesto (legacy: Predial) → GAS_JUR_PREDIAL
//     - Depreciación → GAS_JUR_DEPRECIACION
//     - Educación → GAS_JUR_CAPACITACION
//     - Gastos personales (Alimentación, Entretenimiento, etc) → GAS_JUR_NO_DEDUCIBLE
//     - Resto → GAS_JUR_OPERATIVO
const _ownersById = {};
(d.owners || []).forEach(o => { _ownersById[o.id] = o; });
const _deriveGasFiscalCode = (cat, ownerId) => {
  if (cat === "Aporte tributario") return "AP_TRIB_PV";
  const ow = _ownersById[ownerId];
  const isJur = ow?.type === "juridica";
  if (isJur) {
    if (cat === "Nómina") return "GAS_JUR_NOMINA";
    if (cat === "Honorarios") return "GAS_JUR_HONORARIOS_PROF";
    if (cat === "Impuesto" || cat === "Predial") return "GAS_JUR_PREDIAL";
    if (cat === "Depreciación") return "GAS_JUR_DEPRECIACION";
    if (cat === "Educación") return "GAS_JUR_CAPACITACION";
    if (["Alimentación", "Entretenimiento", "Personal", "Vestimenta", "Mascotas", "Deporte", "Ahorro"].includes(cat)) return "GAS_JUR_NO_DEDUCIBLE";
    return "GAS_JUR_OPERATIVO";
  }
  // natural
  if (cat === "Salud") return "GAS_NAT_SALUD_MEDICINA";
  if (cat === "Vivienda" || cat === "Arrendamiento" || cat === "Mantenimiento" || cat === "Servicios") return "GAS_NAT_PERSONAL";
  if (cat === "Seguros") return "SEG_GENERICO";
  if (cat === "Impuesto" || cat === "Predial") return "GAS_NAT_PERSONAL";
  if (cat === "Depreciación") return "GAS_INMUEBLE_DEPRECIACION";
  if (cat === "Ahorro") return "GAS_NAT_AHORRO";
  return "GAS_NAT_PERSONAL";
};
Object.keys(d.gas).forEach(cat => {
  if (!Array.isArray(d.gas[cat])) return;
  d.gas[cat] = d.gas[cat].map(item => {
    if (item.fiscalCode) return item;
    return { ...item, fiscalCode: _deriveGasFiscalCode(cat, item.owner) };
  });
});
if(!d.ingresos)d.ingresos=[];if(!d.metas)d.metas=[];if(!d.ibk)d.ibk=[];if(!d.pen)d.pen={};if(!d.jurisdiction)d.jurisdiction="CO";if(d.componenteInflacionarioPct==null)d.componenteInflacionarioPct=50.88;return migrateInvFiscalCodeTipo(migratePrimaBonoAnual(migrateInversionUnica(migrateAporteTributarioNombre(migrateDeudaViviendaWizardLegacy(migratePlanOptimizacionNamespace(migrateFiscalCodePVLegacy(migrateDeclaracionesV55(migrateAportesVoluntariosV17(d)))))))))};

// ═══ END-TO-END ENCRYPTION ═══
const E2E={
  async deriveKey(password,salt){
    const enc=new TextEncoder();
    const keyMaterial=await crypto.subtle.importKey("raw",enc.encode(password),{name:"PBKDF2"},false,["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt:enc.encode(salt),iterations:100000,hash:"SHA-256"},keyMaterial,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  },
  async encrypt(data,password,salt){
    const key=await this.deriveKey(password,salt);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const enc=new TextEncoder();
    const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(data)));
    const combined=new Uint8Array(iv.length+encrypted.byteLength);
    combined.set(iv);combined.set(new Uint8Array(encrypted),iv.length);
    return btoa(String.fromCharCode(...combined));
  },
  async decrypt(encryptedB64,password,salt){
    const key=await this.deriveKey(password,salt);
    const combined=Uint8Array.from(atob(encryptedB64),c=>c.charCodeAt(0));
    const iv=combined.slice(0,12);
    const data=combined.slice(12);
    const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,data);
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
};
let _svT=null;
// 30-oct-2026 (Santiago: "creé una persona jurídica y no queda guardada… delicado eso").
// El guardado manda el blob completo: la última pantalla que guarda gana. Con dos
// pestañas, dos dispositivos o varias personas en la cuenta, una borraba los cambios
// de la otra sin aviso. Ahora cada pantalla recuerda la versión (updated_at) que leyó
// o guardó; si en el servidor hay una más nueva, no pisa: avisa (fp3-save-conflict).
let _versionServidor=null;
let _forzarGuardado=false;
export const forzarSiguienteGuardado=()=>{_forzarGuardado=true;};
const sS=async(d,uid,accountId,isLegacy,role)=>{
  // Nunca se persiste una TRM que no sea real (p. ej. el 4200 provisional).
  d=sinTrmProvisional(d);
  // Modo demo: solo en memoria. Ni caché local, ni snapshots, ni Supabase.
  if(esDemo(d))return;
  // 31-oct-2026 — la foto del mes va con los datos (servidor), no en localStorage.
  d=registrarMes(d,{trm:trmReal(d)});
  try{
    localStorage.setItem(SK,JSON.stringify(d));
    if(isSupabaseConfigured&&uid){
      // Copia vieja en pantalla (lectura falló): ningún PATCH/upsert a user_data.
      if(datosNoSincronizados())return;
      // Fase 3 commit 5 — gating reader: si el usuario es READER en una
      // cuenta multi-usuario (no legacy), abortar el upsert antes del
      // setTimeout. RLS en BD ya bloquearía el UPDATE (policy account_admins
      // only), pero hacerlo en cliente evita el roundtrip y muestra UX
      // clara. localStorage ya se guardó arriba (cache local OK), pero NO
      // se persiste a Supabase. Emitir evento para que App muestre toast.
      if(role==="reader"&&!isLegacy){
        try{const ev=new CustomEvent("fp3-reader-blocked");window.dispatchEvent(ev)}catch{}
        return;
      }
      clearTimeout(_svT);
      _svT=setTimeout(async()=>{
        if(datosNoSincronizados())return;
        // Commit 12 Tarea 3 (BUG REPORTADO: 'no quedan guardados'): el catch
        // silencioso original ocultaba errores del upsert. Si Supabase rechazaba
        // el guardado (RLS, schema mismatch, tamaño), el usuario veia "Guardado"
        // pero los datos nunca llegaban al backend. Al recargar la pagina se
        // perdian. Ahora hacemos visible el error y el estado al window para
        // diagnostico inmediato.
        try{
          // Multi-cuenta (Fase 2 commit 1): si tenemos accountId y NO estamos
          // en modo legacy, hacer UPDATE por account_id. Esto funciona aunque
          // el admin que escribe sea distinto al `id` del row de user_data
          // (caso futuro de admin invitado). El row ya existe — lo creó
          // handle_new_user (PATCH 5/FIX 1) o la migración retroactiva.
          // Caso legacy (accountId nulo o isLegacy=true): mantener upsert
          // por id, idéntico al comportamiento pre-Fase 2.
          // ¿Alguien guardó después de que esta pantalla leyó? Entonces no se pisa.
          if(_versionServidor&&!_forzarGuardado){
            const qv=supabase.from("user_data").select("updated_at");
            const cur=accountId&&!isLegacy?await qv.eq("account_id",accountId).maybeSingle():await qv.eq("id",uid).maybeSingle();
            const srv=cur?.data?.updated_at;
            if(srv&&new Date(srv).getTime()>new Date(_versionServidor).getTime()+500){
              try{window.dispatchEvent(new CustomEvent("fp3-save-conflict",{detail:{servidor:srv}}))}catch{}
              return;
            }
          }
          _forzarGuardado=false;
          const ahoraISO=new Date().toISOString();
          let result;
          if(accountId&&!isLegacy){
            result=await supabase.from("user_data")
              .update({data:d,jurisdiction:d.jurisdiction||"CO",updated_at:ahoraISO})
              .eq("account_id",accountId).select("updated_at");
          }else{
            result=await supabase.from("user_data").upsert(
              {id:uid,data:d,jurisdiction:d.jurisdiction||"CO",updated_at:ahoraISO},
              {onConflict:"id"}
            ).select("updated_at");
          }
          if(result.error){
            console.error("[fp3] Supabase save ERROR:",result.error);
            window.__fp3LastSaveError=result.error;
            // Toast visible al usuario para que sepa que hay un problema
            try{const ev=new CustomEvent("fp3-save-error",{detail:result.error});window.dispatchEvent(ev)}catch{}
          }else{
            // La versión la pone el servidor (trigger user_data_updated_at).
            const fila=Array.isArray(result.data)?result.data[0]:result.data;
            _versionServidor=fila?.updated_at||ahoraISO;
            window.__fp3LastSaveOk=new Date().toISOString();
            // Commit 23 Tarea 3: notificar al usuario cuando el upsert a Supabase
            // se confirma. Resuelve la duda 'se guardo o no?' que tenia el usuario
            // (caso del bug reportado 'AGREGO SALARIOS PERO NO QUEDAN GUARDADOS'
            // - los datos SI se guardaban, pero el toast 'Guardado' se mostraba
            // antes del debounce de 2s, generando incertidumbre).
            try{const ev=new CustomEvent("fp3-save-ok",{detail:{at:new Date().toISOString()}});window.dispatchEvent(ev)}catch{}
          }
        }catch(e){
          console.error("[fp3] Supabase save EXCEPTION:",e);
          window.__fp3LastSaveError=e;
          try{const ev=new CustomEvent("fp3-save-error",{detail:e});window.dispatchEvent(ev)}catch{}
        }
      },2000);
    }
  }catch(e){console.error("[fp3] localStorage save ERROR:",e)}
};
// 03-ago-2026 (Santiago: "dólar a 4.200 es un grave error para calcular").
// Cada usuario se creaba con trm:4200 GRABADO en su perfil. Ese valor queda en
// Supabase y es el que se lee después: la tasa real del Banco de la República
// llegaba, pero el dato viejo ya estaba persistido y volvía a pisar todo en la
// siguiente carga.
// Ahora se crea SIN trm. El efecto de arranque la trae del Banco y esa es la
// que se guarda. 4200 queda solo como respaldo si la fuente no responde.
const mkU=(n,e)=>({p:{name:n,email:e,plan:"free"},inv:[],deu:[],gas:{},ibk:[],ingresos:[],pen:{age:35,rAge:60,sv:2500,cur:120000,ret:7,inf:3,des:6000,btcC:10,btcP:50000},metas:[]});

const DI=[{id:"i1",n:"Apartamento Bogotá",ub:"Bogotá, Chapinero",tp:"Real Estate",vc:650000000,va:850000000,un:[{n:"Apto 301",ig:[{c:"Arriendo",m:4200000,t:"f"}],gs:[{c:"Admin",m:580000,t:"f"},{c:"Predial",m:220000,t:"f"}]}]},{id:"i2",n:"Casa Orlando",ub:"Orlando, FL",tp:"Real Estate",moneda:"USD",vc:280000,va:360000,un:[{n:"Casa principal",ig:[{c:"Airbnb",m:3200,t:"v"}],gs:[{c:"Property Tax",m:280,t:"f"},{c:"Insurance",m:180,t:"f"},{c:"HOA",m:150,t:"f"}]}]},{id:"i3",n:"Fondo Bancolombia",ub:"Colombia",tp:"Fondo de Inversión",vc:120000000,va:145000000,un:[]},{id:"i4",n:"CDT Davivienda",ub:"Colombia",tp:"CDT",vc:80000000,va:86000000,un:[]},{id:"i5",n:"Portafolio ETFs",ub:"USA",tp:"Acciones",moneda:"USD",vc:35000,va:48000,un:[]},{id:"i6",n:"Bitcoin",ub:"",tp:"Crypto",vc:15000000,va:22000000,un:[]}];
const DD=[{id:"d1",n:"Hipoteca Apto Bogotá",tp:"Hipoteca",mt:380000000,ts:12,pg:4800000,pl:180,vi:"i1"},{id:"d2",n:"Crédito Vehículo",tp:"Libre inversión",mt:45000000,ts:18,pg:1200000,pl:36},{id:"d3",n:"Tarjeta Visa",tp:"Tarjeta",mt:8500000,ts:28,pg:850000,pl:12}];
const DG={Vivienda:[{c:"Arriendo vivienda",m:4500000,t:"f"},{c:"Servicios públicos",m:450000,t:"f"},{c:"Internet + TV",m:180000,t:"f"}],Alimentación:[{c:"Mercado semanal",m:1800000,t:"f"},{c:"Restaurantes",m:600000,t:"v"}],Transporte:[{c:"Gasolina",m:400000,t:"v"},{c:"Parqueadero",m:250000,t:"f"},{c:"SOAT + Tecno",m:120000,t:"f"}],Educación:[{c:"Colegio hijo 1",m:2300000,t:"f"},{c:"Colegio hijo 2",m:2300000,t:"f"},{c:"Extracurriculares",m:400000,t:"v"}],Seguros:[{c:"Seguro vida",m:350000,t:"f"},{c:"Salud prepagada",m:680000,t:"f"}],Personal:[{c:"Ropa y cuidado",m:300000,t:"v"},{c:"Entretenimiento",m:500000,t:"v"},{c:"Suscripciones",m:120000,t:"f"}]};
const DIB=[{tk:"AAPL",n:"Apple",sh:25,pr:198.5,cb:155,tg:220},{tk:"MSFT",n:"Microsoft",sh:15,pr:430,cb:310,tg:500},{tk:"TSLA",n:"Tesla",sh:8,pr:382,cb:442,tg:500},{tk:"NVDA",n:"NVIDIA",sh:12,pr:920,cb:480,tg:1100},{tk:"PLTR",n:"Palantir",sh:50,pr:25,cb:17.5,tg:35},{tk:"QQQ",n:"QQQ",sh:20,pr:485,cb:380,tg:550},{tk:"BTC",n:"Bitcoin",sh:0.15,pr:68000,cb:42000,tg:120000}];
const DING=[{id:"ing_1",nombre:"Salario Principal",categoria:"Salario",mensual:12500000,tipo:"fijo",fuente:"Empresa Tech"},{id:"ing_2",nombre:"Arriendo Apto Bogotá",categoria:"Arriendo",mensual:4200000,tipo:"fijo",fuente:"Apto 301 Chapinero",capital:"850000000",tasa:"5.9"},{id:"ing_3",nombre:"Airbnb Orlando",categoria:"Arriendo",mensual:3200,tipo:"variable",fuente:"Casa Orlando",moneda:"USD"},{id:"ing_4",nombre:"Rendimiento CDT",categoria:"Rendimiento",mensual:860000,tipo:"fijo",fuente:"CDT Davivienda",capital:"86000000",tasa:"12"},{id:"ing_5",nombre:"Freelance Consultoría",categoria:"Freelance",mensual:3500000,tipo:"variable",fuente:"Clientes varios"}];
const ADV=[{id:"cashflow",nm:"Tus rentas",av:"",cl:"#f59e0b",bg:"rgba(245,158,11,0.06)",ti:"¿Cuánto te entra sin trabajar?"},{id:"estratega",nm:"Tu libertad",av:"",cl:"#ff5000",bg:"rgba(255,80,0,0.06)",ti:"¿En qué nivel estás y qué sigue?"},{id:"riesgo",nm:"Tus riesgos",av:"",cl:"#3b82f6",bg:"rgba(59,130,246,0.06)",ti:"¿Qué podría salir mal?"},{id:"valor",nm:"Tus inversiones",av:"",cl:"#00c805",bg:"rgba(0,200,5,0.06)",ti:"¿Qué rinde y qué no?"},{id:"contrarian",nm:"Segunda opinión",av:"",cl:"#3b82f6",bg:"rgba(59,130,246,0.06)",ti:"Lo que te conviene no hacer"}];

const dfa=(ds,a)=>{const d=(ds||[]).filter(x=>x.la===a);return{s:d.reduce((a,x)=>a+(x.mt||0),0),p:d.reduce((a,x)=>a+(x.pg||0),0)}};
const iM=(inv,ds)=>{let ig=0,gs=0;const toArr=v=>Array.isArray(v)?v:[];
if(inv.un&&Array.isArray(inv.un))inv.un.forEach(u=>{toArr(u.ig).forEach(i=>ig+=(+i.m||0));toArr(u.gs).forEach(g=>gs+=(+g.m||0))});
else{toArr(inv.ig).forEach(i=>ig+=(+i.m||0));toArr(inv.gs).forEach(g=>gs+=(+g.m||0))}
if(ig===0&&(+inv.renta||0)>0)ig=+inv.renta;
const va=+inv.va||0,vc=+inv.vc||0,noi=ig-gs,db=dfa(ds,inv.id),eq=va-db.s,gn=va-vc;
return{ig,gs,noi,gn,roi:vc>0?(gn/vc)*100:0,cap:va>0?((noi*12)/va)*100:0,ds:db.s,dp:db.p,eq,coc:eq>0?(((noi-db.p)*12)/eq)*100:0}};
const inferType=(i)=>{let tp=String(i.tp||i.tipo||i.type||"").trim();if(!tp||!isNaN(Number(tp)))tp="";const typeMap={"Other":"Otro","Investment":"Fondo de Inversión","Income":"Otro","Trading":"Acciones","Renta Fija":"CDT","Lote":"Real Estate"};if(tp&&typeMap[tp])return typeMap[tp];const validTypes=["Real Estate","Fondo de Inversión","CDT","Acciones","Crypto","Bodega","Vehículo","Local Comercial","Negocio","Cash","Otro"];if(tp&&validTypes.includes(tp))return tp;const nm=((i.n||i.nombre||"")+" "+(i.ub||"")).toLowerCase();if(/apart|apto|casa|lote|terreno|oficina|inmueble|propiedad|house|condo/i.test(nm))return"Real Estate";if(/bodega/i.test(nm))return"Bodega";if(/local/i.test(nm))return"Local Comercial";if(/fondo|fiduci|fund/i.test(nm))return"Fondo de Inversión";if(/cdt|renta fija|bonos|tes /i.test(nm))return"CDT";if(/accion|etf|portafolio|vti|spy|stock|share/i.test(nm))return"Acciones";if(/btc|bitcoin|crypto|eth|usdt/i.test(nm))return"Crypto";if(/vehic|carro|moto|auto/i.test(nm))return"Vehículo";if(/negocio|empresa|sas|company/i.test(nm))return"Negocio";if(/cash|ahorro|cuenta|saving/i.test(nm))return"Cash";if(/green|puerto|orlando|miami|backswing|district/i.test(nm))return"Real Estate";return"Otro"};

// ═══ ESTIMACIÓN TRIBUTARIA — importada desde src/lib/taxCO.js ═══
// UVT, calcImpRenta y estimarImpuesto vienen del import al tope del archivo.

// ═══════════════════════════════════════════════════════════════════════════
// cT — Motor de cálculo de totales del Dashboard (misma arquitectura que
// simT del Simulador, refactor 4-jul-2026).
//
// Entrada:
//   inv, ds, gf, ing → data del user (inv, deudas, gastos, ingresos)
//   taxData          → resultado de estimarImpuesto(u), opcional. Si viene,
//                      calcula retención + impuesto neto. Si no, quedan 0.
//
// Contrato de salida idéntico a simT del Simulador (consistencia total):
//   brutoTotal, retencionMensual, disponibleCuenta,
//   aportesObligatorios, gastosFamiliares, cuotasDeudas, impuestoNeto,
//   egresosTotales, cashFlow, independencia,
//   + aliases legacy: ni, ti, tg, gfm, tc, te, cf, ind, ab, td, nw, dta,
//     ingT, tTax
// ═══════════════════════════════════════════════════════════════════════════
// Activación (23-jul-2026): ¿la cuenta está vacía? Se usa para volver a
// ofrecer el tour de arranque a quien se registró, no cargó nada y volvió
// después. Antes el tour SOLO se mostraba en el instante del signup: quien
// cerraba la pestaña y volvía caía en un dashboard vacío, sin guía y sin
// forma de recuperar el tour. Ese es el punto donde más gente abandona.
const cuentaVacia = (d) => {
  if (!d || d?.p?.demo) return false;
  const nInv = (d.inv || []).length;
  const nIng = (d.ingresos || []).length;
  const nDeu = (d.deu || []).length;
  const nGas = Object.values(d.gas || {}).reduce((s, its) => s + (its || []).length, 0);
  return nInv + nIng + nDeu + nGas === 0;
};

const cT=(inv,ds,gf,ing,taxData,trm=4200,inflacionPct)=>{
  let ab=0, aportesObligatorios=0, gastosFamiliares=0;
  (inv||[]).forEach(i=>{if(i.sim!==false)ab+=vaCOP(i,trm)})
  // 26-jul-2026 — DOBLE CONVERSIÓN DE MONEDA (Santiago: "puse el valor en
  // dólares pero lo pone en el patrimonio en dólares cuando el resto están en
  // pesos, hay una incongruencia").
  // La línea era: ab += vaCOP(i,trm) * (i.moneda==="USD" ? trm : 1)
  // Pero vaCOP YA multiplica por la TRM cuando la moneda es USD. Multiplicar
  // otra vez elevaba el activo al cuadrado de la tasa: su portafolio de
  // USD 33.266 entraba al patrimonio como $353.971.663.304 en vez de
  // $108.513.692. Un activo en dólares inflaba el patrimonio ~3.262 veces.;
  // NUEVO (18-jul-2026): usa promedio mensualizado según frecuencia.
  // Items sin `frecuencia` se asumen "mensual" → comportamiento idéntico al anterior.
  const brutoTotal=(ing||[]).reduce((s,i)=>{
    if(i.sim===false) return s;
    const montoBase=(i.mensual||0)*(i.moneda==="USD"?trm:1);
    return s + montoPromedioMensual({...i, mensual: montoBase});
  },0);
  const td=(ds||[]).reduce((s,d)=>d.sim===false?s:s+((d.mt||0)*(d.moneda==="USD"?trm:1)),0);
  // 25-jul-2026 (Santiago: "las deudas también pueden ser una vez al año,
  // variables o fijas, pues uno hace abonos o la paga"). El formulario de
  // deudas YA tiene selector de frecuencia y vigencia —guarda frecuencia,
  // desdeMes, hastaMes— pero esta suma tomaba la cuota cruda y la cobraba los
  // 12 meses, ignorando las dos cosas. El motor prometía algo que no cumplía.
  // Caso real: tres de las deudas de Santiago tienen vigencia hasta octubre y
  // se estaban cobrando todo el año — $18,7M anuales de más.
  // getMonto lee `mensual`/`m`, así que se mapea `pg` como en el resto del motor.
  const cuotasDeudas=(ds||[]).filter(d=>(d.mt||0)>0&&d.sim!==false)
    .reduce((s,d)=>s+(montoPromedioMensual({...d, mensual:(d.pg||0)*(d.moneda==="USD"?trm:1)})),0);
  // Aportes obligatorios (categoría "Seguridad Social") separados de gastos familiares.
  // Usan promedio mensualizado según frecuencia (retrocompat: sin frecuencia = mensual).
  Object.entries(gf||{}).forEach(([cat,items])=>{
    (items||[]).forEach(g=>{
      if(g.sim===false)return;
      // 26-jul-2026 (Santiago): los gastos podían cargarse solo en pesos, pero
      // el motor tampoco convertía si venía moneda. Ahora respeta el campo,
      // igual que ya hacían patrimonio, ingresos y deudas. Sin `moneda` se
      // asume COP, así que nada de lo ya cargado cambia.
      const monto=montoPromedioMensual(g)*(g.moneda==="USD"?trm:1);
      if(cat==="Seguridad Social") aportesObligatorios+=monto;
      else gastosFamiliares+=monto;
    });
  });
  const gfm=aportesObligatorios+gastosFamiliares;
  // Impuesto + retención (opcional). Sin taxData → quedan en 0.
  let impuestoBrutoAnual=0, retencionAnual=0;
  if(taxData&&Array.isArray(taxData.detalle)){
    taxData.detalle.forEach(tx=>{
      impuestoBrutoAnual+=(tx.impBruto!=null?tx.impBruto:(tx.impuesto||0));
      retencionAnual+=(tx.reteN||0);
    });
  }
  const retencionMensual=Math.round(retencionAnual/12);
  const impuestoBrutoMensual=Math.round(impuestoBrutoAnual/12);
  const impuestoNeto=Math.max(0,Math.round((impuestoBrutoAnual-retencionAnual)/12));
  // Consolidación (idéntico contrato al simT del Simulador)
  const disponibleCuenta=brutoTotal-retencionMensual;
  const egresosTotales=aportesObligatorios+gastosFamiliares+cuotasDeudas+impuestoNeto;
  const cashFlow=disponibleCuenta-egresosTotales;
  // 11-oct-2026 — El índice de independencia es COBERTURA PASIVA (ingreso
  // pasivo neto ÷ obligaciones), no ingreso total ÷ egresos. Antes un
  // asalariado sin activos salía "Independencia" solo porque su sueldo cubría
  // sus gastos. La base vive en src/lib/metrics.js (spec Finanzas); acá solo
  // se expone. `coberturaTotal` conserva el ratio viejo (ingreso total ÷
  // egresos) para los textos que hablan de "tus ingresos cubren tus gastos".
  const coberturaTotal=egresosTotales>0?(disponibleCuenta/egresosTotales)*100:0;
  const argsMet={ingresos:ing,gastos:gf,deudas:ds,inv,trm,retencionMensual,impuestoNeto};
  const met=calcularMetricas(argsMet);
  // 21-oct-2026 — Mismo criterio que el Simulador (SimuladorAvanzado → metMes):
  // el NIVEL se mide contra lo que se paga ESTE mes, no contra el promedio del
  // año. Acá faltaba, así que el Dashboard, el Asesor IA, el PDF y el Excel
  // decían un nivel y la tarjeta del Simulador otro. En la cuenta de Santiago
  // coinciden este mes, pero en febrero, marzo, mayo y junio su flujo es
  // negativo y las dos pantallas se separaban.
  const metMes=calcularMetricas(argsMet,{base:"mes"});
  const independencia=metMes.coberturaPasiva;
  return{
    // ═══ Nuevo modelo explícito ═══
    brutoTotal, retencionMensual, disponibleCuenta,
    aportesObligatorios, gastosFamiliares, cuotasDeudas,
    impuestoBrutoMensual, impuestoNeto,
    egresosTotales, cashFlow, independencia, coberturaTotal,
    // ═══ Base única de métricas (metrics.js) ═══
    // 21-oct-2026 — UNA sola base por párrafo. Todo lo que describe la foto de
    // HOY (nivel, cobertura, ingreso pasivo, obligaciones, colchón, salud) sale
    // de `metMes`; lo que describe el AÑO (brutoTotal, egresosTotales,
    // cashFlow, arriba) sigue en promedio. Antes `nivel` era del mes y las
    // cifras que lo acompañaban eran del promedio, así que el mismo párrafo
    // mezclaba dos cuentas: "Nivel 4/5" junto a una cobertura que no lo producía.
    met, metMes, nivel:metMes.nivel,
    salud:saludFinanciera(metMes), rentaYield:rentaYYield(metMes), inflacion:gananciaVsInflacion(metMes,inflacionPct), colchonMeses:metMes.colchonMeses,
    ingresoPasivo:metMes.ip, ingresoPasivoBruto:metMes.ipBruto, pctIngresoPasivo:metMes.pctIngresoPasivo,
    ob:metMes.ob, ahorroPct:metMes.ahorroPct, cargaDeudaPct:metMes.cargaDeudaPct, ingresoNeto:metMes.ingresoNeto,
    // ═══ Legacy aliases (compatibilidad) ═══
    ab, td, nw:ab-td,
    ti:brutoTotal, tg:0, ni:disponibleCuenta,
    gfm, tc:cuotasDeudas, te:egresosTotales, cf:cashFlow,
    ind:independencia, dta:ab>0?(td/ab)*100:0, ingT:brutoTotal,
    tTax:impuestoNeto,
  };
};

const Cd=({children,s,...p})=><div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",...s}} {...p}>{children}</div>;
const St=({l,v,sub,cl})=><div style={{padding:"16px 20px"}}><div style={{fontSize:11,color:T.tx3,letterSpacing:1,fontWeight:600,marginBottom:6}}>{l}</div><div style={{fontSize:24,fontWeight:700,color:cl||T.tx,letterSpacing:"-0.03em"}}>{v}</div>{sub&&<div style={{fontSize:12,color:T.tx3,marginTop:3}}>{sub}</div>}</div>;
const Bg=({children,cl})=><span style={{background:`${cl||T.gn}15`,color:cl||T.gn,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999}}>{children}</span>;
const Bt=({children,onClick,v,sz,dis,st})=>{const vs={p:{background:`linear-gradient(135deg,${T.gn},#00a804)`,color:"#fff"},s:{background:"transparent",color:T.tx2,border:`1px solid ${T.border}`},d:{background:T.rdB,color:T.rd}};const ss={s:{padding:"6px 14px",fontSize:12},m:{padding:"10px 20px",fontSize:14},l:{padding:"14px 28px",fontSize:16}};return<button onClick={onClick} disabled={dis} style={{...(vs[v||"p"]),...(ss[sz||"m"]),borderRadius:10,border:"none",cursor:dis?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:6,fontWeight:600,opacity:dis?.5:1,...(st||{})}}>{children}</button>};
const fmtNum=(v)=>{if(v==null||v==="")return"";const n=String(v).replace(/[^0-9.-]/g,"");if(!n||isNaN(Number(n)))return String(v);const parts=n.split(".");parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,",");return parts.join(".")};
const unfmtNum=(v)=>String(v).replace(/,/g,"");
const In=({l,value:v,onChange:oc,type:tp,placeholder:ph,options:opts})=><div style={{display:"flex",flexDirection:"column",gap:5}}>{l&&<label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:1}}>{l}</label>}{opts?<select value={v||""} onChange={e=>oc(e.target.value)} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.tx,fontSize:14,outline:"none"}}>{opts.map(o=><option key={o.v!=null?o.v:o} value={o.v!=null?o.v:o}>{o.l||o}</option>)}</select>:tp==="number"?<input type="text" inputMode="numeric" value={fmtNum(v)} onChange={e=>{const raw=unfmtNum(e.target.value);oc(raw)}} placeholder={ph} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.tx,fontSize:14,outline:"none"}}/>:<input type={tp||"text"} value={v!=null?v:""} onChange={e=>oc(e.target.value)} placeholder={ph} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.tx,fontSize:14,outline:"none"}}/>}</div>;
const Md=({open,onClose,title,children,wide})=>{if(!open)return null;return<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1e3,padding:20}}><div onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:`1px solid ${T.borderL}`,borderRadius:12,width:"100%",maxWidth:wide?700:520,maxHeight:"85vh",overflow:"auto",padding:32}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><h3 style={{fontSize:18,fontWeight:700,margin:0,color:T.tx}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:18}}>✕</button></div>{children}</div></div>};

// Sin tasa real el motor y el borrador dejan los USD por fuera: arriba va «pendiente de tasa».
export const NOTA_TRM_DECLARACION="Tus montos en dólares de este borrador todavía no están convertidos correctamente. No lo uses para declarar. En tu declaración usa la TRM del 31-dic-2025 para patrimonio y la del día de cada pago para ingresos.";
export const NotaTrmDeclaracion=({u})=>tieneUSD(u)?<div role="note" style={{margin:"0 0 12px",padding:"10px 14px",borderRadius:10,background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.25)",fontSize:12,color:"#bfdbfe"}}>{usdPendienteDeTasa(u)&&<strong style={{display:"block",marginBottom:4,color:"#fbbf24"}}>{NOTA_TRM_PENDIENTE}</strong>}{NOTA_TRM_DECLARACION}</div>:null;
export const AvisoTasa=({est,t,fm})=>{
  if(est.modo==="pendiente")return<div role="status" style={{background:"rgba(245,158,11,0.1)",borderBottom:"1px solid rgba(245,158,11,0.3)",padding:"8px 20px",fontSize:12,color:"#fbbf24"}}>No pudimos obtener la TRM; vuelve a intentar. Tus totales, flujo y nivel quedan <strong>pendientes de tasa</strong>: tus montos en USD se muestran en dólares. Patrimonio {fm?fm(t?.nw||0):""} <em>sin tus montos en USD</em>.</div>;
  if(est.modo==="guardada"&&est.fecha)return<div role="status" style={{padding:"4px 20px",fontSize:12,color:"var(--fp-txt2)"}}>Tasa usada: TRM del {est.fecha}</div>;
  return null;
};
export { sS as _sS, sL as _sL, sanitize as _sanitize };
export default function FinPath(){
  const[pagoEstado,setPagoEstado]=useState(null);
  // Hallazgos que el usuario marcó como "ya lo sé". Se guardan aparte de sus
  // datos financieros: es preferencia de interfaz, no información patrimonial.
  const[hallazgosDescartados,setHallazgosDescartados]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("fp3_hallazgos_descartados")||"[]")}catch{return []}
  });
  const descartarHallazgo=(id)=>setHallazgosDescartados(p=>{
    const n=[...new Set([...p,id])];
    try{localStorage.setItem("fp3_hallazgos_descartados",JSON.stringify(n))}catch{}
    return n;
  });
  const[u,_setU]=useState(null);
  const setU=(v)=>{if(typeof v==="function"){_setU(p=>{const r=v(p);return r||p})}else{_setU(v)}};
  const[ld,setLd]=useState(true);
  const[pg,setPg]=useState("dash");
  const[md,setMd]=useState(null);
  const[f,sF]=useState({});
  const[aM,sAM]=useState("login");
  const[aF,sAF]=useState({n:"",e:"",p:""});
  const[adv,sAdv]=useState(null);
  const[sb,sSb]=useState(true);
  const[mb,sMb]=useState(false);
  const[simS,sSimS]=useState("actual");
  const[showImport,setShowImport]=useState(false);
  const[dashMas,setDashMas]=useState(false); // 31-oct-2026: análisis detallado del Dashboard, plegado por defecto
  const[pmDetalle,setPmDetalle]=useState(false); // primer minuto: eligió cargar sección por sección
  const[cur,setCur]=useState(()=>localStorage.getItem("fp3_cur")||"COP");
  const[showAuth,setShowAuth]=useState(false);
  const[loginRole,setLoginRole]=useState(()=>{if(typeof window==="undefined")return"client";const p=window.location.pathname;return(p==="/asesores"||p==="/asesores/")?"advisor":"client"});
  const[billingCycle,setBillingCycle]=useState("mensual");
  // 4-nov-2026: una persona tocó "Activar" 8 veces en 5 s porque el botón no daba señal; cada toque creaba una suscripción en Mercado Pago. Mientras se abre el pago, el botón dice "Abriendo Mercado Pago…" y no acepta más toques.
  const[abriendoPago,setAbriendoPago]=useState(null);
  const[tarjetaMP,setTarjetaMP]=useState(null); // 5-nov-2026: cobro automático con tarjeta sin cuenta de Mercado Pago
  useEffect(()=>{const f=()=>setAbriendoPago(null);window.addEventListener("pageshow",f);return()=>window.removeEventListener("pageshow",f)},[]);
  const[monedaPago,setMonedaPago]=useState(null);
  const[toast,setToast]=useState("");
  const[authUser,setAuthUser]=useState(null);
  const[authLoading,setAuthLoading]=useState(false);
  const[authError,setAuthError]=useState("");
  const[locked,setLocked]=useState(false);
  const[pinInput,setPinInput]=useState("");
  const[masked,setMasked]=useState(false);
  const[taxTab,setTaxTab]=useState("estrategia");
  const[descuentosOwnerId,setDescuentosOwnerId]=useState(null);
  const[aportesOwnerId,setAportesOwnerId]=useState(null);
  const[showAyuda,setShowAyuda]=useState(false);
  const[ownerJumpFromFamilyView,setOwnerJumpFromFamilyView]=useState(null);
  const trmPendiente = useRef(null);
  // 31-oct-2026 — La última TRM real que llegó. El demo (y cualquier dato que
  // entre después sin tasa) la necesita: antes quedaba «pendiente de tasa» y el
  // Dashboard y el Simulador mostraban niveles distintos (106 % vs 70 %).
  const trmUltima = useRef(null);
  const[trmViva,setTrmViva]=useState(false);
  // Aplica la TRM que llegó antes de que existiera `u`. Sin esto, en la carga
  // normal (sesión más lenta que la petición) la tasa real se perdía.
  useEffect(() => {
    // Una TRM guardada (incluido el 4200 por defecto que quedó en perfiles
    // mientras el efecto estaba roto) es provisional: la tasa real la pisa.
    // Se consume una sola vez para no pisar luego un ajuste manual.
    if (u && trmPendiente.current) {
      const { trm, trmSrc, trmFecha } = trmPendiente.current;
      trmPendiente.current = null;
      if (u.trm !== trm || u.trmSrc !== trmSrc) setU(p => p ? { ...p, trm, trmSrc, trmFecha } : p);
    } else if (u && !trmReal(u) && trmUltima.current) {
      const { trm, trmSrc, trmFecha } = trmUltima.current;
      setU(p => p ? { ...p, trm, trmSrc, trmFecha } : p);
    }
  }, [u]);

  // 03-ago-2026 (Santiago: "cómo hacemos que siempre esté actualizado").
  // La TRM se pedía UNA sola vez al cargar. Quien deja la pestaña abierta días
  // —lo normal en una herramienta de trabajo— se quedaba con la tasa de ese
  // momento.
  // Ahora se refresca cada 6 horas y, sobre todo, al volver a la pestaña: si
  // alguien la abrió el viernes y vuelve el lunes, la primera interacción ya
  // trae la tasa vigente.
  // El Banco de la República publica solo días hábiles, así que el fin de
  // semana devuelve la del viernes — eso es correcto, no un dato viejo.
  useEffect(() => {
    let vivo = true;
    const traer = async () => {
      try {
        const j = await traerTrm();
        const real = trmDeApi(j);
        if (vivo && real) { trmUltima.current = real; setTrmViva(true); setU(p => (p && p.trm !== real.trm) ? { ...p, ...real } : p); }
      } catch {}
    };
    const id = setInterval(traer, 6 * 60 * 60 * 1000);
    const alVolver = () => { if (document.visibilityState === "visible") traer(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; clearInterval(id); document.removeEventListener("visibilitychange", alVolver); };
  }, []);
  // Modo demo: copia de la cuenta real al entrar, y ref al u actual.
  const realAntesDemoRef=useRef(null);const uRef=useRef(null);uRef.current=u;
  // State para menús desplegables del sidebar (sesión 1-may-2026 v3:
  // colapsar Vista familiar y Declaraciones anteriores bajo Impuestos
  // para no llenar el menú lateral). Por default abierto si la página
  // actual es uno de los hijos.
  const[expandedMenus,setExpandedMenus]=useState(()=>({tax:false,anio:true}));
  // Password recovery flow: detectar link de recovery y pedir nueva contraseña
  const[showResetPassword,setShowResetPassword]=useState(false);
  const[resetNewPassword,setResetNewPassword]=useState("");
  const[resetLoading,setResetLoading]=useState(false);
  const[resetError,setResetError]=useState("");
  const[resetSent,setResetSent]=useState(false);
  // Modal de solicitar recuperación (el usuario escribe email acá explícitamente)
  const[showRecoveryRequest,setShowRecoveryRequest]=useState(false);
  // Sesión 4-may-2026: tour de bienvenida — se activa cuando un user nuevo
  // entra recién signup. Dura ~60 segundos y lo guía a su primer momento de
  // valor (importar Excel, demo, o cargar manualmente). Ver OnboardingTour.jsx.
  const[showOnboarding,setShowOnboarding]=useState(false);const[paywall,setPaywall]=useState(false);const[extraADeudas,setExtraADeudas]=useState(0);
  const[recoveryEmail,setRecoveryEmail]=useState("");
  // ═══ MULTI-USUARIO STATE (Fase 2 commit 1) ═══
  // useAccount detecta la cuenta activa del usuario y su rol. Si la migración
  // 01+01b+01c+01d aún no está aplicada, devuelve isLegacy=true con defaults
  // (admin) y todo el flujo cae al camino legacy. Cuando está aplicada, los
  // saves van a public.user_data por account_id en lugar de por id.
  const{accountId,role,isLegacy,displayName,plan:planAccount,maxMembers,memberships,subscriptionStatus,graceUntil,pagoUnico,loading:accountLoading,refresh:refreshAccount}=useAccount(authUser,supabase);
  // 30-oct-2026: cuentas que invitaron a este usuario como contador (solo lectura tributaria).
  const[clientesContador,setClientesContador]=useState([]);
  useEffect(()=>{
    if(!authUser||!isSupabaseConfigured)return;
    let vivo=true;
    supabase.rpc("contador_mis_clientes").then(({data})=>{if(vivo&&Array.isArray(data))setClientesContador(data)}).catch(()=>{});
    return()=>{vivo=false};
  },[authUser?.id]);
  // Refs para que sS() (que es global, fuera del componente) acceda a los
  // values frescos sin recrear el callback ni cerrar sobre values stale del
  // setTimeout de 2s del debounce de save.
  const accountIdRef=useRef(null);
  const isLegacyRef=useRef(true);
  // roleRef: necesario para que sS() (global, fuera del componente) chequee
  // el rol activo sin cerrar sobre value stale del setTimeout debounce de 2s.
  // Default 'admin' garantiza que el flujo legacy (sin provider envolvente)
  // o el primer mount (antes de que useAccount resuelva) NO bloquee saves.
  const roleRef=useRef("admin");
  const modoConsultaRef=useRef(false);
  useEffect(()=>{accountIdRef.current=accountId;isLegacyRef.current=isLegacy;roleRef.current=role||"admin";},[accountId,isLegacy,role]);
  // Handler del AccountSwitcher (Fase 2 commit 2): persistir elección,
  // limpiar cache local de la cuenta vieja, forzar refetch del hook, y
  // setU(null) para que el próximo useEffect cargue data de la nueva cuenta.
  const handleAccountSwitch=useCallback((newAccountId)=>{
    if(!newAccountId||newAccountId===accountIdRef.current)return;
    try{localStorage.setItem("fp3_active_account",newAccountId)}catch{}
    try{localStorage.removeItem(SK)}catch{}
    setU(null);
    refreshAccount();
  },[refreshAccount]);
  // Recarga de data al cambiar accountId (post-switch).
  // El useEffect de mount inicial (deps []) corre solo 1 vez; este useEffect
  // dispara cuando accountId cambia DESPUÉS del primer load (típicamente
  // tras un click en AccountSwitcher).
  // NOTA: authUser NO va en deps (regla del proyecto). Lo leemos del closure
  // y hacemos early return si está vacío. Cuando authUser llega tras
  // getSession, accountId también cambia (useAccount fetches), disparando
  // este useEffect via la dep de accountId.
  const initialLoadDoneRef=useRef(false);
  useEffect(()=>{
    if(!authUser?.id||accountLoading||!accountId)return;
    if(!initialLoadDoneRef.current){
      // Primer load: lo cubre el useEffect de mount inicial. Marcar done y skipear.
      initialLoadDoneRef.current=true;
      return;
    }
    // Switch real: recargar user_data con el nuevo accountId
    const uid=authUser.id;
    (async()=>{
      try{const r=await sLR(uid,accountId);if(r.datos)setU(sanitize(r.datos))}
      catch(e){console.warn("[fp3] reload tras switch falló:",e)}
    })();
  },[accountId,accountLoading]);
  // Copia vieja en pantalla: banner + solo lectura + [Reintentar].
  const[noSinc,setNoSinc]=useState(datosNoSincronizados);
  // 30-oct-2026: alguien (otra pestaña, otro dispositivo u otra persona de la cuenta) guardó después.
  const[conflicto,setConflicto]=useState(false);
  useEffect(()=>{const h=()=>setConflicto(true);window.addEventListener("fp3-save-conflict",h);return()=>window.removeEventListener("fp3-save-conflict",h)},[]);
  const[reintentando,setReintentando]=useState(false);
  useEffect(()=>alCambiarSincronizacion(setNoSinc),[]);
  const reintentarCarga=async()=>{
    if(!authUser?.id||reintentando)return;
    setReintentando(true);
    try{const r=await sLR(authUser.id,accountIdRef.current);if(r.estado==="ok"&&r.datos)setU(sanitize(r.datos))}
    finally{setReintentando(false)}
  };
  // ═══ ADVISOR MODE STATE ═══
  // isAdvisor: true si el usuario loggeado existe en la tabla `advisors`
  // advisorProfile: datos del asesor (plan, max_clients, firm_name, etc.)
  // viewMode: "workspace" (asesor viendo su lista) | "client" (asesor viendo dashboard de cliente) | "personal" (asesor usando Finpathia como retail propio)
  // currentClientId: cuando viewMode === "client", id del cliente cuyo user_data está cargado
  // advisorClients: lista de clientes del asesor
  const[isAdvisor,setIsAdvisor]=useState(false);
  const[advisorProfile,setAdvisorProfile]=useState(null);
  const[viewMode,setViewMode]=useState(()=>{
    // Persistir preferencia del usuario entre sesiones. Para usuarios que son
    // AMBOS (asesor + cliente), defaultear a 'personal' previene el flash
    // de AdvisorWorkspace al recargar la página como cliente.
    //
    // FIX bug: si entra por /asesores o /asesores/, forzar 'workspace' sin
    // importar lo que diga localStorage. Caso contrario, un asesor que alguna
    // vez tocó "Modo personal" quedaba con 'personal' guardado y al volver
    // por /asesores caía directo a su dashboard privado (bug reportado).
    try{
      if(typeof window!=="undefined"){
        const p=window.location.pathname;
        if(p==="/asesores"||p==="/asesores/")return "workspace";
      }
      return localStorage.getItem("fp3_viewMode")||"personal";
    }catch{return "personal"}
  });
  const[currentClientId,setCurrentClientId]=useState(null);
  const[advisorClients,setAdvisorClients]=useState([]);
  // ═══ CONTEXT SWITCH (Sprint 2C) ═══
  // advisorOwnUser: backup del user del asesor cuando entra a ver dashboard de un cliente.
  //                 Al volver al workspace, restauramos `u` desde aquí.
  // currentClient: metadatos del cliente que el asesor está viendo (nombre, email)
  // switchingClient: flag durante carga de datos del cliente (evita flicker)
  const[advisorOwnUser,setAdvisorOwnUser]=useState(null);
  const[currentClient,setCurrentClient]=useState(null);
  const[switchingClient,setSwitchingClient]=useState(false);
  useEffect(()=>{const c=()=>sMb(window.innerWidth<900);c();window.addEventListener("resize",c);return()=>window.removeEventListener("resize",c)},[]);

  // Sesión 4-may-2026: Boot analytics — capturar UTMs y disparar pageview.
  // Si el user llega vía ?utm_source=whatsapp&utm_campaign=pioneros, esos
  // datos se persisten en sessionStorage para atribuir el signup al canal.
  useEffect(()=>{
    captureUTMs();
    track("app_loaded", {
      // Sin el token de /invite/<token> y sin query del referrer.
      pathname: typeof window !== "undefined" ? window.location.pathname.replace(/^\/invite\/[^/]+/, "/invite/_") : "",
      referrer: typeof document !== "undefined" && document.referrer ? (()=>{try{return new URL(document.referrer).origin}catch{return ""}})() : "",
    });
  },[]);
  // Password recovery: escuchar el evento de Supabase cuando el usuario hace
  // click en el link del email. Muestra el modal para que ingrese nueva contraseña.
  useEffect(()=>{
    if(!supabase||!isSupabaseConfigured)return;
    const{data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY"){
        setShowResetPassword(true);
        setResetError("");
        setResetNewPassword("");
      }
    });
    return()=>subscription?.unsubscribe();
  },[]);
  useEffect(()=>{if(mb)sSb(false)},[mb]);
  // Persistir viewMode en localStorage cuando cambia — solo si hay usuario loggeado
  // para evitar que después del logout se re-escriba al resetear el estado.
  useEffect(()=>{
    if(!u)return;
    try{if(viewMode==="workspace"||viewMode==="personal")localStorage.setItem("fp3_viewMode",viewMode)}catch{}
  },[viewMode,u]);
  useEffect(()=>{(async()=>{
    // Timeout defensivo: si supabase se cuelga (problemas de red, session corrupta,
    // retry silencioso), la app cargaba para siempre con 'Cargando tu patrimonio...'.
    // Con este timeout de 8s, la app sigue cargando como unauthenticated y se
    // recupera cuando la sesión llegue (si alguna vez llega).
    const timeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error("auth timeout")),8000));
    try{
      if(isSupabaseConfigured&&supabase){
        const{data:{session}}=await Promise.race([supabase.auth.getSession(),timeout]);
        if(session?.user){
          setAuthUser(session.user);
          try{
            // Multi-cuenta (Fase 2): pasar accountIdRef.current. En el primer
            // mount es null (useAccount aún no resolvió) → sL cae a path legacy.
            // Subsecuentemente, los saves usan los refs actualizados.
            const r=await sLR(session.user.id,accountIdRef.current);
            if(r.datos)setU(sanitize(r.datos));
            // 26-oct-2026 — El alta por Google solo si el servidor CONFIRMÓ que
            // no hay fila. Con estado "error" (fallo, timeout o cifrado sin
            // llave) no se crea nada: crear encima de una fila real que no se
            // pudo leer es exactamente lo que este PR viene a evitar.
            else if(r.estado==="nuevo"&&(session.user.app_metadata?.provider==="google"||sessionStorage.getItem("fp3_oauth"))){
              const{data:fila}=await supabase.from("user_data").select("id").eq("id",session.user.id).maybeSingle();
              if(!fila)await crearCuentaOAuth(session.user);
            }
            sessionStorage.removeItem("fp3_oauth");
          }catch(e){if(typeof console!=="undefined")console.warn("[load] data load timeout:",e)}
          // ═══ Check if user is an advisor ═══
          try{
            const{data:advData,error:advErr}=await Promise.race([
              supabase.from("advisors").select("id,email,firm_name,advisor_plan,max_clients,subscription_status").eq("id",session.user.id).maybeSingle(),
              timeout,
            ]);
            if(!advErr&&advData){
              // viewMode ya está inicializado desde localStorage con preferencia previa.
              // Si nunca eligió, default es "personal" (evita flash para usuarios cliente-y-asesor).
              setIsAdvisor(true);
              setAdvisorProfile(advData);
              // Cargar clientes en background — no bloquea render del dashboard.
              // El usuario ya ve su contenido mientras se carga.
              supabase.from("advisor_client_data").select("id,email,data,plan,jurisdiction,updated_at,client_status,invited_at,accepted_at").eq("advisor_id",session.user.id).then(({data:cd})=>{
                if(cd)setAdvisorClients(cd);
              }).catch(()=>{});
            }
          }catch(e){/* silent - not an advisor, or timeout */}
        }
      }else{
        try{const d=await sL();if(d)setU(sanitize(d))}catch(e){if(typeof console!=="undefined")console.warn("[load] local data error:",e)}
      }
    }catch(e){
      if(typeof console!=="undefined")console.warn("[load] session fetch failed/timeout, continuando sin auth:",e);
    }
    setLd(false);
    // 03-ago-2026 (Santiago: "necesito que el dólar esté en tiempo real a tasa
    // de hoy"). /api/trm ya traía el dato del Banco de la República ($3.144
    // hoy), pero este setU lo DESCARTABA cuando `u` era null: la petición corre
    // en paralelo con la carga de sesión y suele ganar. La app se quedaba con el
    // 4200 por defecto — 33,6% de desvío. Con el portafolio IBKR de Santiago
    // (USD 33.266) eso son $35 millones de más.
    try{
      const j=await traerTrm();
      // /api/trm devuelve {trm:4200,source:"default"} cuando falla: eso no es tasa.
      const real=trmDeApi(j);
      if(real){
        trmPendiente.current=real;trmUltima.current=real;setTrmViva(true);
        setU(p=>p?{...p,...real}:p);
      }
    }catch{}
    // Handle Stripe success redirect
    const params=new URLSearchParams(window.location.search);
    const successFlag=params.get('success');
    const sessionId=params.get('session_id')||(typeof window!=="undefined"?window.__fpStripeSessionId:null)||null;
    // ═══ REGRESO DESDE STRIPE ═══════════════════════════════════════════
    // 25-jul-2026. Antes, el momento más delicado del producto era SILENCIO:
    //  · Al volver de un pago exitoso no se mostraba nada. La página se
    //    recargaba sola a los 1,5s, sin explicación: se sentía roto.
    //  · Si el plan era Pro o Básico, stripe-recover-activation devuelve
    //    "not_pro_familiar" (solo cubre Pro Familiar) y NO PASABA NADA.
    //    El usuario pagaba y la app se comportaba como si no hubiera pasado.
    //  · Si cancelaba en Stripe, volvía con ?canceled=true y tampoco veía
    //    nada — quedaba dudando si le habían cobrado.
    // Después de entregar una tarjeta, el silencio destruye la confianza.
    const cancelado=params.get('canceled');
    // 5-nov-2026 · Regreso desde Mercado Pago (suscripción o pago único con PSE/Efecty).
    const mpVuelta=params.get('mp');
    if(mpVuelta){
      if(mpVuelta==='ok')setPagoEstado({tipo:"exito",titulo:"¡Pago recibido!",msg:"Mercado Pago confirmó tu pago. Tu plan se activa en menos de un minuto y te llega un correo con el detalle. Si no lo ves activo, recarga la página."});
      else if(mpVuelta==='pendiente')setPagoEstado({tipo:"procesando",cerrable:true,titulo:"Tu pago está pendiente",msg:"Si pagaste en efectivo (Efecty) o tu banco aún no confirma el PSE, activamos tu plan apenas Mercado Pago lo apruebe y te avisamos por correo. No tienes que hacer nada más."});
      else setPagoEstado({tipo:"cancelado",titulo:"No se completó el pago",msg:"No te cobramos nada y tu plan sigue igual. Puedes intentarlo de nuevo con PSE, Efecty o tarjeta."});
      window.history.replaceState({},'',window.location.pathname);
    } else if(cancelado==='true'){
      setPagoEstado({tipo:"cancelado",titulo:"No se completó el pago",msg:"No te cobramos nada y tu plan sigue igual. Puedes intentarlo cuando quieras."});
      window.history.replaceState({},'',window.location.pathname);
    } else if(successFlag==='true'||(successFlag==='1'&&sessionId&&sessionId!=='{CHECKOUT_SESSION_ID}')){
      setPagoEstado({tipo:"procesando",titulo:"Confirmando tu pago…",msg:"Un momento, estamos activando tu plan."});
      try{
        const userId=(await supabase.auth.getUser()).data?.user?.id;
        if(userId&&sessionId&&sessionId!=='{CHECKOUT_SESSION_ID}'){
          const r=await fetchAuth('/.netlify/functions/stripe-recover-activation',{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({userId,sessionId}),
          });
          const data=await r.json();
          // 11-oct-2026: Checkout ya no da prueba → amount_total > 0 es el
          // primer cobro real. Purchase (Pixel) + purchase (GA4), una sola
          // vez por session id; trackPurchase ignora totales en 0 (cupón 100%).
          if(data?.compra){
            const pp=planDesdePriceId(data.compra.priceId);
            trackPurchase({purchaseId:data.compra.purchaseId,amountTotal:data.compra.amountTotal,currency:data.compra.currency,plan:pp?.plan,billingCycle:pp?.billingCycle});
          }
          if(data.ok){
            setPagoEstado({tipo:"exito",titulo:"¡Listo! Tu plan está activo",msg:"Gracias por confiar en FINPATHIA. Ya tienes acceso completo."});
            setTimeout(()=>window.location.reload(),2500);
          }else{
            // Pro/Básico: la activación la hace el webhook, no esta función.
            // No es un error del usuario — su pago SÍ se registró.
            setPagoEstado({tipo:"exito",titulo:"Pago recibido",msg:"Tu suscripción quedó registrada. La activación puede tardar unos segundos; si no ves el cambio, recarga la página."});
            setTimeout(()=>window.location.reload(),4000);
          }
        }else{
          setPagoEstado({tipo:"exito",titulo:"Pago recibido",msg:"Tu suscripción quedó registrada. Si no ves el cambio en unos segundos, recarga la página."});
        }
      }catch(e){
        setPagoEstado({tipo:"exito",titulo:"Pago recibido",msg:"Tu suscripción quedó registrada. Si no ves el cambio, escríbenos a soporte@finpathia.com y lo revisamos."});
      }
      window.history.replaceState({},'',window.location.pathname);
    }
  })()},[]);
  // Auto-save de `u` a Supabase. Cuando el advisor está viendo un cliente (viewMode='client'),
  // el `u` contiene los datos del CLIENTE, entonces debemos guardar al id del cliente,
  // NO al authUser.id del advisor. Esto evita que el advisor sobreescriba su propia data.
  useEffect(()=>{
    if(!u)return;
    // Guarda para prevenir race condition durante logout: si authUser ya fue
    // limpiado, no intentar guardar. Esto evita que sS() corra con un id
    // obsoleto justo cuando u está siendo limpiado a null.
    const targetId=(isAdvisor&&viewMode==="client"&&currentClientId)?currentClientId:authUser?.id;
    if(!targetId)return;
    // Multi-cuenta (Fase 2): pasar accountId/isLegacy SOLO en modo retail
    // (no en modo asesor-viendo-cliente, donde el save va contra el row del
    // cliente vía advisor_client_data y no aplica el flujo multi-cuenta).
    const isAdvisorViewingClient=isAdvisor&&viewMode==="client"&&currentClientId;
    // 5-nov-2026 (Santiago: "si no paga debería tener limitación de uso"). En modo consulta no se
    // guarda nada en el servidor, aunque una sección cambie los datos sin pasar por upd().
    if(!isAdvisorViewingClient&&modoConsultaRef.current)return;
    if(isAdvisorViewingClient){
      sS(u,targetId);
    }else{
      sS(u,targetId,accountIdRef.current,isLegacyRef.current,roleRef.current);
    }
  },[u]);

  // Commit 12 Tarea 3: listener de errores de Supabase para hacer visible al
  // usuario cuando un guardado falla. Antes el catch silencioso ocultaba el
  // problema y el usuario veia "Guardado" sin que los datos llegaran al
  // backend. Al recargar la pagina se perdian.
  useEffect(()=>{
    const handler=(e)=>{
      const err=e.detail;
      const msg=err?.message||err?.code||String(err);
      console.error("[fp3] Save error caught by listener:",err);
      setToast(`Error guardando: ${msg.slice(0,80)}. Revisa la consola.`);
      setTimeout(()=>setToast(""),8000);
    };
    window.addEventListener("fp3-save-error",handler);
    return ()=>window.removeEventListener("fp3-save-error",handler);
  },[]);

  // Commit 23 Tarea 3: listener de OK de Supabase. Cuando el upsert se
  // confirma (despues del debounce de 2s en sS()), mostramos toast
  // 'Sincronizado' por 2 segundos. Esto reemplaza el feedback enganoso
  // 'Guardado' inmediato por un flujo de dos etapas honesto:
  //   'Guardando…' (al instante, localStorage hecho)
  //   'Sincronizado' (a los ~2s, backend confirmo)
  // Solo se muestra si hay un toast 'Guardando' activo o si el toast esta
  // vacio (no sobreescribir mensajes informativos).
  useEffect(()=>{
    const handler=()=>{
      // Lee toast actual desde el state callback para evitar dependencia
      setToast(prev=>{
        if(prev && !prev.includes("Guardando")) return prev; // respetar otros toasts
        return "Sincronizado";
      });
      setTimeout(()=>setToast(prev=>prev==="Sincronizado"?"":prev),2000);
    };
    window.addEventListener("fp3-save-ok",handler);
    return ()=>window.removeEventListener("fp3-save-ok",handler);
  },[]);

  // Fase 3 commit 5: listener global de readers bloqueados. Disparado
  // por sS() (cuando un reader intenta auto-save) y por guardEdit() en
  // módulos hijos (cuando un reader hace click en agregar/editar/eliminar).
  // Toast unificado evita que cada módulo tenga que recibir showToast
  // como prop o duplicar el mensaje.
  useEffect(()=>{
    const handler=()=>{
      setToast("Solo lectura · pídele al admin de la cuenta que actualice este dato");
      setTimeout(()=>setToast(prev=>prev.startsWith("")?"":prev),3500);
    };
    window.addEventListener("fp3-reader-blocked",handler);
    return ()=>window.removeEventListener("fp3-reader-blocked",handler);
  },[]);


  // Session timeout — lock after 15 min inactivity
  useEffect(()=>{
    if(!u)return;
    const pin=localStorage.getItem("fp3_pin");
    if(!pin)return;
    let timer;
    const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>setLocked(true),15*60*1000)};
    const events=["mousedown","keydown","touchstart","scroll"];
    events.forEach(e=>window.addEventListener(e,reset));
    reset();
    return()=>{clearTimeout(timer);events.forEach(e=>window.removeEventListener(e,reset))};
  },[u]);

  // Auto-backup every 24h
  useEffect(()=>{
    if(!u)return;
    const lastBackup=localStorage.getItem("fp3_last_backup");
    const now=Date.now();
    if(!lastBackup||now-parseInt(lastBackup)>86400000){
      try{
        const backups=JSON.parse(localStorage.getItem("fp3_backups")||"[]");
        backups.push({date:new Date().toISOString(),data:JSON.stringify(u)});
        if(backups.length>7)backups.shift();
        localStorage.setItem("fp3_backups",JSON.stringify(backups));
        localStorage.setItem("fp3_last_backup",String(now));
      }catch{}
    }
  },[u]);

  const estTrm=estadoTrm(u,trmViva);
  const trm=estTrm.trm;
  const { regPack, jurisdiction } = useJurisdiction(u);
  // 3-nov-2026: idioma y país de la sesión para las pantallas compartidas (lib/region.js).
  // Va aquí, antes de los cálculos de impuesto y totales, para que en EE. UU. usen el motor de EE. UU.
  setRegion({ idioma: u?.lang || (jurisdiction === "US" ? "en" : "es"), pais: jurisdiction });
  // En EE. UU. las pantallas compartidas trabajan en dólares: TRM 1 (lo que esté en USD queda igual).
  const trmPais = jurisdiction === "US" ? 1 : trm;
  // En EE. UU. no hay "pendiente de tasa": todo está en dólares y la TRM no entra en los totales.
  const estTrmPais = jurisdiction === "US" ? { trm: 1, modo: "sin_usd", fecha: null } : estTrm;
  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),3000)};
  // logout: limpia COMPLETAMENTE el estado local + supabase. Debe dejar
  // la app en el mismo estado que si acabara de abrirse por primera vez.
  // Si supabase.signOut falla (común cuando el token ya expiró del lado
  // servidor), limpiamos igual lo local para que el usuario nunca quede
  // atrapado en un estado "medio-logueado".
  const logout=async()=>{
    // 0) La llave de descifrado vive en memoria: antes se iba con el barrido de
    // claves "fp3*" del localStorage, ahora hay que soltarla a mano. Si no, al
    // entrar otra cuenta en la misma pestaña quedaría la llave de la anterior.
    _encKey=null;
    // 1) Supabase signOut en BACKGROUND (no esperamos respuesta del servidor).
    // signOut({scope:"local"}) limpia el storage localmente sin hacer request
    // al servidor, y lo que demora a veces es el request de logout global.
    // Hacemos fire-and-forget para que el usuario vea la respuesta UI inmediata.
    try{supabase.auth.signOut({scope:"local"}).catch(()=>{})}catch(e){/* silent */}
    // 2) Limpiar TODO el localStorage/sessionStorage de Finpathia y Supabase
    try{
      const keysToRemove=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k&&(k.startsWith("fp3")||k.startsWith("sb-")||k.includes("supabase"))){
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k=>localStorage.removeItem(k));
    }catch(e){/* silent */}
    try{
      const sKeys=[];
      for(let i=0;i<sessionStorage.length;i++){
        const k=sessionStorage.key(i);
        if(k&&(k.startsWith("fp3")||k.startsWith("sb-"))) sKeys.push(k);
      }
      sKeys.forEach(k=>sessionStorage.removeItem(k));
    }catch(e){/* silent */}
    // 3) Resetear TODO el estado de React en el orden correcto
    setAuthUser(null);
    setIsAdvisor(false);
    setAdvisorProfile(null);
    setAdvisorClients([]);
    setViewMode("workspace");
    setCurrentClientId(null);
    setAdvisorOwnUser(null);
    setCurrentClient(null);
    setSwitchingClient(false);
    setShowAuth(false);
    setPg("dash");
    // setU(null) al FINAL para que el useEffect de auto-save no dispare con authUser aún seteado
    _setU(null);
  };

  // ═══ Sprint 2C: Volver del dashboard del cliente al workspace del asesor ═══
  // Restaura el u del advisor desde advisorOwnUser (el backup hecho al entrar al cliente).
  const returnToAdvisorWorkspace=()=>{
    if(advisorOwnUser){
      _setU(advisorOwnUser);
      setAdvisorOwnUser(null);
    }
    setCurrentClient(null);
    setCurrentClientId(null);
    setViewMode("workspace");
  };
  // /patrimonio (oct-2026): en esta landing el modal no muestra el bloque de
  // seguridad genérico, ni "Explorar sin cuenta" ni la demo (brief de la página).
  const __enLandingPatrimonio=typeof window!=="undefined"&&/^\/patrimonio\/?$/.test(window.location.pathname);
  // 25-oct-2026 (Santiago: "ayúdame a mejorar el proceso en que llegan los clientes… para que sí se inscriban").
  // Quien viene de calcular su nivel en /libertad ve su resultado al crear la cuenta (no lo pierde de vista)
  // y no se le ofrecen desvíos (demo, explorar sin cuenta): el único paso es guardar su norte.
  // 25-oct-2026: país por zona horaria (sin preguntar); se puede cambiar con un toque.
  const __paisDetectado=(()=>{try{const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"";return /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise)|^Pacific\/Honolulu/.test(tz)?"US":"CO"}catch{return"CO"}})();
  const __norteLanding=(()=>{try{const n=leerNorte();if(!n)return null;const r=calcularNorte(n);return r&&r.ob>0?r:null}catch{return null}})();
  // ═══ 25-oct-2026 — Entrar con Google (Santiago: "que se registren de una") ═══
  // Se prende con VITE_GOOGLE_LOGIN=true cuando el proveedor Google esté activo en Supabase.
  const GOOGLE_LOGIN=import.meta.env.VITE_GOOGLE_LOGIN==="true";
  const entrarConGoogle=async()=>{
    try{
      track("signup_google_click",{modo:aM});
      sessionStorage.setItem("fp3_oauth","1");
      const{error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/"}});
      if(error)setAuthError("No pudimos abrir Google: "+error.message);
    }catch(e){setAuthError("No pudimos abrir Google. Intenta con tu correo.")}
  };
  // Primera vez que entra con Google: no tiene user_data. Se crea igual que en el registro con correo.
  const crearCuentaOAuth=async(user)=>{
    const email=user.email||"";
    const meta=user.user_metadata||{};
    const nombre=(meta.full_name||meta.name||"").trim()||(()=>{const x=email.split("@")[0].split(/[._\-+0-9]/)[0];return x?x.charAt(0).toUpperCase()+x.slice(1):"Usuario"})();
    const nd=mkU(nombre,email);nd.p.plan="free";nd.p.trialEnd=new Date(Date.now()+getTrialDays(email)*86400000).toISOString().split("T")[0];nd.jurisdiction=__paisDetectado;
    const __norte=leerNorte();let __conNorte=false;
    if(__norte){const it=itemsDesdeNorte(__norte,"own_1");if(it.ingresos.length||Object.keys(it.gas).length||it.inv.length){nd.owners=[{id:"own_1",name:nombre,type:"natural"}];nd.ingresos=it.ingresos;nd.gas=it.gas;nd.inv=it.inv;nd.deu=it.deu;__conNorte=true;}}
    setU(nd);await sS(nd,user.id);setPg("dash");
    try{guardarEntrada();trackSignup({method:"google",userId:user.id});}catch{}
    if(__conNorte){borrarNorte();showToast("Tu norte quedó guardado. Esto es lo que tienes hoy.")}else{setShowOnboarding(true)}
    fetch("/.netlify/functions/send-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:email,template:"welcome",vars:{name:nombre,isPioneros:false}})}).catch(()=>{});
  };
  const auth=async()=>{
    if(!aF.e||!aF.p){setAuthError("Ingresa email y contraseña");return}
    // Sesión 4-may-2026: subimos mínimo de 6 → 8 caracteres + validación
    // de seguridad básica (no permitir passwords débiles obvios). Esto se
    // aplica solo en SIGNUP — login deja pasar passwords viejas para no
    // bloquear users existentes que tengan password de 6 chars.
    if(aM==="signup"){
      // Sesión 4-may-2026: validar aceptación de Términos y Privacidad.
      // Sin esto, los términos no son legalmente vinculantes en Colombia.
      if(!aF.acceptTerms){setAuthError("Debes aceptar los Términos y Condiciones y la Política de Privacidad para crear tu cuenta.");return}
      if(aF.p.length<8){setAuthError("La contraseña debe tener mínimo 8 caracteres");return}
      // Lista de passwords débiles más comunes (top 20 en breaches conocidos).
      // Si el user intenta uno de estos, lo rechazamos con mensaje claro.
      const weakList=["12345678","password","qwerty12","11111111","00000000","abcdefgh","87654321","password1","password2","contrasena","password123","qwertyuiop","asdfghjkl","zxcvbnm123","12345abc","abc12345"];
      if(weakList.includes(aF.p.toLowerCase())){setAuthError("Esa contraseña es muy común. Elige algo único — por ejemplo una frase corta con números.");return}
      // Anti-patrón: solo numéros (ej: "12345678" o "11223344")
      if(/^\d+$/.test(aF.p)){setAuthError("La contraseña no puede ser solo números. Agrega letras o símbolos.");return}
    }else{
      // En login solo validamos largo mínimo para evitar requests vacíos.
      if(aF.p.length<6){setAuthError("La contraseña debe tener mínimo 6 caracteres");return}
    }
    setAuthLoading(true);setAuthError("");
    try{
    if(isSupabaseConfigured){
      if(aM==="login"){
        const{data,error}=await supabase.auth.signInWithPassword({email:aF.e,password:aF.p});
        if(error){const msg=error.message==="Invalid login credentials"?"Email o contraseña incorrectos":error.message==="Email not confirmed"?"Revisa tu email y confirma tu cuenta":error.message;setAuthError(msg);setAuthLoading(false);return}
        // Sesión 4-may-2026: tracking GA4 — login exitoso con user_id
        // para atribución cross-device.
        track("login_completed",{ method:"email" });
        identifyUser(data.user.id);
        // Advisor lookup: corre SIEMPRE para saber si la cuenta tiene plan Asesor
        let advData=null;
        try{
          const{data:ad,error:advErr}=await supabase.from("advisors").select("id,email,firm_name,advisor_plan,max_clients,subscription_status").eq("id",data.user.id).maybeSingle();
          if(!advErr) advData=ad;
        }catch(e){/* silent */}
        // Validación: si eligió "Asesor" pero la cuenta NO tiene plan Asesor → error y signout
        if(loginRole==="advisor" && !advData){
          try{await supabase.auth.signOut()}catch{}
          setAuthError("Esta cuenta no tiene plan de Asesor activo. Ingresa como Cliente o adquiere el plan en Planes.");
          setAuthLoading(false);
          return;
        }
        setAuthUser(data.user);_encKey=aF.p;
        try{
          // Multi-cuenta (Fase 2): paso accountIdRef.current. Inicialmente
          // null porque useAccount no resolvió tras setAuthUser; sLR cae a
          // path legacy. sLR ya trae timeout y distingue error de usuario nuevo.
          const __r=await sLR(data.user.id,accountIdRef.current);
          const d=__r.datos;
          // Lectura fallida: nunca crear una cuenta en blanco encima de la real.
          if(__r.estado==="error"&&!d)throw new Error("no pudimos leer tus datos");
          if(d){const __sd=sanitize(d);setU(__sd);setPg("dash");if(cuentaVacia(__sd))setShowOnboarding(true);}
          else{const nd=mkU(aF.n||(()=>{const x=(aF.e||"").split("@")[0].split(/[._\-+0-9]/)[0];return x?x.charAt(0).toUpperCase()+x.slice(1):"Usuario"})(),aF.e);nd.p.plan="free";nd.p.trialEnd=new Date(Date.now()+getTrialDays(aF.e)*86400000).toISOString().split("T")[0];nd.jurisdiction=aF.country||__paisDetectado;
            // 20-oct-2026: si viene de /libertad con el norte calculado, las tres
            // cifras entran como ítems reales. Nada que repetir; el dashboard
            // muestra el nivel desde el primer segundo y el tour no hace falta.
            const __norte=leerNorte();let __conNorte=false;
            if(__norte){const it=itemsDesdeNorte(__norte,"own_1");if(it.ingresos.length||Object.keys(it.gas).length||it.inv.length){nd.owners=[{id:"own_1",name:aF.n||"Yo",type:"natural"}];nd.ingresos=it.ingresos;nd.gas=it.gas;nd.inv=it.inv;nd.deu=it.deu;__conNorte=true;}}
            setU(nd);await sS(nd,data.user.id);
            if(__conNorte){borrarNorte();track("norte_guardado",{nivel:undefined});sessionStorage.setItem("fp3_norte_recien","1");}else{setShowOnboarding(true)}}
        }catch(loadErr){
          // Si falla la carga de datos: limpiamos el estado a medio-loguear para no
          // dejar al usuario atrapado con authUser seteado pero sin data (lo que
          // causaría loader infinito). Mostramos error accionable.
          setAuthUser(null);
          try{await supabase.auth.signOut({scope:"local"})}catch{}
          _encKey=null;
          setAuthError("No se pudo cargar tus datos: "+loadErr.message+". Vuelve a intentar.");
          setAuthLoading(false);
          return;
        }
        // Setear viewMode y isAdvisor JUNTOS (React 18 batchea setStates síncronos)
        // para evitar flash de AdvisorWorkspace cuando el usuario entra como cliente.
        // Si entra como asesor: workspace. Si entra como cliente: personal.
        if(advData){
          // IMPORTANTE: setViewMode ANTES que setIsAdvisor para que el condicional
          // de render (u&&isAdvisor&&viewMode==="workspace") nunca sea true con
          // viewMode todavía en el valor inicial "workspace" cuando el usuario eligió cliente.
          setViewMode(loginRole==="advisor"?"workspace":"personal");
          setIsAdvisor(true);
          setAdvisorProfile(advData);
          if(loginRole==="advisor"){
            // Si entra como asesor, cargamos clientes AHORA (los necesita para workspace)
            try{
              const{data:clientsData}=await supabase.from("advisor_client_data").select("id,email,data,plan,jurisdiction,updated_at,client_status,invited_at,accepted_at").eq("advisor_id",data.user.id);
              if(clientsData)setAdvisorClients(clientsData);
            }catch(e){/* silent */}
          }else{
            // Si entra como cliente, cargamos clientes en BACKGROUND (no bloquea UI).
            // Los necesita solo si luego cambia a modo asesor.
            supabase.from("advisor_client_data").select("id,email,data,plan,jurisdiction,updated_at,client_status,invited_at,accepted_at").eq("advisor_id",data.user.id).then(({data:cd})=>{
              if(cd)setAdvisorClients(cd);
            }).catch(()=>{});
          }
        }else{
          setViewMode("personal");
        }
      }else{
        const sr=await fetch("/.netlify/functions/auth-signup",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({email:aF.e,password:aF.p,name:aF.n||"",attribution:readFirstTouch()})
        });
        const srd=await sr.json();
        if(!sr.ok){const errMsg=srd.error||"Error creando cuenta";
        // 04-sep-2026 — Se medía cuando alguien ABRE el registro y cuando lo
        // COMPLETA, pero nunca cuando falla. Con 16 caminos de error sin
        // instrumentar, un mes con cero registros y un mes donde diez personas
        // lo intentaron y todas chocaron con el mismo muro se ven idénticos en
        // los informes. Ahora se distingue.
        // Se manda una CATEGORÍA, no el mensaje crudo ni el correo: alcanza
        // para saber qué está frenando a la gente sin meter datos personales
        // en una herramienta de analítica.
        try{
          const _m=String(errMsg).toLowerCase();
          const _motivo=_m.includes("already")||_m.includes("exists")?"email_ya_registrado"
            :_m.includes("invalid email")?"email_invalido"
            :_m.includes("password")||_m.includes("contraseña")?"password_rechazada"
            :_m.includes("cuenta llena")||_m.includes("límite")?"limite_plan"
            :_m.includes("fetch")||_m.includes("network")?"error_red"
            :"otro";
          track("signup_failed",{motivo:_motivo});
        }catch(_e){}
        let friendly=errMsg;if(errMsg.includes("already been registered")||errMsg.includes("already registered")||errMsg.includes("already exists"))friendly="Este email ya tiene cuenta. Prueba iniciar sesión.";else if(errMsg.includes("Cuenta llena")||errMsg.includes("límite del plan"))friendly="Estamos teniendo un problema técnico al crear tu cuenta. Por favor intenta de nuevo o escríbenos a soporte@finpathia.com.";else if(errMsg.includes("Invalid email")||errMsg.includes("invalid email"))friendly="El email no es válido. Verifica que esté bien escrito.";else if(errMsg.includes("Password should be"))friendly="La contraseña no cumple con los requisitos de seguridad.";setAuthError(friendly);setAuthLoading(false);return}
        const{data,error}=await supabase.auth.signInWithPassword({email:aF.e,password:aF.p});
        if(error){setAuthError(error.message);setAuthLoading(false);return}
        setAuthUser(data.user);_encKey=aF.p;const nd=mkU(aF.n||(()=>{const x=(aF.e||"").split("@")[0].split(/[._\-+0-9]/)[0];return x?x.charAt(0).toUpperCase()+x.slice(1):"Usuario"})(),aF.e);nd.p.plan="free";nd.p.trialEnd=new Date(Date.now()+getTrialDays(aF.e)*86400000).toISOString().split("T")[0];nd.jurisdiction=aF.country||__paisDetectado;setU(nd);await sS(nd,data.user.id);
        // Sesión 4-may-2026: tracking GA4 — signup completed con metadata
        // de promo (Pioneros) y user_id para atribución cross-device.
        // 11-oct-2026: guardar UTM + ángulo ANTES de trackSignup (que borra
        // fp3_signup_intent) para el evento "activation" (primer activo) de días después.
        guardarEntrada();
        trackSignup({ method: "email", userId: data.user.id });
        // 25-jul-2026 (Santiago: "creé una cuenta nueva y me llevó al simulador
        // de Pedro"): setPg solo se reseteaba en logout. Si el visitante venía
        // explorando la demo y quedó parado en el Simulador, al registrarse
        // seguía ahí — la pantalla más compleja de la app — y encima con los
        // datos de ejemplo si luego abría el tour. Arranque siempre en el inicio.
        setPg("dash");
        // Mostrar onboarding tour después del signup exitoso. Sin este paso,
        // ~40% de los users nuevos quedan mirando un dashboard vacío sin saber
        // qué hacer. El tour los lleva a su primer momento de valor en 60s.
        // 20-oct-2026: salvo que venga de /libertad con su norte ya cargado.
        if(sessionStorage.getItem("fp3_norte_recien")){sessionStorage.removeItem("fp3_norte_recien");setShowOnboarding(false);showToast("Tu norte quedó guardado. Esto es lo que tienes hoy.")}else{setShowOnboarding(true)}
        // Enviar welcome email (fire-and-forget — si falla no bloquea el flow).
        // Detecta si el user vino con cupón Pioneros para personalizar el copy.
        const __isPioneros = sessionStorage.getItem("fp3_promo_code") === "PIONEROS2026";
        fetch("/.netlify/functions/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: aF.e,
            template: "welcome",
            vars: { name: aF.n || "", isPioneros: __isPioneros },
          }),
        }).catch(err => console.warn("[welcome email] failed:", err));
        // Conversión Google Ads (legacy — pre-existente)
        window.gtag?.('event','conversion',{send_to:'AW-613365221/dbh6CL2pn9cZEOXrvKQC',value:1.0,currency:'COP'});
      }
    }else{setU(mkU(aF.n||"Usuario",aF.e))}
    }catch(e){setAuthError("Error: "+e.message)}
    setAuthLoading(false);
  };
  // Salir de la demo: vuelve la cuenta real (recargada de Supabase; si no se
  // puede, la copia en memoria tomada al entrar). La demo nunca se guardó.
  const salirDemo=async()=>{
    if(!confirm("Se quitan los datos de ejemplo y vuelves a tu cuenta tal como estaba. ¿Seguimos?"))return;
    const nombre=u?.p?.name||"Usuario",correo=u?.p?.email||"";
    const real=await datosAlSalir({
      recargar:authUser?.id?()=>sL(authUser.id,accountIdRef.current):null,
      ref:realAntesDemoRef,
      enBlanco:()=>mkU(nombre,correo),
    });
    setU(real);setPg("dash");showToast("Listo — volviste a tu cuenta");
  };
  const demo=()=>{showToast("Datos de ejemplo cargados");window.gtag?.("event","demo_opened",{method:"button"});guardarReal(realAntesDemoRef,uRef.current);setU(p=>{
    // 25-jul-2026 (Santiago: "si la gente ingresa y ve un nombre que no es, eso
    // es extraño"): antes la demo pisaba SIEMPRE el perfil con "Pedro Pérez" y
    // demo@finpathia.com. Un usuario recién registrado abría el ejemplo y veía
    // el nombre de otra persona sobre SU cuenta — en una app de patrimonio eso
    // se lee como "estoy viendo la plata de alguien más". Ahora, si ya hay
    // sesión, se conservan nombre y correo reales: cambian los DATOS de ejemplo,
    // nunca la identidad.
    const yaRegistrado=!!authUser;
    const nombreReal=(p?.p?.name&&p.p.name!=="Pedro Pérez")?p.p.name:"";
    const emailReal=(p?.p?.email&&p.p.email!=="demo@finpathia.com")?p.p.email:"";
    const nd=mkU(yaRegistrado&&nombreReal?nombreReal:"Pedro Pérez",yaRegistrado&&emailReal?emailReal:"demo@finpathia.com");
    nd.p={
      name:yaRegistrado&&nombreReal?nombreReal:"Pedro Pérez",
      email:yaRegistrado&&emailReal?emailReal:"demo@finpathia.com",
      plan:yaRegistrado?(p?.p?.plan||"pro"):"pro",
      trialEnd:yaRegistrado&&p?.p?.trialEnd?p.p.trialEnd:new Date(Date.now()+30*86400000).toISOString().split("T")[0],
      demo:true,
      anonymous:!yaRegistrado,
    };
    // 21-oct-2026 (Santiago: "montar el demo con números y escenarios parecidos
    // al mío para ver todo el potencial de la herramienta; lotes, bodegas,
    // apartamento, fondo BTG"). La demo anterior era un asalariado con dos
    // arriendos. Esta es un patrimonio de familia con sociedad: tres
    // propietarios, inmuebles de renta, lotes, fondos de crédito privado con
    // capital × tasa, renta en dólares, dos hipotecas, gastos por categoría,
    // declaraciones cargadas y un escenario 2027 con cambios. Cifras
    // verosímiles, no reales; nombres genéricos.
    nd.owners=[
      {id:"own_1",name:"Pedro Pérez",type:"natural"},
      {id:"own_2",name:"Laura Gómez",type:"natural"},
      {id:"own_j1",name:"Inversiones Pérez SAS",type:"juridica",regimen:"ordinario"},
    ];
    // 22-oct-2026 (Santiago: "que el demo tenga modelos muy parecidos a los
    // números que vemos aquí, pero sin mis datos personales y nombres de
    // inversiones más genéricas; para mostrar ahora a unos interesados").
    // Patrimonio de familia concentrado en ladrillo (una casa de recreo grande
    // que renta por temporadas, dos apartamentos en USA con hipoteca, un local,
    // un lote con licencia), un fondo de crédito privado que paga cada mes,
    // efectivo de una venta por invertir, carros con cuota, sin salario. Los
    // escenarios muestran el mismo dilema: vender el inmueble grande y poner
    // a producir la plata, de tres maneras. Cifras verosímiles, redondeadas;
    // nombres genéricos; ninguna persona real.
    nd.inv=[
      {id:"d_i1",n:"Casa de recreo en el lago",ub:"Oriente antioqueño",tp:"Real Estate",va:8500000000,vc:6000000000,tasa:"",owner:"own_j1",valorizacionPct:"4"},
      {id:"d_i2",n:"Apartamento en Orlando",ub:"Orlando, FL",tp:"Real Estate",va:1600000000,vc:1400000000,tasa:"",owner:"own_1",valorizacionPct:"3"},
      {id:"d_i3",n:"Apartamento en Miami",ub:"Miami, FL",tp:"Real Estate",va:850000000,vc:700000000,tasa:"",owner:"own_1",valorizacionPct:"4"},
      {id:"d_i4",n:"Local comercial",ub:"Medellín",tp:"Local Comercial",va:1100000000,vc:800000000,tasa:"",owner:"own_j1",valorizacionPct:"4"},
      {id:"d_i5",n:"Lote con licencia para bodega",ub:"Antioquia",tp:"Real Estate",va:410000000,vc:300000000,tasa:"",owner:"own_1",valorizacionPct:"6"},
      {id:"d_i6",n:"Fondo de crédito privado",ub:"Colombia",tp:"Fondo de Inversión",va:3300000000,vc:3300000000,tasa:"19",owner:"own_j1"},
      {id:"d_i7",n:"Participación en fintech de crédito",ub:"Colombia",tp:"Acciones",va:950000000,vc:600000000,tasa:"8.2",owner:"own_1"},
      {id:"d_i8",n:"Efectivo de una venta (por invertir)",ub:"Colombia",tp:"Cash",va:800000000,vc:800000000,tasa:"",owner:"own_2"},
      {id:"d_i9",n:"Portafolio de acciones USA",ub:"USA",tp:"Acciones",va:130000000,vc:100000000,tasa:"",owner:"own_1"},
      {id:"d_i10",n:"Bitcoin",ub:"",tp:"Crypto",va:70000000,vc:40000000,tasa:"",owner:"own_1"},
      {id:"d_i11",n:"Camioneta",ub:"Medellín",tp:"Vehículo",va:330000000,vc:380000000,tasa:"",owner:"own_1"},
      {id:"d_i12",n:"Carro",ub:"Medellín",tp:"Vehículo",va:205000000,vc:240000000,tasa:"",owner:"own_2"},
      {id:"d_i13",n:"Cuenta de ahorros",ub:"Colombia",tp:"Cash",va:40000000,vc:40000000,tasa:"",owner:"own_1"},
    ];
    nd.ingresos=[
      // Rentas de activos (capital × tasa: el monto sale del capital)
      {id:"d_ig1",nombre:"Rendimiento fondo de crédito privado",categoria:"Intereses bancarios",mensual:52250000,tipo:"fijo",fuente:"Fondo de crédito privado",owner:"own_j1",moneda:"COP",capital:"3300000000",tasa:"19"},
      {id:"d_ig2",nombre:"Dividendos fintech de crédito",categoria:"Dividendos",mensual:6500000,tipo:"fijo",fuente:"Participación en fintech de crédito",owner:"own_1",moneda:"COP",capital:"950000000",tasa:"8.2"},
      {id:"d_ig3",nombre:"Arriendo casa del lago (temporadas)",categoria:"Arriendo",mensual:0,tipo:"variable",frecuencia:"variable",fuente:"Casa de recreo en el lago",owner:"own_j1",moneda:"COP",
       // Alquiler por temporadas: picos en enero, Semana Santa, mitad y fin de año.
       montosMensuales:[60000000,25000000,35000000,50000000,20000000,45000000,55000000,25000000,20000000,30000000,25000000,66000000]},
      {id:"d_ig4",nombre:"Arriendo del domo (en la casa del lago)",categoria:"Arriendo",mensual:2500,tipo:"fijo",fuente:"Casa de recreo en el lago",owner:"own_j1",moneda:"USD"},
      {id:"d_ig5",nombre:"Arriendo apartamento Orlando",categoria:"Arriendo",mensual:7000,tipo:"fijo",fuente:"Apartamento en Orlando",owner:"own_1",moneda:"USD"},
      {id:"d_ig6",nombre:"Arriendo apartamento Miami",categoria:"Arriendo",mensual:1900,tipo:"fijo",fuente:"Apartamento en Miami",owner:"own_1",moneda:"USD"},
      {id:"d_ig7",nombre:"Dividendos empresa de distribución",categoria:"Dividendos",mensual:6500000,tipo:"fijo",fuente:"Participación minoritaria",owner:"own_1",moneda:"COP"},
      // Trabajo: sin salario fijo; honorarios semi-pasivos
      {id:"d_ig8",nombre:"Honorarios por distribución",categoria:"Honorarios",mensual:13000000,tipo:"fijo",fuente:"Clientes",owner:"own_1",moneda:"COP"},
      // Un contrato que termina este año (el simulador futuro lo detecta)
      {id:"d_ig9",nombre:"Contrato de consultoría",categoria:"Honorarios",mensual:9000000,tipo:"variable",fuente:"Cliente",owner:"own_2",moneda:"COP",desdeMes:1,hastaMes:8},
    ];
    nd.deu=[
      {id:"d_d1",n:"Hipoteca apartamento Miami",tp:"mortgage",mt:470000000,pg:4900000,ts:7,owner:"own_1"},
      {id:"d_d2",n:"Hipoteca apartamento Orlando",tp:"mortgage",mt:1100000000,pg:12800000,ts:7.5,owner:"own_1"},
      {id:"d_d3",n:"Crédito camioneta",tp:"vehiculo",mt:165000000,pg:4500000,ts:9,owner:"own_1"},
      {id:"d_d4",n:"Crédito carro",tp:"vehiculo",mt:96000000,pg:4500000,ts:22,owner:"own_2"},
      {id:"d_d5",n:"Crédito de consumo",tp:"loan",mt:61000000,pg:1500000,ts:18,owner:"own_1"},
    ];
    nd.gas={
      "Obligatorios":[{c:"Seguridad social (dos personas)",m:27600000,t:"f",owner:"own_1"},{c:"Seguros de vida y salud",m:6900000,t:"f",owner:"own_1"}],
      "Impuestos":[{c:"Impuesto de renta (neto, mensualizado)",m:5400000,t:"f",owner:"own_1"},{c:"Retención en la fuente",m:5200000,t:"f",owner:"own_1"},{c:"Aporte tributario sociedad",m:1200000,t:"f",owner:"own_j1"},{c:"Impuesto vehicular (anual)",m:7200000,t:"f",owner:"own_1",frecuencia:"anual",mesPago:4}],
      "Vivienda":[{c:"Arriendo vivienda",m:10000000,t:"f",owner:"own_1"},{c:"Servicios",m:2000000,t:"f",owner:"own_1"},{c:"Empleada doméstica",m:1800000,t:"f",owner:"own_1"}],
      "Familia":[{c:"Educación hijos",m:9300000,t:"f",owner:"own_1",desdeMes:2,hastaMes:11},{c:"Alimentación",m:6900000,t:"v",owner:"own_1"},{c:"Transporte",m:1700000,t:"v",owner:"own_1"},{c:"Representación",m:1500000,t:"v",owner:"own_1"},{c:"Entretenimiento",m:1400000,t:"v",owner:"own_2"}],
      "Honorarios":[{c:"Asesoría legal y contable",m:8000000,t:"f",owner:"own_j1"}],
      "Inmueble arrendado":[{c:"Administración y mantenimiento casa del lago",m:3500000,t:"f",owner:"own_j1",activoId:"d_i1"},{c:"HOA y seguro apartamento Orlando",m:3200000,t:"f",owner:"own_1",activoId:"d_i2"}],
    };
    // Tres escenarios, el mismo dilema: vender la casa del lago (y Orlando, que
    // pierde plata con la hipoteca), pagar las cuotas de los carros y poner a
    // producir los $9.500 M que quedan. Lo que cambia es dónde.
    const vender=[{posicionId:"d_i1"},{posicionId:"d_i2"},{posicionId:"d_i8"}];
    const pagar=["d_d2","d_d3","d_d4","d_d5"];
    const bodega={id:"demo_mv_bodega",mes:1,tipo:"transformar",posicionId:"d_i5",nombre:"Lote con licencia para bodega",obra:600000000,mesesObra:5,valor:1010000000,renta:8000000,origen:[{posicionId:"demo_d_fondo"}]};
    const pensiones=[{id:"demo_mv_pen1",mes:48,tipo:"flujo_inicia",flujo:{id:"demo_mv_pen1_f",nombre:"Pensión Laura",tipo:"ingreso",monto:24000000,indexa:true}},{id:"demo_mv_pen2",mes:72,tipo:"flujo_inicia",flujo:{id:"demo_mv_pen2_f",nombre:"Pensión Pedro",tipo:"ingreso",monto:25000000,indexa:true}}];
    const fondo=(cap)=>({id:"demo_d_fondo",destinoId:null,nombre:"Fondo de renta fija",canasta:"rentas",capital:cap,tasa:10.5,pagaPct:100,valorizacion:0,regla:"Paga el 100% del rendimiento cada mes"});
    nd.caminos=[
      {id:"demo_esc_1",nombre:"Vender el lago y vivir de rentas",tesis:"Vender la casa del lago y Orlando, pagar las cuotas, y repartir entre un fondo que paga cada mes, la bodega y acciones.",color:"#f59e0b",plantilla:"balance",propio:true,editado:true,
       ventas:vender,pagos:pagar,
       despliegue:[fondo(7000000000),{id:"demo_d_acc",destinoId:"d_i9",nombre:"Portafolio de acciones USA",canasta:"crecimiento",capital:2200000000,tasa:22,pagaPct:0,valorizacion:0,regla:"Todo se reinvierte"},{id:"demo_d_btc",destinoId:"d_i10",nombre:"Bitcoin",canasta:"crecimiento",capital:270000000,tasa:20,pagaPct:0,valorizacion:0,regla:"Todo se reinvierte"}],
       eventos:[bodega,...pensiones,{id:"demo_mv_casa",mes:48,tipo:"comprar",nombre:"Casa propia",costo:4300000000,bolsillo:"uso",pagaPct:0,valorizacion:5,origen:[{posicionId:"demo_d_fondo"}]},{id:"demo_mv_arr",mes:48,tipo:"flujo_cambia",flujoId:"gas_vivienda",monto:3800000}],
       excedente:[{canasta:"rentas",pct:50},{canasta:"crecimiento",pct:50}],colchonMeses:6,canastas:null,condiciones:[]},
      {id:"demo_esc_2",nombre:"Conservador: todo en rentas estables",tesis:"Lo mismo, pero todo lo que queda va a rentas que pagan cada mes; nada en crecimiento.",color:"#00c805",plantilla:"seguridad",propio:true,editado:true,
       ventas:vender,pagos:pagar,
       despliegue:[fondo(9470000000)],
       eventos:[bodega,...pensiones],
       excedente:[{canasta:"rentas",pct:80},{canasta:"crecimiento",pct:20}],colchonMeses:12,canastas:{rentas:{min:80}},condiciones:["sin_deuda_cara"]},
      {id:"demo_esc_3",nombre:"Motor de construcción",tesis:"Parte de la plata entra a proyectos de construcción que se venden vuelta tras vuelta, y lo demás a rentas.",color:"#a855f7",plantilla:"crecimiento",propio:true,editado:true,
       ventas:vender,pagos:pagar,
       despliegue:[fondo(7000000000),{id:"demo_d_acc3",destinoId:"d_i9",nombre:"Portafolio de acciones USA",canasta:"crecimiento",capital:2200000000,tasa:22,pagaPct:0,valorizacion:0,regla:"Todo se reinvierte"},{id:"demo_d_btc3",destinoId:"d_i10",nombre:"Bitcoin",canasta:"crecimiento",capital:270000000,tasa:20,pagaPct:0,valorizacion:0,regla:"Todo se reinvierte"}],
       eventos:[bodega,...pensiones,{id:"demo_mv_motor",mes:2,tipo:"motor",nombre:"Proyectos de construcción asociativos",lote:1200000000,obra:1500000000,venta:3645000000,mesesVuelta:16,impuestoPct:35,vueltas:6,reinvierte:true,origen:[{posicionId:"demo_d_fondo"}]}],
       excedente:[{canasta:"rentas",pct:30},{canasta:"crecimiento",pct:70}],colchonMeses:6,canastas:null,condiciones:[]},
    ];
    // 30-oct-2026 (Santiago: "monta en el demo unos 5 escenarios futuros con conceptos
    // diferentes: protección, crecer, mercado"). Van en «Mi futuro a 10 años», que es la
    // sección viva (MiPlan/caminos salió del menú). Mismo patrimonio, cinco ideas:
    // blindar, vivir de rentas, equilibrio, crecer en mercado global y crecer en finca raíz.
    const pagarTodo={d_d1:true,d_d2:true,d_d3:true,d_d4:true,d_d5:true};
    const pagarCaras={d_d3:true,d_d4:true,d_d5:true};
    const pagarConOrlando={d_d2:true,d_d3:true,d_d4:true,d_d5:true};
    // En «Mi futuro» las canastas reinvierten; lo que debe pagar cada mes va como inversión propia que entrega el 100%.
    const rfPaga=(nombre,monto,tasa,moneda="COP")=>({preset:"custom",nombre,monto,anio:1,rendimientoNomPct:tasa,pctRecibe:100,moneda,fuente:"venta"});
    const bodegaF10={accion:"modifica",inversionMonto:600000000,inversionAnio:1,rentaNuevaMensual:8000000,rentaNuevaDesdeMes:6,valorizacionNomPct:7};
    const f10=(id,nombre,descripcion,config)=>({id,nombre,descripcion,creado:"2026-10-30T12:00:00.000Z",config:{escenario:"base",decisiones:{},norte:"equilibrio",mezcla:null,nuevas:[],reinversiones:[],futuros:{ingresos:[],activos:[],gastos:[]},...config}});
    // Demo: 12 meses de historia del patrimonio (crece ~1% al mes, con un bache en abril).
    {const f=fotoPatrimonio(nd,trmReal(nd)||4000);if(f){const hoy=new Date();nd.historiaPatrimonio=[];for(let m=12;m>=1;m--){const dt=new Date(hoy.getFullYear(),hoy.getMonth()-m,28);const fac=Math.pow(0.99,m)*(dt.getMonth()===3?0.97:1);nd.historiaPatrimonio.push({k:dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0"),d:dt.toISOString().slice(0,10),a:Math.round(f.a*fac),de:Math.round(f.de*(1+m*0.01)),nw:Math.round(f.a*fac-f.de*(1+m*0.01))})}}}
    nd.futuro10={escenarios:[
      f10("demo_f10_1","1 · Protección: blindar la familia","Quedar sin deudas y con la vida pagada pase lo que pase: vender Orlando (renta menos de lo que cuesta), la fintech y el bitcoin, pagar todos los créditos y dejar lo que sobra en liquidez y renta fija. Se quedan la casa del lago y el fondo que paga cada mes.",
        {decisiones:{d_i2:{accion:"vende"},d_i7:{accion:"vende"},d_i10:{accion:"vende"}},pagarDeudas:pagarTodo,mezcla:{liquidez:30,renta:65,crecimiento:5}}),
      f10("demo_f10_2","2 · Vivir de rentas","Vender la casa del lago y Orlando, pagar los créditos caros y poner la plata a pagar cada mes: dos tercios en renta fija que deposita cada mes, el resto creciendo.",
        {decisiones:{d_i1:{accion:"vende"},d_i2:{accion:"vende"}},pagarDeudas:pagarConOrlando,norte:"rentas",nuevas:[rfPaga("Renta fija que paga cada mes (CDT y TES)",6500000000,10)]}),
      f10("demo_f10_3","3 · Equilibrio","Vender la casa del lago y Orlando, construir la bodega en el lote y repartir mitad en renta, mitad creciendo.",
        {decisiones:{d_i1:{accion:"vende"},d_i2:{accion:"vende"},d_i5:bodegaF10},pagarDeudas:pagarConOrlando,norte:"equilibrio",nuevas:[rfPaga("Renta fija que paga cada mes (CDT y TES)",4000000000,10)]}),
      f10("demo_f10_4","4 · Crecer en mercado global","Salir del ladrillo grande: vender la casa del lago, Orlando y Miami, pagar todo y llevar el 70% a un portafolio global de acciones (S&P 500, en dólares). Líquido y diversificado, pero sube y baja.",
        {decisiones:{d_i1:{accion:"vende"},d_i2:{accion:"vende"},d_i3:{accion:"vende"}},pagarDeudas:pagarTodo,norte:"crecer",nuevas:[rfPaga("Bonos globales que pagan cada mes",2500000000,7,"USD")]}),
      f10("demo_f10_5","5 · Crecer en finca raíz","Quedarse con los inmuebles y sumar más: construir la bodega en el lote y meter el efectivo y la fintech en un proyecto de vivienda en preventa que se valoriza.",
        {decisiones:{d_i5:bodegaF10,d_i7:{accion:"vende"},d_i8:{accion:"vende"}},pagarDeudas:pagarCaras,norte:"crecer",
         nuevas:[{preset:"custom",nombre:"Proyecto de vivienda en preventa",monto:1200000000,anio:1,rendimientoNomPct:14,pctRecibe:0,moneda:"COP",fuente:"venta"}]}),
    ]};
    nd.caminoElegido="demo_esc_1";
    // Declaraciones de años anteriores, para que "Tu renta, año tras año" tenga con qué comparar.
    nd.owners[0].declaraciones=[
      {tipo:"F210",anoGravable:2025,capturadoEl:"2026-09-10T15:00:00.000Z",fuenteCaptura:"demo",renglones:{ingresosBrutos:612000000,ingresosNoConstitutivos:16000000,rentaExenta25:45000000,deducIntereses:0,deducMedicina:19000000,deducDependientes:0,pvAFC:48000000,patrimonioBruto:5400000000,deudas:810000000,patrimonioLiquido:4590000000,impuestoCalculado:96000000,retefuente:88000000,saldoPagar:8000000}},
      {tipo:"F210",anoGravable:2024,capturadoEl:"2025-09-10T15:00:00.000Z",fuenteCaptura:"demo",renglones:{ingresosBrutos:548000000,ingresosNoConstitutivos:15000000,rentaExenta25:41000000,deducIntereses:0,deducMedicina:17000000,deducDependientes:0,pvAFC:36000000,patrimonioBruto:4900000000,deudas:900000000,patrimonioLiquido:4000000000,impuestoCalculado:84000000,retefuente:71000000,saldoPagar:13000000}},
    ];
    nd.owners[2].declaraciones=[
      {tipo:"F110",anoGravable:2025,capturadoEl:"2026-04-20T15:00:00.000Z",fuenteCaptura:"demo",renglones:{ingresosBrutos:880000000,costosDeducciones:310000000,rentaLiquida:570000000,rentaLiquidaGravable:570000000,patrimonioBruto:7100000000,deudas:950000000,patrimonioLiquido:6150000000,impuestoCalculado:199500000,descICA:6000000,impuestoNeto:193500000,autorretencion:52000000,saldoPagar:141500000}},
    ];
    // Un escenario 2027 ya armado: así se ve el simulador futuro con cambios reales.
    nd.escenarios=[
      {id:"esc_demo_2027",nombre:"Mi 2027",año:2027,creado:"2026-10-21T12:00:00.000Z",descripcion:"Vendo el lote, pago la camioneta y meto más al fondo",cambios:[
        {id:"c1",tipo:"cambia",kind:"ing",ref:"ing_0",nombre:"Rendimiento fondo de crédito privado",desdeMes:1,modo:"capital",capital:"2800000000",tasa:"21",tasaModo:"anual",monto:"49000000"},
        {id:"c2",tipo:"termina",kind:"deu",ref:"deu_2",nombre:"Crédito camioneta",desdeMes:7},
        {id:"c3",tipo:"nuevo",kind:"ing",nombre:"Rendimiento CDT (venta del lote)",cat:"Intereses bancarios",desdeMes:3,hastaMes:12,capital:"380000000",tasa:"11",tasaModo:"anual",monto:"3483333"},
        {id:"c4",tipo:"nuevo",kind:"gas",nombre:"Universidad hijo mayor",cat:"Educación",desdeMes:2,monto:"4200000"},
      ]},
    ];
    nd.metas=[{name:"Fondo de emergencia (6 meses)",type:"emergency",target:150000000,saved:60000000,monthly:5000000}];
    return nd;
  });setTimeout(()=>showToast("Impuestos calculados para Pedro, Laura y Pérez SAS"),1500)};
  // 3-nov-2026 (Santiago: "crea bien el demo de USA, por ejemplo escenarios… y el año
  // siguiente créalo también con una simulación"). El demo anterior (ago-2026) tenía
  // la casa propia y a la vez arriendo de apartamento, la cuota del carro contada dos
  // veces, categorías en inglés que el motor no reconocía como renta, y ningún
  // escenario. Este es el gemelo del demo de Colombia: una familia con patrimonio de
  // ~US$3M, tres inmuebles (uno que pierde plata), cuentas de retiro, una tarjeta cara
  // con efectivo de sobra al lado, ingresos variables, cinco escenarios a 10 años y dos
  // simulaciones del año entrante. Cifras verosímiles, no reales; nombres genéricos.
  // Categorías y tipos: claves canónicas (Salario/Arriendo… y tipo del IRS) para que
  // las pantallas de EE. UU. y las compartidas lean lo mismo.
  const demoUS=()=>{
    guardarReal(realAntesDemoRef,uRef.current);
    window.gtag?.("event","demo_opened",{method:"button",pais:"US"});
    showToast((uRef.current?.lang||"en")!=="es"?"Sample data loaded — the Johnson family, Austin TX":"Datos de ejemplo cargados — familia Johnson, Austin TX");
    setU(p=>{
      // Igual que el demo de Colombia: con sesión se conservan nombre y correo reales.
      const yaRegistrado=!!authUser;
      const nombreReal=(p?.p?.name&&p.p.name!=="Alex Johnson"&&p.p.name!=="Pedro Pérez")?p.p.name:"";
      const emailReal=(p?.p?.email&&!/^demo(-us)?@finpathia\.com$/.test(p.p.email))?p.p.email:"";
      const nombre=yaRegistrado&&nombreReal?nombreReal:"Alex Johnson";
      const nd=mkU(nombre,yaRegistrado&&emailReal?emailReal:"demo-us@finpathia.com");
      nd.p={name:nombre,email:yaRegistrado&&emailReal?emailReal:"demo-us@finpathia.com",
        plan:yaRegistrado?(p?.p?.plan||"pro"):"pro",
        trialEnd:yaRegistrado&&p?.p?.trialEnd?p.p.trialEnd:new Date(Date.now()+30*86400000).toISOString().split("T")[0],
        demo:true,anonymous:!yaRegistrado,bienvenidaVista:true};
      nd.jurisdiction="US";
      nd.lang=p?.lang||"en";
      const t=(es,en)=>(nd.lang==="es"?es:en);
      nd.trm=1;
      // Casados declarando juntos en Texas (sin impuesto estatal). Cambiar el estado a
      // California o Nueva York en Impuestos muestra el peso del impuesto estatal.
      nd.taxConfig={filingStatus:"married_jointly",state:"TX"};
      nd.owners=[{id:"own_1",name:nombre,type:"natural"},{id:"own_2",name:"Jordan Johnson",type:"natural"}];
      nd.inv=[
        {id:"us_a1",n:t("Casa — Austin, TX","Home — Austin, TX"),tp:"primary_home",ub:"Austin, TX",vc:680000,va:950000,owner:"own_1",moneda:"USD"},
        {id:"us_a2",n:t("Dúplex en arriendo — East Austin","Rental duplex — East Austin"),tp:"rental_res",ub:"Austin, TX",vc:360000,va:520000,owner:"own_1",moneda:"USD",valorizacionPct:"4"},
        // El dilema: la renta corta del condo apenas cubre hipoteca, HOA y limpieza.
        {id:"us_a3",n:t("Condo vacacional — Orlando, FL (renta corta)","Vacation condo — Orlando, FL (short-term rental)"),tp:"rental_res",ub:"Orlando, FL",vc:350000,va:410000,owner:"own_1",moneda:"USD",valorizacionPct:"3"},
        {id:"us_a4",n:"401(k) — Alex (Fidelity)",tp:"401k_trad",vc:300000,va:465000,owner:"own_1",moneda:"USD"},
        {id:"us_a5",n:"401(k) — Jordan (Vanguard)",tp:"401k_trad",vc:150000,va:210000,owner:"own_2",moneda:"USD"},
        {id:"us_a6",n:t("Roth IRA (los dos)","Roth IRAs (both)"),tp:"roth_ira",vc:100000,va:160000,owner:"own_1",moneda:"USD"},
        {id:"us_a7",n:"Brokerage — VTI / VXUS",tp:"stocks_etf",vc:240000,va:340000,owner:"own_1",moneda:"USD"},
        {id:"us_a8",n:t("Cuenta de alto rendimiento (Marcus)","High-yield savings (Marcus)"),tp:"cash_equiv",vc:95000,va:95000,owner:"own_1",moneda:"USD",tasa:"4.3"},
        {id:"us_a9",n:"Bitcoin & ETH",tp:"crypto",vc:45000,va:85000,owner:"own_1",moneda:"USD"},
        {id:"us_a10",n:t("Planes 529 — universidad de los hijos","529 plans — kids' college"),tp:"other_asset",vc:58000,va:72000,owner:"own_1",moneda:"USD"},
        {id:"us_a11",n:t("HSA — invertida","HSA — invested"),tp:"hsa",vc:35000,va:48000,owner:"own_1",moneda:"USD"},
        {id:"us_a12",n:"Tesla Model Y (2024)",tp:"vehicle",vc:52000,va:41000,owner:"own_1",moneda:"USD"},
      ];
      nd.deu=[
        {id:"us_d1",n:t("Hipoteca — casa en Austin","Mortgage — Austin home"),tp:"mortgage",mt:520000,pg:3650,ts:6.1,pl:300,owner:"own_1",vi:"us_a1",moneda:"USD"},
        {id:"us_d2",n:t("Hipoteca — dúplex East Austin","Mortgage — East Austin duplex"),tp:"mortgage",mt:245000,pg:1820,ts:7.25,pl:290,owner:"own_1",vi:"us_a2",moneda:"USD"},
        {id:"us_d3",n:t("Hipoteca — condo de Orlando","Mortgage — Orlando condo"),tp:"mortgage",mt:290000,pg:2240,ts:7.6,pl:320,owner:"own_1",vi:"us_a3",moneda:"USD"},
        {id:"us_d4",n:t("Crédito del carro — Tesla","Auto loan — Tesla"),tp:"auto",mt:28000,pg:690,ts:7.4,pl:44,owner:"own_1",vi:"us_a12",moneda:"USD"},
        {id:"us_d5",n:t("Préstamo estudiantil — Jordan","Student loans — Jordan"),tp:"student_loan",mt:24000,pg:340,ts:6.5,pl:84,owner:"own_2",moneda:"USD"},
        // Tarjeta al 24,99 % APR con $95K al 4,3 % al lado: el hallazgo que la app debe ver.
        {id:"us_d6",n:t("Chase Sapphire — tarjeta de crédito","Chase Sapphire — credit card"),tp:"credit_card",mt:12400,pg:450,ts:24.99,pl:36,owner:"own_1",moneda:"USD"},
      ];
      nd.ingresos=[
        {id:"us_i1",nombre:t("Salario — Alex (Austin Tech Co.)","Salary — Alex (Austin Tech Co.)"),categoria:"Salario",tipo:"w2",mensual:18500,moneda:"USD",owner:"own_1",fuente:"Austin Tech Co."},
        // Bono anual en marzo: el pico del año en Mes a mes.
        {id:"us_i2",nombre:t("Bono anual — Alex","Annual bonus — Alex"),categoria:"Salario",tipo:"w2",mensual:60000,frecuencia:"anual",mesPago:3,moneda:"USD",owner:"own_1",fuente:"Austin Tech Co."},
        {id:"us_i3",nombre:t("Salario — Jordan (Dell Medical)","Salary — Jordan (Dell Medical)"),categoria:"Salario",tipo:"w2",mensual:9200,moneda:"USD",owner:"own_2",fuente:"Dell Medical"},
        // Consultoría 1099 que cambia mes a mes: paga self-employment tax y pagos estimados.
        {id:"us_i4",nombre:t("Consultoría — clientes 1099","Consulting — 1099 clients"),categoria:"Honorarios",tipo:"1099nec",mensual:0,frecuencia:"variable",moneda:"USD",owner:"own_1",fuente:t("Clientes de asesoría","Advisory clients"),
         montosMensuales:[4200,2800,6500,3100,8200,4400,3900,7100,5200,9500,11000,6800]},
        {id:"us_i5",nombre:t("Arriendo — dúplex East Austin","Rent — East Austin duplex"),categoria:"Arriendo",tipo:"rental",mensual:3600,moneda:"USD",owner:"own_1",activoId:"us_a2",fuente:t("Inquilinos","Tenants")},
        // Renta corta: temporada alta en primavera, julio y diciembre.
        {id:"us_i6",nombre:t("Renta corta — condo de Orlando","Short-term rental — Orlando condo"),categoria:"Arriendo",tipo:"rental",mensual:0,frecuencia:"variable",moneda:"USD",owner:"own_1",activoId:"us_a3",fuente:"Airbnb",
         montosMensuales:[2400,3600,4100,3800,1900,2600,4200,3100,1500,1700,2300,4000]},
        {id:"us_i7",nombre:t("Dividendos — fondos indexados","Dividends — index funds"),categoria:"Dividendos",tipo:"qual_div",mensual:720,moneda:"USD",owner:"own_1",activoId:"us_a7",fuente:"Vanguard"},
        {id:"us_i8",nombre:t("Intereses — cuenta de alto rendimiento","Interest — high-yield savings"),categoria:"Intereses bancarios",tipo:"interest",mensual:340,moneda:"USD",owner:"own_1",activoId:"us_a8",fuente:"Marcus"},
      ];
      nd.gas={
        "Vivienda":[{id:"us_g1",c:t("Impuesto predial y seguro — casa","Property tax & insurance — home"),m:1450,owner:"own_1"},{id:"us_g2",c:t("Condo de Orlando — HOA, seguro y limpieza","Orlando condo — HOA, insurance & cleaning"),m:900,owner:"own_1"}],
        "Servicios":[{id:"us_g3",c:t("Servicios, internet y celulares","Utilities, internet & phones"),m:520,owner:"own_1"}],
        "Alimentación":[{id:"us_g4",c:t("Mercado","Groceries"),m:1350,owner:"own_1"},{id:"us_g5",c:t("Restaurantes y café","Dining out & coffee"),m:600,owner:"own_1"}],
        "Transporte":[{id:"us_g6",c:t("Seguro, carga y gasolina","Insurance, charging & gas"),m:380,owner:"own_1"}],
        "Salud":[{id:"us_g7",c:t("Seguro médico — familia","Health insurance — family"),m:1250,owner:"own_1"},{id:"us_g8",c:t("Gastos médicos de bolsillo","Out-of-pocket medical"),m:200,owner:"own_1"}],
        "Educación":[{id:"us_g9",c:t("Colegio privado de los hijos","Kids' private school"),m:2100,owner:"own_1"}],
        "Seguros":[{id:"us_g10",c:t("Seguro de vida y umbrella","Life & umbrella insurance"),m:210,owner:"own_1"}],
        "Entretenimiento":[{id:"us_g11",c:t("Viajes","Travel"),m:600,owner:"own_1"},{id:"us_g12",c:t("Streaming y suscripciones","Streaming & subscriptions"),m:140,owner:"own_1"}],
        "Personal":[{id:"us_g13",c:t("Ropa y cuidado personal","Clothing & personal care"),m:400,owner:"own_1"}],
      };
      // Mi futuro a 10 años: el mismo patrimonio, cinco ideas (como el demo de Colombia).
      // Lo que viene en todos: la universidad de los dos hijos (el 529 cubre una parte).
      const universidad={gastos:[{nombre:t("Universidad — el mayor (UT Austin, residente)","College — oldest (UT Austin, in-state)"),anual:32000,desde:3,anios:4},{nombre:t("Universidad — el menor","College — youngest"),anual:32000,desde:6,anios:4}],ingresos:[],activos:[]};
      const pagarCaras={us_d4:true,us_d5:true,us_d6:true};
      const pagaCadaMes=(nombre,monto,tasa)=>({preset:"custom",nombre,monto,anio:1,rendimientoNomPct:tasa,pctRecibe:100,moneda:"USD",fuente:"venta"});
      const f10=(id,nombre,descripcion,config)=>({id,nombre,descripcion,creado:"2026-11-03T12:00:00.000Z",config:{escenario:"base",decisiones:{},norte:"equilibrio",mezcla:null,nuevas:[],reinversiones:[],futuros:universidad,...config}});
      nd.futuro10={escenarios:[
        f10("us_f10_1",t("1 · Protección: blindar la familia","1 · Protection: bulletproof the family"),t("Quedar sin deudas salvo la casa y con un colchón grande: vender el condo de Orlando (su renta apenas cubre hipoteca, HOA y limpieza) y el cripto, pagar el carro, el préstamo estudiantil y la tarjeta, y dejar el resto en efectivo y bonos del Tesoro.","Be debt-free except the home and keep a deep cash cushion: sell the Orlando condo (its rent barely covers the mortgage, HOA and cleaning) and the crypto, pay off the car, student loans and the card, and park the rest in cash and Treasuries."),
          {decisiones:{us_a3:{accion:"vende"},us_a9:{accion:"vende"}},pagarDeudas:{us_d3:true,...pagarCaras},mezcla:{liquidez:30,renta:65,crecimiento:5}}),
        f10("us_f10_2",t("2 · Vivir de rentas","2 · Live off income"),t("Vender el condo de Orlando y la cuenta de inversión, pagar las deudas caras y armar una escalera de bonos del Tesoro y municipales que paga cada mes.","Sell the Orlando condo and the taxable brokerage, clear the expensive debt and build a Treasury and muni bond ladder that pays every month."),
          {decisiones:{us_a3:{accion:"vende"},us_a7:{accion:"vende"}},pagarDeudas:{us_d3:true,...pagarCaras},norte:"rentas",nuevas:[pagaCadaMes(t("Escalera de bonos del Tesoro y municipales (paga cada mes)","Treasury & muni bond ladder (pays monthly)"),380000,4.6)]}),
        // Caja: condo $410K − su hipoteca $290K − tarjeta $12K ≈ $108K → $100K a bonos.
        f10("us_f10_3",t("3 · Equilibrio","3 · Balanced"),t("Vender el condo de Orlando, pagar su hipoteca y la tarjeta, poner $100K en bonos que pagan cada mes y repartir lo que sobra mitad en bonos y mitad en fondos indexados.","Sell the Orlando condo, pay off its mortgage and the credit card, put $100K in bonds that pay monthly and let the monthly surplus go half to bonds, half to index funds."),
          {decisiones:{us_a3:{accion:"vende"}},pagarDeudas:{us_d3:true,us_d6:true},norte:"equilibrio",nuevas:[pagaCadaMes(t("Escalera de bonos (paga cada mes)","Bond ladder (pays monthly)"),100000,4.6)]}),
        // Caja: duplex $520K + condo $410K − sus hipotecas $535K − tarjeta $12K ≈ $383K al mercado.
        f10("us_f10_4",t("4 · Crecer en el mercado","4 · Grow in the market"),t("Dejar de ser arrendador: vender el dúplex y el condo de Orlando, pagar sus hipotecas y la tarjeta, y poner unos $380K en un portafolio indexado global. Líquido y diversificado, pero sube y baja.","Get out of landlording: sell the duplex and the Orlando condo, pay off their mortgages and the card, and put about $380K into a global index portfolio. Liquid and diversified, but it swings."),
          {decisiones:{us_a2:{accion:"vende"},us_a3:{accion:"vende"}},pagarDeudas:{us_d2:true,us_d3:true,us_d6:true},norte:"crecer",
           nuevas:[{preset:"sp500",nombre:t("Portafolio indexado global (VT)","Global index portfolio (VT)"),monto:380000,anio:1,pctRecibe:0,moneda:"USD",fuente:"venta"}]}),
        // Caja: cripto $85K + brokerage $340K − tarjeta $12K ≈ $413K → $250K de entrada al fourplex.
        f10("us_f10_5",t("5 · Crecer en finca raíz","5 · Grow in real estate"),t("Quedarse con todos los inmuebles y sumar uno: vender el cripto y la cuenta de inversión, pagar la tarjeta y poner $250K en un fourplex en San Antonio que renta y se valoriza.","Keep every property and add one: sell the crypto and the taxable brokerage, pay off the card and put $250K into a fourplex in San Antonio that rents and appreciates."),
          {decisiones:{us_a9:{accion:"vende"},us_a7:{accion:"vende"}},pagarDeudas:{us_d6:true},norte:"crecer",
           nuevas:[{preset:"custom",nombre:t("Fourplex — San Antonio, TX","Fourplex — San Antonio, TX"),monto:250000,anio:1,rendimientoNomPct:8.5,pctRecibe:70,moneda:"USD",fuente:"venta"}]}),
      ]};
      // Año entrante: dos simulaciones de 2027 ya armadas.
      const prox=new Date().getFullYear()+1;
      nd.escenarios=[
        {id:"us_esc_1",nombre:t(`Nuestro ${prox}`,`Our ${prox}`),año:prox,creado:"2026-11-03T12:00:00.000Z",descripcion:t("El aumento de Jordan, la tarjeta pagada en marzo y el mayor entra a la universidad en agosto","Jordan's raise, the credit card paid off in March and the oldest starts college in August"),cambios:[
          {id:"c1",tipo:"cambia",kind:"ing",ref:"ing:id:us_i3",nombre:t("Salario — Jordan (Dell Medical)","Salary — Jordan (Dell Medical)"),desdeMes:1,monto:"9800"},
          {id:"c2",tipo:"termina",kind:"deu",ref:"deu:id:us_d6",nombre:t("Chase Sapphire — tarjeta de crédito","Chase Sapphire — credit card"),desdeMes:3},
          {id:"c3",tipo:"nuevo",kind:"gas",nombre:t("Universidad — el mayor (UT Austin)","College — oldest (UT Austin)"),cat:"Educación",desdeMes:8,monto:"2700"},
          {id:"c4",tipo:"termina",kind:"gas",ref:"gas:Educación:id:us_g9",nombre:t("Colegio privado de los hijos","Kids' private school"),desdeMes:8},
          {id:"c5",tipo:"nuevo",kind:"gas",nombre:t("Colegio privado — solo el menor","Private school — youngest only"),cat:"Educación",desdeMes:8,monto:"1050"},
        ]},
        {id:"us_esc_2",nombre:t(`${prox} — vender el condo de Orlando`,`${prox} — sell the Orlando condo`),año:prox,creado:"2026-11-03T12:00:00.000Z",descripcion:t("Vender el condo en abril, pagar su hipoteca y poner la plata en bonos del Tesoro","Sell the condo in April, pay off its mortgage and put the cash in Treasuries"),cambios:[
          {id:"c1",tipo:"termina",kind:"ing",ref:"ing:id:us_i6",nombre:t("Renta corta — condo de Orlando","Short-term rental — Orlando condo"),desdeMes:4},
          {id:"c2",tipo:"termina",kind:"deu",ref:"deu:id:us_d3",nombre:t("Hipoteca — condo de Orlando","Mortgage — Orlando condo"),desdeMes:4},
          {id:"c3",tipo:"termina",kind:"gas",ref:"gas:Vivienda:id:us_g2",nombre:t("Condo de Orlando — HOA, seguro y limpieza","Orlando condo — HOA, insurance & cleaning"),desdeMes:4},
          {id:"c4",tipo:"nuevo",kind:"ing",nombre:t("Intereses de bonos del Tesoro (venta del condo)","Treasury interest (condo proceeds)"),cat:"Intereses bancarios",desdeMes:5,capital:"95000",tasa:"4.4",tasaModo:"anual",monto:"348"},
        ]},
      ];
      nd.pen={age:44,rAge:62,sv:2000,cur:675000,ret:7,inf:3,des:14000,btcC:10,btcP:85000};
      nd.metas=[];nd.ibk=[];
      return nd;
    });
  };
  const generatePDF=()=>{
    const fecha=new Date().toLocaleDateString("es-CO",{year:"numeric",month:"long",day:"numeric"});
    // BUG FIX 13-jun-2026: santiago reportó que el PDF incluía items apagados
    // (toggle OFF) en los cálculos como si estuvieran activos. El patrón del
    // sistema usa `item.sim !== false` para "encendido" (los items viejos sin
    // la prop sim también cuentan como encendidos por retrocompatibilidad).
    // Ver: DeudasModule:93, GastosModule:272, IngresosModule:213,
    // InversionesModule:89 — todos usan el mismo filtro.
    // Al filtrar acá en las 4 líneas iniciales, TODO el resto del PDF
    // (totales, conteos en h2, tablas, KPIs, runway, FIRE) se corrige en
    // cascada sin más cambios porque todo consume estas 4 variables.
    // Para gastos también se filtran categorías vacías (donde todos los
    // items quedaron apagados) para no imprimir headers vacíos.
    const inv=((u&&u.inv)||[]).filter(i=>i.sim!==false);
    const deu=((u&&u.deu)||[]).filter(d=>d.sim!==false);
    const gasRaw=(u&&u.gas)||{};
    const gas=Object.fromEntries(
      Object.entries(gasRaw)
        .map(([cat,items])=>[cat,(items||[]).filter(g=>g.sim!==false)])
        .filter(([,items])=>items.length>0)
    );
    const ing=((u&&u.ingresos)||[]).filter(i=>i.sim!==false);
    // Separar categorías: aportes obligatorios ("Seguridad Social") vs gastos familiares
    const gasCats=Object.entries(gas).map(([cat,items])=>({cat,total:items.reduce((s,g)=>s+montoPromedioMensual(g),0),esAporte:cat==="Seguridad Social"}))/* frecuencia: un gasto anual no es un gasto mensual (fix 25-jul-2026) */.sort((a,b)=>b.total-a.total);
    const aportesObligatorios=gasCats.filter(c=>c.esAporte).reduce((s,c)=>s+c.total,0);
    const gastosFamiliares=gasCats.filter(c=>!c.esAporte).reduce((s,c)=>s+c.total,0);
    const totalGas=aportesObligatorios+gastosFamiliares;
    const brutoTotal=ing.reduce((s,i)=>s+(montoPromedioMensual(i)*(i.moneda==="USD"?trm:1)),0);
    const totalDeu=deu.reduce((s,d)=>s+(d.mt||0),0);
    const totalCuotas=deu.reduce((s,d)=>s+(d.pg||0),0);
    const totalPat=inv.reduce((s,i)=>s+vaCOP(i,trm),0);
    // Retención + impuesto neto vienen del motor cT ya calculado (t)
    const retencionMensual=Math.round(t.retencionMensual||0);
    const impuestoNeto=Math.round(t.impuestoNeto||0);
    const disponibleCuenta=brutoTotal-retencionMensual;
    const egresosTotales=aportesObligatorios+gastosFamiliares+totalCuotas+impuestoNeto;
    const nw=totalPat-totalDeu;
    const cf=disponibleCuenta-egresosTotales;
    // Nivel e índice: misma base que el Dashboard y el Simulador (metrics.js).
    const ind=t.independencia||0;
    const level=t.nivel?.nombre||"Sin datos";
    const fireNum=egresosTotales*12*25;const firePct=fireNum>0?(nw/fireNum*100):0;
    const dta=totalPat>0?(totalDeu/totalPat*100):0;
    const runway=t.colchonMeses!=null?Math.round(t.colchonMeses*10)/10:0; // colchón único (metrics.js)
    const invRows=inv.map(i=>"<tr><td>"+(i.n||i.nombre||"")+"</td><td>"+(i.tp||i.tipo||"Otro")+"</td><td class=r>"+fm(vaCOP(i,trm))+"</td><td class=r "+(vaCOP(i,trm)>=vcCOP(i,trm)?"style=color:#00a804":"style=color:#e64800")+">"+fm(vaCOP(i,trm)-vcCOP(i,trm))+"</td></tr>").join("");
    const ingRows=ing.map(i=>"<tr><td>"+(i.nombre||"")+"</td><td>"+(i.categoria||"")+"</td><td class=r>"+fm(montoPromedioMensual(i)*(i.moneda==="USD"?trm:1))+"</td></tr>").join("");
    const gasRows=gasCats.map(g=>"<tr><td>"+g.cat+(g.esAporte?" <span style='font-size:9px;color:#f59e0b'>(aporte)</span>":"")+"</td><td class=r>"+fm(g.total)+"</td><td class=r>"+(brutoTotal>0?fmtPctEs((g.total/brutoTotal*100), 1):"—")+"</td></tr>").join("");
    const deuRows=deu.map(d=>"<tr><td>"+(d.n||"")+"</td><td class=r>"+fm(d.mt||0)+"</td><td class=r>"+fm(d.pg||0)+"</td><td class=r>"+fmtTasaEs(d.ts||0)+"</td></tr>").join("");
    // Bloque desglose family office (nuevo Fase 4)
    const desgloseFlujo="<div style='display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0 18px'>"
      +"<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px'>"
        +"<div style='font-size:9px;color:var(--fp-txt3);letter-spacing:1.2px;text-transform:uppercase;font-weight:700;margin-bottom:8px'>Ingresos Mensuales</div>"
        +"<div style='display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px'><span style='color:var(--fp-line)'>Bruto Total</span><span style='font-weight:500'>"+fm(brutoTotal)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:10px;margin-bottom:8px;padding-left:8px;border-left:2px solid #e5e7eb'><span style='color:#3b82f6'>− Retención (recuperable)</span><span style='color:#3b82f6'>−"+fm(retencionMensual)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:13px;font-weight:800;padding-top:7px;border-top:1px solid #d1d5db;color:#00a804'><span>= DISPONIBLE</span><span>"+fm(disponibleCuenta)+"</span></div>"
      +"</div>"
      +"<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px'>"
        +"<div style='font-size:9px;color:var(--fp-txt3);letter-spacing:1.2px;text-transform:uppercase;font-weight:700;margin-bottom:8px'>Egresos Mensuales</div>"
        +"<div style='display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px'><span style='color:#f59e0b'>A. Aportes obligatorios</span><span style='color:#f59e0b'>"+fm(aportesObligatorios)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px'><span>B. Gastos familiares</span><span>"+fm(gastosFamiliares)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px'><span>C. Cuotas deudas</span><span>"+fm(totalCuotas)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:10px;margin-bottom:6px'><span style='color:#3b82f6'>D. Impuesto neto estimado</span><span style='color:#3b82f6'>"+fm(impuestoNeto)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:13px;font-weight:800;padding-top:7px;border-top:1px solid #d1d5db;color:#e64800'><span>= EGRESOS TOTALES</span><span>"+fm(egresosTotales)+"</span></div>"
      +"</div>"
    +"</div>";
    const html="<!DOCTYPE html><html><head><title>Reporte FINPATHIA</title><style>:root{--fp-bg:#ffffff;--fp-card:#ffffff;--fp-raised:#f4f4f5;--fp-txt:#18181b;--fp-txt2:#52525b;--fp-txt3:#71717a;--fp-line:#d4d4d8;--fp-ink:0,0,0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;color:var(--fp-card);padding:32px 40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.6}h1{font-size:22px;font-weight:800}h2{font-size:15px;font-weight:700;margin:24px 0 8px;padding-bottom:4px;border-bottom:2px solid #00c805}.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #00c805}.logo{font-size:18px;font-weight:800;color:#00c805}.dt{font-size:11px;color:#888}.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:10px 0}.g4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin:10px 0}.k{background:#f8f8f8;border-radius:8px;padding:10px;border-left:3px solid #00c805}.kr{border-left-color:#ff5000}.kl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px}.kv{font-size:18px;font-weight:700;margin-top:2px}.ks{font-size:9px;color:#888;margin-top:2px}table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}th{text-align:left;padding:5px 8px;background:#f0f0f0;font-weight:600;font-size:9px;text-transform:uppercase;color:#666}td{padding:5px 8px;border-bottom:1px solid #eee}.r{text-align:right}.lb{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;margin:10px 0}.lt{font-size:18px;font-weight:700;color:#00a804}.ft{margin-top:28px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#aaa;text-align:center}.ds{font-size:8px;color:#ccc;margin-top:16px;text-align:center;line-height:1.4}@media print{body{padding:20px}@page{size:letter;margin:12mm}}</style></head><body>"
    +"<div class=hd><div><div class=logo>FINPATHIA</div><h1>Reporte Financiero Personal</h1></div><div style=text-align:right><div class=dt>"+fecha+"</div><div class=dt>"+(u?.p?.name||"Usuario")+"</div></div></div>"
    +"<div class=lb><div style=font-size:11px;color:#666>NIVEL DE LIBERTAD FINANCIERA</div><div class=lt>"+level+"</div><div style=font-size:13px;color:#333;margin-top:4px>Índice: "+fmtPctEs(ind, 1)+"</div></div>"
    +desgloseFlujo
    +"<div class=g4><div class=k><div class=kl>Patrimonio Neto</div><div class=kv>"+fm(nw)+"</div></div><div class=k><div class=kl>Disponible/mes</div><div class=kv>"+fm(disponibleCuenta)+"</div></div><div class='k "+(cf<0?"kr":"")+"'><div class=kl>Cash Flow/mes</div><div class=kv style=color:"+(cf>=0?"#00a804":"#e64800")+">"+fm(cf)+"</div></div><div class=k><div class=kl>FIRE Progress</div><div class=kv>"+fmtPctEs(firePct, 0)+"</div><div class=ks>Meta: "+fm(fireNum)+"</div></div></div>"
    +"<h2>Patrimonio ("+inv.length+" activos)</h2><div class=g3><div class=k><div class=kl>Activos</div><div class=kv>"+fm(totalPat)+"</div></div><div class='k kr'><div class=kl>Deudas</div><div class=kv>"+fm(totalDeu)+"</div></div><div class=k><div class=kl>Neto</div><div class=kv>"+fm(nw)+"</div></div></div>"
    +"<table><thead><tr><th>Activo</th><th>Tipo</th><th class=r>Valor</th><th class=r>Ganancia</th></tr></thead><tbody>"+invRows+"</tbody></table>"
    +"<h2>Ingresos ("+ing.length+" fuentes)</h2><table><thead><tr><th>Fuente</th><th>Categoría</th><th class=r>Bruto/mes</th></tr></thead><tbody>"+ingRows+"<tr style=font-weight:700;border-top:2px+solid+#333><td colspan=2>Total Bruto</td><td class=r>"+fm(brutoTotal)+"</td></tr></tbody></table>"
    +"<h2>Gastos ("+gasCats.length+" categorías)</h2><table><thead><tr><th>Categoría</th><th class=r>Monto/mes</th><th class=r>% Bruto</th></tr></thead><tbody>"+gasRows+"<tr style=font-weight:700;border-top:2px+solid+#333><td>Total</td><td class=r>"+fm(totalGas)+"</td><td class=r>"+(brutoTotal>0?fmtPctEs((totalGas/brutoTotal*100), 0):"—")+"</td></tr></tbody></table>"
    +(deu.length>0?"<h2>Deudas ("+deu.length+")</h2><table><thead><tr><th>Deuda</th><th class=r>Saldo</th><th class=r>Cuota/mes</th><th class=r>Tasa</th></tr></thead><tbody>"+deuRows+"<tr style=font-weight:700;border-top:2px+solid+#333><td>Total</td><td class=r>"+fm(totalDeu)+"</td><td class=r>"+fm(totalCuotas)+"</td><td></td></tr></tbody></table>":"")
    +"<h2>Indicadores</h2><div class=g3><div class=k><div class=kl>Independencia</div><div class=kv>"+fmtPctEs(ind)+"</div><div class=ks>Meta: 100%+</div></div><div class=k><div class=kl>Deuda/Activos</div><div class=kv>"+fmtPctEs(dta, 1)+"</div><div class=ks>Ideal: &lt;30%</div></div><div class=k><div class=kl>Runway</div><div class=kv>"+runway+" meses</div><div class=ks>Sin ingresos</div></div></div>"
    +"<div class=ds>Este reporte es generado por FINPATHIA con fines informativos. No constituye asesoría financiera profesional.</div>"
    +"<div class=ft>FINPATHIA — finpathia.com — "+fecha+"</div></body></html>";
    const w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);
  };

  const handleImport=(key,rows,isGastos)=>{if(isGastos){const g={...(u&&u.gas||{})};rows.forEach(r=>{const cat=r.cat||"Otro";if(!g[cat])g[cat]=[];g[cat].push({c:r.c,m:r.m,t:r.t})});upd("gas",g)}else{upd(key,[...((u&&u[key])||[]),...rows])}};

  // 21-oct-2026 — El signo va ANTES del peso. Antes salía "$-35.114.710" y
  // "$-35,1M": el menos quedaba entre el símbolo y el número.
  const fm=n=>{if(masked)return"$•••••";if(n==null||isNaN(n))return"$0";/* 3-nov-2026: en EE. UU. los montos ya están en dólares (trmPais = 1); no se convierten */const baseUSD=jurisdiction==="US";const enUSD=!baseUSD&&cur==="USD"&&trm>0;const v=enUSD?(n/trm):n;const loc=(enUSD||baseUSD)?"en-US":"es-CO";const sg=v<0?"-":"";const a=Math.abs(v);if(enUSD||baseUSD){if(a>=1e9)return sg+"$"+(a/1e9).toLocaleString(loc,{minimumFractionDigits:1,maximumFractionDigits:1})+"B";if(a>=1e6)return sg+"$"+(a/1e6).toLocaleString(loc,{minimumFractionDigits:1,maximumFractionDigits:1})+"M";}else{/* 31-oct-2026: un solo formato en pesos, en millones ($16.400 M); la «B» se confundía con billón */if(a>=1e8)return sg+"$"+Math.round(a/1e6).toLocaleString(loc)+" MM";if(a>=1e6)return sg+"$"+(a/1e6).toLocaleString(loc,{minimumFractionDigits:1,maximumFractionDigits:1})+" MM";}return sg+"$"+Math.round(a).toLocaleString(loc)};
  // Commit 23 Tarea 3: feedback honesto del estado de guardado.
  // Antes 'showToast' decia 'Guardado' inmediato, pero tecnicamente solo
  // era localStorage — el upsert a Supabase tenia debounce de 2s y podia
  // tardar mas. Generaba la duda '¿se guardo realmente?' que reporto el
  // usuario. Ahora el flujo es:
  //   1. upd() → toast 'Guardando...' (honesto: localStorage hecho, backend pendiente)
  //   2. sS() debounce 2s → upsert a Supabase
  //   3. Si OK → evento 'fp3-save-ok' → toast 'Sincronizado'
  //   4. Si error → evento 'fp3-save-error' → toast 'Error guardando'
  // 25-oct-2026: en modo consulta (prueba vencida, cuentas nuevas) no se guarda: se ofrece el plan.
  const upd=(k,v)=>{if(modoConsulta){setPaywall(true);return}showToast("Guardando…");setU(p=>p?{...p,[k]:v}:p);};
  // 28-oct-2026: admin por el correo de la SESIÓN verificada (authUser), no por
  // el correo del perfil, que vive en user_data y el propio usuario podría reescribir.
  const isAdmin=String(authUser?.email||"").toLowerCase()==="santiagososa1@me.com";
  const INVITADOS=["andres.isaza@grupogiesas.com","renatomaestri76@hotmail.com"];
  const getTrialDays=(email)=>INVITADOS.includes(email)?30:14;
  const trialEnd=u?.p?.trialEnd;
  const trialActive=trialEnd&&new Date(trialEnd)>=new Date();
  const trialDays=trialEnd?Math.max(0,Math.ceil((new Date(trialEnd)-new Date())/(86400000))):0;
  // Resolución del plan: prioridad
  //   1. isAdmin → "pro" (acceso total para admins de Anthropic/staff)
  //   2. trialActive → "pro" (durante trial 14d, mismo acceso que pro)
  //   3. planAccount === "pro_familiar" → "pro_familiar" (de la tabla accounts,
  //      vía useAccount hook). Es la fuente de verdad cuando el user tiene
  //      cuenta multi-usuario activa.
  //   4. u?.p?.plan → plan legacy guardado en user_data.data.p.plan
  //      (free, basico, pro)
  // Pro Familiar es VISUALMENTE distinto a Pro (badge, label, pricing card),
  // pero EN TÉRMINOS DE GATING tiene el mismo o mayor acceso. Para checks de
  // features usa hasProAccess en lugar de plan==="pro" donde aplique.
  const plan=isAdmin?"pro":trialActive?"pro":(planAccount==="pro_familiar"?"pro_familiar":(u?.p?.plan||"free"));
  // Helper: ¿tiene acceso a features Pro o superiores?
  // Usar este en gates de features. plan==="pro" es solo para "soy plan Pro
  // exacto" (ej. mostrar 'Plan actual' en pricing card del plan Pro).
  const hasProAccess=plan==="pro"||plan==="pro_familiar"||plan==="advisor_pro";
  // ═══ 25-oct-2026 — MODO CONSULTA (Santiago: "que se registren, la usen y a los X días aviso de cobro") ═══
  // Ya no hay plan gratis para elegir: todos entran con 14 días de Pro. Al vencer, la cuenta queda en
  // consulta: ve todos sus datos, su nivel y su panel, pero para agregar o editar elige un plan.
  // Aplica a toda prueba que vence desde el 26-oct-2026; quienes ya estaban en gratis siguen como estaban.
  const CONSULTA_DESDE="2026-10-26";
  // 5-nov-2026 (Santiago: "¿plan Free? ¿no se supone que no va más?"). Un plan pagado que vence
  // (pago único sin renovar, suscripción cancelada) también queda en consulta, no en un Free con funciones.
  const planVencido=subscriptionStatus==="expired";
  const modoConsulta=!isAdmin&&plan==="free"&&!u?.p?.anonymous&&(planVencido||(!!trialEnd&&!trialActive&&String(trialEnd).slice(0,10)>=CONSULTA_DESDE));
  modoConsultaRef.current=modoConsulta;
  const ultimoNivelRef=useRef((()=>{try{return JSON.parse(localStorage.getItem("fp3_ultimo_nivel")||"null")}catch{return null}})());
  // 29-oct-2026: el impuesto de toda la plataforma es el «referente»: anclado en la
  // declaración de cada titular cuando la hay (ver lib/impuestoReferente.js).
  // Año en curso: la declaración real del año anterior. Años siguientes (Simulador Futuro): el estimado.
  // Guarda una declaración en el titular (máximo 4 años; si el año ya existe, se reemplaza).
  const guardarDeclaracion=(ownerId,declaracion)=>{
    const owners=(u&&u.owners||[]).map(o=>{
      if(o.id!==ownerId)return o;
      const actuales=Array.isArray(o.declaraciones)?[...o.declaraciones]:[];
      const anoNuevo=Number(declaracion.anoGravable)||0;
      const idx=actuales.findIndex(d=>Number(d?.anoGravable)===anoNuevo);
      if(idx>=0){actuales[idx]=declaracion}else{actuales.push(declaracion)}
      actuales.sort((a,b)=>(Number(b?.anoGravable)||0)-(Number(a?.anoGravable)||0));
      return{...o,declaraciones:actuales.slice(0,4)};
    });
    upd("owners",owners);
    const ow=owners.find(o=>o.id===ownerId);
    showToast("Declaración "+declaracion.anoGravable+" guardada en "+(ow?.name||"el titular"));
  };
  const calRef=useMemo(()=>{try{return u?calibracionReferente(u,{modo:"actual"}):{}}catch{return{}}},[u]);
  const calRefFuturo=useMemo(()=>{try{return u?calibracionReferente(u,{modo:"estimado"}):{}}catch{return{}}},[u]);
  const impRef=useMemo(()=>{if(!u)return{total:0,mes:0,detalle:[]};try{return estimarImpuestoReferente(u,calRef)}catch{return estimarImpuesto(u)}},[u,calRef]);
  const t=useMemo(()=>{if(!u)return{};const base=cT(u.inv,u.deu,u.gas,u.ingresos,impRef,trmPais,u.inflacionPct);return totalesConTasa(base,estTrmPais,ultimoNivelRef.current)},[u,trm,trmPais,estTrm.modo,impRef]);
  useEffect(()=>{if(t&&t.nivel&&!t.pendienteTasa){ultimoNivelRef.current=t.nivel;try{localStorage.setItem("fp3_ultimo_nivel",JSON.stringify(t.nivel))}catch{}}},[t]);
  // ═══ 11-oct-2026 — ACTIVACIÓN = «primer activo cargado» (copy v3) ═══
  // Cuando la persona tiene al menos un activo en Patrimonio (u.inv), el
  // navegador AVISA a track-activation con solo UTM + ángulo de entrada. El
  // servidor no le cree: comprueba él mismo en user_data que la lista de
  // activos no está vacía (sin leer valores) y marca activated_at una sola
  // vez. Nunca se manda el activo, su valor ni conteos. Como el guardado en
  // Supabase va con 2 s de espera, si el servidor aún no ve el activo
  // (activo:false) se reintenta al confirmarse el siguiente guardado
  // (fp3-save-ok) o en la próxima carga. Solo en la vista personal: un
  // asesor mirando a un cliente no activa su propia cuenta.
  const tieneActivo=!!(u&&!esDemo(u)&&Array.isArray(u.inv)&&u.inv.length>0);
  useEffect(()=>{
    if(!tieneActivo||!authUser?.id||viewMode!=="personal")return;
    const k="fp3_activacion_"+authUser.id;
    try{if(localStorage.getItem(k))return;}catch{}
    let enCurso=false,listo=false;
    const avisar=()=>{
      if(enCurso||listo)return;enCurso=true;
      const ent=leerEntrada();
      fetchAuth("/api/track-activation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({utm:ent.utm,angle:ent.angle})})
        .then(r=>r.ok?r.json():null).then(d=>{if(d&&d.ok&&d.activo!==false){listo=true;try{localStorage.setItem(k,"1")}catch{}}}).catch(()=>{}).finally(()=>{enCurso=false;});
    };
    avisar();
    window.addEventListener("fp3-save-ok",avisar);
    return ()=>window.removeEventListener("fp3-save-ok",avisar);
  },[tieneActivo,authUser?.id,viewMode]);
  // ═══ 11-oct-2026 — simulator_used (Analítica: medir la v2 de los correos) ═══
  // Primera vez que abre el simulador (año en curso "sim" o futuro "simf").
  // Mismo camino que la activación: solo la bandera + UTM + ángulo, sesión
  // verificada, el servidor marca simulator_first_used_at una vez. Un solo
  // intento por carga de página (ref) y bandera en localStorage al lograrlo.
  // No cuenta cuando un asesor está viendo a un cliente.
  const simIntentado=useRef(false);
  useEffect(()=>{
    if((pg!=="sim"&&pg!=="simf")||simIntentado.current||!authUser?.id||viewMode!=="personal")return;
    const k="fp3_simulador_"+authUser.id;
    try{if(localStorage.getItem(k))return;}catch{}
    simIntentado.current=true;
    const ent=leerEntrada();
    fetchAuth("/api/track-activation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"simulator_used",utm:ent.utm,angle:ent.angle})})
      .then(r=>r.ok?r.json():null).then(d=>{if(d&&d.ok){try{localStorage.setItem(k,"1")}catch{}}}).catch(()=>{});
  },[pg,authUser?.id,viewMode]);
  // ═══ 11-oct-2026 — ENLACES DE LOS CORREOS (?ir=dash|sim|inv|price) ═══
  // Los botones de los correos de la prueba abren una sección concreta.
  // Lista cerrada de destinos; se lee una vez cuando ya hay datos cargados.
  const irAplicado=useRef(false);
  useEffect(()=>{
    if(!u||irAplicado.current||typeof window==="undefined")return;
    irAplicado.current=true;
    try{
      const ps=new URLSearchParams(window.location.search);
      const ir=ps.get("ir");
      if(ir&&["dash","sim","inv","price"].includes(ir))setPg(ir);
      if(ir){ps.delete("ir");const q=ps.toString();window.history.replaceState({},"",window.location.pathname+(q?"?"+q:""));}
    }catch{}
  },[u]);
  const ib=useMemo(()=>{if(!u?.ibk?.length)return{tc:0,tv:0,pnl:0,pp:0,pos:[]};let tc=0,tv=0;const pos=u.ibk.map(p=>{
    // 26-jul-2026 (Santiago: "¿y si la persona tiene opciones qué hace?").
    // Un contrato de opción representa 100 acciones: su valor es
    // precio × contratos × 100. El cálculo asumía acciones sueltas, así que
    // una posición de opciones aparecía 100 VECES MÁS CHICA de lo real.
    // En su cuenta son 5 posiciones por USD $6.748 —el 20% del portafolio—
    // que figuraban como $67. `mult` guarda el multiplicador; sin él se asume
    // 1 y nada cambia para las acciones ya cargadas.
    const mult=p.mult||1;
    const va=p.sh*p.pr*mult,cbb=p.sh*p.cb*mult,pnl=va-cbb,pp=cbb>0?((va/cbb)-1)*100:0,up=(p.pr>0&&p.tg>0)?((p.tg/p.pr)-1)*100:null;tc+=cbb;tv+=va;return{...p,va,cbb,pnl,pp,up}});return{tc,tv,pnl:tv-tc,pp:tc>0?((tv/tc)-1)*100:0,pos}},[u?.ibk]);
  const pen=useMemo(()=>{if(!u)return{};const p=u.pen||{},yrs=Math.max(0,(p.rAge||60)-(p.age||35)),mr=(p.ret||7)/100/12;let fv=+(p.cur||0);for(let m=0;m<yrs*12;m++)fv=fv*(1+mr)+(+(p.sv||0));const rfv=fv/Math.pow(1+(p.inf||3)/100,yrs),mo=rfv>0?rfv*0.04/12:0;const proj=[];let rv=+(p.cur||0);for(let y=0;y<=yrs;y++){proj.push({age:(p.age||35)+y,val:Math.round(rv)});for(let m=0;m<12&&y<yrs;m++)rv=rv*(1+mr)+(+(p.sv||0))}let ba=0;const bc=(p.btcC||10)/100,bp=p.btcP||50000;for(let y=1;y<=yrs;y++)for(let m=1;m<=12;m++)ba+=(+(p.sv||0))/(bp*Math.pow(1+bc,((y-1)*12+m)/12));const bfv=ba*bp*Math.pow(1+bc,yrs),bmo=(bfv*.04)/12;return{yrs,fv:Math.round(rfv),mo:Math.round(mo),ok:mo>=(p.des||6000),gap:Math.max(0,(p.des||6000)-mo),proj,ba,bfv,bmo:Math.round(bmo)}},[u?.pen]);
  const simT=useMemo(()=>{const im={actual:1,conservador:.8,optimista:1.3,crisis:.6},gm={actual:1,conservador:1.1,optimista:.85,crisis:1.05};const sni=t.ni*(im[simS]||1),sgf=t.gfm*(gm[simS]||1),ste=sgf+t.tc,scf=sni-ste;return{...t,ni:sni,gfm:sgf,te:ste,cf:scf,ind:ste>0?(sni/ste)*100:0}},[t,simS]);
  if(ld)return<LoadingScreen/>;

  // ═══ INVITE ROUTE ═══
  // URL /invite/:token → renderizar AcceptInvite independiente de sesión
  // Debug observabilidad: ?debug=1 en la URL abre el dashboard de analytics
  {
    if(typeof window!=="undefined"){
      const search=window.location.search||"";
      if(search.includes("debug=1")){
        return<DashboardObservabilidad onClose={()=>{window.history.pushState({},'',window.location.pathname);window.location.reload()}}/>;
      }
    }
  }

  // El componente maneja validación, signup/login, y vinculación al asesor.
  {
    const pathname=typeof window!=="undefined"?window.location.pathname:"";
    const inviteMatch=pathname.match(/^\/invite\/([A-Za-z0-9_-]+)\/?$/);
    if(inviteMatch){
      // index.html saca el token de la URL (queda /invite/_) y lo deja en memoria.
      const token=inviteMatch[1]==="_"?(window.__fpInviteToken||(()=>{try{return sessionStorage.getItem("fp3_invite_token")||""}catch{return ""}})()):inviteMatch[1];
      return<AcceptInvite token={token} onComplete={()=>{try{sessionStorage.removeItem("fp3_invite_token")}catch{};window.location.href="/"}}/>;
    }
  }

  if(!u&&!showAuth){
    // Route: /asesores → Landing dedicada para contadores/asesores (Plan PRO Corporativo)
    const pathname=typeof window!=="undefined"?window.location.pathname:"";
    if(pathname==="/asesores"||pathname==="/asesores/"){
      return<LandingAsesores onGetStarted={(planKey)=>{track("signup_modal_opened",{from:"asesores",plan_intent:planKey});setShowAuth(true);if(planKey)sessionStorage.setItem("fp3_advisor_plan_intent",planKey)}}/>;
    }
    // Sesión 1-may-2026: rutas preview hidden para comparar variantes de hero.
    // El landing oficial sigue en /. /hero-a y /hero-b son temporales para
    // que Santiago elija la dirección antes de hacer el cambio definitivo.
    if(pathname==="/hero-a"||pathname==="/hero-a/"){
      return<HeroVariantA onGetStarted={()=>setShowAuth(true)}/>;
    }
    if(pathname==="/hero-b"||pathname==="/hero-b/"){
      return<HeroVariantB onGetStarted={()=>setShowAuth(true)}/>;
    }
    if(pathname==="/hero-c"||pathname==="/hero-c/"){
      return<HeroVariantC onGetStarted={()=>setShowAuth(true)}/>;
    }
    // Sesión 3-may-2026: campaña Pioneros 2026 (50 plazas, 3 meses gratis Pro)
    // BUG FIX: el modal por default abría en MODO LOGIN, lo que confundía a
    // los pioneros nuevos (intentaban login con un email que nunca crearon
    // y veían "email o contraseña incorrectos"). Forzamos signup al venir
    // de /pioneros.
    // 17-oct-2026: landing /patrimonio. Los CTA abren el registro directo;
    // "Iniciar sesión" abre la pestaña Ingresar.
    if(pathname==="/patrimonio"||pathname==="/patrimonio/"){
      return<><LandingPatrimonio onLogin={()=>{sAM("login");track("login_modal_opened",{from:"patrimonio"});setShowAuth(true)}} onGetStarted={(ctaId)=>{sAM("signup");track("cta_click",{cta_id:ctaId});track("signup_modal_opened",{from:"patrimonio"});setShowAuth(true)}}/></>;
    }
    // 20-oct-2026: landing /libertad. El norte en un minuto, sin cuenta; el
    // registro hereda las tres cifras (fp3_norte).
    if(pathname==="/libertad"||pathname==="/libertad/"){
      return<Suspense fallback={null}><LandingLibertad onLogin={()=>{sAM("login");track("login_modal_opened",{from:"libertad"});setShowAuth(true)}} onGetStarted={(ctaId)=>{sAM("signup");track("cta_click",{cta_id:ctaId});track("signup_modal_opened",{from:"libertad"});setShowAuth(true)}}/></Suspense>;
    }
    if(pathname==="/pioneros"||pathname==="/pioneros/"){
      return<LandingPioneros onGetStarted={()=>{track("signup_modal_opened",{from:"pioneros"});sAM("signup");setShowAuth(true)}}/>;
    }
    // Sesión 3-may-2026: página /seguridad — explica el stack de seguridad
    // (Stripe + Supabase + AWS) a usuarios desconfiados que preguntan
    // "¿qué tan seguro es?". Linkeable desde footer y modales de signup.
    if(pathname==="/seguridad"||pathname==="/seguridad/"){
      return<LandingSeguridad/>;
    }
    // Sesión 4-may-2026: documentos legales — Términos y Privacidad cumpliendo
    // Ley 1581/2012 Colombia y principios CCPA/GDPR para users US/EU.
    // Linkeable desde footer y obligatorio aceptar al hacer signup.
    if(pathname==="/terminos"||pathname==="/terminos/"){
      return<LandingTerminos/>;
    }
    if(pathname==="/privacidad"||pathname==="/privacidad/"){
      return<LandingPrivacidad/>;
    }
    // 12-oct-2026 (Andrés Gómez no podía entrar): el botón "Iniciar sesión" de la
    // landing abría la pestaña CREAR CUENTA. Un cliente que ya existe ponía su
    // email y contraseña y recibía "este email ya tiene cuenta". Ahora abre Ingresar.
    return<><LandingPage onLogin={()=>{sAM("login");track("login_modal_opened",{from:"home"});setShowAuth(true)}} onGetStarted={(meta)=>{const from=meta?.source||"home";sAM("signup");track("signup_modal_opened",{from,...(meta?.dias_restantes!=null?{dias_restantes:meta.dias_restantes}:{})});setShowAuth(true)}}/><PWAInstallPrompt/></>;
  }
  if(!u)return<div style={{background:T.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui",color:T.tx}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:var(--fp-bg)}input:focus,select:focus{border-color:#00c805!important;outline:none}`}</style>
    {/* Modal SOLICITAR recuperación: el usuario escribe su email acá */}
    {showRecoveryRequest&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
      <div style={{background:T.bg2,border:`1px solid ${T.borderL||T.border}`,borderRadius:12,width:"100%",maxWidth:460,padding:"clamp(20px, 5vw, 32px)",position:"relative"}}>
        <button onClick={()=>{setShowRecoveryRequest(false);setResetSent(false);setResetError("")}} style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:20}}>✕</button>
        <div style={{fontSize:32,marginBottom:8,textAlign:"center"}}></div>
        <h2 style={{fontSize:20,fontWeight:700,textAlign:"center",marginBottom:8,color:T.tx}}>Recuperar contraseña</h2>
        {!resetSent?<>
          <p style={{fontSize:13,color:T.tx3,textAlign:"center",marginBottom:20,lineHeight:1.5}}>
            Escribe tu email y te enviaremos un link para crear una contraseña nueva.
          </p>
          <input
            type="email"
            placeholder="tu@email.com"
            value={recoveryEmail}
            onChange={(e)=>{setRecoveryEmail(e.target.value);setResetError("")}}
            autoFocus
            onKeyDown={(e)=>{if(e.key==="Enter"&&recoveryEmail)document.getElementById("btn-send-recovery")?.click()}}
            style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",color:T.tx,fontSize:14,outline:"none",marginBottom:12}}
          />
          {resetError&&<div style={{color:T.rd,fontSize:12,marginBottom:12,padding:"8px 12px",background:T.rdB,borderRadius:8}}>{resetError}</div>}
          <button
            id="btn-send-recovery"
            onClick={async()=>{
              if(!recoveryEmail||!recoveryEmail.includes("@")){setResetError("Escribe un email válido");return}
              setResetLoading(true);setResetError("");
              try{
                const{error}=await supabase.auth.resetPasswordForEmail(recoveryEmail,{
                  redirectTo:window.location.origin+"/"
                });
                if(error)throw error;
                setResetSent(true);
              }catch(e){setResetError("No pudimos enviar el email: "+e.message)}
              finally{setResetLoading(false)}
            }}
            disabled={resetLoading}
            style={{width:"100%",background:resetLoading?T.tx3:T.gn,color:"#000",border:"none",padding:"12px 20px",borderRadius:10,cursor:resetLoading?"wait":"pointer",fontWeight:700,fontSize:14}}
          >
            {resetLoading?"Enviando...":"Enviar link de recuperación"}
          </button>
        </>:<>
          <div style={{fontSize:48,textAlign:"center",marginBottom:12}}></div>
          <p style={{fontSize:14,color:T.tx,textAlign:"center",marginBottom:12,lineHeight:1.5,fontWeight:600}}>
            Email enviado a <span style={{color:T.gn}}>{recoveryEmail}</span>
          </p>
          <p style={{fontSize:12,color:T.tx3,textAlign:"center",marginBottom:20,lineHeight:1.6}}>
            Revisa tu bandeja de entrada y la carpeta de spam. El link expira en 1 hora. Cuando lo abras vas a volver acá para crear tu nueva contraseña.
            {" "}<strong>Ábrelo en este mismo navegador</strong>, en la misma pestaña o una nueva; si lo abres en otro dispositivo no va a funcionar.
            ¿No funciona? Escríbenos a soporte@finpathia.com.
          </p>
          <button onClick={()=>{setShowRecoveryRequest(false);setResetSent(false)}} style={{width:"100%",background:T.bg3,color:T.tx,border:`1px solid ${T.border}`,padding:"12px 20px",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:13}}>
            Cerrar
          </button>
        </>}
      </div>
    </div>}
    {/* Modal de nueva contraseña tras click en link del email */}
    {showResetPassword&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
      <div style={{background:T.bg2,border:`1px solid ${T.borderL||T.border}`,borderRadius:12,width:"100%",maxWidth:460,padding:"clamp(20px, 5vw, 32px)"}}>
        <div style={{fontSize:32,marginBottom:8,textAlign:"center"}}></div>
        <h2 style={{fontSize:20,fontWeight:700,textAlign:"center",marginBottom:8,color:T.tx}}>Nueva contraseña</h2>
        <p style={{fontSize:13,color:T.tx3,textAlign:"center",marginBottom:24,lineHeight:1.5}}>
          Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
        </p>
        <input
          type="password"
          placeholder="Nueva contraseña (mínimo 8 caracteres)"
          value={resetNewPassword}
          onChange={(e)=>{setResetNewPassword(e.target.value);setResetError("")}}
          autoFocus
          style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",color:T.tx,fontSize:14,outline:"none",marginBottom:12}}
        />
        {resetError&&<div style={{color:T.rd,fontSize:12,marginBottom:12,padding:"8px 12px",background:T.rdB,borderRadius:8}}>{resetError}</div>}
        <button
          onClick={async()=>{
            if(resetNewPassword.length<8){setResetError("La contraseña debe tener al menos 8 caracteres");return}
            setResetLoading(true);setResetError("");
            try{
              const{error}=await supabase.auth.updateUser({password:resetNewPassword});
              if(error)throw error;
              // IMPORTANTE: después de cambiar password, Supabase mantiene la sesión abierta
              // con el token del recovery. Cerramos sesión para forzar login limpio con la
              // contraseña nueva. Esto evita que queden sesiones raras por el reset.
              await supabase.auth.signOut({scope:"local"});
              _encKey=null;
              setShowResetPassword(false);
              setResetNewPassword("");
              setAuthError("Contraseña actualizada. Inicia sesión con la nueva.");
              sAM("login");
            }catch(e){setResetError("No pudimos actualizar: "+e.message)}
            finally{setResetLoading(false)}
          }}
          disabled={resetLoading}
          style={{width:"100%",background:resetLoading?T.tx3:T.gn,color:"#000",border:"none",padding:"12px 20px",borderRadius:10,cursor:resetLoading?"wait":"pointer",fontWeight:700,fontSize:14}}
        >
          {resetLoading?"Actualizando...":"Actualizar contraseña"}
        </button>
        <div style={{marginTop:16,padding:"10px 12px",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:8,fontSize:12,color:T.tx3,lineHeight:1.5}}>
          Al cambiar tu contraseña conservas tus datos y tu plan.
        </div>
      </div>
    </div>}
    <div style={{width:"100%",maxWidth:420,padding:"clamp(24px, 6vw, 40px) clamp(20px, 5vw, 32px)"}}>
      <div onClick={()=>setShowAuth(false)} style={{fontSize:13,color:T.tx3,cursor:"pointer",marginBottom:24}}>← Volver</div>
      {/* 25-oct-2026 (Santiago: "que se registren de una"): en registro el formulario va primero; la seguridad, en una línea debajo del botón. */}
      {!__enLandingPatrimonio&&aM!=="signup"&&<div style={{background:"rgba(0,200,5,0.04)",border:"1px solid rgba(0,200,5,0.1)",borderRadius:12,padding:"12px 16px",marginBottom:20,fontSize:12,color:T.tx3,lineHeight:2}}>
        <span style={{color:T.gn}}>✓</span> <strong style={{color:T.tx2}}>Conexión cifrada</strong> · tus datos viajan por HTTPS y se guardan cifrados en el servidor<br/>
        <span style={{color:T.gn}}>✓</span> Solo tu cuenta y las personas que invites pueden verlos en la app<br/>
        <span style={{color:T.gn}}>✓</span> No vendemos tus datos. Sin publicidad dentro de la app<br/>
        <span style={{color:T.gn}}>✓</span> Exporta o borra todo en cualquier momento
      </div>}
      <div style={{fontSize:28,fontWeight:700,background:"linear-gradient(135deg,#00c805,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:20}}>FINPATHIA</div>
      <div role="tablist" aria-label="Crear cuenta o ingresar" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,marginBottom:24,borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`,background:T.bg2}}>
        <button type="button" role="tab" aria-selected={aM==="signup"} onClick={()=>sAM("signup")} style={{padding:"12px 10px",border:"none",borderBottom:aM==="signup"?`3px solid ${T.gn}`:"3px solid transparent",background:aM==="signup"?T.gnB:"transparent",color:aM==="signup"?T.gn:T.tx3,fontWeight:700,fontSize:14,cursor:"pointer"}}>Crear cuenta</button>
        <button type="button" role="tab" aria-selected={aM==="login"} onClick={()=>sAM("login")} style={{padding:"12px 10px",border:"none",borderBottom:aM==="login"?`3px solid ${T.gn}`:"3px solid transparent",background:aM==="login"?T.gnB:"transparent",color:aM==="login"?T.gn:T.tx3,fontWeight:700,fontSize:14,cursor:"pointer"}}>Ingresar</button>
      </div>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:6}}>{aM==="login"?"Inicia sesión":sessionStorage.getItem("fp3_promo_code")==="PIONEROS2026"?"Acceso Pioneros":"Crea tu cuenta gratis"}</h2>
      {aM==="signup"&&__norteLanding&&<div style={{background:T.gnB,border:`1px solid ${T.gn}`,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontSize:12,color:T.tx3,letterSpacing:1}}>Tu norte</div>
        <div style={{fontSize:18,fontWeight:700,color:T.gn}}>Nivel {__norteLanding.nivel} de 5 · {__norteLanding.nombre}</div>
        <div style={{fontSize:13,color:T.tx2,marginTop:2}}>{__norteLanding.mesesCubiertos!=null?`${(Math.round(__norteLanding.mesesCubiertos*10)/10).toLocaleString("es-CO")} meses de vida cubiertos`:""}{__norteLanding.siguiente&&__norteLanding.añosConSobrante>0?` · ${Math.round(__norteLanding.añosConSobrante)} años para subir de nivel`:""}</div>
        <div style={{fontSize:12,color:T.tx3,marginTop:4}}>Crea tu cuenta para guardarlo: tus tres cifras quedan cargadas y ves qué mover para llegar antes.</div>
      </div>}
      <p style={{color:T.tx3,fontSize:14,marginBottom:28}}>{aM==="login"?"Accede a tu patrimonio":sessionStorage.getItem("fp3_promo_code")==="PIONEROS2026"?"14 días de prueba + 3 meses gratis del Plan Pro":"14 días de acceso Pro incluidos"}</p>
      <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
        {aM==="login"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
          <label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:1}}>Ingresar como</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{v:"client",icon:"",label:"Cliente"},{v:"advisor",icon:"",label:"Asesor"}].map(o=>{
              const sel=loginRole===o.v;
              return<button key={o.v} type="button" onClick={()=>{setLoginRole(o.v);setAuthError("")}} style={{padding:"12px",borderRadius:10,border:"2px solid "+(sel?T.gn:T.border),background:sel?T.gnB:T.bg2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:sel?T.gn:T.tx2,fontWeight:sel?700:400,fontSize:13,transition:"all .15s"}}>
                <span style={{fontSize:18}}>{o.icon}</span>{o.label}
              </button>})}
          </div>
          <div style={{fontSize:11,color:T.tx3,marginTop:2}}>{loginRole==="advisor"?"Acceso al workspace de asesor (requiere plan Asesor)":"Acceso a tu dashboard personal"}</div>
        </div>}
        {GOOGLE_LOGIN&&loginRole!=="advisor"&&<>
          <button type="button" onClick={entrarConGoogle} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%",padding:"13px",borderRadius:12,border:"1px solid "+T.border,background:"#fff",color:"#111",fontWeight:700,fontSize:15,cursor:"pointer"}}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="rgb(255,193,7)" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="rgb(255,61,0)" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="rgb(76,175,80)" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="rgb(25,118,210)" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            {aM==="signup"?"Crear cuenta con Google":"Entrar con Google"}
          </button>
          {aM==="signup"&&<div style={{fontSize:12,color:T.tx3,textAlign:"center",marginTop:-8}}>Al continuar con Google aceptas los Términos y la Política de Privacidad.</div>}
          <div style={{display:"flex",alignItems:"center",gap:10,color:T.tx3,fontSize:12}}><div style={{flex:1,height:1,background:T.border}}/>o con tu correo<div style={{flex:1,height:1,background:T.border}}/></div>
        </>}
        <In l="Email" value={aF.e} onChange={v=>sAF(p=>({...p,e:v}))} type="email" placeholder="tu@email.com"/>
        <In l={aM==="signup"?"Contraseña (mínimo 8 caracteres)":"Contraseña"} value={aF.p} onChange={v=>sAF(p=>({...p,p:v}))} type="password" placeholder="••••••••"/>
        {aM==="signup"&&(()=>{const pais=aF.country||__paisDetectado;return<div style={{fontSize:12,color:T.tx3}}>
          {pais==="US"?"United States":"Colombia"} · <span role="button" onClick={()=>sAF(p=>({...p,country:pais==="US"?"CO":"US"}))} style={{color:T.gn,cursor:"pointer",fontWeight:600}}>{pais==="US"?"¿Vives en Colombia?":"¿Vives en Estados Unidos?"}</span>
        </div>})()}
        {aM==="signup"&&<label style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 4px",cursor:"pointer",userSelect:"none"}}>
          <input
            type="checkbox"
            checked={!!aF.acceptTerms}
            onChange={e=>sAF(p=>({...p,acceptTerms:e.target.checked}))}
            style={{marginTop:2,width:16,height:16,accentColor:T.gn,cursor:"pointer",flexShrink:0}}
          />
          <span style={{fontSize:12,color:T.tx2,lineHeight:1.5}}>
            Acepto los <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{color:T.gn,textDecoration:"none",fontWeight:600}}>Términos y Condiciones</a> y la{" "}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{color:T.gn,textDecoration:"none",fontWeight:600}}>Política de Privacidad</a> de FINPATHIA.
          </span>
        </label>}
      </div>
      <Bt sz="l" onClick={auth} dis={authLoading} st={{width:"100%",justifyContent:"center",borderRadius:12}}>{authLoading?"Cargando...":aM==="login"?"Ingresar":sessionStorage.getItem("fp3_promo_code")==="PIONEROS2026"?"Activar mi acceso Pioneros — 3.5 meses gratis":"Crear cuenta — 14 días Pro gratis"}</Bt>
      {authError&&<div style={{color:T.rd,fontSize:13,marginTop:12,padding:"12px 14px",background:T.rdB,border:`1px solid ${T.rd}30`,borderRadius:10,display:"flex",gap:10,alignItems:"flex-start"}}><span style={{fontSize:16,flexShrink:0}}></span><div style={{flex:1}}><div style={{fontWeight:700,marginBottom:2}}>{aM==="login"?"No pudimos iniciar sesión":"No pudimos crear tu cuenta"}</div><div style={{fontSize:12,color:T.rd,opacity:0.9}}>{authError}</div></div></div>}
      {aM==="signup"&&<p style={{textAlign:"center",marginTop:12,color:T.tx3,fontSize:12}}>Conexión cifrada · no vendemos tus datos · sin tarjeta</p>}
      <p style={{textAlign:"center",marginTop:16,color:T.tx3,fontSize:12}}>{aM==="login"?"¿Nuevo aquí? Usa la pestaña Crear cuenta arriba.":"¿Ya eres cliente? Usa la pestaña Ingresar arriba."}</p>
      {/* 25-oct-2026: al crear cuenta, sin demo ni "explorar sin cuenta": un solo camino. */}{!__enLandingPatrimonio&&aM!=="signup"&&<><div style={{marginTop:24,textAlign:"center"}}><span onClick={()=>{const nd=mkU("Usuario","");nd.p.plan="pro";nd.p.trialEnd=new Date(Date.now()+14*86400000).toISOString().split("T")[0];nd.p.anonymous=true;setU(nd)}} style={{fontSize:13,color:T.gn,cursor:"pointer",fontWeight:600}}>Explorar sin cuenta — 14 días gratis →</span></div>
      <div style={{marginTop:16,padding:"16px",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.12)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:12,fontWeight:600,color:T.orange,marginBottom:6}}>¿Quieres ver cómo funciona?</div><div style={{fontSize:12,color:T.tx3,marginBottom:10}}>Explora la plataforma con datos de ejemplo: patrimonio, ingresos, gastos, deudas, impuestos y simulador.</div><div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}><button onClick={()=>{const nd=mkU("Pedro Pérez","demo@finpathia.com");nd.p.plan="pro";nd.p.trialEnd=new Date(Date.now()+14*86400000).toISOString().split("T")[0];nd.p.demo=true;guardarReal(realAntesDemoRef,uRef.current);setU(nd);setTimeout(()=>demo(),500)}} style={{background:"linear-gradient(135deg,#f59e0b,#f59e0b)",color:"#000",border:"none",padding:"10px 20px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13}}>Demo Colombia</button><button onClick={()=>demoUS()} style={{background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"#fff",border:"none",padding:"10px 20px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13}}>Demo USA</button></div></div></>}
      {aM==="login"&&<p style={{textAlign:"center",marginTop:14}}>
        <span onClick={()=>{
          setRecoveryEmail(aF.e||"");
          setResetError("");
          setResetSent(false);
          setShowRecoveryRequest(true);
        }} style={{color:T.bl,cursor:"pointer",fontSize:13,fontWeight:600,textDecoration:"underline"}}>
          ¿Olvidaste tu contraseña?
        </span>
      </p>}
    </div>
  </div>;

  // PIN lock screen
  if(u&&locked){
    const pin=localStorage.getItem("fp3_pin");
    return<div style={{background:T.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui"}}>
      <div style={{textAlign:"center",padding:40,maxWidth:360}}>
        <div style={{fontSize:48,marginBottom:16}}></div>
        <div style={{fontSize:22,fontWeight:700,color:T.tx,marginBottom:6}}>Sesión bloqueada</div>
        <div style={{fontSize:13,color:T.tx3,marginBottom:24}}>Ingresa tu PIN para continuar</div>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:16}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:40,height:48,borderRadius:10,border:"2px solid "+(pinInput.length>i?T.gn:T.border),display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:T.tx,background:T.bg2}}>{pinInput[i]?"•":""}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,maxWidth:220,margin:"0 auto"}}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map(n=><button key={n} onClick={()=>{if(n==="⌫")setPinInput(p=>p.slice(0,-1));else if(n!==""&&pinInput.length<4){const np=pinInput+n;setPinInput(np);if(np.length===4){if(np===pin){setLocked(false);setPinInput("")}else{setPinInput("");showToast("PIN incorrecto")}}}}} style={{width:56,height:48,borderRadius:12,border:"1px solid "+T.border,background:n===""?"transparent":T.bg2,color:T.tx,fontSize:18,fontWeight:600,cursor:n===""?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{n}</button>)}
        </div>
      </div>
    </div>;
  }

  // ═══ ADVISOR WORKSPACE ═══
  // Si el usuario es advisor y está en modo workspace (no ha seleccionado un cliente
  // ni ha elegido ver su dashboard personal), renderizamos la lista de clientes.
  if(u&&isAdvisor&&viewMode==="workspace"){
    const refreshClients=async()=>{
      if(!authUser?.id)return;
      try{
        const{data}=await supabase
          .from("advisor_client_data")
          .select("id,email,data,plan,jurisdiction,updated_at,client_status,invited_at,accepted_at")
          .eq("advisor_id",authUser.id);
        if(data)setAdvisorClients(data);
      }catch(e){/* silent */}
    };
    // ═══ Context switch: abrir dashboard de un cliente ═══
    // 1. Guardar el u (user) del advisor en advisorOwnUser
    // 2. Cargar user_data del cliente desde advisor_client_data
    // 3. Setear u = client user data (el Dashboard renderizará sus datos)
    // 4. viewMode = "client"
    const openClientDashboard=async(clientId)=>{
      const client=advisorClients.find(c=>c.id===clientId);
      if(!client){showToast("No se pudo abrir el cliente");return}
      setSwitchingClient(true);
      try{
        // Backup del user propio antes de cambiarlo
        setAdvisorOwnUser(u);
        // Preparar datos del cliente para el dashboard
        const clientData=client.data||{};
        const clientUser=sanitize({
          ...clientData,
          p:{...(clientData.p||{}),plan:client.plan||"pro",name:clientData?.p?.name||client.email?.split("@")[0]||"Cliente"},
        });
        setCurrentClient({id:client.id,email:client.email,name:clientUser?.p?.name||client.email,jurisdiction:client.jurisdiction});
        setCurrentClientId(client.id);
        setU(clientUser);
        setViewMode("client");
      }catch(e){
        console.error("Error loading client:",e);
        showToast("Error cargando cliente");
        setAdvisorOwnUser(null);
      }finally{
        setSwitchingClient(false);
      }
    };
    return<AdvisorWorkspace
      advisorProfile={{...advisorProfile,id:authUser?.id}}
      clients={advisorClients}
      onOpenClient={openClientDashboard}
      onViewPersonal={()=>setViewMode("personal")}
      onLogout={logout}
      onRefreshClients={refreshClients}
    />;
  }

  // Feature gating — inline, no separate component
  const gateOverlay=(planNeeded)=><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:10,background:"rgba(12,12,15,0.5)",backdropFilter:"blur(2px)",borderRadius:12}}><div style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:12,padding:"40px 48px",textAlign:"center",boxShadow:"0 12px 40px rgba(0,0,0,.6)",maxWidth:340}}><div style={{width:56,height:56,borderRadius:12,background:T.gnB,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}></div><div style={{fontSize:18,fontWeight:700,marginBottom:6,letterSpacing:"-0.02em"}}>FINPATHIA Pro</div><div style={{fontSize:13,color:T.tx3,marginBottom:20,lineHeight:1.5}}>Todo FINPATHIA en un solo plan: $24.900 al mes o $249.000 al año.</div><Bt onClick={()=>setPg("price")} st={{width:"100%",justifyContent:"center"}}>Activar Pro</Bt></div></div>;
  const gated=(feat,planNeeded,content)=>{const ok=hasProAccess||(plan==="basico"&&["trd","pen","btc","sim","simf"].includes(feat));if(ok||plan===planNeeded)return content;return<div style={{position:"relative"}}><div style={{filter:"blur(4px)",pointerEvents:"none",opacity:.3,maxHeight:400,overflow:"hidden"}}>{content}</div>{gateOverlay(planNeeded)}</div>};

  const getCoach=id=>{
    if(!u)return[];
    try{
    const msgs=[];
    const inv=((u&&u.inv)||[]).filter(i=>i.sim!==false),deu=((u&&u.deu)||[]).filter(d=>d.sim!==false),ing=((u&&u.ingresos)||[]).filter(i=>i.sim!==false);
    const gas={};Object.entries((u&&u.gas)||{}).forEach(([cat,items])=>{const fi=(items||[]).filter(g=>g.sim!==false);if(fi.length>0)gas[cat]=fi});
    const topA=inv.map(i=>({...i,...iM(i,deu)})).sort((a,b)=>b.noi-a.noi);
    const hiDebt=deu.filter(d=>(d.mt||0)>0).sort((a,b)=>b.ts-a.ts);
    const gasCats=Object.entries(gas).map(([cat,items])=>({cat,total:items.reduce((s,g)=>s+montoPromedioMensual(g),0),items}))/* frecuencia: un gasto anual no es un gasto mensual (fix 25-jul-2026) */.sort((a,b)=>b.total-a.total);
    // Clasificación pasivo/activo: la misma de metrics.js (antes cada pantalla
    // tenía su lista y ninguna reconocía "Rentas de capital").
    const ingPasivo=t.ingresoPasivoBruto||0;
    const ingActivo=t.met?t.met.iaBruto:0;
    const pctPasivo=t.pctIngresoPasivo||0;
    const runway=t.colchonMeses!=null?Math.round(t.colchonMeses*10)/10:0; // colchón único (metrics.js)
    const fireNum=t.gfm*12*25;
    const firePct=fireNum>0?(t.nw/fireNum*100):0;
    const reVal=inv.filter(i=>(i.tp||i.tipo)==="Real Estate").reduce((s,i)=>s+vaCOP(i,trm),0);
    const rePct=t.nw>0?(reVal/t.nw*100):0;
    const topGasto=gasCats[0];
    const worstDebt=hiDebt[0];
    const worstAsset=topA.length>1?topA[topA.length-1]:null;
    const currencies={COP:0,USD:0};
    ing.forEach(i=>{if(i.moneda==="USD")currencies.USD+=montoPromedioMensual(i)*trm;else currencies.COP+=montoPromedioMensual(i)});
    const usdPct=t.ni>0?(currencies.USD/t.ni*100):0;

    if(id==="cashflow"){
      msgs.push({t:"Cuadrante de Ingresos",c:"Ingresos activos (trabajo): "+fm(ingActivo)+"/mes ("+fmtPctEs((100-pctPasivo), 0)+")\nIngresos pasivos (activos): "+fm(ingPasivo)+"/mes ("+fmtPctEs(pctPasivo, 0)+")\n\n"+(pctPasivo>=70?"EXCELENTE: Más del 70% es pasivo. Eres inversionista.":pctPasivo>=40?"EN TRANSICIÓN: "+fmtPctEs(pctPasivo, 0)+" pasivo. Aún dependes del trabajo.":"DEPENDIENTE: Solo "+fmtPctEs(pctPasivo, 0)+" pasivo. Si dejas de trabajar, pierdes el "+fmtPctEs((100-pctPasivo), 0)+".")});
      const prodA=inv.filter(i=>iM(i,deu).noi>0);
      const valorA=inv.filter(i=>{const va=+i.va||0,vc=+i.vc||0;return iM(i,deu).noi<=0&&va>vc*1.1});
      const deadA=inv.filter(i=>{const va=+i.va||0,vc=+i.vc||0;return iM(i,deu).noi<=0&&va<=vc*1.1&&va>0});
      let clasif="Generan renta ("+prodA.length+"):\n"+prodA.slice(0,5).map(a=>"  "+(a.n||a.nombre||"Sin nombre")+": +"+fm(iM(a,deu).noi)+"/mes").join("\n");
      if(valorA.length>0)clasif+="\n\nSolo valorización ("+valorA.length+"):\n"+valorA.slice(0,3).map(a=>{const g=+a.vc>0?((+a.va-a.vc)/a.vc*100):0;return"  "+(a.n||a.nombre||"Sin nombre")+": +"+fmtPctEs(g, 0)+" plusvalía (no renta)"}).join("\n");
      if(deadA.length>0)clasif+="\n\nSin renta ni valorización ("+deadA.length+"):\n"+deadA.slice(0,3).map(a=>"  "+(a.n||a.nombre||"Sin nombre")+": "+fm(a.va)).join("\n");
      if(deadA.length===0&&valorA.length===0)clasif+="\n\nTodos tus activos generan renta.";
      msgs.push({t:"Clasificación de Activos",c:clasif});
      msgs.push({t:"Plan de Acción",c:"1. Convertir "+fm(deadA.reduce((s,i)=>s+vaCOP(i,trm),0))+" improductivos en productivos\n2. Reinvertir cash flow "+fm(t.cf)+"/mes en activos que generen ingreso\n3. Meta: ingreso pasivo > "+fm(t.te)+"/mes (hoy: "+fm(ingPasivo)+")\n4. Cada "+fm(Math.abs(t.cf)*12)+" ahorrado/año te acerca "+fmtPctEs(((t.te>0?Math.abs(t.cf)*12/t.te*100:0)), 0)+" más"});
    }
    else if(id==="estratega"){
      // Nivel desde la base única (metrics.js): cobertura pasiva = IP ÷ OB.
      const nv=t.nivel||{};
      const sig=nv.siguiente;
      const nvTxt=nv.nivel?("Nivel "+nv.nivel+"/5: "+nv.nombre):"Nivel: sin datos";
      // 21-oct-2026 — Tres arreglos en este bloque:
      //  · Las cifras salen de la MISMA base que el nivel (metMes, el mes en
      //    curso). Antes mezclaba el promedio del año con un nivel del mes.
      //  · El umbral del siguiente escalón sale de umbralNivel(). Leía el campo
      //    `min`, que la escala nueva ya no tiene: daba NaN y se imprimía
      //    "necesitas $0/mes de ingreso pasivo".
      //  · El nivel 5 ya no es Independencia sino Abundancia; Independencia es
      //    el 4. El texto felicitaba por lo que no era.
      const mB=t.metMes||t.met||{};
      const ctxNv={ob:mB.ob||0,obEsencial:nv.obEsencial||mB.ob||0};
      const sigMonto=sig?umbralNivel(sig,ctxNv):null;
      const nvCuerpo="Cobertura pasiva: "+pc(mB.coberturaPasiva)+"\nIngreso pasivo neto: "+fm(mB.ip)+"/mes vs Gastos + cuotas: "+fm(mB.ob)+"/mes\n\n"+
        (nv.nivel===5?"Abundancia: tu ingreso pasivo es el doble de tus gastos y cuotas. Ese margen absorbe un año malo sin tocar el capital y deja para reinvertir."
        :nv.nivel===4?"¡Independencia alcanzada! Tu ingreso pasivo cubre el 100% de tus gastos y cuotas."
        :nv.candado==="deficit"?"Tu flujo del mes es negativo ("+fm(mB.fl)+"/mes) y tus activos todavía no pagan lo esencial. El primer paso es que lo que entra cubra lo que sale."
        :nv.candado==="patrimonio_negativo"?"Tu patrimonio neto es negativo: el nivel queda en "+nv.nombre+" hasta que tus activos superen tus deudas."
        :sig?"Siguiente: "+sig.nombre+(sigMonto!=null?" → necesitas "+fm(sigMonto)+"/mes de ingreso pasivo\nTe faltan: "+fm(nv.faltaIPSiguiente)+"/mes de ingreso pasivo":" → no se gana con ingreso pasivo sino con que el flujo del mes quede positivo (hoy: "+fm(mB.fl)+"/mes)"):"")+
        (nv.deficitFlujo&&nv.nivel>1?"\n\nOjo: el flujo de este mes es negativo ("+fm(mB.fl)+"/mes). El escalón lo ganan tus activos y no se toca, pero ese hueco se está tapando con capital o con deuda.":"");
      msgs.push({t:""+nvTxt,c:nvCuerpo});
      msgs.push({t:"Proyección FIRE",c:"FIRE Number: "+fm(fireNum)+"\nProgreso: "+fmtPctEs(firePct, 0)+" ("+fm(t.nw)+" / "+fm(fireNum)+")\n\n"+(firePct>=100?"Tu patrimonio ya supera tu FIRE number.":"Necesitas acumular "+fm(Math.max(fireNum-t.nw,0))+" más.")});
      if(topGasto)msgs.push({t:"Aceleradores",c:"Mayor gasto: "+topGasto.cat+" ("+fm(topGasto.total)+"/mes)\n\nSi reduces gastos 15%: cash flow sube a "+fm(t.cf+t.gfm*0.15)+"/mes\nSi aumentas ingreso 20%: cash flow sube a "+fm(t.cf+t.ni*0.2)+"/mes\n\nCombinar ambos te acelera al doble."});
    }
    else if(id==="riesgo"){
      // inferType is now module-level
          const types={};inv.forEach(i=>{const tp=inferType(i);types[tp]=(types[tp]||0)+vaCOP(i,trm)});
      const te=Object.entries(types).sort((a,b)=>b[1]-a[1]);
      const mx=te[0]||["",0];const mxP=t.nw>0?(mx[1]/t.nw*100):0;
      msgs.push({t:"Concentración",c:te.map(([tp,v])=>"• "+tp+": "+fm(v)+" ("+fmtPctEs(((v/(t.nw||1))*100), 0)+")").join("\n")+"\n\n"+(mxP>50?""+mx[0]+" = "+fmtPctEs(mxP, 0)+". Riesgo extremo.":mxP>35?""+mx[0]+" = "+fmtPctEs(mxP, 0)+". Cerca del límite.":"Diversificación aceptable.")});
      msgs.push({t:"Stress Test",c:"Caída inmobiliaria -20%:\n• Pierdes: "+fm(reVal*0.2)+"\n• Patrimonio: "+fm(t.nw-reVal*0.2)+"\n\nPierdes mayor ingreso"+(ing.length>0?" ("+ing.sort((a,b)=>montoPromedioMensual(b)-montoPromedioMensual(a))[0].nombre+")":"")+":\n• Cash flow: "+fm(t.cf-(ing.length>0?(ing.sort((a,b)=>montoPromedioMensual(b)-montoPromedioMensual(a))[0].mensual||0)*(ing.sort((a,b)=>montoPromedioMensual(b)-montoPromedioMensual(a))[0].moneda==="USD"?4200:1):0))+"/mes\n\nRunway sin ingresos: "+runway+" meses "+(runway<6?"":"")});
      msgs.push({t:"Moneda",c:"COP: "+fm(currencies.COP)+"/mes ("+fmtPctEs((100-usdPct), 0)+")\nUSD: "+fm(currencies.USD)+"/mes ("+fmtPctEs(usdPct, 0)+")\n\n"+(usdPct<15?"Muy expuesto al COP. Recomendación: 30%+ en USD.":usdPct>70?"Muy dolarizado.":"Buena diversificación.")});
    }
    else if(id==="valor"){
      const ranked=topA.map(a=>{const m=iM(a,deu);const va=+a.va||0,vc=+a.vc||0;const aprec=vc>0?((va-vc)/vc*100):0;const yld=va>0?(m.noi*12/va*100):0;const tasa=+(a.tasa||0);const bestYld=Math.max(yld,tasa);const total=aprec+bestYld;const nm=(a.n||a.nombre||"Sin nombre");const tipo=bestYld>aprec?"Renta":"Valorización";return{nm,aprec,bestYld,total,tipo,m,va}}).sort((a,b)=>b.total-a.total);
      msgs.push({t:"Ranking por Retorno Total",c:ranked.slice(0,8).map((a,i)=>(i+1)+". "+a.nm+"\n   "+a.tipo+": "+(a.aprec>0?"+"+fmtPctEs(a.aprec, 0)+" valorización":"sin valorización")+(a.bestYld>0?" + "+fmtPctEs(a.bestYld, 1)+" renta/año":"")+"\n   Retorno total: "+fmtPctEs(a.total, 1)).join("\n\n")+"\n\nRetorno = valorización + renta. Edita cada activo en Patrimonio para agregar su renta y gastos."});
      const poor=ranked.filter(a=>a.total<5&&a.va>50000000);
      const stars=ranked.filter(a=>a.total>15);
      msgs.push({t:"Optimización",c:(poor.length>0?"Bajo rendimiento (<5% total):\n"+poor.map(a=>"  "+a.nm+": "+fmtPctEs(a.total, 1)+" (val "+fmtPctEs(a.aprec, 0)+" + renta "+fmtPctEs(a.bestYld, 1)+")\n    → En CDT al 10% generaría "+fm(a.va*0.1/12)+"/mes").join("\n")+"\n\n":"")+(stars.length>0?"Estrellas (>15% total):\n"+stars.map(a=>"  "+a.nm+": "+fmtPctEs(a.total, 1)+" ("+a.tipo+")").join("\n"):"Todo en rango normal.")});
      msgs.push({t:"Margen de Seguridad",c:"Deuda/Activos: "+pc(t.dta)+"\n\n"+(t.dta<20?"Excelente margen. Puedes apalancarte.":t.dta<40?"Aceptable. No más deuda.":"Riesgo alto. Paga deuda primero.")+(worstDebt?"\n\nDeuda más cara: "+worstDebt.n+" al "+fmtTasaEs(worstDebt.ts)+". Pagarla = invertir al "+fmtTasaEs(worstDebt.ts)+" garantizado.":"")});
    }
    else if(id==="contrarian"){
      const err=[];
      if(rePct>60)err.push("Concentración inmobiliaria "+fmtPctEs(rePct, 0)+" — No compres más inmuebles.");
      if((100-pctPasivo)>80)err.push(""+fmtPctEs((100-pctPasivo), 0)+" depende de trabajo — Si te enfermas, pierdes casi todo.");
      if(runway<6)err.push("Solo "+fmtMeses(runway)+" de colchón de liquidez — Mínimo necesitas 6 meses líquidos.");
      if(worstDebt&&worstDebt.ts>15)err.push("Deuda al "+fmtTasaEs(worstDebt.ts)+" ("+worstDebt.n+") — Nada rinde eso consistentemente. Paga primero.");
      const bigG=gasCats.find(g=>t.ni>0&&g.total>t.ni*0.25);
      if(bigG)err.push(""+bigG.cat+" = "+fmtPctEs(((bigG.total/t.ni)*100), 0)+" del ingreso — Máx recomendado: 25%.");
      if(t.dta>50)err.push("Deuda/Activos "+pc(t.dta)+" — Más de la mitad está financiada con deuda.");
      msgs.push({t:"¿Qué Errores Estoy Cometiendo?",c:err.length>0?err.map(e=>""+e).join("\n\n"):"No encuentro errores graves. Eso ya es mucho."});
      const worstTotal=worstAsset?(()=>{const wm=iM(worstAsset,deu);const wva=+worstAsset.va||0,wvc=+worstAsset.vc||0;return (wvc>0?((wva-wvc)/wvc*100):0)+(wva>0?(wm.noi*12/wva*100):0)})():99;
      msgs.push({t:"Antes de Agregar, Elimina",c:(hiDebt.length>0?"1. Pagar "+hiDebt[0].n+" ("+fmtTasaEs(hiDebt[0].ts)+") = invertir al "+fmtTasaEs(hiDebt[0].ts)+" garantizado\n":"")+(worstAsset&&worstTotal<5?"2. Evaluar "+(worstAsset.n||worstAsset.nombre||"activo")+": retorno total "+fmtPctEs(worstTotal, 1)+" — ¿vale el capital atrapado?\n":"")+(topGasto?"3. Recortar "+topGasto.cat+" 10% = +"+fm(topGasto.total*0.1)+"/mes\n":"")+"\nEliminar lo malo > agregar algo nuevo."});
      msgs.push({t:"La Pregunta Clave",c:t.dta>30?"¿Pagar deuda o invertir?\n→ Deuda más cara: "+fmtTasaEs(worstDebt?worstDebt.ts:0)+". Si no encuentras inversiones >"+fmtTasaEs((worstDebt||{}).ts||0)+" consistentes, PAGA DEUDA.":"¿Dónde poner "+fm(t.cf>0?t.cf*6:0)+" (ahorro 6 meses)?\n→ Con deuda baja, invierte en lo que entiendas y puedas monitorear."});
    }
    // Contextual quote based on situation
    const quotes = {
      cashflow: [
        {cond:pctPasivo<30, q:"\u00ABLos ricos no trabajan por dinero. Hacen que el dinero trabaje para ellos.\u00BB", a:"\u2014 Filosofía del ingreso pasivo"},
        {cond:pctPasivo>=30&&pctPasivo<70, q:"\u00ABLa clave no es cuánto ganas, sino cuánto conservas y cuánto trabaja para ti.\u00BB", a:"\u2014 Principio del flujo de efectivo"},
        {cond:pctPasivo>=70, q:"\u00ABLa verdadera riqueza se mide en tiempo: ¿cuántos meses puedes vivir sin trabajar?\u00BB", a:"\u2014 Definición de libertad financiera"},
      ],
      estratega: [
        {cond:t.ind<25, q:"\u00ABEl viaje de mil millas comienza con un solo paso. Tu primer paso es cubrir lo básico.\u00BB", a:"\u2014 Principio de seguridad financiera"},
        {cond:t.ind>=25&&t.ind<100, q:"\u00ABNo se trata de ser rico, se trata de tener opciones. Estás construyendo opciones.\u00BB", a:"\u2014 Filosofía de la vitalidad financiera"},
        {cond:t.ind>=100&&t.ind<150, q:"\u00ABLa independencia no es tener millones, es que tus activos paguen tus cuentas.\u00BB", a:"\u2014 Definición de independencia"},
        {cond:t.ind>=150, q:"\u00ABEl dinero es un terrible amo pero un excelente sirviente. El tuyo ya trabaja para ti.\u00BB", a:"\u2014 Sabiduría financiera clásica"},
      ],
      riesgo: [
        {cond:rePct>50, q:"\u00ABLa diversificación es protección contra la ignorancia. Concentración es para los que saben lo que hacen.\u00BB", a:"\u2014 Principio de gestión de riesgo"},
        {cond:runway<6, q:"\u00ABRegla #1: nunca perder dinero. Regla #2: nunca olvidar la regla #1.\u00BB", a:"\u2014 Filosofía de preservación de capital"},
        {cond:true, q:"\u00ABEl riesgo viene de no saber lo que estás haciendo. Tú sí lo sabes.\u00BB", a:"\u2014 Principio del inversionista informado"},
      ],
      valor: [
        {cond:t.dta>40, q:"\u00ABEl precio es lo que pagas, el valor es lo que recibes. Asegúrate de recibir más.\u00BB", a:"\u2014 Filosofía de inversión en valor"},
        {cond:t.dta<=40&&topA.length>0, q:"\u00ABSolo compra algo que estarías feliz de tener si el mercado cerrara por 10 años.\u00BB", a:"\u2014 Principio de inversión a largo plazo"},
        {cond:true, q:"\u00ABEs mejor comprar algo maravilloso a un precio justo que algo justo a un precio maravilloso.\u00BB", a:"\u2014 Filosofía de calidad sobre precio"},
      ],
      contrarian: [
        {cond:t.dta>30, q:"\u00ABNo es lo que compras, es lo que pagas. Y la deuda cara es el precio más alto.\u00BB", a:"\u2014 Principio de inversión inteligente"},
        {cond:(100-pctPasivo)>80, q:"\u00ABTodo el mundo tiene un plan hasta que la vida te golpea. ¿Cuál es tu plan B?\u00BB", a:"\u2014 Filosofía de preparación"},
        {cond:true, q:"\u00ABLa sabiduría en inversiones: saber qué evitar. Evita lo estúpido y lo brillante llega solo.\u00BB", a:"\u2014 Principio de inversión por eliminación"},
      ],
    };
    const qs = quotes[id] || [];
    const q = qs.find(x => x.cond);
    if(q) msgs.push({t:"Reflexión", c:q.q+"\n\n"+q.a});

    return msgs;
    }catch(e){return[{t:"Error",c:"No se pudo analizar tu portafolio. Verifica que tus activos tengan nombre y valor. Error: "+e.message}];}
  };

  const has=u?(u.inv?.length||u.deu?.length||Object.keys((u&&u.gas)||{}).length)>0:false;
  const isUS=jurisdiction==="US";
  const lang=u?.lang||(isUS?"en":"es");
  const isEN=lang==="en";
  const nvs=[{id:"dash",i:"",l:"Dashboard"},{id:"_sep1",sep:true,l:isEN?"MY MONEY":"MI DINERO"},{id:"inv",i:"",l:isEN?"Assets & Liabilities":"Patrimonio"},{id:"ing",i:"",l:isEN?"Income":"Ingresos"},{id:"gas",i:"",l:isEN?"Expenses":"Egresos"},{id:"deu",i:"",l:isEN?"Debts":"Deudas"},{id:"tax",i:"",l:isEN?"Tax Planning":"Impuestos",hasChildren:true},{id:"taxopt",i:"",l:"Tax Review",parent:"tax",hidden:!isUS},{id:"famtax",i:"",l:isEN?"Family Tax View":"Vista familiar",parent:"tax",hidden:true},{id:"prevtax",i:"",l:isEN?"Previous Returns":"Historial",parent:"tax",hidden:isUS},{id:"taxcalc",i:"",l:isEN?"Tax Planning":"Calculadora de declaración",parent:"tax",hidden:isUS},{id:"taxinf",i:"",l:"Informe para el contador",parent:"tax",hidden:isUS},{id:"contclientes",i:"",l:isEN?"Clients sharing with me":"Clientes que me comparten",hidden:!clientesContador.length},{id:"_sep2",sep:true,l:isEN?"TOOLS":"TU PLAN"},      // 21-oct-2026: Tu Norte y Metas salen del menú (no se borran: rutas y
      // datos siguen vivos) y los absorbe Mi plan. Flujo Anual (el desempeño
      // del año completo) y el Simulador del año siguiente se quedan: son el
      // corto plazo y complementan a Mi plan (10 años). Santiago: "me quitó el
      // año que viene, si era útil"; "son complementarias".
      // Santiago: "no quiero llenar a FINPATHIA de secciones; menos es más".
      // Nombres por horizonte de tiempo (21-oct-2026, Santiago: "es año actual,
      // año entrante y simulaciones futuras"): este año, año entrante, 10 años.
      //
      // 21-oct-2026 — Se llamaban "Este año · lo real" y "Este año ·
      // simulado", y Santiago: "eso de lo real o simulado no es correcto…
      // real y simulado es una mala interpretación". Tiene razón: las dos
      // pantallas miran el MISMO año con los MISMOS datos que él cargó. Una
      // lo muestra mes a mes y la otra deja moverle las perillas. Llamar "lo
      // real" a una insinúa que la otra es inventada, y que lo cargado en la
      // primera es un hecho y no también una proyección del año.
      //
      // Renombrarlas no alcanzaba: eran DOS puertas del menú al mismo año, y
      // ningún rótulo de dos palabras explica por qué son dos. Así que es una
      // sola —"Este año"— con sus dos vistas adentro. Las rutas no cambian
      // (`flujo` y `sim` siguen siendo las páginas): cambia la puerta.
      // `goesTo` = el padre no tiene página propia, lleva a su primera vista.
      {id:"anio",i:"",l:isEN?"This Year":"Este año",hasChildren:true,goesTo:"flujo"},{id:"flujo",i:"",l:isEN?"Month by Month":"Mes a mes",parent:"anio"},{id:"sim",i:"",l:isEN?"Simulator":"Simulador",parent:"anio"},{id:"simf",i:"",l:isEN?"Next Year":"Año entrante"},{id:"f10",i:"",l:isEN?"My 10-Year Future":"Mi futuro a 10 años",hasChildren:true,goesTo:((u?.futuro10?.escenarios)||[]).length?"f10esc":"f10crear"},{id:"f10crear",i:"",l:isEN?"Scenario Builder":"Creador de escenarios",parent:"f10"},{id:"f10esc",i:"",l:isEN?"Saved Scenarios":"Escenarios creados",parent:"f10"},{id:"norte",i:"",l:isEN?"Your North":"Tu Norte",hidden:true},{id:"met",i:"",l:isEN?"Goals":"Metas",hidden:true},{id:"trd",i:"",l:"Trading",
      // 26-jul-2026 — OCULTO DEL MENÚ, NO ELIMINADO.
      // Uso real medido en la base: 2 de 86 cuentas tienen posiciones
      // cargadas, y una es la de Santiago. Contra 31 en Ingresos y 21 en
      // Patrimonio.
      // Por qué se oculta y no se borra:
      //  · es una de las tres funciones que justifican el plan Básico ($8),
      //    junto con pensiones y BTC — quitar features de un plan pago es de
      //    lo más difícil de deshacer;
      //  · los datos de esos 2 usuarios quedan intactos y la ruta /trd sigue
      //    viva: quien tenga el enlace o un marcador entra igual;
      //  · el bajo uso puede deberse a que NO FUNCIONABA —el botón de precios
      //    nunca sirvió, verificado hoy— y no a falta de interés. Con los
      //    precios andando el número podría ser otro.
      // Revisar en un mes. Volver a mostrarlo es quitar este hidden.
      hidden:true},// 31-oct-2026 — Menos es más: las cinco calculadoras en una sola puerta, el
      // Asesor y los Coaches en una (se cambian con la barra de arriba) y el
      // Glosario abajo, con la ayuda. Ninguna ruta cambia.
      {id:"calc",i:"",l:isEN?"Calculators":"Calculadoras",hasChildren:true,goesTo:"pen"},{id:"pen",i:"",l:isEN?"Retirement":"Pensiones",parent:"calc"},{id:"btc",i:"₿",l:isEN?(isUS?"Bitcoin vs 401(k)":"Bitcoin savings"):(isUS?"Bitcoin vs 401(k)":"Ahorro en BTC"),parent:"calc"},{id:"buyvsinvest",i:"",l:isEN?"Buy vs Invest":(isUS?"Comprar o invertir":"Comprar o arrendar"),parent:"calc"},{id:"gocasional",i:"",l:"Ganancia ocasional",parent:"calc",hidden:isUS},{id:"aportes",i:"",l:"Calcula tus aportes",parent:"calc",hidden:isUS},{id:"asesor",i:"",l:isEN?"AI Advisor":"Asesor IA"},{id:"coach",i:"",l:isEN?"Your advisory team":"Tu equipo de asesores"},{id:"_sep4",sep:true},{id:"price",i:"",l:isEN?"Plans":"Planes"},{id:"cuenta",i:"",l:isEN?"My Account":"Mi cuenta"},{id:"glosario",i:"",l:isEN?"Glossary":"Glosario",hidden:isUS},{id:"metrics",i:"",l:isEN?"Business metrics":"Cómo va el negocio",hidden:!isAdmin}];

  const secNames={dash:"Dashboard",inv:"Patrimonio",ing:"Ingresos",gas:"Egresos",deu:"Deudas",trd:"Trading",sim:"Simulador",met:"Metas",pen:"Pensiones",tax:"Planeación Tributaria",btc:"Ahorro BTC",coach:"Coaches IA",asesor:"Asesor IA",price:"Planes",cuenta:"Mi cuenta"};
  if(typeof document!=="undefined")document.title="FINPATHIA"+(secNames[pg]?" — "+secNames[pg]:"");
  const rp=()=>{if(!u)return null;switch(pg){
    case"dash":{
    // Encabezado de sección (25-jul-2026). La jerarquía existía solo como
    // comentarios en el código: el usuario bajaba por diez bloques sin
    // señalización y todo pesaba igual. Esto la vuelve visible sin quitar
    // un solo gráfico ni indicador — que era la condición de Santiago.
    const SecH=({n,t,s})=><div style={{margin:"56px 0 24px"}}>
      {/* 25-jul-2026 (Santiago: "están muy pequeños, cuesta saber en qué etapa
          estamos"). La primera versión usaba 15px, casi el mismo peso que los
          títulos de tarjeta: no separaba nada. Un divisor de sección tiene que
          leerse ANTES que el contenido que agrupa, o no cumple su función.
          Ahora el número va grande y translúcido al costado —marca de etapa,
          no dato— y el título al tamaño de un encabezado real. */}
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:20,fontWeight:600,color:T.tx,letterSpacing:"-0.01em",lineHeight:1.3}}>{t}</div>
          <div style={{fontSize:13,color:T.tx3,marginTop:3}}>{s}</div>
        </div>
      </div>
      <div style={{height:1,background:T.border,marginTop:14}}/>
    </div>;
    // 3-nov-2026: EE. UU. usa este mismo Dashboard (bilingüe, en dólares). DashboardUS.jsx queda sin usar.
    // Data prep
    const fd=[{name:tx("Ingresos","Income"),a:t.ti},{name:tx("Gastos","Expenses"),a:-(t.gfm+t.tg)},{name:tx("Deudas","Debts"),a:-t.tc},{name:tx("Neto","Net"),a:t.cf}];
    const pj=[0,1,3,5,10].map(y=>({yr:y===0?tx("Hoy","Today"):`+${y}${tx("a","y")}`,v:t.nw*Math.pow(1.08,y)+t.cf*12*y}));
    // Patrimonio distribution
    const bc={};((u&&u.inv)||[]).filter(i=>i.sim!==false).forEach(i=>{const tp=inferType(i);bc[tp]=(bc[tp]||0)+vaCOP(i,trmPais)});if(ib.tv>0)bc.Trading=ib.tv*trmPais/*26-jul-2026: ib.tv está en USD porque las posiciones se cargan en dólares, pero se sumaba tal cual a una distribución donde todo lo demás pasó por vaCOP y está en pesos. Categoría en dólares mezclada entre categorías en pesos, y ~3.262 veces más chica de lo real.*/;
    const pie=Object.entries(bc).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    const totalPat=t.ab+ib.tv;
    // Income by category
    const incByCat={};const otroI=tx("Otro","Other");((u&&u.ingresos)||[]).filter(i=>i.sim!==false).forEach(i=>{incByCat[i.categoria||otroI]=(incByCat[i.categoria||otroI]||0)+montoPromedioMensual(i)});
    const incPie=Object.entries(incByCat).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    // Expense by category
    // 25-jul-2026 — BUG DE DATOS. Esta suma usaba `g.m` crudo, mientras que el
    // total de la tarjeta (t.gfm) usa montoPromedioMensual(), que divide según
    // la frecuencia. Un gasto ANUAL aparecía en la lista con su valor de año
    // entero como si fuera mensual.
    // Caso real de Santiago: "Seguros" es anual por $27,6M → se mostraba
    // $30,8M/mes y encabezaba sus gastos con 44%. El valor mensual real es
    // ~$5,4M. Estaba inflado 12 veces, y por eso los porcentajes de las
    // categorías sumaban más de 200% contra un total que sí estaba bien.
    const expByCat={};Object.entries((u&&u.gas)||{}).forEach(([cat,its])=>{expByCat[cat]=(its||[]).filter(g=>g.sim!==false).reduce((s,g)=>s+montoPromedioMensual(g),0)});
    const expPie=Object.entries(expByCat).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    // Top income sources
    const topInc=[...((u&&u.ingresos)||[]).filter(i=>i.sim!==false)].sort((a,b)=>montoPromedioMensual(b)-montoPromedioMensual(a)).slice(0,5);
    // Health score (0-100)
    // Salud financiera: spec Finanzas §2 (metrics.js), 5 componentes con peso.
    const healthScore=t.salud.score;
    const healthColor=healthScore==null?T.tx3:healthScore>=80?T.gn:healthScore>=60?"#00c805":healthScore>=40?"#f59e0b":T.rd;
    // 3-nov-2026: nombres de nivel y de banda (metrics.js) en el idioma de la sesión.
    const tN=(s)=>tx(s,{Excelente:"Excellent",Buena:"Good","Frágil":"Fragile","Crítica":"Critical","Sin datos":"No data","Déficit":"Deficit",Estabilidad:"Stability",Seguridad:"Security",Independencia:"Independence",Abundancia:"Abundance"}[s]||s);
    const healthLabel=tN(t.salud.banda);
    // 25-oct-2026 (Santiago: "el abordaje para un cliente nuevo es confuso"). Sin datos, el panel muestra
    // solo la guía de 4 pasos: nada de gráficas en $0, Resumen, PDF ni avisos sueltos.
    const sinDatos=!((u&&u.inv)||[]).length&&!((u&&u.ingresos)||[]).length&&!Object.keys((u&&u.gas)||{}).length&&!((u&&u.deu)||[]).length;

    return<div>
      {/* Greeting con PageHeader (estilo Optimus) — Sesión 2-may-2026 */}
      {/* BUG FIX 5-may-2026: agregamos flexWrap:"wrap" + gap para que en mobile
          los botones (Resumen, Reporte PDF) bajen a línea siguiente cuando no
          hay espacio. Sin flexWrap, el flex:1 del contenido se reducía a ~80px
          en pantallas chicas, apilando todo el texto letra por letra. */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"clamp(14px, 3vw, 24px)",flexWrap:"wrap",gap:12}}>
        <div style={{flex:"1 1 280px",minWidth:0}}>
          <PageHeader
            label={new Date().getHours()<12?tx("Buenos días","Good morning"):new Date().getHours()<18?tx("Buenas tardes","Good afternoon"):tx("Buenas noches","Good evening")}
            title={(u?.p?.name&&u?.p?.name!=="Usuario"&&u?.p?.name!=="")?(u?.p?.name||"").split(" ")[0]:(u?.p?.email||"").split("@")[0]}
            subtitle={tx("Tu patrimonio y salud financiera, de un vistazo.","Your net worth and financial health at a glance.")}
          />
          {!sinDatos&&((u?.p?.name)==="Usuario"||!(u?.p?.name))&&<div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.12)",borderRadius:12,padding:"10px 14px",marginTop:10,fontSize:12,color:T.bl,cursor:"pointer"}} onClick={()=>setPg("set")}>{tx("Configura tu nombre en ","Add your name in ")}<strong>Config</strong>{tx(" para personalizar tu experiencia"," to personalize your experience")}</div>}
          {/* Banner Pro Familiar — suscripción activa.
              11-oct-2026: Checkout ya no da prueba. Quien tiene planAccount
              === "pro_familiar" ya pagó (el primer cobro es inmediato),
              aunque le queden días de la prueba de la app (trialEnd, 14 días
              desde el registro, independiente de Stripe). Antes este banner
              decía "Trial gratuito" y "se cobra $27 USD/mes" mientras
              trialActive, asumiendo que trialEnd coincidía con un trial de
              Stripe; ya no es así, así que siempre muestra "activo". */}
          {planAccount==="pro_familiar"&&<div style={{background:trialActive?"linear-gradient(135deg,rgba(59,130,246,0.06),rgba(0,200,5,0.04))":"linear-gradient(135deg,rgba(59,130,246,0.06),rgba(59,130,246,0.04))",border:"1px solid rgba(59,130,246,0.15)",borderRadius:12,padding:"clamp(8px, 2vw, 12px) clamp(10px, 3vw, 16px)",marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 200px",minWidth:0}}>
              <span style={{fontSize:14,flexShrink:0}}></span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:"#3b82f6"}}>
                  {tx("Plan Pro Familiar activo","Pro Family plan active")}
                </div>
                <div style={{fontSize:11,color:T.tx3,lineHeight:1.4,marginTop:1}}>
                  {tx("Hasta 10 personas pueden compartir esta cuenta","Up to 10 people can share this account")}
                </div>
              </div>
            </div>
            <button onClick={()=>setPg("acc")} style={{background:"linear-gradient(135deg,#3b82f6,#3b82f6)",color:"#fff",border:"none",padding:"10px 14px",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:12,flexShrink:0}}>{tx("Mi Cuenta →","My Account →")}</button>
          </div>}
          {/* Banner Pro Trial — solo para users que NO compraron Pro Familiar.
              Flujo: registro → 14 días Pro gratis en la app (trialEnd) →
              suscripción. Desde el 11-oct-2026 Checkout cobra de inmediato:
              no hay una segunda prueba en Stripe. */}
          {trialActive&&planAccount!=="pro_familiar"&&/* 31-oct-2026: no repetir la prueba si ya está la tarjeta de bienvenida, salvo en los últimos días */(trialDays<=5||u?.p?.bienvenidaVista||!(((u&&u.inv)||[]).length>0&&((u&&u.ingresos)||[]).length>0&&Object.keys((u&&u.gas)||{}).length>0))&&<div style={{background:trialDays<=3?"rgba(255,80,0,0.06)":trialDays<=5?"rgba(245,158,11,0.06)":"linear-gradient(135deg,rgba(0,200,5,0.08),rgba(59,130,246,0.05))",border:"1px solid "+(trialDays<=3?"rgba(255,80,0,0.15)":trialDays<=5?"rgba(245,158,11,0.15)":"rgba(0,200,5,0.15)"),borderRadius:12,padding:"14px 18px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 200px",minWidth:0}}>
              <span style={{fontSize:18,flexShrink:0}}></span>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:T.gn}}>{tx("Plan Pro — Trial gratuito","Pro plan — free trial")}</div><div style={{fontSize:12,color:T.tx3}}>{trialDays<=1?tx("¡Tu acceso Pro se vence HOY! Crea tu cuenta para no perder tus datos.","Your Pro access ends TODAY. Create your account to keep your data."):trialDays<=3?tx("¡Solo ","Only ")+trialDays+tx(" días! Después pierdes el Asesor IA y los Coaches."," days left. After that you lose the AI Advisor and Coaches."):trialDays<=5?tx("Tu trial Pro se vence en ","Your Pro trial ends in ")+trialDays+tx(" días — crea tu cuenta para mantener acceso"," days — create your account to keep access"):trialDays+tx(" días de acceso Pro completo"," days of full Pro access")}</div></div>
            </div>
            {(trialDays<=5||u?.p?.anonymous)&&<button onClick={()=>{if(u?.p?.anonymous)logout();else setPg("price")}} style={{background:trialDays<=3?T.rd:T.gn,color:trialDays<=3?"#fff":"#000",border:"none",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,flexShrink:0}}>{u?.p?.anonymous?tx("Crear cuenta gratis →","Create free account →"):tx("Mantener Pro →","Keep Pro →")}</button>}
          </div>}
          {!trialActive&&trialEnd&&plan==="free"&&u?.p?.anonymous&&<div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.12)",borderRadius:12,padding:"14px 18px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 200px",minWidth:0}}><span style={{fontSize:18,flexShrink:0}}></span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:T.bl}}>{tx("Crea tu cuenta para mantener Pro","Create your account to keep Pro")}</div><div style={{fontSize:12,color:T.tx3}}>{tx("Con una cuenta, tus datos se guardan en la nube y viajan cifrados.","With an account, your data is saved in the cloud and encrypted in transit.")}</div></div></div><button onClick={()=>{logout()}} style={{background:T.bl,color:"#fff",border:"none",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,flexShrink:0}}>{tx("Crear cuenta →","Create account →")}</button></div>}
          {!trialActive&&trialEnd&&plan==="free"&&!u?.p?.anonymous&&<div style={{background:"rgba(255,80,0,0.06)",border:"1px solid rgba(255,80,0,0.12)",borderRadius:12,padding:"14px 18px",marginTop:12,display:"flex",flexWrap:"wrap",gap:8}}>
            {/* 25-jul-2026 — Aviso de fin de prueba. Aparece cuando el trial
                venció y la cuenta quedó en gratuito. Era código muerto hasta
                que se corrigió el bug del plan permanente (a4943d1).
                Redacción sobria a pedido de Santiago: sin disculpas ni
                explicaciones técnicas, que al usuario no le aportan. Sí se
                mantiene "tus datos están intactos" — es lo primero que uno
                teme cuando le cierran una puerta.
                Las tres opciones a la vista para que elija, con Pro Familiar
                destacado. (Antes el motivo era que Pro Familiar tenía 14 días
                de prueba en Stripe y el usuario veía $0 hoy; desde el
                11-oct-2026 ningún plan tiene prueba en Checkout: el primer
                cobro es inmediato.) */}
            <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <span style={{fontSize:18,flexShrink:0}}></span>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:T.rd}}>{modoConsulta?(planVencido?tx("Tu plan Pro venció · estás en modo consulta","Your Pro plan expired · you're in view-only mode"):tx("Tu prueba de 14 días terminó · estás en modo consulta","Your 14-day trial ended · you're in view-only mode")):tx("Tu prueba gratuita del plan Pro terminó","Your free Pro trial has ended")}</div>
                  <div style={{fontSize:12,color:T.tx3,marginTop:2,lineHeight:1.5}}>
                    {modoConsulta?(isUS?<>{tx("Puedes ver todos tus datos y tu nivel. Para ","You can still see all your data and your level. To ")}<strong>{tx("agregar o editar","add or edit")}</strong>{tx(", usar el ",", use the ")}<strong>{tx("Asesor IA","AI Advisor")}</strong>{tx(" y simular tu futuro, activa FINPATHIA Pro: "," and project your future, activate FINPATHIA Pro: ")}<strong>{tx("US$14 al mes","$14/month")}</strong>{tx(" o US$140 al año."," or $140/year.")}</>:<>Puedes ver todos tus datos y tu nivel. Para <strong>agregar o editar</strong>, usar el <strong>Asesor IA</strong> y simular tu futuro, activa FINPATHIA Pro: <strong>$24.900 al mes</strong> o $249.000 al año.</>):<>{tx("Para seguir usando el ","To keep using the ")}<strong>{tx("motor fiscal","tax engine")}</strong>{tx(", el ",", the ")}<strong>{tx("Asesor IA","AI Advisor")}</strong>{tx(" y los "," and the ")}<strong>Coaches</strong>{tx(", activa tu plan.",", activate your plan.")}
                    <br/>{tx("Tus datos están intactos y tu cuenta sigue activa en el plan gratuito.","Your data is intact and your account stays active on the free plan.")}</>}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={()=>setPg("price")} style={{background:T.gn,color:"#000",border:"none",padding:"10px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>{tx("Ver planes →","See plans →")}</button>
              </div>
            </div>
          </div>}
        </div>
        {!sinDatos&&<div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
          <button onClick={()=>setPg("resumen")} style={{background:T.bl,color:"#fff",border:"none",padding:"10px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>{tx("Resumen","Summary")}</button>
          <button onClick={generatePDF} style={{background:T.gn,color:"#000",border:"none",padding:"10px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>{tx("Reporte PDF","PDF report")}</button>
        </div>}
      </div>

      {/* 25-oct-2026 — Primera pantalla: tu nivel y UNA acción. Mientras dura la prueba y hasta que la cierre. */}
      {trialActive&&!u?.p?.bienvenidaVista&&!(tieneEstimados(u)&&!u?.p?.afinaCerrada)&&((u&&u.inv)||[]).length>0&&((u&&u.ingresos)||[]).length>0&&Object.keys((u&&u.gas)||{}).length>0&&(()=>{
        const nv=t.nivel||{};
        const hasInv=((u&&u.inv)||[]).filter(i=>i.sim!==false).length>0;
        const hasIng=((u&&u.ingresos)||[]).filter(i=>i.sim!==false).length>0;
        const hasGas=Object.keys((u&&u.gas)||{}).length>0;
        const acc=!hasIng?{t:tx("Registra lo que te entra cada mes","Add what comes in each month"),b:tx("Agregar mis ingresos","Add my income"),pg:"ing"}
          :!hasGas?{t:tx("Registra lo que gastas al mes","Add what you spend each month"),b:tx("Agregar mis gastos","Add my expenses"),pg:"gas"}
          :!hasInv?{t:tx("Agrega lo que tienes: ahorros, inversiones, propiedades","Add what you own: savings, investments, property"),b:tx("Agregar mi patrimonio","Add my assets"),pg:"inv"}
          :{t:tx("Mira cómo sería tu plata en 10 años","See what your money could look like in 10 years"),b:tx("Ver mi futuro a 10 años","See my 10-year future"),pg:"f10"};
        const cerrar=()=>setU(p=>p?{...p,p:{...p.p,bienvenidaVista:true}}:p);
        return <div style={{marginBottom:20,border:"1px solid "+T.border,borderRadius:12,padding:"16px 20px",background:T.bg2}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
            <div style={{fontSize:12,fontWeight:700,color:T.gn,letterSpacing:1}}>{tx("Bienvenido · ","Welcome · ")}{trialDays}{tx(" días de Pro gratis"," days of Pro free")}</div>
            <button onClick={cerrar} aria-label={tx("Cerrar","Close")} style={{background:"transparent",border:"none",color:T.tx3,cursor:"pointer",fontSize:16}}>✕</button>
          </div>
          <div style={{fontSize:17,fontWeight:600,margin:"4px 0 2px"}}>{nv.nivel?tx("Estás en el nivel ","You're at level ")+nv.nivel+tx(" de 5 · "," of 5 · ")+tN(nv.nombre):tx("Descubre en qué nivel de libertad financiera estás","Find out your level of financial freedom")}</div>
          <div style={{fontSize:13,color:T.tx2,lineHeight:1.5}}>{tx("Tu siguiente paso: ","Your next step: ")}<strong>{acc.t}</strong>{tx(". Mientras más real sea tu información, más preciso tu nivel y tu plan.",". The more accurate your info, the more precise your level and your plan.")}</div>
          <button onClick={()=>{track("bienvenida_accion",{pg:acc.pg});setPg(acc.pg)}} style={{marginTop:12,background:T.gn,color:"#000",border:"none",padding:"12px 20px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>{acc.b} →</button>
        </div>;
      })()}
      {/* 31-oct-2026 — Primer minuto: tres cifras en vez de un Dashboard vacío. */}
      {sinDatos&&!pmDetalle&&!esDemo(u)&&<PrimerMinuto nombre={(u?.p?.name&&u.p.name!=="Usuario")?u.p.name.split(" ")[0]:""}
        onDetallar={()=>{track("primer_minuto_detalle");setPmDetalle(true)}}
        onExcel={()=>{track("primer_minuto_excel");setShowImport(true)}}
        onListo={(e)=>{
          const ownerId=(u?.owners&&u.owners[0]?.id)||"own_1";
          const it=itemsDesdeNorte(e,ownerId);
          it.inv=it.inv.map(i=>({...i,n:tx("Lo que tengo (estimado)","What I own (estimate)"),tp:"Otros",...(isUS?{moneda:"USD"}:{})}));
          // 2-nov-2026: todas las filas del primer minuto quedan marcadas como estimadas (AfinaTuNumero las cuenta aparte).
          const est=x=>({...x,estimado:true});it.inv=it.inv.map(est);it.ingresos=it.ingresos.map(est);it.deu=it.deu.map(est);Object.keys(it.gas).forEach(k=>{it.gas[k]=it.gas[k].map(est)});
          track("afina_mostrado");
          track("primer_minuto_listo",{pasivo:Number(e.ingresoPasivo)>0,deudas:Number(e.deudas)>0});
          setU(p=>p?{...p,owners:(p.owners&&p.owners.length)?p.owners:[{id:ownerId,name:(p.p&&p.p.name)||tx("Yo","Me"),type:"natural"}],ingresos:it.ingresos,gas:it.gas,inv:it.inv,deu:it.deu}:p);
          try{window.scrollTo({top:0,behavior:"smooth"})}catch{}
        }}/>}
      {(()=>{
        const hasIng=((u&&u.ingresos)||[]).filter(i=>i.sim!==false).length>0;
        const hasGas=Object.keys((u&&u.gas)||{}).length>0;
        const hasInv=((u&&u.inv)||[]).filter(i=>i.sim!==false).length>0;
        const hasDeu=((u&&u.deu)||[]).length>0;
        if(sinDatos&&!pmDetalle&&!esDemo(u))return null; // el primer minuto va primero
        if(!esDemo(u)&&tieneEstimados(u))return null; // 2-nov-2026: con estimados manda «Ahora hazlo exacto»
        // 25-oct-2026: orden y texto de Santiago — activos, ingresos, gastos y deudas.
        const steps=[
          {id:"inv",done:hasInv,icon:"",title:tx("Tus activos","Your assets"),desc:isUS?tx("Lo que tienes: cuentas, fondos, acciones, 401(k), propiedades, cripto, vehículos","What you own: accounts, funds, stocks, 401(k), property, crypto, vehicles"):tx("Lo que tienes: cuentas, CDTs, fondos, acciones, propiedades, cripto, vehículos","What you own: accounts, CDs, funds, stocks, property, crypto, vehicles"),action:tx("Activos cargados","Assets added"),tip:tx("Cada uno con su valor de hoy","Each one at today's value")},
          {id:"ing",done:hasIng,icon:"",title:tx("Tus ingresos mensuales","Your monthly income"),desc:tx("Salario, arriendos, dividendos: todo lo que te entra cada mes","Salary, rent, dividends: everything that comes in each month"),action:tx("Ingresos cargados","Income added"),tip:tx("Lo que recibes en un mes normal","What you get in a typical month")},
          {id:"gas",done:hasGas,icon:"",title:tx("Tus gastos mensuales","Your monthly expenses"),desc:tx("Vivienda, colegios, transporte, seguros, mercado, salidas","Housing, schools, transportation, insurance, groceries, going out"),action:tx("Gastos cargados","Expenses added"),tip:tx("Las cuotas de créditos van en deudas","Loan payments go under debts")},
          {id:"deu",done:hasDeu,icon:"",title:tx("Tus deudas","Your debts"),desc:tx("Hipotecas, créditos y tarjetas, con su saldo y su cuota","Mortgages, loans and cards, with balance and payment"),action:tx("Deudas cargadas","Debts added"),tip:tx("Si no tienes deudas, sáltalo","No debts? Skip it")},
        ];
        const done=steps.filter(s=>s.done).length;
        const pct=Math.round((done/steps.length)*100);
        if(done>=steps.length)return null;
        return <div style={{marginBottom:24}}>
        <div style={{background:"linear-gradient(135deg,rgba(0,200,5,.04),rgba(59,130,246,.03))",border:"1px solid rgba(0,200,5,.12)",borderRadius:12,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:T.bg3}}><div style={{height:"100%",width:pct+"%",background:"linear-gradient(90deg,#00c805,#3b82f6)",borderRadius:3,transition:"width 0.5s"}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
            <div>
              <h3 style={{fontSize:22,fontWeight:700,margin:"0 0 6px",letterSpacing:"-0.02em"}}>{done===0?tx("Es muy fácil: 4 datos y listo","It's easy: 4 things and you're done"):tx("¡Vas bien! ","Nice progress! ")+done+tx(" de 4"," of 4")}</h3>
              <p style={{color:T.tx2,fontSize:13,margin:0,lineHeight:1.5}}>{tx("Ingresa tus activos, tus ingresos mensuales, tus gastos mensuales y tus deudas. Si tienes un Excel, la IA lo lee y alimenta la plataforma; si no, llenas cada dato a mano.","Add your assets, monthly income, monthly expenses and debts. If you have a spreadsheet, the AI reads it and fills in the platform; if not, enter each item by hand.")}</p>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:13,fontWeight:700,color:T.gn}}>{pct}%</div>
              <Bt sz="s" onClick={()=>{track("checklist_excel");setShowImport(true)}}>{tx("Subir mi Excel","Upload my spreadsheet")}</Bt>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:10}}>
            {steps.map((s,i)=><button key={s.id} onClick={()=>setPg(s.id)} style={{background:s.done?"rgba(0,200,5,0.06)":T.bg2,border:"1px solid "+(s.done?"rgba(0,200,5,0.2)":T.border),borderRadius:12,padding:"18px 18px",cursor:"pointer",textAlign:"left",color:T.tx,transition:"all 0.2s",opacity:s.done?.6:1}} onMouseOver={e=>{if(!s.done)e.currentTarget.style.borderColor="#00c805"}} onMouseOut={e=>{if(!s.done)e.currentTarget.style.borderColor=T.border}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{width:36,height:36,borderRadius:12,background:s.done?"rgba(0,200,5,0.12)":T.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{s.done?"":s.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:11,color:s.done?T.gn:T.tx3,fontWeight:700,letterSpacing:1}}>{tx("Paso ","Step ")}{i+1}</span>
                    {s.done&&<span style={{fontSize:11,color:T.gn,fontWeight:600}}>{tx("✓ Listo","✓ Done")}</span>}
                  </div>
                  <div style={{fontSize:14,fontWeight:700,marginTop:2,color:s.done?T.tx3:T.tx,textDecoration:s.done?"line-through":"none"}}>{s.title}</div>
                  <div style={{fontSize:12,color:T.tx3,marginTop:2,lineHeight:1.4}}>{s.done?s.action+" ✓":s.desc}</div>
                  {!s.done&&<div style={{fontSize:11,color:T.bl,marginTop:6}}>{s.tip}</div>}
                </div>
              </div>
            </button>)}
          </div>

        </div>
      </div>;
      })()}

      <div style={{display:sinDatos?"none":undefined}}>
      <SecH n={1} t={tx("¿Dónde estoy?","Where am I?")} s={tx("Tu patrimonio hoy y qué dice tu family office","Your net worth today and what your family office says")}/>
      {/* ══════════ 1 · ¿DÓNDE ESTOY? ══════════
          Patrimonio neto y salud financiera. El número que resume todo. */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"2fr 1fr",gap:20,marginBottom:20}}>
        <div style={{
          background:"rgba(var(--fp-ink),0.02)",
          border:`1px solid ${CHART.border}`,
          borderRadius:12,
          padding:0,
          position:"relative",
          overflow:"hidden",
          backgroundImage:`radial-gradient(circle at 0% 0%, ${CHART.green}15 0%, transparent 50%)`,
        }}>
          {/* Accent line vertical */}
          <div style={{position:"absolute",left:0,top:24,bottom:24,width:2,background:CHART.green,borderRadius:"0 2px 2px 0"}}/>
          <div style={{padding:"18px 20px"}}>
            <div style={{fontSize:11,color:CHART.txt3,letterSpacing:"0.08em",fontWeight:700}}>{tx("PATRIMONIO NETO","NET WORTH")}</div>
            <div style={{fontFamily:CHART.fontDisplay,fontSize:"clamp(2.5rem,6vw,4rem)",fontWeight:700,letterSpacing:"-0.045em",marginTop:6,lineHeight:1.0,fontVariantNumeric:"tabular-nums",color:CHART.txt}}>{fm(t.nw)}</div>
            <div style={{display:"flex",gap:28,marginTop:24,flexWrap:"wrap"}}>
              {[{l:tx("Activos","Assets"),v:fm(totalPat),c:CHART.txt},{l:tx("Deuda","Debt"),v:fm(t.td),c:CHART.txt},{l:tx("Ratio D/A","D/A ratio"),v:pc(t.dta),c:t.dta<50?CHART.green:CHART.red}].map(k=>
                <div key={k.l}><div style={{fontSize:11,color:CHART.txt3,letterSpacing:"0.06em",fontWeight:600}}>{k.l}</div><div style={{fontSize:18,fontWeight:700,color:k.c,marginTop:4,fontFamily:CHART.fontMono,fontVariantNumeric:"tabular-nums"}}>{k.v}</div></div>
              )}
            </div>
            {/* 1-nov-2026 — «¿Tus rentas ya pagan tu vida?» pasó al medidor de
                libertad (MedidorLibertad, debajo). Aquí queda solo la variación
                del patrimonio, que es del número de arriba. */}
            {(()=>{
              const hs=resumenHistoria(registrarMes(u||{},{trm:trmReal(u)}).historiaPatrimonio);
              if(!hs.mes||isUS)return null; // 3-nov-2026: la historia se guarda en pesos; en EE. UU. aún no se muestra
              return<div style={{marginTop:16,fontSize:13,color:CHART.txt3}}>
                Patrimonio <b style={{color:hs.mes.cambio>=0?CHART.green:CHART.txt}}>{hs.mes.cambio>=0?"+":""}{fm(hs.mes.cambio)}</b> frente a {etiquetaMes(hs.mes.desde)}.
              </div>;
            })()}
          </div>
        </div>
        <div style={{
          background:"rgba(var(--fp-ink),0.02)",
          border:`1px solid ${CHART.border}`,
          borderRadius:12,
          padding:"28px",
          display:"flex",
          flexDirection:"column",
          alignItems:"center",
          justifyContent:"center",
          textAlign:"center",
          position:"relative",
          overflow:"hidden",
          backgroundImage:`radial-gradient(circle at 50% 0%, ${healthColor}15 0%, transparent 60%)`,
        }}>
          {/* Ring con glow */}
          <div style={{
            width:96,height:96,borderRadius:"50%",
            border:"3px solid "+healthColor,
            display:"flex",alignItems:"center",justifyContent:"center",
            marginBottom:20,
            boxShadow:`0 0 24px ${healthColor}30, inset 0 0 24px ${healthColor}10`,
          }}>
            <div style={{fontFamily:CHART.fontDisplay,fontSize:32,fontWeight:700,color:healthColor,fontVariantNumeric:"tabular-nums"}}>{healthScore==null?"—":healthScore}</div>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:healthColor,fontFamily:CHART.fontDisplay}}>{healthLabel}</div>
          <div style={{fontSize:11,color:CHART.txt3,marginTop:4,letterSpacing:"0.06em",fontWeight:600}}>{tx("Salud Financiera","Financial Health")}</div>
        </div>
      </div>

      {/* 1-nov-2026 — Infografías del Dashboard (skill infografia-finpathia).
          Base «este mes» (t.metMes), la misma del nivel, el Simulador y el Asesor. */}
      {(t.ob||0)>0&&<MedidorLibertad cobertura={t.ind||0} ip={t.ingresoPasivo||0} ob={t.ob||0} nivel={t.nivel} fm={fm}
        extra={<>
          {(t.ind||0)<100&&<div style={{fontSize:12,color:CHART.txt3}}>{tx("Para cubrirlo con rentas necesitarías unos ","To cover it with passive income you'd need about ")}<b style={{color:CHART.txt}}>{fm(Math.abs((t.ingresoPasivo||0)-(t.ob||0))*12/RETORNO_SUPUESTO)}</b>{tx(" más invertidos al "," more invested at ")}{pctR(RETORNO_SUPUESTO*100,0)}{tx(" anual."," a year.")}</div>}
          {(t.gfm||0)>0&&<div style={{fontSize:13,color:CHART.txt2}}>{tx("Tu número FIRE: ","Your FIRE number: ")}<b style={{color:CHART.txt}}>{fm(t.gfm*12*25)}</b>{tx(" · llevas el "," · you're at ")}<b style={{color:CHART.txt}}>{pctR(Math.max(0,t.nw/(t.gfm*12*25)*100),0)}</b></div>}
        </>}/>}

      {/* 2-nov-2026 — Después del primer minuto: primero ve su número (arriba), luego el camino para volverlo exacto. */}
      {!esDemo(u)&&tieneEstimados(u)&&!u?.p?.afinaCerrada&&<AfinaTuNumero u={u} T={T} mb={mb} fm={fm} c={{nw:t.nw,cf:t.cf,ing:t.ti,gas:t.te,pasivo:t.ingresoPasivo,deuda:t.td}} irA={(id)=>{track("afina_clic",{id});setPg(id)}} onCerrar={()=>setU(p=>p?{...p,p:{...p.p,afinaCerrada:true}}:p)}/>}
      {/* Ubicación (25-jul-2026, Santiago): "mejor el slot del patrimonio neto
          de primero y debajo lo que ve el family office". Correcto — primero
          el número, después la lectura del número. Antes iba sobre el
          patrimonio y el usuario leía conclusiones antes de ver el dato del
          que salen. */}
      {/* Posición en riqueza: le da escala al número anterior. */}
      {(() => {
        const nwUSD = isUS ? t.nw : trmPais > 0 ? t.nw / trmPais : 0; // 3-nov-2026: en EE. UU. t ya está en dólares
        // Colombia thresholds (Credit Suisse/UBS 2024, adjusted)
        const colPerc = nwUSD < 1000 ? 30 : nwUSD < 5000 ? 45 : nwUSD < 10000 ? 55 : nwUSD < 30000 ? 70 : nwUSD < 50000 ? 80 : nwUSD < 100000 ? 90 : nwUSD < 250000 ? 95 : nwUSD < 500000 ? 97 : nwUSD < 1000000 ? 99 : nwUSD < 5000000 ? 99.5 : 99.9;
        // Global thresholds (UBS Global Wealth Report 2024)
        const gloPerc = nwUSD < 1000 ? 20 : nwUSD < 7087 ? 40 : nwUSD < 10000 ? 50 : nwUSD < 30000 ? 65 : nwUSD < 50000 ? 75 : nwUSD < 109430 ? 85 : nwUSD < 250000 ? 90 : nwUSD < 500000 ? 95 : nwUSD < 936430 ? 98 : nwUSD < 5000000 ? 99 : 99.9;
        const colLabel = colPerc >= 99 ? "Top 1% Colombia" : colPerc >= 95 ? "Top 5% Colombia" : colPerc >= 90 ? "Top 10% Colombia" : colPerc >= 80 ? "Top 20% Colombia" : "Top " + (100 - colPerc) + "% Colombia";
        const gloLabel = gloPerc >= 99 ? "Top 1% Mundial" : gloPerc >= 95 ? "Top 5% Mundial" : gloPerc >= 90 ? "Top 10% Mundial" : gloPerc >= 80 ? "Top 20% Mundial" : "Top " + (100 - gloPerc) + "% Mundial";
        // USA thresholds (Federal Reserve Survey of Consumer Finances 2022)
        const usPerc = nwUSD < 12000 ? 20 : nwUSD < 44000 ? 30 : nwUSD < 105000 ? 40 : nwUSD < 192700 ? 50 : nwUSD < 400000 ? 60 : nwUSD < 650000 ? 70 : nwUSD < 1060000 ? 80 : nwUSD < 1900000 ? 90 : nwUSD < 5000000 ? 95 : nwUSD < 11100000 ? 99 : 99.5;
        const usLabel = usPerc >= 99 ? "Top 1% en USA" : usPerc >= 95 ? "Top 5% en USA" : usPerc >= 90 ? "Top 10% en USA" : usPerc >= 80 ? "Top 20% en USA" : usPerc >= 50 ? "Top " + (100 - usPerc) + "% en USA" : "Percentil " + usPerc + " en USA";
        return (
          (isUS||trmPais>0)&&nwUSD>0&&<Cd s={{padding:"20px 24px",marginBottom:20}}>
            {/* 31-oct-2026 (crítica de diseño): una sola forma de decirlo —«tienes más que el X %»—, sin «Top»/«Percentil» mezclados; las fuentes, plegadas. */}
            <div style={{fontSize:15,fontWeight:600,color:T.tx}}>{tx("Tu posición en riqueza","Where your wealth ranks")}</div>
            <div style={{fontSize:13,color:T.tx3,marginTop:2}}>{isUS?<>{tx("Con ","With ")}{fm(t.nw)}{tx(" de patrimonio tienes más que…"," in net worth you have more than…")}</>:<>{tx("Con ","With ")}{fm(t.nw)}{tx(" de patrimonio (unos USD "," in net worth (about USD ")}{Math.round(nwUSD).toLocaleString("es-CO")}{tx(") tienes más que…",") you have more than…")}</>}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,150px),1fr))",gap:12,marginTop:14}}>
              {(isUS?[[usPerc,tx("de los hogares en Estados Unidos","of US households")],[gloPerc,tx("de los adultos del mundo","of adults worldwide")]]:[[colPerc,tx("de los adultos en Colombia","of adults in Colombia")],[gloPerc,tx("de los adultos del mundo","of adults worldwide")],[usPerc,tx("de los hogares en Estados Unidos","of US households")]]).map(([p,l])=>[tx("el "+p+" %",p+"%"),l]).map(([v,l])=>
                <div key={l} style={{borderTop:`1px solid ${T.border}`,paddingTop:10}}>
                  <div style={{fontSize:22,fontWeight:600,color:T.tx,letterSpacing:"-0.01em"}}>{v}</div>
                  <div style={{fontSize:13,color:T.tx3}}>{l}</div>
                </div>)}
            </div>
            <details className="fp-detalle" style={{marginTop:12}}><summary style={{fontSize:12,color:T.tx3,cursor:"pointer"}}>{tx("Fuentes","Sources")}</summary><div style={{fontSize:12,color:T.tx3,marginTop:6,lineHeight:1.6}}>{tx("UBS Global Wealth Report 2024 (umbral top 10%: USD $109,430 · top 1%: USD $936,430) · Credit Suisse Wealth Databook 2023 — Colombia (mediana adulto: ~USD $6,500) · Federal Reserve Survey of Consumer Finances 2022 (mediana hogar: USD $192,700 · top 10%: USD $1.9M · top 1%: USD $11.1M)","UBS Global Wealth Report 2024 (top 10% threshold: $109,430 · top 1%: $936,430) · Federal Reserve Survey of Consumer Finances 2022 (median household: $192,700 · top 10%: $1.9M · top 1%: $11.1M)")}</div></details>
          </Cd>
        );
      })()}

      {/* Cómo va el año (25-jul-2026). El resto de la sección 1 es una foto
          fija: cuánto tienes HOY. Esto agrega la trayectoria — de dónde vienes
          y hacia dónde va el año. Se calcula del flujo, no del histórico de
          patrimonio, porque ese vive en localStorage y está vacío para
          cualquier usuario nuevo. */}
      {(()=>{ try{
        const hoy=new Date();
        return <AnoEnCurso user={u} trm={trmPais} fmt={fm} T={T} mesActual={hoy.getMonth()+1} año={hoy.getFullYear()} totales={t}/>;
      }catch(e){ return null } })()}

      {/* ═══ EL ASESOR HABLA PRIMERO (25-jul-2026) ═══════════════════════════
          Hasta hoy toda esta inteligencia existía pero vivía dentro de
          secciones que había que ir a buscar. Acá aparece sin que la pidan,
          ordenada por plata y con su respaldo. Si no hay nada que decir, el
          componente no renderiza: el silencio es parte del diseño.
          Envuelto en try/catch — un fallo del motor fiscal NO puede tumbar
          el dashboard entero. */}
      {(()=>{
        try{
          let recs=[];
          try{ recs=isUS?[]:(generarRecomendaciones(u,estimarImpuesto(u))||[]) }catch{ recs=[] } // 3-nov-2026: recomendaciones tributarias de Colombia
          const hs=generarHallazgos({
            user:u,
            recomendaciones:recs,
            trm:trmPais,
            patrimonioTotal:(t?.ab||0)+(ib?.tv||0),
            totales:t,
            descartados:hallazgosDescartados,
            max:4,
          });
          return <HallazgosProactivos hallazgos={hs} T={T} onIr={(pg)=>setPg(pg)} onDescartar={descartarHallazgo}/>;
        }catch(e){ return null }
      })()}

      {/* Contrarian en home — 1 error prioritario + 1 CTA (PR feat dashboard).
          Misma lógica determinística que getCoach("contrarian"); no toca Asesor IA. */}
      {hasContrarianHomeData(u) && (()=>{
        try{
          const alert=getTopContrarianAlert(u,t,trmPais||u?.trm);
          if(!alert)return <ContrarianHomeCard muted T={T}/>;
          return <ContrarianHomeCard alert={alert} T={T} onCta={()=>{
            if(alert.advId){
              const a=ADV.find(x=>x.id===alert.advId)||ADV.find(x=>x.id==="contrarian");
              if(a)sAdv(a);
            }else if(alert.ctaPage==="coach"){
              const a=ADV.find(x=>x.id==="contrarian");
              if(a)sAdv(a);
            }
            setPg(alert.ctaPage||"coach");
          }}/>;
        }catch(e){return null}
      })()}

      <SecH n={2} t={tx("¿Cómo se mueve tu plata?","How does your money move?")} s={tx("Lo que entra, lo que sale y lo que queda cada mes","What comes in, what goes out and what's left each month")}/>
      {t.metMes&&<FlujoDinero met={t.metMes} fm={fm} periodo={tx("Este mes, ","This month, ")+tx(nombreMes(new Date().getMonth()+1).toLowerCase(),nombreMes(new Date().getMonth()+1))}/>}
      {(()=>{try{
        const hoy=new Date();
        const meses=rentasPorMes({ingresos:u.ingresos,gastos:u.gas,deudas:u.deu,inv:u.inv,trm:trmPais,retencionMensual:t.retencionMensual||0,impuestoNeto:t.impuestoNeto||0},hoy.getFullYear());
        return<RentasMesAMes meses={meses} mesActual={hoy.getMonth()+1}/>;
      }catch(e){return null}})()}
      {/* ══════════ 2 · ¿CÓMO SE MUEVE MI PLATA? ══════════
          Indicadores de flujo: entra, sale, queda. */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:20}}>
        {[
          {l:tx("Ingresos/mes","Income/mo"),v:fm(t.ti),c:T.tx,i:""},
          {l:tx("Gastos/mes","Expenses/mo"),v:fm(t.gfm+t.tg),c:T.tx,i:""},
          {l:tx("Deudas/mes","Debt/mo"),v:fm(t.tc),c:T.tx,i:""},
          {l:"Cash Flow",v:fm(t.cf)+tx("/mes","/mo"),c:t.cf>=0?T.gn:T.rd,i:""},
          {l:tx("Rentas cubren","Passive income covers"),v:pc(t.ind),c:t.ind>=100?T.gn:T.tx2,i:t.ind>=100?"":""},
        ].map(k=><Cd key={k.l} s={{padding:"18px 20px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:11,color:T.tx3,fontWeight:600,letterSpacing:1}}>{k.l}</div><div style={{fontSize:22,fontWeight:700,color:k.c,marginTop:6}}>{k.v}</div></div></div></Cd>)}
      </div>

      {/* Flujo de caja mes a mes. */}
      {/* Mampostería (25-jul-2026, Santiago: "si diagrama profesionalmente
          estos espacios no quedan así"). Antes eran DOS grillas de 2 columnas
          con 5 tarjetas de alturas muy distintas: la fila de gráficos tenía
          TRES tarjetas, así que la tercera —Distribución Patrimonial— quedaba
          sola ocupando medio ancho con el otro medio vacío. Y abajo, Ingresos
          (5 líneas) contra Gastos (9) dejaba otro hueco.
          Con columnas CSS las tarjetas fluyen y llenan el espacio: cero huecos.
          El costo aceptado es el orden de lectura —baja por la columna
          izquierda y sigue por la derecha—, irrelevante acá porque las cinco
          tarjetas son pares entre sí. */}
      <style>{`.fp-masonry > * { break-inside: avoid; page-break-inside: avoid; margin-bottom: 20px; display: block; }`}</style>
      <div className="fp-masonry" style={{columnCount:mb?1:2,columnGap:20,marginBottom:20}}>
        {/* Cash Flow Waterfall */}
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:20}}>{tx("Flujo de Caja Mensual","Monthly Cash Flow")}</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={fd} margin={MARGEN_EJE}><ChartGradients/><CartesianGrid {...gridProps}/><XAxis dataKey="name" {...axisProps}/><YAxis {...axisProps} width={78} tickFormatter={v=>sinCorte(fm(v).replace("$",""))}/><Tooltip cursor={{fill:"rgba(var(--fp-ink),0.03)"}} content={<ChartTooltip formatter={v=>fm(v)}/>}/><Bar dataKey="a" radius={[8,8,0,0]} maxBarSize={64}>{fd.map((d,i)=><Cell key={i} fill={d.a>=0?CHART.green:CHART.red}/>)}</Bar></BarChart>
          </ResponsiveContainer>
        </Cd>
        {/* Tax Estimate */}
        {(()=>{const txD=impRef;return txD.total>0?<Cd s={{padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:20}}>{isUS?tx("Impuestos estimados aparte de la nómina (anual)","Estimated taxes beyond withholding (annual)"):tx("Impuestos (Anual)","Taxes (Annual)")}</div>
          {Object.values(calRef).some(c=>c.real)&&<div style={{fontSize:12,color:T.tx3,marginBottom:8}}>{tx("Este año: según tu declaración ","This year: based on your ")}{new Date().getFullYear()-1}{tx(" (retenciones + saldo pagado)."," return (withholding + balance paid).")}</div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:12,color:T.tx3}}>{Object.values(calRef).some(c=>c.real)?tx("Total del año","Total for the year"):tx("Total estimado","Estimated total")}</span>
            <span style={{fontSize:18,fontWeight:700,color:T.pr,fontFamily:"monospace"}}>{fm(txD.total)}{tx("/año","/yr")}</span>
          </div>
          <div style={{fontSize:12,color:T.tx3,marginBottom:8}}>{fm(txD.mes)}{tx("/mes estimado","/mo estimated")}</div>
          {txD.detalle.some(d=>(d.pensionVoluntariaManualAnual||0)>0)&&<div style={{fontSize:11,color:T.tx3,background:T.bg3,borderRadius:6,padding:"6px 8px",marginBottom:8}}>Ajustamos el cálculo de la renta exenta del 25%. Si tienes AFC o pensión voluntaria, tu valor estimado puede subir.</div>}
          {txD.detalle.map((d,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:"1px solid "+T.border,fontSize:12}}>
            <span style={{color:T.tx2}}>{d.type==="juridica"?"":""} {d.name}</span>
            <div style={{textAlign:"right"}}>
                    <span style={{color:T.tx2}}>{fm(d.impuesto)} <span style={{color:T.tx3}}>({pctR(d.tasa??d.tasaBruta??0)})</span></span>
                    <div style={{fontSize:11,color:T.tx3}}>{tx("Ingresos: ","Income: ")}{fm(d.ingreso)}{tx("/año","/yr")}</div>
                    {d.ahorroOptimo>100000&&<div style={{fontSize:11,color:T.gn}}>{tx("Ajuste posible: -","Possible savings: -")}{fm(d.ahorroOptimo)}</div>}
                  </div>
          </div>)}
          <button onClick={()=>setPg("tax")} style={{width:"100%",marginTop:10,padding:"8px",background:T.bg3,border:"1px solid "+T.border,borderRadius:8,color:T.pr,cursor:"pointer",fontSize:12,fontWeight:600}}>{tx("Ver detalle → Impuestos","See details → Taxes")}</button>
        </Cd>:null})()}
        {/* Patrimonio Distribution */}
        <Cd s={{padding:20}}>
          {/* Treemap (25-jul-2026). Antes: dona de 140px con leyenda de nueve
              líneas. Para saber que el 68% está en Real Estate había que LEER
              y comparar cifras — la concentración, que es EL dato de una
              distribución patrimonial, quedaba escondida en una tabla.
              Acá el bloque grande es grande porque hay más plata: mismo
              principio que hace funcionar al Sankey, la geometría carga el
              significado. Ninguna cifra se pierde: van dentro del bloque o en
              la leyenda de lo que no cupo, y el tooltip da el detalle. */}
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>{tx("Distribución Patrimonial","Asset Allocation")}</div>
          <div style={{fontSize:12,color:T.tx3,marginBottom:20}}>{tx("El tamaño de cada bloque es la plata que tienes ahí","Each block's size is how much money you have there")}</div>
          {pie.length>0
            ?<BarraComposicion datos={pie} total={totalPat} paleta={T.ch} T={T} altura={44}/>
            :<div style={{height:140,display:"flex",alignItems:"center",justifyContent:"center",color:T.tx3,fontSize:13}}>{tx("Agrega inversiones","Add investments")}</div>}
          {/* 25-jul-2026 (Santiago: "veo listado en gastos pero no en
              patrimonio"). Al reemplazar la dona por el treemap me llevé
              también su leyenda, mientras que ingresos y gastos conservaron
              la lista debajo del gráfico. Quedaba inconsistente y, peor, se
              perdía el detalle exacto: el treemap agrupa la cola en "Otros" y
              sin lista esos activos desaparecían de la vista. */}
          {pie.length>0&&<div style={{marginTop:20,borderTop:"1px solid "+T.border}}>
            {pie.map((p,i)=><div key={p.name} style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:i<pie.length-1?"1px solid "+T.border:"none",fontSize:13}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:(totalPat>0?(p.value/totalPat)*100:0)+"%",background:T.ch[i%T.ch.length],opacity:0.10,pointerEvents:"none"}}/>
              <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                <div style={{width:10,height:10,borderRadius:3,background:T.ch[i%T.ch.length],flexShrink:0}}/>
                <span style={{color:T.tx2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <span style={{fontWeight:700,fontFamily:"monospace",color:T.tx}}>{fm(p.value)}</span>
                <span style={{color:T.tx3,fontSize:12,minWidth:34,textAlign:"right"}}>{totalPat>0?pctR((p.value/totalPat)*100):""}</span>
              </div>
            </div>)}
          </div>}
        </Cd>
        {/* Top Ingresos */}
        <Cd s={{padding:0}}>
          <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+T.border}}>
            <span style={{fontSize:13,fontWeight:700,color:T.tx2}}>{tx("Ingresos por fuente","Income by source")}</span>
            <span style={{fontSize:13,fontWeight:700,color:T.gn}}>{fm(t.ti)}{tx("/mes","/mo")}</span>
          </div>
          {/* 25-jul-2026: mismo tratamiento que el patrimonio. La lista sola
              obligaba a comparar cifras para ver el peso de cada fuente; el
              treemap lo muestra por área. La lista queda debajo con el detalle
              (categoría, capital, tasa), que el gráfico no puede dar. */}
          {topInc.length>0&&<div style={{padding:"4px 20px 14px"}}>
            <BarraComposicion datos={topInc.map(x=>({name:x.nombre||"—",value:x.mensual||0}))} total={t.ti} paleta={T.ch} T={T} altura={40}/>
          </div>}
          {topInc.length>0?topInc.map((inc,i)=><div key={i} style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 20px",borderBottom:"1px solid "+T.border}}>
            <div style={{position:"absolute",left:0,top:0,bottom:0,width:(t.ti>0?((inc.mensual||0)/t.ti)*100:0)+"%",background:T.ch[i%T.ch.length],opacity:0.10,pointerEvents:"none"}}/>
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
              {/* Punto de color: la lista de gastos ya lo tenía y la de
                  ingresos no. Ata cada fila con su bloque del treemap. */}
              <div style={{width:10,height:10,borderRadius:3,background:T.ch[i%T.ch.length],flexShrink:0}}/>
              <div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:600}}>{inc.nombre||"—"}</div><div style={{fontSize:11,color:T.tx3}}>{inc.categoria}{inc.capital>0?" • Capital: "+fm(inc.capital):""}{inc.tasa?" • "+tasaR(inc.tasa)+"":""}</div></div>
            </div>
            <div style={{fontWeight:700,fontFamily:"monospace",color:T.gn}}>{fm(inc.mensual||0)}</div>
          </div>):<div style={{padding:28,textAlign:"center",color:T.tx3,fontSize:13}}>{tx("Agrega ingresos","Add income")}</div>}
        </Cd>
        {/* Gastos by category */}
        <Cd s={{padding:0}}>
          <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+T.border}}>
            <span style={{fontSize:13,fontWeight:700,color:T.tx2}}>{tx("Gastos por categoría","Expenses by category")}</span>
            <span style={{fontSize:13,fontWeight:700,color:T.rd}}>{fm(t.gfm)}{tx("/mes","/mo")}</span>
          </div>
          {/* 25-jul-2026 (Santiago: "estos huecos que desperdician espacio"):
              14 categorías contra 5 fuentes de ingreso desbalanceaba la fila y
              generaba mucho ruido visual. Se muestran las 8 principales y el
              resto se agrupa en una línea: no se oculta plata, el total del
              encabezado sigue siendo el completo. */}
          {expPie.length>0&&<div style={{padding:"4px 20px 14px"}}>
            <BarraComposicion datos={expPie} total={t.gfm} paleta={T.ch} T={T} altura={40}/>
          </div>}
          {expPie.length>0?expPie.slice(0,8).map((exp,i)=><div key={exp.name} style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 20px",borderBottom:"1px solid "+T.border}}>
            {/* 25-jul-2026: la proporción vive DENTRO de la fila. Antes el
                gráfico estaba arriba y la lista abajo repetía los mismos datos;
                ahora la lista ES el gráfico y no cuesta un pixel extra. */}
            <div style={{position:"absolute",left:0,top:0,bottom:0,width:(t.gfm>0?(exp.value/t.gfm)*100:0)+"%",background:T.ch[i%T.ch.length],opacity:0.10,pointerEvents:"none"}}/>
            <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:T.ch[i%T.ch.length]}}/><span style={{fontSize:13}}>{nombreCategoria(exp.name)}</span></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700,fontFamily:"monospace",color:T.rd}}>{fm(exp.value)}</span><span style={{fontSize:11,color:T.tx3}}>{t.gfm>0?pc((exp.value/t.gfm)*100):""}</span></div>
          </div>):<div style={{padding:28,textAlign:"center",color:T.tx3,fontSize:13}}>{tx("Agrega gastos","Add expenses")}</div>}
          {expPie.length>8&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 20px",fontSize:12,color:T.tx3}}>
            <span>+{expPie.length-8} categorías más</span>
            <span style={{fontFamily:"monospace",fontWeight:600}}>{fm(expPie.slice(8).reduce((s,e)=>s+e.value,0))}</span>
          </div>}
        </Cd>

        {/* 25-jul-2026 (Santiago: "no vemos deudas ahí, que también es
            importante"). Omisión conceptual: la sección se llama "¿Cómo se
            mueve tu plata?" y las cuotas —su tercera salida más grande— no
            aparecían en el desglose. Estaban en el indicador de arriba y en la
            sección de patrimonio, pero no acá, que es donde se compara qué
            entra contra qué sale. */}
        {(()=>{
          const deudas=((u&&u.deu)||[])
            .filter(d=>d.sim!==false&&(d.mt||0)>0)
            .map(d=>({name:d.n||tx("Crédito","Loan"),value:montoPromedioMensual({...d,mensual:(d.pg||0)*(d.moneda==="USD"?trmPais:1)}),tasa:d.ts||0,saldo:(d.mt||0)*(d.moneda==="USD"?trmPais:1)}))
            .filter(d=>d.value>0)
            .sort((a,b)=>b.value-a.value);
          if(!deudas.length) return null;
          const totalCuotas=deudas.reduce((s,d)=>s+d.value,0);
          return <Cd s={{padding:0}}>
            <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+T.border}}>
              <span style={{fontSize:13,fontWeight:700,color:T.tx2}}>{tx("Cuotas de deuda","Debt payments")}</span>
              <span style={{fontSize:13,fontWeight:700,color:"#f59e0b"}}>{fm(totalCuotas)}{tx("/mes","/mo")}</span>
            </div>
            <div style={{padding:"4px 20px 14px"}}>
              <BarraComposicion datos={deudas} total={totalCuotas} paleta={T.ch} T={T} altura={40}/>
            </div>
            {deudas.map((d,i)=><div key={d.name+i} style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 20px",borderBottom:i<deudas.length-1?"1px solid "+T.border:"none"}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:(totalCuotas>0?(d.value/totalCuotas)*100:0)+"%",background:T.ch[i%T.ch.length],opacity:0.10,pointerEvents:"none"}}/>
              <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,position:"relative"}}>
                <div style={{width:10,height:10,borderRadius:3,background:T.ch[i%T.ch.length],flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600}}>{d.name}</div>
                  <div style={{fontSize:11,color:T.tx3}}>{d.tasa>0?tasaR(d.tasa)+(isUS?" APR · ":" E.A. · "):""}{tx("saldo ","balance ")}{fm(d.saldo)}</div>
                </div>
              </div>
              <div style={{fontWeight:700,fontFamily:"monospace",color:"#f59e0b",position:"relative"}}>{fm(d.value)}</div>
            </div>)}
          </Cd>;
        })()}
      </div>

      <SecH n={3} t={tx("¿En qué está tu patrimonio?","What is your net worth made of?")} s={tx("Composición, liquidez real y evolución","Mix, real liquidity and growth")}/>
      {t.metMes&&<MapaPatrimonio met={t.metMes} fm={fm}/>}
      {/* ══════════ 3 · ¿EN QUÉ ESTÁ MI PATRIMONIO? ══════════
          Composición: en qué está puesta la plata. */}
      {(() => {
        const nwUSD = isUS ? t.nw : trmPais > 0 ? t.nw / trmPais : 0; // 3-nov-2026: en EE. UU. t ya está en dólares
        // Liquid assets (cash + investments, not real estate)
        const liquidAssets = ((u&&u.inv)||[]).filter(i=>i.sim!==false).filter(i => ["Investment","Fondo de Inversión","CDT","Acciones","Crypto","Renta Fija","Cash"].includes(i.tp||i.tipo)).reduce((s,i) => s + vaCOP(i,trmPais), 0);
        const runway = t.colchonMeses != null ? Math.round(t.colchonMeses*10)/10 : 999; // colchón único (metrics.js)
        const burnRate = t.nw > 0 ? ((t.te * 12) / t.nw * 100) : 0;
        const savingsRate = t.ahorroPct || 0; // misma cifra que alertas y puntaje (metrics.js, neto de retención)
        const fireNumber = t.gfm * 12 * 25;
        const fireProgress = fireNumber > 0 ? Math.min((t.nw / fireNumber) * 100, 100) : 0;
        const debtService = t.cargaDeudaPct || 0; // cuotas ÷ ingreso neto de retención (metrics.js)
        // Passive vs active income
        // % del ingreso que es pasivo: misma clasificación que el nivel (metrics.js).
        const passiveRatio = t.pctIngresoPasivo || 0;
        // Yield on cost
        const totalInvested = ((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((s,i) => s + vcCOP(i,trmPais), 0);
        const yieldOnCost = t.rentaYield.yield || 0; // renta neta ÷ costo de activos que rentan (metrics.js)
        // Concentration risk
        const maxAsset = ((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((max,i) => vaCOP(i,trmPais) > max.v ? {n:i.n||i.nombre||"",v:vaCOP(i,trmPais)} : max, {n:"",v:0});
        const concRisk = (t.ab+ib.tv) > 0 ? (maxAsset.v / (t.ab+ib.tv) * 100) : 0;

        return (<>
          {/* 1-nov-2026 (Santiago: «toda esa sección de indicadores family office
              también la podrías mejorar»; «me faltan datos… estaba escondido»).
              Indicadores como bullet graphs y, A LA VISTA (antes plegados en «Ver
              el análisis detallado»): número FIRE, hitos y fecha libre de deudas.
              Mismas fórmulas de siempre; cambia la presentación. */}
          <IndicadoresSalud items={[
            {l:tx("Colchón de liquidez","Cash cushion"),valor:Math.min(runway,24),texto:runway>=999?"∞":mesesR(runway),max:24,ideal:[6,1e9],cerca:[3,6],tip:tx("Líquidos ÷ gastos y cuotas del mes. Ideal: 6 meses o más.","Liquid assets ÷ monthly expenses and payments. Ideal: 6 months or more.")},
            {l:tx("Gasto anual sobre patrimonio","Annual spending vs. net worth"),valor:burnRate,texto:pc(burnRate),max:12,ideal:[0,4],cerca:[4,8],tip:tx("Lo que gastas al año ÷ tu patrimonio. Ideal: 4 % o menos.","What you spend in a year ÷ your net worth. Ideal: 4% or less.")},
            {l:tx("Tasa de ahorro","Savings rate"),valor:savingsRate,texto:pc(savingsRate),max:50,ideal:[20,1e9],cerca:[10,20],tip:tx("Lo que te sobra ÷ lo que entra. Ideal: 20 % o más.","What's left over ÷ what comes in. Ideal: 20% or more.")},
            {l:tx("Carga de deudas","Debt load"),valor:debtService,texto:pc(debtService),max:60,ideal:[0,30],cerca:[30,50],tip:tx("Cuotas ÷ lo que entra. Ideal: 30 % o menos.","Payments ÷ what comes in. Ideal: 30% or less.")},
            {l:tx("Ingreso que no es trabajo","Income not from work"),valor:passiveRatio,texto:pc(passiveRatio),max:100,ideal:[80,100],cerca:[50,80],tip:tx("La parte de tu ingreso que no depende de trabajar.","The share of your income that doesn't depend on working.")},
            {l:tx(t.rentaYield.etiqueta,t.rentaYield.sobreValorActual?"Rental yield (on current value)":"Yield on cost"),valor:t.rentaYield.yield==null?null:yieldOnCost,texto:t.rentaYield.yield==null?"—":pc(yieldOnCost),max:16,ideal:[8,1e9],cerca:[4,8],tip:tx("Renta neta al año ÷ "+(t.rentaYield.sobreValorActual?"valor actual":"lo que costaron")+" los activos que rentan.","Net annual income ÷ "+(t.rentaYield.sobreValorActual?"current value":"what they cost")+" of income-producing assets.")},
            {l:tx("Concentración","Concentration"),valor:concRisk,texto:pc(concRisk),max:100,ideal:[0,30],cerca:[30,50],tip:concRisk>30?tx(maxAsset.n+" es el "+pc(concRisk)+" de tu patrimonio.",maxAsset.n+" is "+pc(concRisk)+" of your net worth."):tx("Ningún activo pasa del 30 %.","No single asset is over 30%.")},
          ]}/>
          <FireNumero fireNumber={fireNumber} nw={t.nw} fm={fm} ahorroMes={Math.max(0,t.cf||0)}
            anios={añosParaMeta(t.nw,fireNumber,Math.max(0,t.cf||0),0.05)}/>
          {(()=>{
            const liquidA=((u&&u.inv)||[]).filter(i=>i.sim!==false).filter(i=>["Investment","Fondo de Inversión","CDT","Cash","Renta Fija"].includes(i.tp||i.tipo)).reduce((s,i)=>s+vaCOP(i,trmPais),0);
            const totalD=((u&&u.deu)||[]).filter(d=>d.sim!==false).reduce((s,d)=>s+(d.mt||0),0);
            return<CaminoIndependencia fm={fm} hitos={[
              {name:tx("Fondo de emergencia (6 meses)","Emergency fund (6 months)"),target:t.te*6,current:liquidA},
              {name:tx("Libre de deudas","Debt-free"),target:totalD>0?totalD:1,current:totalD>0?Math.max(0,totalD-t.td):1},
              {name:tx("50 % independencia","50% independence"),target:t.gfm*12*12.5,current:t.nw},
              {name:tx("Número FIRE (25× gastos)","FIRE number (25× expenses)"),target:fireNumber,current:t.nw},
              {name:tx("Libertad absoluta (62,5× gastos)","Full freedom ("+(62.5).toLocaleString(localeCifras())+"× expenses)"),target:t.gfm*12*62.5,current:t.nw},
            ]}/>;
          })()}
          {t.td>0&&<LineaDeudas deudas={(u&&u.deu)||[]} trm={trmPais} fm={fm}/>}
          <Cd s={dashMas?{padding:20,marginTop:20}:{padding:0,marginTop:20,background:"transparent",border:"none"}}>
            {/* Dos columnas (25-jul-2026, Santiago: "¿se podrá diagramar mejor
                esta parte? tal vez aprovechando un diseño a dos columnas, no
                tiene que quedar unas gráficas tan alargadas de líneas tan
                largas"). Tenía razón: con 1600px de ancho, la etiqueta queda a
                la izquierda y el valor a la derecha con medio metro de barra en
                el medio — el ojo pierde la relación entre ambos.
                Las tarjetas fluyen en dos columnas; las que YA tienen dos
                columnas por dentro (fecha libre de deuda, concentración) se
                marcan para ocupar el ancho completo, porque partirlas otra vez
                las dejaría ilegibles. */}
            <style>{`
              .fp-fo2 > * { break-inside: avoid; margin-bottom: 12px; }
              .fp-fo-ancho { column-span: all; }
            `}</style>
            {dashMas&&<>
            <div className="fp-fo2" style={{columnCount:mb?1:2,columnGap:12}}>
            {/* 1-nov-2026 — Número FIRE, fecha libre de deuda y camino a la
                independencia salieron de aquí: ahora van a la vista arriba
                (FireNumero, LineaDeudas, CaminoIndependencia). */}
            {/* CONCENTRACIÓN DE RIESGO */}
            <div style={{marginTop:20,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
              <div style={{fontSize:12,color:T.tx3,fontWeight:600,marginBottom:20}}>{tx("CONCENTRACIÓN DE RIESGO — ¿Qué tan diversificado estás?","CONCENTRATION RISK — How diversified are you?")}</div>
              {(() => {
                const assets = ((u&&u.inv)||[]).filter(i=>i.sim!==false).filter(i => vaCOP(i,trmPais) > 0).map(i => ({name:i.n||i.nombre||"",value:vaCOP(i,trmPais),type:i.tp||i.tipo||"Otro"})).concat(ib.tv>0?[{name:"Trading",value:ib.tv,type:"Acciones"}]:[]);
                const totalA = assets.reduce((s,a) => s + a.value, 0);
                if (totalA === 0) return <div style={{fontSize:12,color:T.tx3}}>{tx("Agrega activos en Patrimonio para ver el análisis.","Add assets to see this analysis.")}</div>;
                const sorted = [...assets].sort((a,b) => b.value - a.value);
                const top3 = sorted.slice(0,5);
                // Herfindahl index (0-10000, lower = more diversified)
                const hhi = assets.reduce((s,a) => s + Math.pow((a.value/totalA)*100, 2), 0);
                const hhiLabel = hhi < 1500 ? tx("Bien diversificado","Well diversified") : hhi < 2500 ? tx("Moderadamente concentrado","Moderately concentrated") : tx("Muy concentrado","Highly concentrated");
                const hhiColor = hhi < 1500 ? T.gn : hhi < 2500 ? "#f59e0b" : T.rd;
                // By type
                const byType = {};
                assets.forEach(a => { byType[a.type] = (byType[a.type]||0) + a.value; });
                const typeArr = Object.entries(byType).sort((a,b) => b[1] - a[1]);

                return (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:12}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:T.tx2,marginBottom:8}}>{tx("Top 5 activos por valor","Top 5 assets by value")}</div>
                        {top3.map((a,i) => {
                          const pct = (a.value / totalA * 100);
                          const risk = pct > 40;
                          return (
                            <div key={i} style={{marginBottom:8}}>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:8}}>
                                <span style={{color:risk?T.rd:T.tx2}}>{risk?"":""}{a.name}</span>
                                <span style={{color:risk?T.rd:T.tx3,fontWeight:600}}>{pctR(pct)} — {fm(a.value)}</span>
                              </div>
                              <div style={{height:6,background:"rgba(var(--fp-ink),0.05)",borderRadius:3,overflow:"hidden"}}>
                                <div style={{height:"100%",width:pct+"%",background:pct>40?T.rd:pct>25?"#f59e0b":T.gn,borderRadius:3}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:T.tx2,marginBottom:8}}>{tx("Diversificación por tipo","Diversification by type")}</div>
                        {typeArr.map(([type,val],i) => {
                          const pct = (val / totalA * 100);
                          return (
                            <div key={type} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid rgba(var(--fp-ink),0.04)"}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <div style={{width:8,height:8,borderRadius:3,background:T.ch[i%T.ch.length]}}/>
                                <span style={{color:T.tx2}}>{type}</span>
                              </div>
                              <span style={{color:T.tx3,fontFamily:"monospace"}}>{pctR(pct)} ({fm(val)})</span>
                            </div>
                          );
                        })}
                        <div style={{marginTop:8,fontSize:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{color:T.tx3}}>{tx("Índice Herfindahl:","Herfindahl index:")}</span>
                          <span style={{fontWeight:700,color:hhiColor}}>{Math.round(hhi)} — {hhiLabel}</span>
                        </div>
                        <div style={{fontSize:11,color:T.tx3,marginTop:2}}>{tx("<1500 diversificado · 1500-2500 moderado · >2500 concentrado","<1,500 diversified · 1,500–2,500 moderate · >2,500 concentrated")}</div>
                      </div>
                    </div>
                    {sorted.filter(a => (a.value/totalA*100) > 30).length > 0 && (
                      <div style={{marginTop:10,background:"rgba(255,80,0,0.06)",border:"1px solid rgba(255,80,0,0.15)",borderRadius:8,padding:10,fontSize:12,color:T.rd}}>
                        <strong>{tx("Alerta de concentración:","Concentration alert:")}</strong> {sorted.filter(a => (a.value/totalA*100) > 30).map(a => a.name + " (" + pctR((a.value/totalA*100), 0)+")").join(", ")}{tx(" representan más del 30% de tu patrimonio. Un family office recomendaría diversificar para reducir riesgo."," make up more than 30% of your net worth. A family office would recommend diversifying to reduce risk.")}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* BENCHMARK: ¿Cómo rinde tu patrimonio? */}
            <div style={{marginTop:20,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
              <div style={{fontSize:12,color:T.tx3,fontWeight:600,marginBottom:20}}>{tx("BENCHMARK — ¿Cómo rinde tu patrimonio vs alternativas?","BENCHMARK — How your net worth performs vs. alternatives")}</div>
              {(() => {
                const totalInvested = ((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((s,i) => s + vcCOP(i,trmPais), 0);
                const totalValue = ((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((s,i) => s + vaCOP(i,trmPais), 0);
                const gain = totalValue - totalInvested;
                const gainPct = totalInvested > 0 ? ((totalValue / totalInvested) - 1) * 100 : 0;
                const incomeYield = t.rentaYield.yield || 0;
                const totalReturn = gainPct + incomeYield;
                
                const benchmarks = [
                  {name:tx("Tu portafolio (valoriz.)","Your portfolio (appreciation)"),pct:gainPct,color:gainPct>=0?T.gn:T.rd},
                  {name:tx("Tu portafolio (total: valoriz. + renta)","Your portfolio (total: appreciation + income)"),pct:totalReturn,color:totalReturn>=0?T.gn:T.rd},
                  {name:tx("S&P 500 (promedio 10 años)","S&P 500 (10-year average)"),pct:12.5,color:"#3b82f6"},
                  // 3-nov-2026: referencias de Colombia solo en Colombia; en EE. UU., T-bills y CPI.
                  ...(isUS?[
                  {name:tx("T-bills / cuenta de alto rendimiento (aprox.)","T-bills / high-yield savings (approx.)"),pct:4.3,color:"#3b82f6"},
                  {name:tx("Inflación usada en tus cálculos","Inflation used in your projections"),pct:inflacionGlobal(u&&u.inflacionPct),color:"#f59e0b"},
                  {name:tx("Inflación EE. UU. 2024 (CPI, solo referencia)","US inflation 2024 (CPI, reference only)"),pct:2.9,color:"#a16207"},
                  ]:[
                  {name:"CDT Colombia (promedio)",pct:10.5,color:"#3b82f6"},
                  {name:"Inflación usada en tus cálculos",pct:inflacionGlobal(u&&u.inflacionPct),color:"#f59e0b"},
                  {name:"Inflación Colombia 2024 (solo referencia)",pct:5.2,color:"#a16207"},
                  ]),
                  {name:tx("Colchón (cuenta de ahorros)","Cushion (savings account)"),pct:isUS?0.4:1.5,color:T.tx3},
                ];
                const maxPct = Math.max(...benchmarks.map(b => Math.abs(b.pct)), 1);
                
                return (
                  <>
                    {benchmarks.map((b,i) => (
                      <div key={i} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:8}}>
                          <span style={{color:i<2?T.tx:T.tx2,fontWeight:i<2?700:400}}>{b.name}</span>
                          <span style={{color:b.color,fontWeight:700}}>{b.pct>=0?"+":""}{pctR(b.pct)}</span>
                        </div>
                        <div style={{height:8,background:"rgba(var(--fp-ink),0.05)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:Math.max((Math.abs(b.pct)/maxPct)*100,2)+"%",background:b.color,borderRadius:3,opacity:i<2?1:0.6}}/>
                        </div>
                      </div>
                    ))}
                    <div style={{marginTop:8,fontSize:11,color:T.tx3,lineHeight:1.5}}>
                      {t.inflacion
                        ? <span style={{color:t.inflacion.leGana?T.gn:T.rd}}>{t.inflacion.leGana?"":""} {tx(t.inflacion.mensaje,(()=>{const r=t.inflacion.real||0,x=Math.abs(r).toFixed(1);return{gana:`Your portfolio beats inflation (+${x}% real per year)`,gana_poco:`Your portfolio barely beats inflation (+${x}% real per year)`,no_gana_poco:`Your portfolio is just short of beating inflation (${r<0?"−":""}${x}% real)`,no_gana:`Not beating inflation (−${x}% real)`}[t.inflacion.clase]||t.inflacion.mensaje})())} · nominal {pctR(t.inflacion.nominal)}{tx(" vs inflación usada "," vs. inflation used ")}{pctR(t.inflacion.inflacion)}</span>
                        : <span style={{color:T.tx3}}>{tx("Carga activos para comparar contra la inflación.","Add assets to compare against inflation.")}</span>
                      }
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                        <label style={{fontSize:11,color:T.tx3}} htmlFor="inflacion-global">{tx("Inflación que usa la app (% anual):","Inflation the app uses (% per year):")}</label>
                        <InputDecimalEs id="inflacion-global" value={(u&&u.inflacionPct)!=null?u.inflacionPct:(isUS?3:4)} onChange={v=>upd("inflacionPct",v)} style={{width:64,background:T.bg3,color:T.tx,border:"1px solid rgba(var(--fp-ink),0.1)",borderRadius:6,padding:"3px 6px",fontSize:12}}/>
                        <span style={{fontSize:11,color:T.tx3}}>{tx("Alimenta también la proyección de patrimonio.","Also drives the net worth projection.")}</span>
                      </div>
                      <br/>{tx("Valorización: ","Appreciation: ")}{fm(gain)} ({gainPct>=0?"+":""}{pctR(gainPct)}){tx(" · Renta neta anual: "," · Net annual income: ")}{fm(t.rentaYield.rentaAnual)} ({pctR(incomeYield)} · {tx(t.rentaYield.etiqueta,t.rentaYield.sobreValorActual?"rental yield on current value":"yield on cost")})
                    </div>
                  </>
                );
              })()}
            </div>

            {/* PLANIFICACIÓN TRIBUTARIA — Usa estimarImpuesto() con propietarios + DIAN */}
            {(()=>{const txD=impRef;if(txD.total<=0)return null;return<div style={{marginTop:20,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
              <div style={{fontSize:12,color:T.tx3,fontWeight:600,marginBottom:6}}>{isUS?tx("IMPUESTOS ESTIMADOS — Estados Unidos · federal + estatal + FICA","ESTIMATED TAXES — United States · federal + state + FICA"):`IMPUESTOS ESTIMADOS — Colombia · UVT $${UVT.toLocaleString("es-CO")} (AG ${DEFAULT_AG})`}</div>
              <div style={{fontSize:11,color:T.tx3,marginBottom:20,lineHeight:1.5}}>{isUS?tx("Estimación orientativa con las cifras del IRS del año en curso. No es tu declaración ni asesoría tributaria.","A rough estimate using this year's IRS figures. Not your tax return and not tax advice."):`Estimación orientativa (borrador). No es la liquidación oficial ni asesoría tributaria. Año gravable ${DEFAULT_AG} (UVT $${UVT.toLocaleString("es-CO")}).`}</div>
              {txD.sinClasificar>0&&<div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:8,padding:"10px 14px",marginBottom:20,fontSize:12,color:T.orange}}>{txD.sinClasificar} ingreso(s) sin clasificación fiscal. Ve a <strong>Ingresos</strong> y asigna propietario + clasificación DIAN para un cálculo más preciso.</div>}
              <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:12}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:T.rd,marginBottom:8}}>{tx("Impuesto estimado a cargo por propietario","Estimated tax by owner")}</div>
                  {txD.detalle.map((d,i)=>{const aCargo=d.impuestoACargo??d.impBruto??d.impuesto??0;return<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(var(--fp-ink),0.04)"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:T.tx2}}>{d.type==="juridica"?"":""} {d.name}</div>
                      <div style={{fontSize:11,color:T.tx3}}>{d.us?tx("Federal + estatal","Federal + state")+" ("+(d.us.estado||"")+") + FICA":(d.type==="juridica"?"Tarifa 35%":"Tabla Art. 241 ET")}{tx(" • Ingreso: "," • Income: ")}{fm(d.ingreso)}{tx("/año","/yr")}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.rd,fontFamily:"monospace"}}>{fm(aCargo)}</div>
                      <div style={{fontSize:11,color:T.tx3}}>{tx("Tasa: ","Rate: ")}{pctR(d.tasa??d.tasaBruta??0)}</div>
                    </div>
                  </div>})}
                  {(()=>{const aCargo=txD.detalle.reduce((s,d)=>s+(d.impuestoACargo??d.impBruto??0),0);const rete=txD.detalle.reduce((s,d)=>s+(d.reteN||0),0);const saldo=txD.detalle.reduce((s,d)=>s+(d.saldoAPagar??d.impuesto??0),0);return<>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontWeight:700,fontSize:13,borderTop:"2px solid "+T.border,marginTop:4}}>
                    <span style={{color:T.tx}}>{tx("Impuesto estimado a cargo","Estimated total tax")}</span>
                    <span style={{color:T.rd}}>{fm(aCargo)}{tx("/año","/yr")}</span>
                  </div>
                  <div style={{fontSize:12,color:T.tx2,marginTop:4}}>{tx("Equivale a: ","That's about: ")}<strong style={{color:T.rd}}>{fm(aCargo/12)}{tx("/mes","/mo")}</strong></div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 0",marginTop:4}}>
                      <span style={{color:T.tx2}}>{isUS?tx("Retenido por tu empleador (estimado)","Withheld by your employer (estimate)"):"Retenciones estimadas"}</span>
                      <span style={{fontFamily:"monospace",color:T.gn}}>{fm(rete)}{tx("/año","/yr")}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:700,padding:"6px 0"}}>
                      <span style={{color:T.tx}}>{isUS?tx("A pagar con pagos estimados (1040-ES)","Due via estimated payments (1040-ES)"):"Saldo estimado a pagar"}</span>
                      <span style={{fontFamily:"monospace",color:T.pr}}>{fm(saldo)}{tx("/año","/yr")}</span>
                    </div>
                    <div style={{fontSize:11,color:T.tx3,marginTop:4,lineHeight:1.5}}>{isUS?tx("Impuesto total estimado antes de lo que retiene la nómina. Lo que no se retiene se paga en 4 pagos estimados (abril, junio, septiembre y enero).","Total estimated tax before payroll withholding. Whatever isn't withheld is paid in 4 estimated payments (April, June, September and January)."):"Impuesto estimado a cargo (antes de retenciones). Tu saldo a pagar suele ser menor — el motor ya resta retenciones/anticipos; no volver a restar del total post-rete."}</div>
                  </>})()}
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:T.pr,marginBottom:8}}>{tx("Resumen fiscal","Tax summary")}</div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 0",borderBottom:"1px solid rgba(var(--fp-ink),0.04)"}}>
                    <span style={{color:T.tx2}}>{tx("Ingreso bruto total","Total gross income")}</span>
                    <span style={{fontFamily:"monospace",color:T.tx2}}>{fm(txD.detalle.reduce((s,d)=>s+d.ingreso,0))}{tx("/año","/yr")}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 0",borderBottom:"1px solid rgba(var(--fp-ink),0.04)"}}>
                    <span style={{color:T.tx2}}>{isUS?tx("A pagar aparte de la nómina","Due beyond withholding"):"Impuesto estimado a cargo"}</span>
                    <span style={{fontFamily:"monospace",color:T.rd}}>{fm(txD.total)}{tx("/año","/yr")}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 0",borderBottom:"1px solid rgba(var(--fp-ink),0.04)"}}>
                    <span style={{color:T.tx2}}>{tx("Tasa efectiva global","Overall effective rate")}</span>
                    <span style={{fontFamily:"monospace",color:T.rd}}>{pctR((txD.detalle.reduce((s,d)=>s+d.ingreso,0)>0?((isUS?(txD.totalConRetenciones||txD.total):txD.total)/txD.detalle.reduce((s,d)=>s+d.ingreso,0)*100):0), 1)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 0",borderBottom:"1px solid rgba(var(--fp-ink),0.04)"}}>
                    <span style={{color:T.tx2}}>{tx("Neto después de impuestos","Net after taxes")}</span>
                    <span style={{fontFamily:"monospace",color:T.gn}}>{fm(txD.detalle.reduce((s,d)=>s+d.ingreso,0)-(isUS?(txD.totalConRetenciones||txD.total):txD.total))}{tx("/año","/yr")}</span>
                  </div>
                  <button onClick={()=>setPg("tax")} style={{width:"100%",marginTop:12,padding:"10px",background:T.bg,border:"1px solid "+T.border,borderRadius:8,color:T.pr,cursor:"pointer",fontSize:12,fontWeight:600}}>{tx("Ver detalle completo y revisar → Impuestos","See full details → Taxes")}</button>
                  <div style={{fontSize:11,color:T.tx3,marginTop:8,lineHeight:1.5}}>{isUS?tx("Estimación orientativa. FINPATHIA no presta asesoría tributaria ni jurídica. El valor real puede cambiar por deducciones detalladas, créditos, AMT y ajustes de tu CPA. Presenta tu declaración en IRS.gov o con un preparador autorizado.","Rough estimate. FINPATHIA does not give tax or legal advice. Your actual amount can change with itemized deductions, credits, AMT and your CPA's adjustments. File through IRS.gov or an authorized preparer."):"Estimación orientativa (borrador). No es la liquidación oficial ni asesoría tributaria. Finpathia no presta asesoría tributaria ni jurídica. Esta cifra es un borrador con base en los datos que ingresaste. El saldo real puede cambiar por retenciones, rentas exentas, deducciones, topes en UVT y ajustes de tu contador. Presenta tu declaración solo en los canales oficiales de la DIAN."}</div>
                </div>
              </div>
            </div>})()}

            {/* FONDO EDUCACIÓN HIJOS */}
            {(() => {
              const gastosEdu = Object.values((u&&u.gas)||{}).flat().filter(g => g.sim!==false).filter(g => 
                (g.c||"").toLowerCase().includes("colegio") || (g.c||"").toLowerCase().includes("universidad") || (g.c||"").toLowerCase().includes("educación")
              );
              const gastoEduMes = gastosEdu.reduce((s,g) => s + montoPromedioMensual(g), 0);
              if (gastoEduMes === 0 || isUS) return null; // 3-nov-2026: costos de universidad de Colombia; en EE. UU. no aplica
              const costoUni = 180000000; // Semestre universidad privada Colombia ~$180M
              const aniosUni = 5;
              const totalUni = costoUni * 2 * aniosUni; // 2 semestres x 5 años
              const inflEdu = 0.08; // 8% inflación educativa
              const totalUniInflado = totalUni * Math.pow(1 + inflEdu, 6); // en 6 años
              const ahorroPorHijo = totalUniInflado / (6 * 12); // mensual por 6 años
              const numHijos = Math.max(1, gastosEdu.filter(g => (g.c||"").toLowerCase().includes("colegio")).length);
              
              return (
                <div style={{marginTop:20,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
                  <div style={{fontSize:12,color:T.tx3,fontWeight:600,marginBottom:20}}>FONDO DE EDUCACIÓN — Proyección universitaria</div>
                  <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:12}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:"#3b82f6",marginBottom:8}}>Gasto educativo actual</div>
                      <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
                        Mensual en educación: <strong style={{color:"#3b82f6"}}>{fm(gastoEduMes)}</strong><br/>
                        Anual: <strong>{fm(gastoEduMes * 12)}</strong><br/>
                        Hijos detectados: <strong>{numHijos}</strong>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:"#3b82f6",marginBottom:8}}>Universidad (por hijo)</div>
                      <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
                        Semestre top Colombia: <strong>~{fm(costoUni)}</strong><br/>
                        5 años (10 semestres): <strong>{fm(totalUni)}</strong><br/>
                        Con inflación educativa (8%): <strong style={{color:"#f59e0b"}}>{fm(totalUniInflado)}</strong><br/>
                        Ahorrar mensual (6 años): <strong style={{color:"#3b82f6"}}>{fm(ahorroPorHijo)}{tx("/mes","/mo")}</strong><br/>
                        Por {numHijos} hijos: <strong style={{color:T.rd}}>{fm(ahorroPorHijo * numHijos)}{tx("/mes","/mo")}</strong>
                      </div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:T.tx3,marginTop:8}}>
                    Basado en universidad privada top de Colombia. La inflación educativa (~8% anual) supera la inflación general.
                  </div>
                </div>
              );
            })()}

            {/* ACCIONES RECOMENDADAS */}
            <div style={{marginTop:20,background:"linear-gradient(135deg,rgba(0,200,5,0.06),rgba(59,130,246,0.03))",border:"1px solid rgba(0,200,5,0.1)",borderRadius:12,padding:"14px 20px"}}>
              <div style={{fontSize:12,color:T.gn,fontWeight:700,marginBottom:20}}>{tx("ACCIONES RECOMENDADAS — Prioridades para tu situación","RECOMMENDED ACTIONS — Priorities for your situation")}</div>
              {(() => {
                const actions = [];
                // Check each area
                const runway2 = t.colchonMeses != null ? Math.round(t.colchonMeses*10)/10 : 999;
                if (runway2 < 6) actions.push({pri:"",text:tx("Fondo de emergencia insuficiente. Necesitas al menos 6 meses de gastos en activos líquidos.","Emergency fund too small. You need at least 6 months of expenses in liquid assets."),cat:tx("Liquidez","Liquidity")});
                else if (runway2 < 12) actions.push({pri:"",text:tx("Fondo de emergencia aceptable (","Emergency fund is OK (")+mesesR(runway2)+tx("). Ideal: 12-24 meses.","). Ideal: 12–24 months."),cat:tx("Liquidez","Liquidity")});
                
                const debtSrv = t.cargaDeudaPct || 0; // cuotas ÷ ingreso neto de retención (metrics.js)
                if (debtSrv > 50) actions.push({pri:"",text:tx("Más del 50% de tu ingreso va a deudas. Prioriza pagar la de mayor tasa.","More than 50% of your income goes to debt. Pay off the highest-rate one first."),cat:tx("Deuda","Debt")});
                else if (debtSrv > 30) actions.push({pri:"",text:tx("El " + pctR(debtSrv) + " de tu ingreso neto va a deudas. Busca reducirlo debajo del 30%.",pctR(debtSrv) + " of your net income goes to debt. Aim to get it under 30%."),cat:tx("Deuda","Debt")});
                
                const maxA = ((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((max,i) => vaCOP(i,trmPais) > max.v ? {n:i.n||i.nombre||"",v:vaCOP(i,trmPais)} : max, {n:"",v:0});
                const concR = (t.ab+ib.tv) > 0 ? (maxA.v / (t.ab+ib.tv) * 100) : 0;
                if (concR > 40) actions.push({pri:"",text:maxA.n + tx(" es "," is ") + pctR(concR, 0)+tx(" de tu patrimonio. Diversifica para reducir riesgo."," of your net worth. Diversify to reduce risk."),cat:tx("Riesgo","Risk")});
                
                if (t.cf < 0) actions.push({pri:"",text:tx("Tu cash flow es negativo. Gastas más de lo que ganas. Revisa gastos o busca más ingresos.","Your cash flow is negative: you spend more than you earn. Review expenses or find more income."),cat:"Cash Flow"});
                else if (t.ingresoNeto > 0 && t.ahorroPct < 10) actions.push({pri:"",text:tx("Tu tasa de ahorro es baja (" + pctR(t.ahorroPct) + "). Intenta ahorrar al menos el 20%.","Your savings rate is low (" + pctR(t.ahorroPct) + "). Try to save at least 20%."),cat:tx("Ahorro","Savings")});
                
                const passPct = t.pctIngresoPasivo || 0;
                if (t.ti > 0 && passPct < 50) actions.push({pri:"",text:tx("Solo el " + pctR(passPct, 0)+" de tu ingreso es pasivo. Invierte más en activos que generen renta.","Only " + pctR(passPct, 0)+" of your income is passive. Invest more in income-producing assets."),cat:tx("Independencia","Independence")});
                
                if (actions.length === 0) actions.push({pri:"",text:tx("¡Excelente situación financiera! Mantén tu estrategia actual y sigue diversificando.","Excellent financial position! Keep your current strategy and keep diversifying."),cat:"General"});
                
                return actions.map((a,i) => (
                  <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:i<actions.length-1?"1px solid rgba(var(--fp-ink),0.04)":"none"}}>
                    <span style={{fontSize:14}}>{a.pri}</span>
                    <div>
                      <span style={{fontSize:11,color:T.tx3,fontWeight:600}}>{a.cat}</span>
                      <div style={{fontSize:12,color:T.tx2}}>{a.text}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
            </div>
            </>}
            <button type="button" onClick={()=>setDashMas(v=>!v)} style={{width:"100%",marginTop:4,background:"transparent",border:`1px dashed ${T.border}`,borderRadius:12,padding:"12px 14px",color:T.tx2,cursor:"pointer",fontSize:13,fontWeight:600}}>{dashMas?tx("▾ Ocultar el análisis detallado","▾ Hide detailed analysis"):tx("▸ Ver el análisis detallado: número FIRE, rendimiento vs alternativas, deudas, concentración, impuestos, liquidez y más","▸ See detailed analysis: FIRE number, returns vs. alternatives, debts, concentration, taxes, liquidity and more")}</button>
          </Cd>

      {dashMas&&<>
      {/* Cuánto de eso es realmente disponible. */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:20,marginTop:20,alignItems:"start"}}>
        {/* LIQUIDEZ REAL */}
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.bl,marginBottom:20}}>{tx("Liquidez Real — ¿Cuánto puedes tener en efectivo?","Real Liquidity — How much could you turn into cash?")}</div>
          {(() => {
            const cats = {
              inmediata: {label:tx("Inmediata (48h)","Immediate (48h)"),types:["Cash","CDT","Renta Fija"],color:T.gn,icon:""},
              corto: {label:tx("Corto plazo (30 días)","Short term (30 days)"),types:["Investment","Fondo de Inversión","Acciones","Crypto"],color:"#f59e0b",icon:""},
              largo: {label:tx("Largo plazo (6+ meses)","Long term (6+ months)"),types:["Real Estate","Bodega","Lote","Local Comercial","Negocio","Vehículo"],color:T.rd,icon:""},
            };
            const totals2 = {};
            let grandTotal = 0;
            Object.entries(cats).forEach(([key, cat]) => {
              const val = ((u&&u.inv)||[]).filter(i=>i.sim!==false).filter(i => cat.types.includes(i.tp||i.tipo||"")).reduce((s,i) => s + vaCOP(i,trmPais), 0);
              totals2[key] = val;
              grandTotal += val;
            });

            return (
              <>
                {Object.entries(cats).map(([key, cat]) => {
                  const val = totals2[key];
                  const pct = grandTotal > 0 ? (val / grandTotal * 100) : 0;
                  return (
                    <div key={key} style={{marginBottom:20}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                        <span style={{color:T.tx2}}>{cat.icon} {cat.label}</span>
                        <span style={{fontWeight:700,color:cat.color,fontFamily:"monospace"}}>{fm(val)} <span style={{fontWeight:400,fontSize:11}}>({pctR(pct, 0)})</span></span>
                      </div>
                      <div style={{height:8,background:T.bg3,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:pct+"%",background:cat.color,borderRadius:3}}/>
                      </div>
                    </div>
                  );
                })}
                <div style={{marginTop:8,padding:10,background:T.bg3,borderRadius:8,fontSize:12,color:T.tx2,lineHeight:1.6}}>
                  {(t.colchonMeses||0) >= 6 
                    ? <span style={{color:T.gn}}>{tx("Tu liquidez cubre ","Your liquid assets cover ")}{mesesR(t.colchonMeses)}{tx(" de gastos y cuotas. Bien protegido."," of expenses and payments. Well protected.")}</span>
                    : <span style={{color:"#f59e0b"}}>{tx("Tu liquidez solo cubre ","Your liquid assets only cover ")}{mesesR(t.colchonMeses)}{tx(" de gastos y cuotas. Un asesor recomendaría al menos 6 meses en activos líquidos."," of expenses and payments. An advisor would recommend at least 6 months in liquid assets.")}</span>
                  }
                  <br/><strong>{pctR(((totals2.largo / (grandTotal||1)) * 100), 0)}</strong>{tx(" de tu patrimonio está en activos ilíquidos (no puedes vender rápido)."," of your net worth is in illiquid assets (you can't sell them quickly).")}
                </div>
              </>
            );
          })()}
        </Cd>

        {/* COSTO DE VIDA */}
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"#f59e0b",marginBottom:20}}>{tx("Tu Estilo de Vida en Números","Your Lifestyle in Numbers")}</div>
          {(() => {
            const gastoMes = t.te || 0;
            const gastoDia = gastoMes / 30;
            const gastoHora = gastoDia / 24;
            const gastoMin = gastoHora / 60;
            const ingresoHora = t.ti > 0 ? t.ti / 176 : 0; // 8h laborales
            const horasLibertad = ingresoHora > 0 ? gastoHora / ingresoHora : 0;

            return (
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
                  {[
                    {l:tx("Por mes","Per month"),v:fm(gastoMes),icon:""},
                    {l:tx("Por día","Per day"),v:fm(Math.round(gastoDia)),icon:""},
                    {l:tx("Por hora","Per hour"),v:fm(Math.round(gastoHora)),icon:""},
                    {l:tx("Por minuto","Per minute"),v:fm(Math.round(gastoMin)),icon:""},
                  ].map(k => (
                    <div key={k.l} style={{background:T.bg3,borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
                      <div style={{fontSize:11,color:T.tx3}}>{k.icon} {k.l}</div>
                      <div style={{fontSize:16,fontWeight:700,color:"#f59e0b",marginTop:2}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                <div className="fp-fo-ancho" style={{background:T.bg3,borderRadius:8,padding:12,marginBottom:8}}>
                  <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
                    {tx("Tu ingreso por hora laboral: ","Your income per working hour: ")}<strong style={{color:T.gn}}>{fm(Math.round(ingresoHora))}{tx("/hora","/hour")}</strong><br/>
                    {tx("Necesitas trabajar ","You need to work ")}<strong style={{color:"#f59e0b"}}>{horasLibertad.toFixed(1)}{tx(" horas"," hours")}</strong>{tx(" por cada hora de gastos"," for every hour of expenses")}<br/>
                    {horasLibertad <= 1 
                      ? <span style={{color:T.gn}}>{tx("Ganas más por hora de lo que gastas. Cada hora trabajada genera excedente.","You earn more per hour than you spend. Every hour worked creates a surplus.")}</span>
                      : <span style={{color:T.rd}}>{tx("Gastas más por hora de lo que ganas. Revisa tu estructura de costos.","You spend more per hour than you earn. Review your cost structure.")}</span>
                    }
                  </div>
                </div>
                <div style={{fontSize:12,color:T.tx3,lineHeight:1.6}}>
                  {tx("Cuando evalúes un gasto, piensa: ","When you weigh a purchase, ask: ")}<em>{tx("\"¿Esto vale ","\"Is this worth ")}{fm(Math.round(ingresoHora))}{tx(" × las horas que representa?\""," × the hours it takes?\"")}</em>
                  <br/>{tx("Un gasto de ","A ")}{fm(isUS?1000:1000000)}{tx(" = "," purchase = ")}<strong>{ingresoHora > 0 ? ((isUS?1000:1000000) / ingresoHora).toFixed(1) : "∞"}{tx(" horas"," hours")}</strong>{tx(" de tu trabajo."," of your work.")}
                </div>
              </>
            );
          })()}
        </Cd>
      </div>
      </>}

      {/* Cómo evolucionó en el tiempo — 31-oct-2026: sale de los datos de la
          cuenta (servidor), un punto por mes, con los dólares a la TRM.
          1-nov-2026 (Santiago: «veo una línea recta»). La historia arrancó el
          31-oct: con 2 o 3 meses una curva es una recta que parece inventada.
          Hasta 4 meses se muestra la comparación mes a mes; desde ahí, la curva
          (azul: lo que tienes), con cada mes marcado. No se rellena con las
          declaraciones: ese patrimonio es fiscal (costo) y daría un salto falso. */}
      {(()=>{
        const hs=resumenHistoria(registrarMes(u||{},{trm:trmReal(u)}).historiaPatrimonio);
        if(hs.puntos.length<1||isUS)return null; // 3-nov-2026: la historia se guarda en pesos; en EE. UU. aún no se muestra
        const pts=hs.puntos;
        const c=hs.ano?hs.ano.cambio:hs.mes?hs.mes.cambio:0;
        const titulo=<div><div style={{fontSize:19,fontWeight:600,color:T.tx,letterSpacing:"-0.01em"}}>{tx("¿Cómo ha crecido tu patrimonio?","How has your net worth grown?")}</div><div style={{fontSize:13,color:T.tx3,marginTop:4}}>{tx("Un punto por mes con lo que tenías cargado ese mes. La historia empezó en ","One point per month with what you had entered that month. History starts in ")}{etiquetaMes(pts[0].k)}{tx("; cada mes se suma uno.","; a new point is added each month.")}</div></div>;
        if(pts.length<4){
          return<Cd s={{padding:"clamp(20px,3vw,28px)",marginBottom:20,borderRadius:16}}>
            {titulo}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,160px),1fr))",gap:16,marginTop:20,alignItems:"end"}}>
              {pts.map((p,i)=>{const ult=i===pts.length-1;return<div key={p.k} style={{borderTop:`2px solid ${ult?"var(--fp-azul)":"rgba(var(--fp-ink),0.12)"}`,paddingTop:10}}>
                <div style={{fontSize:12,color:T.tx3}}>{etiquetaMes(p.k)}{ult?tx(" · hoy"," · today"):""}</div>
                <div style={{fontSize:ult?26:20,fontWeight:600,color:T.tx,fontVariantNumeric:"tabular-nums"}}>{fm(p.nw)}</div>
              </div>})}
              {pts.length>1&&<div style={{paddingTop:12}}>
                <div style={{fontSize:12,color:T.tx3}}>{tx("Cambio","Change")}</div>
                <div style={{fontSize:20,fontWeight:600,color:c>=0?"var(--fp-pos)":"var(--fp-neg)",fontVariantNumeric:"tabular-nums"}}>{c>=0?"+":"−"}{fm(Math.abs(c))}</div>
              </div>}
            </div>
            <div style={{fontSize:12,color:T.tx3,marginTop:14}}>{pts.length===1?tx("El próximo mes verás cuánto cambió.","Next month you'll see how much it changed."):tx(`Con ${4-pts.length===1?"un mes":(4-pts.length)+" meses"} más verás la curva.`,`${4-pts.length===1?"One more month":(4-pts.length)+" more months"} and you'll see the curve.`)}</div>
          </Cd>;
        }
        const data=pts.map(p=>({m:etiquetaMes(p.k),nw:p.nw}));
        return<Cd s={{padding:"clamp(20px,3vw,28px)",marginBottom:20,borderRadius:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12,marginBottom:12}}>
            {titulo}
            <div style={{textAlign:"right"}}><div style={{fontSize:12,color:T.tx3}}>{hs.ano?tx("Desde ","Since ")+etiquetaMes(hs.ano.desde):tx("Este mes","This month")}</div><div style={{fontSize:20,fontWeight:600,color:c>=0?"var(--fp-pos)":"var(--fp-neg)",fontVariantNumeric:"tabular-nums"}}>{c>=0?"+":"−"}{fm(Math.abs(c))}</div></div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={MARGEN_EJE}>
              <defs><linearGradient id="fpGradHist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="1" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid {...gridProps}/><XAxis dataKey="m" {...axisProps}/>
              <YAxis {...axisProps} width={78} domain={[v=>Math.floor(v*0.97),v=>Math.ceil(v*1.02)]} tickFormatter={v=>sinCorte(fm(v).replace("$",""))}/>
              <Tooltip content={<ChartTooltip formatter={v=>fm(v)}/>}/>
              <Area type="monotone" dataKey="nw" name={tx("Patrimonio neto","Net worth")} stroke="#3b82f6" strokeWidth={2.5} fill="url(#fpGradHist)" dot={{r:3.5,fill:"#3b82f6",strokeWidth:0}} activeDot={{r:5}}/>
            </AreaChart>
          </ResponsiveContainer>
        </Cd>;
      })()}

      <SecH n={4} t={tx("¿Hacia dónde vas?","Where are you headed?")} s={tx("Proyección, independencia financiera y alertas","Projection, financial independence and alerts")}/>
      {/* ══════════ 4 · ¿HACIA DÓNDE VOY? ══════════
          Proyección e independencia financiera. */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"2fr 1fr",gap:20}}>
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:20}}>{tx("Proyección Patrimonial (8% anual)","Net Worth Projection (8% a year)")}</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={pj} margin={MARGEN_EJE}><ChartGradients/><CartesianGrid {...gridProps}/><XAxis dataKey="yr" {...axisProps}/><YAxis {...axisProps} width={78} tickFormatter={v=>sinCorte(fm(v).replace("$",""))}/><Tooltip content={<ChartTooltip formatter={v=>fm(v)}/>}/><Area type="monotone" dataKey="v" stroke={CHART.green} strokeWidth={2.5} fill="url(#gradGreen)"/></AreaChart>
          </ResponsiveContainer>
        </Cd>
        {/* Independence Progress */}
        <Cd s={{padding:"24px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:24}}>{tx("Independencia Financiera","Financial Independence")}</div>
          <AvisoCambioNivel T={T}/>
          <div style={{position:"relative",height:14,background:T.bg3,borderRadius:8,overflow:"hidden",marginBottom:8}}>
            <div style={{height:"100%",width:Math.min(t.ind,150)+"%",maxWidth:"100%",background:t.ind>=100?"linear-gradient(90deg,#00c805,#3b82f6)":"linear-gradient(90deg,#ff5000,#f59e0b)",borderRadius:8,transition:"width 0.5s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.tx3}}>
            <span>0%</span><span style={{color:t.ind>=100?T.gn:T.tx2,fontWeight:700}}>{pc(t.ind)}</span><span>100%</span>
          </div>
          <div style={{marginTop:16,fontSize:12,color:T.tx2,lineHeight:1.6}}>
            {t.ind>=100
              ?<span style={{color:T.gn}}>{tx("¡Tu ingreso pasivo cubre todos tus gastos y cuotas!","Your passive income covers all your expenses and payments!")}</span>
              :<span>{tx("Tu ingreso pasivo (","Your passive income (")}{fm(t.ingresoPasivo)}{tx("/mes) cubre el ","/mo) covers ")}{pc(t.ind)}{tx(" de tus gastos y cuotas. Te faltan "," of your expenses and payments. You're ")}{fm(Math.max(0,(t.ob||0)-(t.ingresoPasivo||0)))}{tx("/mes de ingreso pasivo.","/mo short in passive income.")}</span>
            }
          </div>
          {t.ind<100&&<div style={{marginTop:8,fontSize:12,color:T.tx3}}>
            {tx("Meta: ","Goal: ")}{fm(t.ob)}{tx("/mes de ingreso pasivo (arriendos netos, intereses, dividendos) para ser independiente.","/mo in passive income (net rent, interest, dividends) to be independent.")}
          </div>}
        </Cd>
      </div>
      {/* Alertas de detalle. Cierra la página: son avisos puntuales, no el
          diagnóstico principal — ese lo da el bloque del family office arriba. */}
      <Cd s={{padding:20,marginTop:20,background:"linear-gradient(135deg,rgba(255,80,0,0.03),rgba(245,158,11,0.02))"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#f59e0b",marginBottom:20}}>{tx("Alertas del Asesor — Rebalanceo y Ajustes","Advisor Alerts — Rebalancing and Adjustments")}</div>
        {(() => {
          const alerts = [];
          const inv = ((u&&u.inv)||[]).filter(i=>i.sim!==false);
          const ing = ((u&&u.ingresos)||[]).filter(i=>i.sim!==false);
          const totalA = inv.reduce((s,i) => s + vaCOP(i,trmPais), 0) + ib.tv;
          
          // 1. Real estate concentration
          const reVal = inv.filter(i => ["Real Estate","Bodega","Lote","Local Comercial"].includes(i.tp||i.tipo)).reduce((s,i) => s + vaCOP(i,trmPais), 0);
          const rePct = totalA > 0 ? (reVal / totalA * 100) : 0;
          if (rePct > 60) alerts.push({type:"",title:tx("Concentración inmobiliaria extrema","Extreme real estate concentration"),msg:tx("El "+pctR(rePct, 0)+" de tu patrimonio está en inmuebles. Si el mercado inmobiliario cae, tu patrimonio se impacta fuertemente. Considera diversificar al menos "+fm(reVal*0.15)+" hacia renta fija, fondos o acciones internacionales.",pctR(rePct, 0)+" of your net worth is in real estate. If the property market drops, your net worth takes a big hit. Consider moving at least "+fm(reVal*0.15)+" into bonds, funds or international stocks."),cat:tx("Diversificación","Diversification")});
          else if (rePct > 45) alerts.push({type:"",title:tx("Alta exposición inmobiliaria","High real estate exposure"),msg:tx("El "+pctR(rePct, 0)+" está en inmuebles. "+(isUS?"":"Es común en Colombia pero ")+"te expone a riesgo de liquidez. Un portafolio balanceado tiene máximo 40% en un solo tipo de activo.",pctR(rePct, 0)+" is in real estate, which exposes you to liquidity risk. A balanced portfolio keeps any single asset type at 40% or less."),cat:tx("Diversificación","Diversification")});

          // 2. Single asset risk
          const maxAsset = inv.reduce((max,i) => vaCOP(i,trmPais) > max.v ? {n:i.n||i.nombre||"",v:vaCOP(i,trmPais)} : max, {n:"",v:0});
          const maxPct = totalA > 0 ? (maxAsset.v / totalA * 100) : 0;
          if (maxPct > 35) alerts.push({type:"",title:maxAsset.n+" = "+pctR(maxPct, 0)+tx(" del patrimonio"," of net worth"),msg:tx("Ningún activo debería superar el 30%. Considera vender una porción o no seguir incrementando esta posición. Mover "+fm(maxAsset.v*0.1)+" a otros activos reduciría tu riesgo.","No single asset should be over 30%. Consider selling part of it or not adding more. Moving "+fm(maxAsset.v*0.1)+" to other assets would lower your risk."),cat:tx("Concentración","Concentration")});

          // 3. Income dependency
          const maxIng = ing.reduce((max,i) => montoPromedioMensual(i) > max.v ? {n:i.nombre||"",v:montoPromedioMensual(i)} : max, {n:"",v:0});
          const maxIngPct = t.ti > 0 ? (maxIng.v / t.ti * 100) : 0;
          if (maxIngPct > 40) alerts.push({type:"",title:tx("Dependencia de ingreso: ","Income dependence: ")+maxIng.n,msg:tx("El "+pctR(maxIngPct, 0)+" de tus ingresos viene de una sola fuente. Si esa fuente falla, tu cash flow cae "+fm(maxIng.v)+"/mes. Diversifica fuentes de ingreso.",pctR(maxIngPct, 0)+" of your income comes from one source. If it stops, your cash flow drops "+fm(maxIng.v)+"/mo. Diversify your income sources."),cat:tx("Riesgo de ingreso","Income risk")});

          // 4. Debt-to-income
          const dti = t.cargaDeudaPct || 0;
          if (dti > 40) alerts.push({type:"",title:tx("Carga de deuda alta: ","High debt load: ")+pctR(dti),msg:tx("Más del 40% de tu ingreso va a cuotas. Prioriza pagar la deuda de mayor tasa. Meta: bajar a menos del 30%.","More than 40% of your income goes to payments. Pay off the highest-rate debt first. Goal: get under 30%."),cat:tx("Deuda","Debt")});

          // 5. Savings rate
          const savR = t.ahorroPct || 0;
          if (savR < 10 && savR >= 0) alerts.push({type:"",title:tx("Tasa de ahorro baja: ","Low savings rate: ")+pctR(savR),msg:tx("Los family offices recomiendan ahorrar al menos 20% del ingreso. Busca reducir gastos variables o incrementar ingresos pasivos.","Family offices recommend saving at least 20% of income. Cut variable expenses or grow passive income."),cat:tx("Ahorro","Savings")});
          if (savR < 0) alerts.push({type:"",title:tx("Ahorro negativo — estás descapitalizándote","Negative savings — you're drawing down your capital"),msg:tx("Gastas "+fm(Math.abs(t.cf))+"/mes más de lo que ganas. Esto erosiona tu patrimonio. Acción urgente: recortar gastos o generar más ingresos.","You spend "+fm(Math.abs(t.cf))+"/mo more than you earn. This erodes your net worth. Urgent: cut expenses or bring in more income."),cat:"Cash Flow"});

          // 6. Vehicles depreciating
          const vehiculos = inv.filter(i => (i.tp||i.tipo) === "Vehículo");
          const vehVal = vehiculos.reduce((s,i) => s + vaCOP(i,trmPais), 0);
          const vehPct = totalA > 0 ? (vehVal / totalA * 100) : 0;
          if (vehPct > 5) alerts.push({type:"",title:tx("Vehículos = ","Vehicles = ")+pctR(vehPct)+tx(" del patrimonio"," of net worth"),msg:tx("Los vehículos pierden ~15% de valor por año. "+fm(vehVal)+" en activos que se deprecian. Un family office los considera gastos, no inversiones.","Vehicles lose ~15% of their value a year. "+fm(vehVal)+" sits in depreciating assets. A family office treats them as expenses, not investments."),cat:tx("Depreciación","Depreciation")});

          // 7. Positive alerts
          const passR = t.pctIngresoPasivo || 0;
          if (passR >= 80) alerts.push({type:"",title:tx("Ingreso pasivo "+pctR(passR, 0)+" — excelente","Passive income "+pctR(passR, 0)+" — excellent"),msg:tx("La mayoría de tu ingreso no depende de tu trabajo. Esto te da libertad y reduce riesgo. Mantén esta estructura.","Most of your income doesn't depend on your work. That gives you freedom and lowers risk. Keep this structure."),cat:tx("Independencia","Independence")});

          const fireN = t.gfm * 12 * 25;
          const fireP = fireN > 0 ? (t.nw / fireN * 100) : 0;
          if (fireP >= 100) alerts.push({type:"",title:tx("FIRE alcanzado — libertad financiera","FIRE reached — financial freedom"),msg:tx("Tu patrimonio supera tu FIRE number. Técnicamente puedes vivir de tus activos por 25+ años sin trabajar.","Your net worth exceeds your FIRE number. In principle you can live off your assets for 25+ years without working."),cat:tx("Libertad","Freedom")});
          else if (fireP >= 70) { const aF=añosParaMeta(t.nw,fireN,Math.max(0,t.cf),0.05); alerts.push({type:"",title:tx("FIRE al "+pctR(fireP, 0)+" — muy cerca","FIRE at "+pctR(fireP, 0)+" — very close"),msg:tx("Te falta "+fm(fireN - t.nw)+" para la independencia total. ","You're "+fm(fireN - t.nw)+" away from full independence. ")+(aF!=null?tx("Proyectado a 5% real anual, llegas en ~"+(aF<1?"menos de 1":fmtAniosEs(aF))+" años.","At 5% real a year, you get there in ~"+(aF<1?"less than 1":aF.toLocaleString(localeCifras(),{maximumFractionDigits:1}))+" years."):tx("Genera ahorro mensual positivo para proyectarlo.","Build positive monthly savings to project it.")),cat:tx("Progreso","Progress")}); }

          if (alerts.length === 0) alerts.push({type:"",title:tx("Sin alertas","No alerts"),msg:tx("Tu situación financiera está bien balanceada. Sigue monitoreando mensualmente.","Your finances are well balanced. Keep checking monthly."),cat:"General"});

          return (
            <div style={{display:"grid",gap:8}}>
              {alerts.sort((a,b) => {const o={"":0,"":1,"":2};return (o[a.type]||2)-(o[b.type]||2)}).map((a,i) => (
                <div key={i} style={{display:"flex",gap:10,padding:12,background:a.type===""?"rgba(255,80,0,0.06)":a.type===""?"rgba(245,158,11,0.04)":"rgba(0,200,5,0.04)",border:"1px solid "+(a.type===""?"rgba(255,80,0,0.12)":a.type===""?"rgba(245,158,11,0.1)":"rgba(0,200,5,0.1)"),borderRadius:12}}>
                  <span style={{fontSize:18,flexShrink:0,marginTop:2}}>{a.type}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,fontWeight:700,color:a.type===""?T.rd:a.type===""?"#f59e0b":T.gn}}>{a.title}</span>
                      <span style={{fontSize:11,color:T.tx3,background:T.bg3,padding:"10px 14px",borderRadius:3}}>{a.cat}</span>
                    </div>
                    <div style={{fontSize:12,color:T.tx2,marginTop:4,lineHeight:1.6}}>{a.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </Cd>
      </>);
      })()}

      </div>
    </div>}
        
case"inv":return isUS?<AssetsModuleUS inversiones={(u&&u.inv)||[]} deudas={(u&&u.deu)||[]} onUpdateAssets={v=>upd("inv",v)} onUpdateLiabs={v=>upd("deu",v)} initialTab="assets" plan={plan} onUpgrade={()=>setPg("price")}/>:<InversionesModule owners={u?.owners||[]} inversiones={(u&&u.inv)||[]} deudas={(u&&u.deu)||[]} onUpdate={v=>upd("inv",v)} onCrearIngreso={(ing)=>upd("ingresos",[...((u&&u.ingresos)||[]),ing])} onSyncIngreso={(activoId,ing)=>{const lst=(u&&u.ingresos)||[];const hay=lst.some(x=>x&&x.activoId===activoId&&x.desdePatrimonio);let n;if(!ing)n=lst.filter(x=>!(x&&x.activoId===activoId&&x.desdePatrimonio));else if(hay)n=lst.map(x=>(x&&x.activoId===activoId&&x.desdePatrimonio)?{...x,...ing,id:x.id}:x);else n=[...lst,{...ing,id:"ing_"+Date.now()}];if(JSON.stringify(n)!==JSON.stringify(lst))upd("ingresos",n);}} fmt={fm} onImport={()=>setShowImport(true)} user={u} trm={trm} plan={plan} onUpgrade={()=>setPg("price")}/>;
    case"ing":return isUS?<IncomeModuleUS ingresos={(u&&u.ingresos)||[]} onUpdate={v=>upd("ingresos",v)} trm={trm} plan={plan} onUpgrade={()=>setPg("price")}/>:<IngresosModule owners={u?.owners||[]} ingresos={(u&&u.ingresos)||[]} onUpdate={v=>upd("ingresos",v)} onIrAPatrimonio={(activoId)=>{try{if(activoId)sessionStorage.setItem("fp3_abrir_activo",activoId)}catch{}setPg("inv")}} trm={trm} cur={cur} fmt={fm} onImport={()=>setShowImport(true)} user={u} authUser={authUser} plan={plan} onUpgrade={()=>setPg("price")}/>;
    case"trd":return gated("trd","Básico",<div><PageHeader label="Inversiones US" title="Trading" subtitle="Posiciones, P/L, upside y objetivos por acción." rightSlot={<><Bt sz="s" onClick={async()=>{
              const tickers=((u&&u.ibk)||[]).map(p=>p.tk).filter(Boolean).join(",");
              if(!tickers)return alert("No hay posiciones con ticker");
              try{
                const r=await fetch("/api/stock-price?tickers="+encodeURIComponent(tickers));
                const d=await r.json();
                if(d.prices){
                  const updated=((u&&u.ibk)||[]).map(p=>{
                    const q=d.prices[p.tk?.toUpperCase()];
                    if(q&&q.price>0)return{...p,pr:q.price,n:p.n||q.name};
                    return p;
                  });
                  upd("ibk",updated);
                  // 26-jul-2026: antes solo decía cuántos se actualizaron. Si
                  // un ticker fallaba —opciones, cripto, símbolos raros— el
                  // usuario no se enteraba y ese precio quedaba viejo sin aviso.
                  const fall=(d.fallidos||[]);
                  alert(""+Object.keys(d.prices).length+" precios actualizados"+
                    (fall.length?"\n\nSin precio ("+fall.length+"): "+fall.join(", ")+"\nEsos conservan el valor anterior. Las opciones y algunos símbolos no están en la fuente.":""));
                }else{alert("No se encontraron precios"+(d.error?": "+d.error:""))}
              }catch(e){alert("Error: "+e.message)}
            }} st={{background:"#3b82f6",color:"#fff"}}>Actualizar Precios</Bt><Bt sz="s" onClick={()=>{sF({});setMd("ib")}}>+ Posición</Bt>{((u&&u.ibk)||[]).length>1&&<Bt v="d" sz="s" onClick={()=>{if(confirm("¿Eliminar TODAS las posiciones de trading?"))upd("ibk",[])}}>Limpiar</Bt>}</>}/><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:18}}><StatCard label="VALOR PORTFOLIO" value={fm(ib.tv)} accent={CHART.green} highlight/><StatCard label="P/L TOTAL" value={fm(ib.pnl)} sub={pc(ib.pp)} subColor={ib.pnl>=0?"positive":"negative"} accent={ib.pnl>=0?CHART.green:CHART.red} trend={ib.pnl>=0?"up":"down"}/><StatCard label="POSICIONES" value={ib.pos.length} accent={CHART.blue}/></div><Cd s={{padding:0}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Ticker","Nombre","Qty","Costo","Precio","Valor","P/L","%","Upside"].map(h=><th key={h} style={{padding:"9px 12px",textAlign:["Ticker","Nombre"].includes(h)?"left":"right",color:T.tx3,fontWeight:600,fontSize:11,borderBottom:`1px solid ${T.border}`}}>{h}</th>)}</tr></thead><tbody>{ib.pos.map((p,i)=><tr key={i} style={{borderBottom:`1px solid ${T.border}`}}><td style={{padding:"9px 12px",fontWeight:700,color:T.gn,fontFamily:"monospace"}}>{p.tk}</td><td style={{padding:"9px 12px"}}>{p.n}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>{p.sh}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>${p.cb.toFixed(2)}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>${p.pr.toFixed(2)}</td><td style={{padding:"9px 12px",textAlign:"right",fontWeight:600}}>{fm(p.va)}</td><td style={{padding:"9px 12px",textAlign:"right",fontWeight:600,color:p.pnl>=0?T.gn:T.rd}}>{fm(p.pnl)}</td><td style={{padding:"9px 12px",textAlign:"right",color:p.pp>=0?T.gn:T.rd}}>{pc(p.pp)}</td><td style={{padding:"9px 12px",textAlign:"right",color:p.up===null?T.tx3:T.bl}}>{p.up===null?"—":pc(p.up)}</td></tr>)}</tbody></table></div></Cd><Md open={md==="ib"} onClose={()=>setMd(null)} title="Agregar Posición"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>{[["tk","Ticker"],["n","Nombre"],["sh","Cantidad","number"],["cb","Costo unitario","number"],["pr","Precio actual","number"],["tg","Objetivo","number"]].map(([k,l,tp])=><In key={k} l={l} value={f[k]} onChange={v=>sF(p=>({...p,[k]:v}))} type={tp}/>)}
              <div style={{gridColumn:"1/-1"}}>
                <div style={{fontSize:12,color:T.tx3,marginBottom:6,fontWeight:600}}>Tipo de instrumento</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[{v:1,l:"Acción / ETF / Cripto",d:"El valor es cantidad × precio"},{v:100,l:"Opción",d:"Cada contrato equivale a 100 acciones"}].map(o=>
                    <button key={o.v} onClick={()=>sF(p=>({...p,mult:o.v}))} style={{flex:"1 1 200px",textAlign:"left",background:(+f.mult||1)===o.v?T.gn+"1a":T.bg3,border:"1px solid "+((+f.mult||1)===o.v?T.gn:T.border),borderRadius:10,padding:"10px 12px",cursor:"pointer",color:T.tx}}>
                      <div style={{fontSize:13,fontWeight:700}}>{o.l}</div>
                      <div style={{fontSize:12,color:T.tx3,marginTop:2}}>{o.d}</div>
                    </button>)}
                </div>
                {(+f.mult||1)===100&&+f.sh>0&&+f.pr>0&&<div style={{fontSize:12,color:T.gn,marginTop:8,fontFamily:"monospace"}}>
                  {f.sh} contrato{+f.sh===1?"":"s"} × ${f.pr} × 100 = {fm((+f.sh)*(+f.pr)*100)}
                </div>}
              </div></div><div style={{display:"flex",gap:12,justifyContent:"flex-end"}}><Bt v="s" onClick={()=>setMd(null)}>Cancelar</Bt><Bt onClick={()=>{add("ibk",{tk:f.tk||"",n:f.n||"",sh:+f.sh||0,cb:+f.cb||0,pr:+f.pr||0,tg:+f.tg||0,mult:+f.mult||1});setMd(null);sF({})}}>Agregar</Bt></div></Md></div>);
        case"gas":return isUS?<ExpensesModuleUS gastos={(u&&u.gas)||{}} onUpdate={v=>upd("gas",v)} agi={t.ti*12}/>:<GastosModule trm={trm} owners={u?.owners||[]} ingresos={u?.ingresos||[]} gastos={(u&&u.gas)||{}} onUpdate={v=>upd("gas",v)} fmt={fm} onImport={()=>setShowImport(true)} plan={plan} onUpgrade={()=>setPg("price")} user={u} authUser={authUser}/>;
        case"deu":return<DeudasModule trm={trmPais} owners={u?.owners||[]} deudas={(u&&u.deu)||[]} inversiones={(u&&u.inv)||[]} onUpdate={v=>upd("deu",v)} fmt={isUS?plataRegion:fm} onImport={()=>setShowImport(true)} user={u} plan={plan} onUpgrade={()=>setPg("price")} authUser={authUser} cashFlow={t.cf} onExtraADeudasChange={setExtraADeudas}/>;
    case"met":return isUS
      ?<GoalsModuleUS
          goals={(u&&u.metas)||[]}
          onUpdateGoals={v=>upd("metas",v)}
          netWorth={t.nw}
          annualIncome={t.ti*12}
          monthlyExpenses={t.te}
          monthlySavings={t.cf}
          currentAge={u?.pen?.age||35}
          retirementBalance={(u?.inv||[]).filter(i=>["Fondo de Inversión","CDT","Acciones"].includes(i.tp||i.tipo)).reduce((s,i)=>s+vaCOP(i,trm),0)}
        />
      :<MetasModule metas={(u&&u.metas)||[]} onUpdate={v=>upd("metas",v)} cashFlow={t.cf} fmt={fm} trm={trmPais} norte={u?.norte||null} cfFuenteLabel={"CF mensual post-cuotas (t.cf / FlujoAnual; mismo neteo que #19 / simT.cf). Extra a deudas restado si Plan a cero (P0.3) está activo."} onNavigateNorte={()=>setPg("norte")} extraADeudas={extraADeudas}/>;
    // «Escenarios a 10 años» (MiPlan) se retiró del menú: lo reemplaza «Mi futuro a 10 años».
    // Links/estado viejo con pg="plan" muestran f10. Datos guardados (perfilPlan, caminos…) se conservan.
    // 1-nov-2026 (Santiago): «Mi futuro a 10 años» se despliega en el menú como
    // «Este año», con dos subsecciones: Creador de escenarios y Escenarios creados.
    case"plan":
    case"f10":
    case"f10crear":
    case"f10esc":{
      const vistaF10=pg==="f10crear"?"crear":pg==="f10esc"?"creados":(((u?.futuro10?.escenarios)||[]).length?"creados":"crear");
      return <MiFuturo10 vista={vistaF10} onCambiarVista={v=>setPg(v==="crear"?"f10crear":"f10esc")} user={{inflacionPct:u?.inflacionPct,inv:(u&&u.inv)||[],ingresos:(u&&u.ingresos)||[],gas:(u&&u.gas)||{},deu:(u&&u.deu)||[],trm:trmPais,owners:(u&&u.owners)||[],taxConfig:u?.taxConfig}} guardado={u?.futuro10||{}} demo={!!u?.p?.demo} onGuardar={v=>{if(u?.p?.demo)return;upd("futuro10",v)}}/>;
    }
    case"simf":return <><SimuladorFuturo user={{gastos:(u&&u.gas)||{},deudas:(u&&u.deu)||[],trm:trmPais,taxConfig:u?.taxConfig,ingresos:(u&&u.ingresos)||[],inv:(u&&u.inv)||[],owners:(u&&u.owners)||[{id:"own_1",name:"Personal",type:"natural"}],_calRef:calRefFuturo,_calRefHoy:calRef}} escenarios={u?.escenarios||[]} onUpdate={v=>upd("escenarios",v)} onNavigate={setPg}/><NotaFuenteImpuesto modo="futuro" cal={calRefFuturo} owners={(u?.owners)||[]} onNavigate={setPg}/></>;
    case"sim":return isUS?<SimuladorUS user={{ingresos:(u&&u.ingresos)||[],gastos:(u&&u.gas)||{},deudas:(u&&u.deu)||[],trm:u?.trm||1}} totals={t}/>:<><SimuladorAvanzado trmReal={trm>0?trm:null} impuestoData={impRef} onInflacionChange={v=>upd("inflacionPct",v)} user={{inflacionPct:u?.inflacionPct,inv:(u&&u.inv)||[],gastos:(u&&u.gas)||{},deudas:(u&&u.deu)||[],ibkr:(u&&u.ibk)||[],trm,ingresos:(u&&u.ingresos)||[],metas:(u&&u.metas)||[],owners:(u&&u.owners)||[{id:"own_1",name:"Personal",type:"natural"}],_calRef:calRef}} totals={t} fmt={fm} onNavigate={setPg} onMarcarRenta={modoConsulta?null:(idx,v)=>setU(p=>p?{...p,ingresos:(p.ingresos||[]).map((x,n)=>n===idx?{...x,rentaPasiva:v}:x)}:p)}/><NotaFuenteImpuesto modo="actual" cal={calRef} owners={(u?.owners)||[]} detalle={impRef?.detalle||[]} onNavigate={setPg}/></>;
    // "anio" es la puerta del menú, no una página: si alguien cae ahí, es el mes a mes.
    case"anio":
    case"flujo":return <><FlujoAnual user={u} trm={trmPais} isEN={isEN}/><NotaFuenteImpuesto modo="actual" cal={calRef} owners={(u?.owners)||[]} detalle={impRef?.detalle||[]} onNavigate={setPg}/></>;
    // Panel del dueño del producto — bloqueado por email en el cliente Y en la
    // función serverless (que además valida contra su propia lista de admins).
    case"metrics":return isAdmin?<AdminMetrics email={u?.p?.email} fmt={fm} T={T}/>:<div style={{padding:40,textAlign:"center",color:T.tx3}}>No disponible.</div>;
    case"pat":{const bc={};((u&&u.inv)||[]).filter(i=>i.sim!==false).forEach(i=>{const tp=inferType(i);bc[tp]=(bc[tp]||0)+vaCOP(i,trm)});if(ib.tv>0)bc.Trading=ib.tv*trm/*26-jul-2026: ib.tv está en USD porque las posiciones se cargan en dólares, pero se sumaba tal cual a una distribución donde todo lo demás pasó por vaCOP y está en pesos. Categoría en dólares mezclada entre categorías en pesos, y ~3.262 veces más chica de lo real.*/;const pie=Object.entries(bc).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);const gr=t.ab+ib.tv;return<div><PageHeader label="Patrimonio" title="Tus activos" subtitle="Distribución y rendimiento real."/><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:18}}><StatCard label="ACTIVOS TOTALES" value={fm(gr)} accent={CHART.green}/><StatCard label="PASIVOS" value={fm(t.td)} accent={CHART.red}/><StatCard label="PATRIMONIO NETO" value={fm(t.nw)} accent={CHART.blue} highlight/></div><div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:14}}><div style={{background:"rgba(var(--fp-ink),0.02)",border:`1px solid ${CHART.border}`,borderRadius:12,padding:24,backgroundImage:`radial-gradient(circle at 0% 0%, ${CHART.green}08 0%, transparent 50%)`}}><div style={{fontSize:12,fontWeight:700,color:CHART.txt3,marginBottom:14,letterSpacing:"0.06em"}}>Distribución</div>{pie.length>0?<ResponsiveContainer width="100%" height={240}><PieChart><Pie data={pie} dataKey="value" cx="50%" cy="50%" innerRadius={56} outerRadius={92} paddingAngle={3} stroke="none">{pie.map((_,i)=><Cell key={i} fill={CHART.series[i%CHART.series.length]}/>)}</Pie><Tooltip content={<ChartTooltip formatter={v=>fm(v)}/>}/></PieChart></ResponsiveContainer>:<div style={{height:240,display:"flex",alignItems:"center",justifyContent:"center",color:CHART.txt3}}>Agrega datos</div>}</div><div style={{background:"rgba(var(--fp-ink),0.02)",border:`1px solid ${CHART.border}`,borderRadius:12,padding:24}}><div style={{fontSize:12,fontWeight:700,color:CHART.txt3,marginBottom:14,letterSpacing:"0.06em"}}>Desglose por categoría</div>{pie.map((a,i)=>{const pct=(a.value/gr)*100;return<div key={a.name} style={{padding:"10px 0",borderBottom:i<pie.length-1?`1px solid ${CHART.border}`:"none"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:10,height:10,borderRadius:3,background:CHART.series[i%CHART.series.length],boxShadow:`0 0 8px ${CHART.series[i%CHART.series.length]}40`}}/><span style={{fontSize:13,fontWeight:500,color:CHART.txt}}>{a.name}</span></div><div style={{fontFamily:CHART.fontMono,fontVariantNumeric:"tabular-nums",display:"flex",alignItems:"baseline",gap:8}}><span style={{fontWeight:700,fontSize:13,color:CHART.txt}}>{fm(a.value)}</span><span style={{fontSize:12,color:CHART.txt3,minWidth:42,textAlign:"right"}}>{fmtPctEs(pct, 1)}</span></div></div><div style={{height:3,background:CHART.border,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:CHART.series[i%CHART.series.length],borderRadius:999,transition:"width 0.4s"}}/></div></div>})}</div></div></div>}
    case"pen":return isUS?<RetirementModuleUS user={u}/>:gated("pen","Básico",<CalculadoraPDF titulo="Pensión" subtitulo="Colpensiones y fondo privado"><PensionesColpensiones trm={trm} fm={fm} owners={u?.owners||[]} pensiones={u?.pensiones||{}} onGuardarPension={(id,v)=>{if(!modoConsulta)setU(p=>p?{...p,pensiones:{...(p.pensiones||{}),[id]:v}}:p)}}/></CalculadoraPDF>);
    case"tax":{
      if(isUS)return<TaxPlanningUS user={u} fmt={fm} onUpdateUser={setU}/>;
      // Sub-pantallas modales (descuentos jurídica, aportes natural, ayuda)
      if(descuentosOwnerId){
        const descOwner=(u?.owners||[]).find(o=>o.id===descuentosOwnerId);
        if(descOwner&&descOwner.type==="juridica"){
          return gated("tax","Pro",<EditarDescuentosTributarios
            owner={descOwner}
            onCancel={()=>setDescuentosOwnerId(null)}
            onSave={(descuentos)=>{
              const nw=(u.owners||[]).map(o=>o.id===descuentosOwnerId?{...o,descuentosTributarios:descuentos}:o);
              setU({...u,owners:nw});
              setDescuentosOwnerId(null);
              showToast(`Descuentos guardados para ${descOwner.name}`);
            }}
          />);
        }
      }
      if(aportesOwnerId){
        const aptOwner=(u?.owners||[]).find(o=>o.id===aportesOwnerId);
        if(aptOwner&&aptOwner.type==="natural"){
          return gated("tax","Pro",<EditarAportesManuales
            owner={aptOwner}
            onCancel={()=>setAportesOwnerId(null)}
            onSave={(aportes)=>{
              const nw=(u.owners||[]).map(o=>o.id===aportesOwnerId?{...o,aportes}:o);
              setU({...u,owners:nw});
              setAportesOwnerId(null);
              showToast(`Aportes guardados para ${aptOwner.name}`);
            }}
          />);
        }
      }
      if(showAyuda){
        return gated("tax","Pro",<AyudaDeclaracion onClose={()=>setShowAyuda(false)}/>);
      }
      // ─────────────────────────────────────────────────────────────────
      // REDISEÑO LINEAL · Sesión 1-may-2026 (definitivo tras 4 iteraciones)
      // UNA SOLA pantalla con 3 etapas en flow vertical.
      //   Paso 1: Tu borrador (lo que entiende la app)
      //   Paso 2: Optimización (preguntas de ahorro)
      //   Paso 3: Declaración casi lista (con detalle F-110/F-210 embebido)
      // Sin tabs, sin modos paralelos. Vista familiar y declaraciones
      // anteriores se acceden desde el menú lateral como entradas separadas.
      // ─────────────────────────────────────────────────────────────────
      // 29-oct-2026 (Santiago: "el módulo de impuestos es muy complicado… necesito
      // estimar cuánto voy a pagar"). Impuestos abre «Lo que viene»: parte de la
      // última declaración de cada titular y solo pregunta qué cambió. El borrador
      // detallado desde cero sigue en "taxdet" para quien lo necesite.
      return gated("tax","Pro",<><NotaTrmDeclaracion u={u}/><EstimadoRenta u={u} onGuardar={(est)=>upd("estimadoRenta",est)} onGuardarVersiones={(l)=>upd("versionesRenta",l)} onNavigate={setPg} onCambiarMes={(id,m)=>upd("owners",(u?.owners||[]).map(o=>o.id===id?{...o,mesDeclaracion:m}:o))}/>
        <button type="button" onClick={()=>setPg("taxdet")} style={{marginTop:12,background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:12,textDecoration:"underline"}}>¿Prefieres el borrador detallado, renglón por renglón? Ábrelo aquí</button></>);
    }
    case"taxinf":return gated("tax","Pro",<InformeContador u={u} onNavigate={setPg}/>);
    case"contclientes":return <VistaContador supabase={supabase} clientes={clientesContador}/>;
    case"taxcalc":return gated("tax","Pro",<><NotaTrmDeclaracion u={u}/><EstimadoRenta u={u} onGuardar={(est)=>upd("estimadoRenta",est)} onGuardarVersiones={(l)=>upd("versionesRenta",l)} onNavigate={setPg} onCambiarMes={(id,m)=>upd("owners",(u?.owners||[]).map(o=>o.id===id?{...o,mesDeclaracion:m}:o))}/></>);
    case"taxdet":return isUS?null:gated("tax","Pro",<><NotaTrmDeclaracion u={u}/><DeclaracionFlow
        user={u}
        estimacion={estimarImpuesto(u)}
        onUpdateUser={(newUser)=>setU(newUser)}
        ano={DEFAULT_AG}
      /></>);
    case"famtax":return gated("tax","Pro",<VistaFamiliarConsolidada
      user={u}
      estimacion={estimarImpuesto(u)}
      ano={DEFAULT_AG}
      onSelectOwner={()=>{setPg("tax")}}
    />);
    case"taxopt":return gated("tax","Pro",<TaxOptimizerUS user={u}/>);
    case"gocasional":return gated("tax","Pro",<OptimizadorGananciaOcasional u={u} onGuardar={(lista)=>upd("calculosGO",lista)}/>);
    case"prevtax":return gated("tax","Pro",<HistorialDeclaraciones
      user={authUser}
      calRef={calRef}
      detalleImpuesto={impRef?.detalle||[]}
      onGuardarDeclaracion={guardarDeclaracion}
      onCambiarMes={(id,m)=>upd("owners",(u?.owners||[]).map(o=>o.id===id?{...o,mesDeclaracion:m}:o))}
      u={u}
      owners={(u&&u.owners)||[]}
      onNavigate={setPg}
      onDeleteDeclaracion={(ownerId,ano)=>{
        upd("owners",(u?.owners||[]).map(o=>o.id!==ownerId?o:{...o,declaraciones:(o.declaraciones||[]).filter(d=>Number(d?.anoGravable)!==Number(ano))}));
        showToast("Declaración "+ano+" borrada");
      }}
      onSaveDeclaracion={(ownerId,declaracion)=>{
        const owners=(u&&u.owners||[]).map(o=>{
          if(o.id!==ownerId)return o;
          const actuales=Array.isArray(o.declaraciones)?[...o.declaraciones]:[];
          const anoNuevo=Number(declaracion.anoGravable)||0;
          const idxMismoAno=actuales.findIndex(d=>Number(d?.anoGravable)===anoNuevo);
          if(idxMismoAno>=0){actuales[idxMismoAno]=declaracion}else{actuales.push(declaracion)}
          actuales.sort((a,b)=>(Number(b?.anoGravable)||0)-(Number(a?.anoGravable)||0));
          // 29-oct-2026: 4 años (antes 3) para ver tendencia en el historial.
          return{...o,declaraciones:actuales.slice(0,4)};
        });
        upd("owners",owners);
        const ow=owners.find(o=>o.id===ownerId);
        const n=ow?.declaraciones?.length||0;
        showToast("Declaración guardada en "+(ow?.name||"owner")+" ("+n+"/4 años)");
      }}
      isPro={hasProAccess}
      onUpsell={()=>setPg("price")}
    />);
    case"aportes":return <CalculadoraPDF titulo="Aportes a seguridad social"><AportesCalculadora fmt={fm}/></CalculadoraPDF>;
    case"glosario":return <GlosarioPage/>;
        // 03-ago-2026 (Santiago: "hagamos versión US completa"). El módulo de BTC
      // estaba oculto en US porque PensionColombia compara contra Colpensiones:
      // salarios mínimos, tasa de reemplazo, aporte obligatorio del 16%. Nada de
      // eso existe allá. Ahora cada jurisdicción tiene el suyo.
      case"norte":return gated("norte","Básico",<TuNorte user={u} totales={t} T={T} isEN={isEN}
        onGuardar={(n)=>setU(p=>p?{...p,norte:n}:p)}
        onReclasificar={(id,canasta)=>upd("inv",((u&&u.inv)||[]).map(i=>i.id===id?{...i,canastaManual:canasta}:i))} />);
      case"btc":return gated("btc","Básico",isUS?<BitcoinRetirementUS user={u}/>:<CalculadoraPDF titulo="Ahorro en bitcoin" subtitulo="Cuánto podrías tener, retirar y heredar"><PensionColombia trm={trm} fm={fm} enDolares={cur==="USD"&&trm>0} guardado={u?.ahorroBTC||null} onGuardar={v=>{if(!modoConsulta)setU(p=>p?{...p,ahorroBTC:v}:p)}} pensiones={u?.pensiones||{}} owners={u?.owners||[]} irAPensiones={()=>setPg("pen")}/></CalculadoraPDF>);
      case"buyvsinvest":return gated("buyvsinvest","Básico",<CalculadoraPDF en={isEN} titulo={isUS?"Comprar o invertir":"Comprar o arrendar"}><BuyVsInvest isUS={isUS} guardado={u?.buyVsInvest||null} onGuardar={v=>{if(!modoConsulta)setU(p=>p?{...p,buyVsInvest:v}:p)}}/></CalculadoraPDF>);
    case"asesor":{const _aInv=((u&&u.inv)||[]).filter(i=>i.sim!==false),_aDeu=((u&&u.deu)||[]).filter(d=>d.sim!==false),_aIng=((u&&u.ingresos)||[]).filter(i=>i.sim!==false),_aGas={};Object.entries((u&&u.gas)||{}).forEach(([cat,items])=>{const fi=(items||[]).filter(g=>g.sim!==false);if(fi.length>0)_aGas[cat]=fi});return gated("asesor","Pro",<AsesorIA user={{inv:_aInv,gas:_aGas,deu:_aDeu,ingresos:_aIng,metas:(u&&u.metas)||[],pen:(u&&u.pen)||null,ibk:(u&&u.ibk)||[],futuro10:(u&&u.futuro10)||null,owners:(u&&u.owners)||[],norte:u?.norte||null,escenariosSim:(u&&u.escenarios)||[],impuesto:isUS?null:(()=>{try{return estimarImpuesto(u)}catch{return null}})(),trm:trm>0?trm:TRM_PROVISIONAL,inflacionPct:u?.inflacionPct,jurisdiction:u?.jurisdiction}} totals={t} sinCuenta={!authUser} onCrearCuenta={async()=>{await logout();sAM("signup");setShowAuth(true)}} userId={authUser?.id}/>);}
    case"coach":{const msgs=adv?getCoach(adv.id):[];return gated("coach","Pro",<div><PageHeader label="Tu equipo de asesores" title="Cinco miradas a tu plata" subtitle="Cada asesor revisa tu información desde un ángulo distinto y te dice qué haría. Solo se analizan los ítems encendidos."/><div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginBottom:20}}>{ADV.map(a=>{const ac=adv?.id===a.id;return<button key={a.id} onClick={()=>sAdv(a)} style={{background:ac?`linear-gradient(135deg,${a.cl}20,${a.cl}10)`:T.card,border:`1px solid ${ac?a.cl:T.border}`,color:T.tx,padding:"14px 20px",borderRadius:12,cursor:"pointer",textAlign:"center",minWidth:90}}><div style={{fontSize:22,marginBottom:4}}>{a.av}</div><div style={{fontWeight:700,fontSize:12,color:ac?a.cl:T.tx}}>{a.nm}</div><div style={{fontSize:11,color:ac?`${a.cl}aa`:T.tx3}}>{a.ti}</div></button>})}</div><Cd>{adv?<div style={{padding:20}}><div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:14,borderBottom:`2px solid ${adv.cl}`,marginBottom:20}}><span style={{fontSize:28}}>{adv.av}</span><div><div style={{fontWeight:700,fontSize:15}}>{adv.nm}</div><div style={{fontSize:12,color:T.tx3}}>{adv.ti}</div></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:6,marginBottom:20}}>{[{l:"Patrimonio",v:fm(t.nw),c:T.tx},{l:"Cash Flow",v:fm(t.cf),c:t.cf>=0?T.gn:T.rd},{l:"Rentas cubren",v:pc(t.ind),c:t.ind>=100?T.gn:T.tx2},{l:"Deuda sobre activos",v:pc(t.dta),c:t.dta<30?T.gn:T.rd}].map(m=><div key={m.l} style={{background:T.bg3,padding:8,borderRadius:8,borderLeft:`3px solid ${m.c}`}}><div style={{fontSize:11,color:T.tx3}}>{m.l}</div><div style={{fontSize:15,fontWeight:700,color:m.c}}>{m.v}</div></div>)}</div>{msgs.map((msg,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:14}}><div style={{width:32,height:32,borderRadius:"50%",background:adv.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{adv.av}</div><div style={{flex:1,background:adv.bg,padding:"14px 18px",borderRadius:"0 14px 14px 14px",border:`1px solid ${adv.cl}10`}}><div style={{fontWeight:700,fontSize:13,color:adv.cl,marginBottom:6}}>{msg.t}</div><div style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",color:T.tx}}>{msg.c}</div></div></div>)}</div>:<div style={{padding:56,textAlign:"center",color:T.tx3}}><div style={{fontSize:40,marginBottom:12}}></div><p>Selecciona un coach</p></div>}</Cd></div>)}
    case"price":{
      const isCO=!isUS;
      // Pricing es source-of-truth en src/lib/plans.js (refactor item #9
      // del backlog 28-abr-2026). Antes había duplicación entre App.jsx y
      // LandingPage.jsx que causó al menos 2 desincronizaciones (Pro
      // Familiar oculto en home + monedas distintas). Ahora ambos consumen
      // la misma definición. Cualquier cambio de precio/feature se hace
      // en plans.js únicamente.
      const plans=getPlansForApp({plan,isUS,trm:trm||4200,billingCycle,trialActive,trialDays});
      // 25-oct-2026 (Santiago: "que quien ingrese vea los planes y decida si paga en pesos o dólares").
      const mon=monedaPago||(isCO?"cop":"usd");
      const pagarMP=async(pl,ciclo=billingCycle)=>{if(abriendoPago)return;setAbriendoPago(pl.n);const planMp=pl.n==="Básico"?"basico":pl.n==="Pro Familiar"?"pro_familiar":"pro";trackCheckoutStarted({plan:pl.n,billingCycle:ciclo,priceId:"mp_"+planMp});
        try{const r=await fetchAuth("/api/mp-suscribir",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan:planMp,ciclo})});const d=await r.json();if(d&&d.url){window.location.href=d.url;setTimeout(()=>setAbriendoPago(null),15000);return}}catch{}
        setAbriendoPago(null);
        if(planMp==="pro"&&ciclo==="mensual"){window.open(PIONEROS_MP.url,"_blank","noopener");return}
        alert("No pudimos abrir Mercado Pago en este momento. Escríbenos a soporte@finpathia.com o intenta pagar en dólares.")};
      // 5-nov-2026 (Santiago: "pago único anual que puedan pagar por PSE"). Checkout Pro de
      // Mercado Pago: PSE, Efecty, tarjeta o saldo. Un solo cobro, no se renueva solo.
      const pagarUnico=async(meses)=>{const clave="unico"+meses;if(abriendoPago)return;setAbriendoPago(clave);trackCheckoutStarted({plan:"Pro",billingCycle:meses===12?"anual":"mensual",priceId:"mp_unico_"+meses});
        try{const r=await fetchAuth("/api/mp-pago-unico",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan:"pro",meses})});const d=await r.json();if(d&&d.url){window.location.href=d.url;setTimeout(()=>setAbriendoPago(null),15000);return}}catch{}
        setAbriendoPago(null);
        alert("No pudimos abrir Mercado Pago en este momento. Escríbenos a soporte@finpathia.com o intenta de nuevo.")};
      return<div>
        <div style={{textAlign:"center",marginBottom:32}}>
          <h2 style={{fontSize:28,fontWeight:700,margin:"0 0 8px"}}>{isUS?"One plan, everything included":"Un solo plan, todo incluido"}</h2>
          <p style={{color:T.tx3,fontSize:15}}>{isUS?"Pay monthly or yearly. Cancel anytime.":"Paga un mes o un año completo. Sin letra pequeña."}</p>
        </div>
        <div style={{maxWidth:720,margin:"0 auto 24px",textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>{isUS?"How do you want to pay?":"¿Cómo quieres pagar?"}</div>
          <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:10}}>
            {[["cop","En pesos colombianos","PSE, tarjeta débito o crédito, o Efecty. No necesitas cuenta de Mercado Pago."],["usd","En dólares (USD)","Tarjeta internacional con Stripe. Tu banco convierte a su tasa."]].map(([k,t1,t2])=>
              <button key={k} onClick={()=>setMonedaPago(k)} style={{textAlign:"left",padding:"12px 14px",borderRadius:12,cursor:"pointer",border:"2px solid "+(mon===k?T.gn:T.border),background:mon===k?T.gnB:"transparent",color:T.tx}}>
                <div style={{fontSize:14,fontWeight:700}}>{mon===k?"● ":"○ "}{t1}</div>
                <div style={{fontSize:12,color:T.tx3,marginTop:3,lineHeight:1.4}}>{t2}</div>
              </button>)}
          </div>
        </div>
        {mon==="cop"?(()=>{
          // 5-nov-2026 (Santiago: "no se diferencia bien dónde se paga mensual y dónde anual",
          // "casi nadie tiene cuenta en Mercado Pago", "necesito que puedan pagar fácilmente").
          // En pesos, lo principal es el pago único de Mercado Pago: PSE, tarjeta o Efecty, sin
          // cuenta de Mercado Pago. Dos tarjetas claras: un mes o un año. El débito automático
          // (suscripción, pide cuenta de Mercado Pago) queda como opción secundaria.
          const pr=PRECIOS_COP["Pro"],sinDesc=pr.mensual*12,ahorro=sinDesc-pr.anual,proPl=plans.find(x=>x.n==="Pro");
          const tarjeta=(meses)=>{const anual=meses===12,clave="unico"+meses,cargando=abriendoPago===clave;return(
            <div key={meses} style={{position:"relative",textAlign:"left",padding:"22px 20px 20px",borderRadius:16,border:anual?"2px solid var(--fp-pos)":"1px solid "+T.border,background:anual?"color-mix(in srgb, var(--fp-pos) 6%, var(--fp-card))":T.bg2,display:"flex",flexDirection:"column"}}>
              {anual&&<div style={{position:"absolute",top:-12,left:20,fontSize:11,fontWeight:700,color:"#000",background:"var(--fp-pos)",padding:"3px 10px",borderRadius:6}}>MÁS CONVENIENTE</div>}
              <div style={{fontSize:13,fontWeight:700,color:T.tx2,textTransform:"uppercase",letterSpacing:0.5}}>{anual?"Un año":"Un mes"}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:6,flexWrap:"wrap"}}>
                <span style={{fontSize:32,fontWeight:700,color:T.tx}}>{fmtCOP(anual?pr.anual:pr.mensual)}</span>
                <span style={{fontSize:14,color:T.tx3,fontWeight:600}}>{anual?"por 12 meses":"por 1 mes"}</span>
              </div>
              {anual?(<>
                <div style={{fontSize:13,color:T.tx3,marginTop:2}}><span style={{textDecoration:"line-through"}}>{fmtCOP(sinDesc)}</span> · equivale a {fmtCOP(Math.round(pr.anual/12/50)*50)} al mes</div>
                <div style={{alignSelf:"flex-start",marginTop:8,fontSize:13,fontWeight:700,color:"var(--fp-pos)",background:"color-mix(in srgb, var(--fp-pos) 12%, transparent)",padding:"4px 10px",borderRadius:6}}>Ahorras {fmtCOP(ahorro)} · 2 meses gratis</div>
              </>):(
                <div style={{fontSize:13,color:T.tx3,marginTop:2}}>Pagas solo este mes. Renuevas cuando quieras.</div>
              )}
              <div style={{flex:1,minHeight:14}}/>
              <Bt v={anual?"p":"s"} sz="m" st={{width:"100%",justifyContent:"center",marginTop:14,opacity:abriendoPago&&!cargando?0.55:1}} onClick={()=>pagarUnico(meses)}>{cargando?"Abriendo Mercado Pago…":anual?`Pagar el año · ${fmtCOP(pr.anual)}`:`Pagar un mes · ${fmtCOP(pr.mensual)}`}</Bt>
            </div>)};
          return(<div style={{maxWidth:640,margin:"0 auto"}}>
            {proPl&&<div style={{textAlign:"left",padding:"20px",borderRadius:16,border:"1px solid "+T.border,background:T.bg2,marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:700,color:T.tx}}>Qué incluye el plan Pro</div>
              <div style={{fontSize:13,color:T.tx3,marginTop:4}}>{proPl.tag} · {proPl.users}</div>
              {proPl.enTrial&&<div style={{fontSize:13,color:T.tx2,marginTop:8}}>Te {proPl.trialDays===1?"queda 1 día":`quedan ${proPl.trialDays} días`} de prueba. Al pagar sigues igual, sin perder nada de lo que cargaste.</div>}
              <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:"8px 18px",marginTop:14}}>
                {(proPl.f||[]).map(f=><div key={f} style={{fontSize:13,color:T.tx2,lineHeight:1.5}}><span style={{color:"var(--fp-pos)",marginRight:6,fontWeight:700}}>✓</span>{f}</div>)}
              </div>
            </div>}
            <div style={{fontSize:15,fontWeight:700,color:T.tx,textAlign:"center",margin:"4px 0 18px"}}>Elige cómo pagar el Pro</div>
            <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:16}}>{tarjeta(12)}{tarjeta(1)}</div>
            <div style={{marginTop:16,padding:"14px 16px",borderRadius:12,background:T.bg3,fontSize:13,color:T.tx2,lineHeight:1.6}}>
              <div style={{fontWeight:700,color:T.tx,marginBottom:4}}>Pagas con PSE, tarjeta débito o crédito, o Efecty</div>
              No necesitas cuenta de Mercado Pago. Es un solo pago: no hay cobros automáticos y te avisamos por correo antes de que venza para que renueves si quieres.
            </div>
            {proPl&&!proPl.cur&&<div style={{marginTop:14,padding:"14px 16px",borderRadius:12,border:"1px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{fontSize:13,color:T.tx2,lineHeight:1.5,flex:"1 1 240px"}}><strong style={{color:T.tx}}>¿Prefieres que se cobre solo cada mes?</strong><br/>Cobro automático con tarjeta débito o crédito, {fmtCOP(pr.mensual)}/mes. Sin cuenta de Mercado Pago. Cancelas en un toque.</div>
              <Bt v="s" sz="m" onClick={()=>setTarjetaMP({ciclo:"mensual",monto:pr.mensual})}>Activar cobro automático</Bt>
            </div>}
            {tarjetaMP&&<Suspense fallback={null}><TarjetaMP ciclo={tarjetaMP.ciclo} monto={tarjetaMP.monto} email={u?.p?.email||authUser?.email||""} onCerrar={()=>setTarjetaMP(null)} onListo={()=>{track("mp_tarjeta_ok")}}/></Suspense>}
          </div>)})():(<>
          <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{display:"inline-flex",background:T.bg3,borderRadius:10,padding:3,marginTop:16}}>
            {["mensual","anual"].map(c=>(
              <button key={c} onClick={()=>setBillingCycle(c)} style={{padding:"8px 24px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:billingCycle===c?T.gn:"transparent",color:billingCycle===c?"#000":T.tx3}}>{isUS?(c==="mensual"?"Monthly":"Annual · 2 months free"):(c==="mensual"?"Pago mensual":"Pago anual · 2 meses gratis")}</button>
            ))}
          </div>
          </div>
        <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"repeat(auto-fit, minmax(300px, 1fr))",gap:16,maxWidth:480,margin:"0 auto"}}>
                    {/* 25-oct-2026 (Santiago: "dejemos un plan que incluye todo, mensual o anual"). Solo Pro a la venta. */}
          {plans.filter(pl=>pl.n==="Pro"||pl.cur).map(pl=>(
            <Cd key={pl.n} s={{border:pl.ac?"2px solid "+T.gn:pl.comingSoon?"1px dashed "+T.border:"1px solid "+T.border,position:"relative",opacity:pl.comingSoon?0.95:1}}>
              
              {pl.comingSoon&&<div style={{background:"linear-gradient(135deg,#3b82f6,#3b82f6)",color:"#fff",textAlign:"center",padding:"6px 0",fontSize:12,fontWeight:700}}>PRONTO DISPONIBLE</div>}
              <div style={{padding:24}}>
                <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>{pl.n}</div>
                <div style={{fontSize:12,color:T.tx3,marginBottom:14,lineHeight:1.4,minHeight:32}}>{pl.tag}</div>
                {mon==="cop"&&PRECIOS_COP[pl.n]?(<div style={{marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:32,fontWeight:700,color:pl.ac?T.gn:T.tx}}>{fmtCOP(PRECIOS_COP[pl.n][billingCycle])}</span>
                    <span style={{color:T.tx3,fontSize:14,fontWeight:600}}>{billingCycle==="anual"?"/año":"/mes"}</span>
                  </div>
                  <div style={{fontSize:12,color:T.tx3,marginTop:2}}>{billingCycle==="anual"?`Un solo cobro al año · 2 meses gratis (equivale a ${fmtCOP(Math.round(PRECIOS_COP[pl.n].anual/12/100)*100)}/mes)`:`En pesos · se cobra solo cada mes · o ${fmtCOP(PRECIOS_COP[pl.n].anual)} al año`}</div>
                </div>):(<>
                {mon==="cop"&&!pl.p.mensual.startsWith("$0")&&<div style={{fontSize:12,color:T.tx2,fontWeight:600,marginBottom:4}}>Por ahora solo en dólares</div>}
                <div style={{marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:pl.comingSoon?22:36,fontWeight:700,color:pl.ac?T.gn:pl.comingSoon?T.tx3:T.tx}}>{billingCycle==="anual"&&pl.pAnualTotal?pl.pAnualTotal:pl.p[billingCycle]}</span>
                    {billingCycle==="anual"&&pl.pAnualTotal
                      ?<span style={{color:T.tx3,fontSize:14,fontWeight:600}}>/año</span>
                      :(pl.pr[billingCycle]&&<span style={{color:T.tx3,fontSize:14,fontWeight:600}}>{pl.pr[billingCycle]}</span>)}
                  </div>
                  {pl.pRef&&pl.pRef[billingCycle]&&<div style={{fontSize:12,color:T.tx3,marginTop:2}}>{pl.pRef[billingCycle]} · cobro en dólares</div>}
                </div>
                {/* 25-jul-2026 (Santiago): "si uno elige un solo pago, que salga
                    la cifra completa; si cambiamos las reglas o los valores,
                    generamos rechazo".
                    Antes la tarjeta anual mostraba "$12 USD/mes" en grande y
                    Stripe cobraba $144 de una: la cifra prominente no era la que
                    se cobraba. Ahora manda el monto real del cobro y la
                    equivalencia mensual queda como referencia secundaria. */}
                {billingCycle==="anual"&&pl.save&&<div style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:T.gn,fontWeight:600}}>{pl.save}</div>
                  <div style={{fontSize:12,color:T.tx3,marginTop:2}}>Un solo pago · equivale a {pl.p.anual} USD/mes</div>
                </div>}
                {billingCycle==="mensual"&&pl.save&&<div style={{fontSize:12,color:T.tx3,marginBottom:12}}>{isUS?"or pay yearly: 2 months free":"o paga el año y llévate 2 meses gratis"}</div>}
                {!pl.save&&<div style={{marginBottom:12}}/>}
                </>)}
                <div className="fp-fo-ancho" style={{background:T.bg3,padding:"8px 12px",borderRadius:8,fontSize:12,color:T.tx2,marginBottom:14,fontWeight:600}}>{pl.users}</div>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                  {pl.f.map(f=><div key={f} style={{fontSize:12,color:T.tx2,lineHeight:1.5}}><span style={{color:T.gn,marginRight:6,fontWeight:700}}>✓</span>{f}</div>)}
                  {(pl.no||[]).map(f=><div key={f} style={{fontSize:12,color:T.tx3,lineHeight:1.5}}><span style={{color:T.tx3,marginRight:6}}>✗</span>{f}</div>)}
                </div>
                {pl.comingSoon?(
                  <Bt v="s" sz="m" st={{width:"100%",justifyContent:"center"}} onClick={()=>{window.location.href="mailto:soporte@finpathia.com?subject=Plan Pro Familiar — interesado&body=Hola, quiero entrar a la lista de espera del plan Pro Familiar para mi familia/equipo. Mi email: "+(u?.p?.email||"")}}>Únete a la lista de espera</Bt>
                ):(
                <Bt v={pl.cur?"s":pl.rank>pl.rankActual?"p":"s"} sz="m" st={{width:"100%",justifyContent:"center",opacity:(pl.cur||pl.rank===0||(abriendoPago&&abriendoPago!==pl.n))?0.55:1,cursor:(pl.cur||pl.rank===0||abriendoPago)?"default":"pointer"}} onClick={()=>{if(!pl.cur&&pl.rank!==0&&mon==="cop"&&PRECIOS_COP[pl.n]){pagarMP(pl);return}
                  if(!pl.cur&&pl.rank!==0)(async()=>{
                  try{
                    // PriceIds vienen de src/lib/plans.js (STRIPE_PRICE_IDS),
                    // source-of-truth única. Refactor item #9.
                    const priceId=STRIPE_PRICE_IDS[pl.n]?.[billingCycle];
                    if(!priceId)return;
                    // Email fallback: u?.p?.email puede no estar cargado para users
                    // recién signup. authUser.email SIEMPRE está si hay sesión.
                    const userEmail=u?.p?.email||authUser?.email||"";
                    const userIdReal=authUser?.id||"";
                    if(!userEmail){alert("Necesitamos tu email para procesar el pago. Completa tu perfil primero (Configuración → Datos personales) y vuelve a intentar.");return;}
                    if(!userIdReal){alert("Sesión no detectada. Haz logout/login y vuelve a intentar.");return;}
                    // Sesión 4-may-2026: tracking GA4 — checkout iniciado
                    // con metadata de plan, ciclo y promo (Pioneros).
                    trackCheckoutStarted({ plan: pl.n, billingCycle, priceId });
                    const r=await fetch("/.netlify/functions/stripe-checkout",{
                      method:"POST",
                      headers:{"Content-Type":"application/json"},
                      body:JSON.stringify({priceId,email:userEmail,userId:userIdReal,promotionCode:sessionStorage.getItem("fp3_promo_code")||"",successUrl:window.location.origin+"/?success=1&session_id={CHECKOUT_SESSION_ID}",cancelUrl:window.location.origin+"/?canceled=true"})
                    });
                    if(!r.ok){
                      const txt=await r.text().catch(()=>"(no body)");
                      console.error("[checkout] HTTP",r.status,txt);
                      alert("Error de Stripe (HTTP "+r.status+"):\n"+txt.slice(0,200)+"\n\nRevisa la consola del browser (F12) o contacta soporte@finpathia.com.");
                      return;
                    }
                    const d=await r.json();
                    if(d.url)window.location.href=d.url;
                    else alert("Error de Stripe: "+(d.error||"No se pudo crear la sesión")+". Si el problema persiste, escríbenos a soporte@finpathia.com");
                  }catch(e){
                    console.error("[checkout] fetch failed:",e);
                    const isBlocked=e.message&&/blocked|aborted|failed|network|cors/i.test(e.message);
                    alert(
                      "Error conectando con Stripe: "+e.message+
                      (isBlocked?"\n\nPosible AdBlocker o extensión del browser bloqueando la conexión.\nPrueba:\n• Desactivar adblocker para finpathia.com\n• Abrir en modo incógnito\n• Probar con otro browser":"\n\nVerifica tu conexión. Detalle del error en consola (F12 → Console).")
                    );
                  }
                })()}}>{
                  // 25-jul-2026: el botón decía "Comenzar" en TODAS las tarjetas,
                  // incluida Free — que no tiene precio, así que era un botón
                  // muerto (el handler hace `if(!priceId)return`). Quien ya tenía
                  // plan no distinguía qué era mejorar y qué era bajar.
                  abriendoPago===pl.n ? "Abriendo Mercado Pago…"
                  : pl.cur ? "Tu plan actual"
                  : pl.enTrial ? (pl.trialDays<=1?"Activar antes de que venza":`Activar — quedan ${pl.trialDays} días`)
                  : pl.rank===0 ? "Se activa al cancelar tu plan"
                  : pl.rankActual===0 ? "Comenzar"
                  : pl.rank>pl.rankActual ? `Mejorar a ${pl.n}`
                  : `Cambiar a ${pl.n}`
                }</Bt>
                )}
              </div>
            </Cd>
          ))}
        </div>
        </>)}
        <div style={{textAlign:"center",marginTop:24,color:T.tx3,fontSize:13,lineHeight:1.8}}>
          {mon==="cop"?"Pagos seguros con Mercado Pago":"Pagos seguros con Stripe"} • Cancelas en un toque desde Mi cuenta • Sin compromisos<br/>
          {mon==="usd"&&isCO&&<><span style={{fontSize:12}}>Conversión a TRM ≈ ${Math.round(trm||4200).toLocaleString("es-CO")} COP/USD · tu banco aplica su propia tasa al cargo en USD.</span><br/></>}
          ¿Preguntas? Escríbenos a soporte@finpathia.com
        </div>
        <div style={{marginTop:32,padding:"20px 24px",background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.15)",borderRadius:12,textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#3b82f6",marginBottom:4}}>¿Eres asesor financiero o contador?</div>
          <div style={{fontSize:12,color:T.tx3,marginBottom:10}}>Tenemos planes para gestionar hasta 40+ clientes con workspace dedicado, white-label y soporte prioritario.</div>
          <a href="/asesores" style={{display:"inline-block",background:"transparent",border:"1px solid #3b82f6",color:"#3b82f6",padding:"8px 18px",borderRadius:8,fontSize:12,fontWeight:600,textDecoration:"none"}}>Ver planes para asesores →</a>
        </div>
      </div>}
    case"resumen":{
      const nwUSD=trm>0?t.nw/trm:0;
      // BUG FIX 13-jun-2026: mismo bug del PDF — esta vista también sumaba
      // items con sim===false. Ahora filtramos igual que en cT() para que la
      // vista sea consistente con los KPIs del Dashboard.
      const passR=t.pctIngresoPasivo||0;
      const totalInv=((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((s,i)=>s+vcCOP(i,trm),0);
      const totalVal=((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((s,i)=>s+vaCOP(i,trm),0);
      const gainPct=totalInv>0?((totalVal/totalInv)-1)*100:0;
      const fireN=t.gfm*12*25;
      const fireProg=fireN>0?Math.min((t.nw/fireN)*100,100):0;
      const fecha=new Date().toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"});
      return<div style={{maxWidth:800,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <button onClick={()=>setPg("dash")} style={{background:T.bg3,border:"none",color:T.tx2,padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13}}>← Dashboard</button>
          <button onClick={generatePDF} style={{background:T.gn,color:"#000",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>Reporte PDF</button>
        </div>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:12,padding:"clamp(16px, 4vw, 32px)"}}>
          <div style={{borderBottom:"2px solid "+T.gn,paddingBottom:16,marginBottom:20}}>
            <div style={{fontSize:"clamp(18px, 5vw, 22px)",fontWeight:700,color:T.gn}}>FINPATHIA — Resumen Ejecutivo</div>
            <div style={{fontSize:13,color:T.tx3,marginTop:4}}>{u?.p?.name||"Usuario"} • {fecha}</div>
          </div>

          {/* Fase 3 (4-jul-2026): KPIs top del Resumen ahora reflejan el
              nuevo modelo family office. Muestran Patrimonio + Disponible
              (protagonista) + Independencia. El desglose Bruto→Retención→
              Disponible y Egresos por categoría va debajo en cards separadas. */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))",gap:12,marginBottom:20}}>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:11,color:T.tx3,letterSpacing:1,fontWeight:600}}>PATRIMONIO NETO</div>
              <div style={{fontSize:24,fontWeight:700,color:T.gn,marginTop:4}}>{fm(t.nw)}</div>
              <div style={{fontSize:11,color:T.tx3}}>≈ USD ${Math.round(nwUSD).toLocaleString("en-US")}</div>
            </div>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:11,color:T.tx3,letterSpacing:1,fontWeight:600}}>DISPONIBLE EN CUENTA</div>
              <div style={{fontSize:24,fontWeight:700,color:T.gn,marginTop:4}}>{fm(t.disponibleCuenta||t.ni||0)}</div>
              <div style={{fontSize:11,color:T.tx3}}>mensual, tras retención</div>
            </div>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:11,color:T.tx3,letterSpacing:1,fontWeight:600}}>CASH FLOW</div>
              <div style={{fontSize:24,fontWeight:700,color:t.cf>=0?T.gn:T.rd,marginTop:4}}>{fm(t.cf)}</div>
              <div style={{fontSize:11,color:T.tx3}}>{fm(t.cf*12)}/año</div>
            </div>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:11,color:T.tx3,letterSpacing:1,fontWeight:600}}>INDEPENDENCIA</div>
              <div style={{fontSize:24,fontWeight:700,color:t.ind>=100?T.gn:"#f59e0b",marginTop:4}}>{fmtPctEs((t.ind), 0)}</div>
              <div style={{fontSize:11,color:T.tx3}}>ingreso pasivo vs gastos y cuotas</div>
              <div style={{fontSize:11,color:T.tx3,marginTop:3}}>FIRE: {fmtPctEs(fireProg, 0)} · capital para no trabajar</div>
            </div>
          </div>

          {/* Desglose Bruto → Retención → Disponible + Egresos por línea */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(280px, 100%), 1fr))",gap:14,marginBottom:24}}>
            {/* Ingresos con desglose */}
            <div style={{background:T.bg3,borderRadius:12,padding:16}}>
              <div style={{fontSize:11,color:T.tx3,letterSpacing:1.2,fontWeight:700,marginBottom:12}}>Ingresos mensuales</div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                <span style={{color:T.tx2}}>Bruto Total</span>
                <span style={{fontFamily:"monospace",color:T.tx}}>{fm(t.brutoTotal||t.ti||0)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:10,paddingLeft:8,borderLeft:`2px solid ${T.border}`}}>
                <span style={{color:"#3b82f6"}}>− Retención <span style={{fontSize:11,opacity:0.7}}>(recuperable)</span></span>
                <span style={{fontFamily:"monospace",color:"#3b82f6"}}>−{fm(t.retencionMensual||0)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
                <span style={{color:T.gn}}>= DISPONIBLE</span>
                <span style={{fontFamily:"monospace",color:T.gn}}>{fm(t.disponibleCuenta||t.ni||0)}</span>
              </div>
            </div>

            {/* Egresos con desglose 4 líneas */}
            <div style={{background:T.bg3,borderRadius:12,padding:16}}>
              <div style={{fontSize:11,color:T.tx3,letterSpacing:1.2,fontWeight:700,marginBottom:12}}>Egresos mensuales</div>
              {[
                {l:"A. Aportes obligatorios",v:t.aportesObligatorios||0,c:"#f59e0b"},
                {l:"B. Gastos familiares",v:t.gastosFamiliares||0,c:T.tx2},
                {l:"C. Cuotas de deudas",v:t.cuotasDeudas||0,c:T.tx2},
                {l:"D. Impuesto neto estimado (post-retención)",v:t.impuestoNeto||0,c:"#3b82f6"},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5,opacity:r.v>0?1:0.5}}>
                  <span style={{color:r.c}}>{r.l}</span>
                  <span style={{fontFamily:"monospace",color:r.c}}>{fm(r.v)}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,paddingTop:10,borderTop:`1px solid ${T.border}`,marginTop:6}}>
                <span style={{color:T.rd}}>= EGRESOS TOTALES</span>
                <span style={{fontFamily:"monospace",color:T.rd}}>{fm(t.egresosTotales||t.te||0)}</span>
              </div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(260px, 100%), 1fr))",gap:20,marginBottom:24}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>Ingresos mensuales</div>
              {((u&&u.ingresos)||[]).filter(i=>i.sim!==false).filter(i=>i.sim!==false&&montoPromedioMensual(i)>0).sort((a,b)=>montoPromedioMensual(b)-montoPromedioMensual(a)).slice(0,6).map((i,idx)=>(
                <div key={idx} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid "+T.border}}>
                  <span style={{color:T.tx2}}>{i.nombre}</span>
                  <span style={{fontWeight:600,fontFamily:"monospace",color:T.gn}}>{fmmontoPromedioMensual(i)}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",fontWeight:700}}>
                <span>Total</span><span style={{color:T.gn}}>{fm(t.ti)}{tx("/mes","/mo")}</span>
              </div>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>Egresos principales</div>
              {Object.entries((u&&u.gas)||{}).map(([cat,items])=>({cat,total:(items||[]).filter(g=>g.sim!==false).reduce((s,g)=>s+montoPromedioMensual(g),0)})).filter(g=>g.total>0).sort((a,b)=>b.total-a.total).slice(0,5).map((g,idx)=>(
                <div key={idx} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid "+T.border}}>
                  <span style={{color:T.tx2}}>{g.cat}</span>
                  <span style={{fontWeight:600,fontFamily:"monospace",color:T.rd}}>{fm(g.total)}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid "+T.border}}>
                <span style={{color:T.tx2}}>Cuotas deudas</span>
                <span style={{fontWeight:600,fontFamily:"monospace",color:T.rd}}>{fm(t.tc)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",fontWeight:700}}>
                <span>Total</span><span style={{color:T.rd}}>{fm(t.te)}{tx("/mes","/mo")}</span>
              </div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(140px, 100%), 1fr))",gap:10,marginBottom:24}}>
            {[
              {l:"Activos",v:fm(totalVal),c:T.gn},
              {l:"Deuda total",v:fm(t.td),c:T.rd},
              {l:"Valorización",v:(gainPct>=0?"+":"")+fmtPctEs(gainPct),c:gainPct>=0?T.gn:T.rd},
              {l:"Ingreso pasivo",v:fmtPctEs(passR, 0),c:passR>=80?T.gn:"#f59e0b"},
            ].map(k=>(
              <div key={k.l} style={{textAlign:"center",padding:10,background:T.bg3,borderRadius:8}}>
                <div style={{fontSize:11,color:T.tx3}}>{k.l}</div>
                <div style={{fontSize:16,fontWeight:700,color:k.c,marginTop:2}}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>Patrimonio por tipo</div>
            {(() => {
              const byType={};((u&&u.inv)||[]).filter(i=>i.sim!==false).forEach(i=>{const tp=i.tp||i.tipo||"Otro";byType[tp]=(byType[tp]||0)+vaCOP(i,trm)});
              return Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([tp,val],idx)=>{
                const pct=totalVal>0?(val/totalVal*100):0;
                return(
                  <div key={tp} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div style={{width:8,height:8,borderRadius:3,background:T.ch[idx%T.ch.length],flexShrink:0}}/>
                    <span style={{fontSize:12,color:T.tx2,flex:1}}>{tp}</span>
                    <div style={{width:120,height:6,background:T.bg3,borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:pct+"%",background:T.ch[idx%T.ch.length],borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:12,color:T.tx3,minWidth:70,textAlign:"right",fontFamily:"monospace"}}>{fm(val)} ({fmtPctEs(pct, 0)})</span>
                  </div>
                );
              });
            })()}
          </div>

          {((u&&u.deu)||[]).filter(d=>d.sim!==false).length>0&&<div style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>Obligaciones financieras</div>
            {((u&&u.deu)||[]).filter(d=>d.sim!==false).map((d,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid "+T.border}}>
                <span style={{color:T.tx2}}>{d.n||d.nombre||"Deuda"} <span style={{color:T.tx3}}>({fmtTasaEs(d.ts||0)})</span></span>
                <div><span style={{color:T.rd,fontFamily:"monospace"}}>{fm(d.mt||0)}</span><span style={{color:T.tx3,marginLeft:8}}>cuota: {fm(d.pg||0)}</span></div>
              </div>
            ))}
          </div>}

          <div style={{background:"linear-gradient(135deg,rgba(0,200,5,0.06),rgba(59,130,246,0.03))",border:"1px solid rgba(0,200,5,0.1)",borderRadius:12,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,color:T.gn,marginBottom:8}}>Diagnóstico</div>
            <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
              {t.ind>=100?"Tu ingreso pasivo cubre el 100% de tus gastos y cuotas. Estás en nivel de independencia financiera.":"Tu ingreso pasivo cubre el "+fmtPctEs(t.ind, 0)+" de tus gastos y cuotas. Te faltan "+fm(Math.max(0,(t.ob||0)-(t.ingresoPasivo||0)))+"/mes de ingreso pasivo para la independencia."}
              <br/>{t.cf>=0?"Cash flow positivo de "+fm(t.cf)+"/mes disponible para inversión.":"Cash flow negativo. Gastas "+fm(Math.abs(t.cf))+"/mes más de lo que ganas."}
              <br/>{passR>=80?"El "+fmtPctEs(passR, 0)+" de tus ingresos son pasivos. Excelente independencia.":"Solo el "+fmtPctEs(passR, 0)+" es ingreso pasivo. Meta: superar 80%."}
              <br/>{fireProg>=100?"Ya superaste tu FIRE number. Puedes vivir de tu patrimonio 25+ años.":"FIRE progress: "+fmtPctEs(fireProg, 0)+". Meta: "+fm(fireN)+". Te falta: "+fm(Math.max(0,fireN-t.nw))+"."}
            </div>
          </div>

          <div style={{textAlign:"center",marginTop:20,fontSize:11,color:T.tx3,borderTop:"1px solid "+T.border,paddingTop:12}}>
            FINPATHIA — Reporte generado el {fecha} • finpathia.com
          </div>
        </div>
      </div>}
    case"cuenta":
    case"set":{
    const cuentaConfig=<div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:20}}><Cd s={{padding:20}}><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 16px"}}>Perfil</h3><div style={{display:"flex",flexDirection:"column",gap:14}}><In l="Nombre" value={u?.p?.name||""} onChange={v=>setU(p=>({...p,p:{...p.p,name:v}}))}/><In l="Email" value={u?.p?.email||""} onChange={v=>setU(p=>({...p,p:{...p.p,email:v}}))}/><In l="TRM (Tasa de cambio USD→COP)" value={(u&&u.trm)} onChange={v=>setU(p=>({...p,trm:+v>0?+v:undefined,trmSrc:+v>0?"manual":undefined,trmFecha:+v>0?new Date().toISOString().slice(0,10):undefined}))} type="number"/>{(u?.jurisdiction||"CO")==="CO"&&<div><label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:1,display:"block",marginBottom:6}}>Componente inflacionario (% exento rendimientos)</label><input type="number" step="0.01" value={u?.componenteInflacionarioPct!=null?u.componenteInflacionarioPct:50.88} onChange={e=>{const v=+e.target.value;if(!isNaN(v)&&v>=0&&v<=100)setU(p=>({...p,componenteInflacionarioPct:v}))}} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none"}}/><div style={{fontSize:11,color:T.tx3,marginTop:4,lineHeight:1.5}}>Art. 38-39 ET · Decreto 0771/2025: <strong>50,88%</strong> para año gravable 2024. Parte de intereses bancarios/CDT/FIC que NO constituye renta para persona natural no obligada a llevar contabilidad. Actualizable cuando la DIAN publique el decreto del próximo año.</div></div>}<div><label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:1,display:"block",marginBottom:6}}>Jurisdicción fiscal</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[{code:"CO",flag:"",name:"Colombia"},{code:"US",flag:"",name:"United States"}].map(c=>{const sel=(u?.jurisdiction||"CO")===c.code;return<button key={c.code} type="button" onClick={()=>{if((u?.jurisdiction||"CO")===c.code)return;if(!confirm(`¿Cambiar jurisdicción fiscal a ${c.name}?\n\nEsto cambia las reglas fiscales, el módulo de pensiones (Colpensiones+RAIS vs 401k) y la planeación tributaria. Tus datos se conservan — solo cambia cómo se calculan y presentan.`))return;setU(p=>({...p,jurisdiction:c.code}));showToast(`✓ Jurisdicción cambiada a ${c.name}`)}} style={{padding:"10px 12px",borderRadius:8,border:"1px solid "+(sel?T.gn:T.border),background:sel?T.gnB:T.bg2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,color:sel?T.gn:T.tx2,fontWeight:sel?700:400,fontSize:12}}><span style={{fontSize:16}}>{c.flag}</span>{c.name}</button>})}</div><div style={{fontSize:11,color:T.tx3,marginTop:4,lineHeight:1.5}}>Define el módulo de pensiones, plan tributario y moneda por default.</div></div></div></Cd><Cd s={{padding:20}}><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 16px"}}>Datos</h3><div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{padding:12,background:T.bg3,borderRadius:10,fontSize:13}}><strong>Plan:</strong> {plan} {!hasProAccess&&<span onClick={()=>setPg("price")} style={{color:T.gn,cursor:"pointer",fontWeight:600}}> → Upgrade</span>}</div>{isAdmin&&<div style={{padding:12,background:T.bg3,borderRadius:10,fontSize:13}}><strong>Plan manual:</strong> <select value={(u?.p?.plan)||"free"} onChange={e=>setU(p=>({...p,p:{...p.p,plan:e.target.value}}))} style={{background:T.bg2,border:"1px solid "+T.border,color:T.tx,padding:"4px 8px",borderRadius:6,marginLeft:8}}><option value="free">Free</option><option value="basico">Básico</option><option value="pro">Pro</option><option value="pro_familiar">Pro Familiar</option></select></div>}<Bt v="s" onClick={()=>{if(((u&&u.inv)||[]).filter(i=>i.sim!==false).length>0||Object.keys((u&&u.gas)||{}).length>0){if(!confirm(isEN?"This replaces your current data with sample data. Continue?":"Esto reemplazará tus datos actuales con datos de ejemplo. ¿Continuar?"))return}isUS?demoUS():demo()}} st={{justifyContent:"center"}}>{isEN?"Load sample data":"Cargar datos demo"}</Bt><Bt v="s" onClick={()=>{const d=localStorage.getItem(SK);if(!d)return alert("No hay datos");const b=new Blob([d],{type:"application/json"});const u2=URL.createObjectURL(b);const a=document.createElement("a");a.href=u2;a.download="finpathia-backup-"+new Date().toISOString().split("T")[0]+".json";a.click()}} st={{justifyContent:"center"}}>Exportar Datos (JSON)</Bt>
              <Bt v="s" onClick={()=>{try{const backups=JSON.parse(localStorage.getItem("fp3_backups")||"[]");if(!backups.length){alert("No hay backups disponibles");return}const last=backups[backups.length-1];const d=JSON.parse(last.data);if(confirm("¿Restaurar backup del "+new Date(last.date).toLocaleDateString("es-CO")+"? Esto reemplazará tus datos actuales.")){setU(sanitize(d));showToast("Backup restaurado")}}catch{alert("Error restaurando backup")}}} st={{justifyContent:"center"}}>Restaurar último backup</Bt>
              <div style={{marginTop:12,padding:12,background:T.bg3,borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Planeación Tributaria</div>
                <div style={{fontSize:12,color:T.tx3,marginBottom:10,lineHeight:1.6}}>Registra las personas o empresas <strong>en Colombia</strong> para las que quieras estimar impuestos. Al asignar un propietario a tus ingresos, la sección <strong>Impuestos</strong> calculará un aproximado del pago de renta por cada uno.<br/><br/>Es opcional: solo registra los que quieras analizar. Si tienes entidades en otros países (ej. USA), no las incluyas aquí.</div>
                {(() => {
                  // Contar items sin fiscalCode explícito por sección.
                  const pendIng = (u?.ingresos || []).filter(i => !i.fiscalCode).length;
                  const pendDeu = (u?.deu || []).filter(d => !d.fiscalCode).length;
                  const pendInv = (u?.inv || []).filter(i => !i.fiscalCode).length;
                  let pendGas = 0;
                  Object.values(u?.gas || {}).forEach(arr => { (arr || []).forEach(g => { if (!g.fiscalCode) pendGas++; }); });
                  const totalPend = pendIng + pendDeu + pendInv + pendGas;
                  const warns = getFiscalWarnings(u);
                  const errs = warns.filter(w => w.severity === "error").length;
                  const warnCount = warns.filter(w => w.severity === "warning").length;
                  if (totalPend === 0 && warns.length === 0) return null;
                  // Lista de secciones con pendientes (con label + count + page id para navegación)
                  const secciones = [
                    { count: pendIng, label: pendIng === 1 ? "ingreso" : "ingresos", emoji: "", page: "ing" },
                    { count: pendGas, label: pendGas === 1 ? "egreso" : "egresos", emoji: "", page: "gas" },
                    { count: pendDeu, label: pendDeu === 1 ? "deuda" : "deudas", emoji: "", page: "deu" },
                    { count: pendInv, label: pendInv === 1 ? "inversión" : "inversiones", emoji: "", page: "inv" },
                  ].filter(s => s.count > 0);
                  return (
                    <div style={{marginBottom:12,padding:"12px 14px",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.or||"#f59e0b",marginBottom:6}}>Clasificación fiscal pendiente</div>
                      <div style={{fontSize:11,color:T.tx2,lineHeight:1.6,marginBottom:secciones.length>0?10:0}}>
                        {totalPend > 0 ? <>Hay <strong>{totalPend} item(s)</strong> sin clasificación fiscal explícita. El motor está usando inferencia automática, pero puedes revisar y confirmar item por item directamente en cada sección para mayor precisión.</> : "Hay items con advertencias fiscales."}
                        {(errs > 0 || warnCount > 0) && <div style={{marginTop:4}}>{errs > 0 && <span style={{color:T.rd}}>• <strong>{errs} error(es)</strong> </span>}{warnCount > 0 && <span>• {warnCount} advertencia(s)</span>}</div>}
                      </div>
                      {secciones.length > 0 && (
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {secciones.map(s => (
                            <button key={s.page} onClick={()=>setPg(s.page)} style={{padding:"6px 10px",background:T.bg3,border:"1px solid "+T.border,borderRadius:6,color:T.tx,cursor:"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                              <span>{s.emoji}</span><span><strong>{s.count}</strong> {s.label}</span><span style={{color:T.tx3,marginLeft:2}}>→</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {(u?.owners||[]).map((ow,i)=>{const isEditing=(u?.p?._editOwnerId===ow.id);const REGS_J=[{v:"ordinario",l:"Ordinario (35%)"},{v:"simple",l:"Simple (RST 1,4–11,5%)"},{v:"zona_franca",l:"Zona Franca (20%)"},{v:"chc",l:"CHC (holding)"},{v:"exenta",l:"Economía Naranja (exenta)"}];const REGS_N=[{v:"ordinario",l:"Ordinario (Cédula General)"},{v:"simple",l:"Simple (RST 1,4–8,3%)"}];const regs=ow.type==="juridica"?REGS_J:REGS_N;const regLabel=(regs.find(r=>r.v===(ow.regimen||"ordinario"))||regs[0]).l;return<div key={ow.id} style={{marginBottom:6,padding:"10px 12px",background:T.bg,borderRadius:10,border:"1px solid "+T.border}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:16}}>{ow.type==="juridica"?"":""}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{ow.name}</div>
                      <div style={{fontSize:11,color:T.tx3}}>{ow.type==="juridica"?"Persona Jurídica":"Persona Natural"} · <span style={{color:T.bl}}>{regLabel}</span>{ow.type==="juridica"&&ow.perdidasFiscalesAcumuladas>0&&<span style={{color:T.gn,marginLeft:6}}>· {fm(ow.perdidasFiscalesAcumuladas)} pérdidas</span>}{ow.type==="juridica"&&ow.descuentosTributarios&&Object.values(ow.descuentosTributarios).some(v=>+v>0)&&<span style={{color:T.bl,marginLeft:6}}>· descuentos</span>}{ow.type==="natural"&&ow.aportes&&(+ow.aportes.segSocialIndependienteMensual>0||ow.aportes.salarioEsBruto===false)&&<span style={{color:T.or||T.bl,marginLeft:6}}>· ajustes avanzados</span>}</div>
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>{setU({...u,p:{...u.p,_editOwnerId:isEditing?null:ow.id}})}} style={{background:T.bg3,border:"1px solid "+T.border,color:T.tx2,cursor:"pointer",padding:"4px 8px",borderRadius:6,fontSize:11}}>{isEditing?"✖️ Cerrar":"Editar"}</button>
                      {i>0&&<button onClick={()=>{if(confirm("¿Eliminar "+ow.name+"?")){const nw=(u.owners||[]).filter(o=>o.id!==ow.id);setU({...u,owners:nw});showToast("Propietario eliminado")}}} style={{background:T.bg3,border:"1px solid "+T.border,color:T.rd,cursor:"pointer",padding:"4px 8px",borderRadius:6,fontSize:11}}><Trash2 size={14} strokeWidth={1.75} /></button>}
                    </div>
                  </div>
                  {isEditing&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed "+T.border,display:"flex",flexDirection:"column",gap:10}}>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:0.5,display:"block",marginBottom:4}}>Nombre</label>
                      <input defaultValue={ow.name} id={"own_name_"+ow.id} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none"}}/>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:0.5,display:"block",marginBottom:4}}>Régimen tributario</label>
                      <select defaultValue={ow.regimen||"ordinario"} id={"own_reg_"+ow.id} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer"}}>
                        {regs.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
                      </select>
                      <div style={{fontSize:11,color:T.tx3,marginTop:4,lineHeight:1.4}}>El régimen determina la tarifa aplicable. Si no estás seguro, consulta con tu contador.</div>
                    </div>
                    {ow.type==="juridica"&&<>
                      <div style={{marginTop:6,paddingTop:10,borderTop:"1px dashed "+T.border}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.bl,letterSpacing:0.5,marginBottom:4}}>Datos declaración anterior (opcional)</div>
                        <div style={{fontSize:11,color:T.tx3,marginBottom:10,lineHeight:1.4}}>Si tu contador te pasa estos datos de la declaración del año anterior, el simulador los aplica según el Estatuto Tributario.</div>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:0.5,display:"block",marginBottom:4}}>Pérdidas fiscales acumuladas — Art. 147 ET</label>
                        <input type="number" defaultValue={ow.perdidasFiscalesAcumuladas||""} id={"own_perd_"+ow.id} placeholder="Ej: 250000000" style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none"}}/>
                        <div style={{fontSize:11,color:T.tx3,marginTop:4,lineHeight:1.4}}>Pérdidas fiscales de años anteriores que no se han compensado. Se compensan contra la utilidad de este año sin límite temporal.</div>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:0.5,display:"block",marginBottom:4}}>Descuentos tributarios — Art. 256-259 ET</label>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                          <input type="number" defaultValue={ow.descuentosTributarios?.cti||""} id={"own_desc_cti_"+ow.id} placeholder="CT&I (Art. 158-1)" style={{background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none"}}/>
                          <input type="number" defaultValue={ow.descuentosTributarios?.empleo||""} id={"own_desc_emp_"+ow.id} placeholder="Empleo 1ra vez (Art. 108-5)" style={{background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none"}}/>
                          <input type="number" defaultValue={ow.descuentosTributarios?.exterior||""} id={"own_desc_ext_"+ow.id} placeholder="Impuestos exterior (Art. 254)" style={{background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none"}}/>
                          <input type="number" defaultValue={ow.descuentosTributarios?.donaciones||""} id={"own_desc_don_"+ow.id} placeholder="Donaciones 25% (Art. 257)" style={{background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none"}}/>
                          <input type="number" defaultValue={ow.descuentosTributarios?.otros||""} id={"own_desc_otr_"+ow.id} placeholder="Otros descuentos" style={{gridColumn:"1/-1",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none"}}/>
                        </div>
                        <div style={{fontSize:11,color:T.tx3,marginTop:4,lineHeight:1.4}}>Valores en $ que tu contador declaró como descuentos directos del impuesto. Sujetos al tope del 25% del impuesto bruto (Art. 259 ET).</div>
                      </div>
                    </>}
                    {ow.type==="natural"&&<>
                      <div style={{marginTop:6,paddingTop:10,borderTop:"1px dashed "+T.border}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.bl,letterSpacing:0.5,marginBottom:4}}>Régimen tributario personal (opcional)</div>
                        <div style={{fontSize:11,color:T.tx3,marginBottom:10,lineHeight:1.4}}>Estos datos afectan la clasificación por cédula de tus honorarios y tu elegibilidad para depreciar activos (Art. 206 #10 y 128 ET).</div>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:0.5,display:"block",marginBottom:4}}>¿Tienes 2+ empleados contratados ≥83% del año? (Art. 206 #10)</label>
                        <select defaultValue={ow.regimenHonorarios||"no_aplica"} id={"own_regh_"+ow.id} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer"}}>
                          <option value="no_aplica">No aplica — no tengo honorarios</option>
                          <option value="sin_empleados">Sin 2+ empleados — honorarios tributan sin exenta 25%</option>
                          <option value="con_empleados">Con 2+ empleados ≥83% del año — aplica exenta 25%</option>
                        </select>
                        <div style={{fontSize:11,color:T.tx3,marginTop:4,lineHeight:1.4}}>Si tus honorarios califican (Art. 206 #10), puedes descontar la renta exenta del 25%. Afecta el impuesto en tus ingresos por honorarios.</div>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:0.5,display:"block",marginBottom:4}}>¿Obligado o voluntariamente llevas contabilidad? (Art. 38-39, 128 ET)</label>
                        <select defaultValue={ow.llevaContabilidad?"si":"no"} id={"own_contab_"+ow.id} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer"}}>
                          <option value="no">No (default para persona natural común)</option>
                          <option value="si">Sí (empresario, RUT con contabilidad)</option>
                        </select>
                        <div style={{fontSize:11,color:T.tx3,marginTop:4,lineHeight:1.4}}>Si llevas contabilidad, puedes depreciar activos (Art. 128 ET), pero pierdes el componente inflacionario de rendimientos (Art. 38-39 ET). La mayoría de las personas naturales NO llevan contabilidad.</div>
                      </div>
                      <div style={{marginTop:6,paddingTop:10,borderTop:"1px dashed "+T.border}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.or||T.bl,letterSpacing:0.5,marginBottom:4}}>Ajustes fiscales avanzados (opcional)</div>
                        <div style={{fontSize:11,color:T.tx3,marginBottom:10,lineHeight:1.4}}>Los aportes de pensión y salud obligatorias se editan dentro de cada salario en Ingresos. La Pensión Voluntaria, AFC y salud prepagada se registran como egresos con categoría "Aporte tributario". Los dos campos de abajo son para casos especiales que no encajan en ninguno de esos lugares.</div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:8}}>
                        <div>
                          <label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:0.5,display:"block",marginBottom:4}}>SS independiente total /mes</label>
                          <input type="number" defaultValue={ow.aportes?.segSocialIndependienteMensual||""} id={"own_apt_ind_"+ow.id} placeholder="Auto: 4% del IBC (40% honorarios)" style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none"}}/>
                        </div>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:T.tx3,letterSpacing:0.5,display:"block",marginBottom:4}}>¿Tu salario en Ingresos es bruto o neto?</label>
                        <select defaultValue={ow.aportes?.salarioEsBruto===false?"neto":"bruto"} id={"own_apt_bruto_"+ow.id} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer"}}>
                          <option value="bruto">Bruto (antes de aportes — recomendado)</option>
                          <option value="neto">Neto (después de aportes — se hace gross-up)</option>
                        </select>
                        <div style={{fontSize:11,color:T.tx3,marginTop:4,lineHeight:1.4}}>Si registras tu salario neto (lo que cae a la cuenta), marca "Neto" y FINPATHIA sumará los aportes para calcular el salario gravable correcto.</div>
                      </div>
                    </>}
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{
                        const nm=document.getElementById("own_name_"+ow.id)?.value?.trim()||ow.name;
                        const rg=document.getElementById("own_reg_"+ow.id)?.value||"ordinario";
                        const upd={...ow,name:nm,regimen:rg};
                        if(ow.type==="juridica"){
                          const perdRaw=document.getElementById("own_perd_"+ow.id)?.value;
                          const perd=perdRaw&&!isNaN(+perdRaw)&&+perdRaw>0?+perdRaw:null;
                          const dCti=+document.getElementById("own_desc_cti_"+ow.id)?.value||0;
                          const dEmp=+document.getElementById("own_desc_emp_"+ow.id)?.value||0;
                          const dExt=+document.getElementById("own_desc_ext_"+ow.id)?.value||0;
                          const dDon=+document.getElementById("own_desc_don_"+ow.id)?.value||0;
                          const dOtr=+document.getElementById("own_desc_otr_"+ow.id)?.value||0;
                          upd.perdidasFiscalesAcumuladas=perd;
                          const tieneDescuentos=dCti+dEmp+dExt+dDon+dOtr>0;
                          upd.descuentosTributarios=tieneDescuentos?{cti:dCti,empleo:dEmp,exterior:dExt,donaciones:dDon,otros:dOtr}:null;
                        }
                        if(ow.type==="natural"){
                          // Régimen personal — afecta clasificación fiscal por cédula
                          const regh=document.getElementById("own_regh_"+ow.id)?.value;
                          const contab=document.getElementById("own_contab_"+ow.id)?.value==="si";
                          upd.regimenHonorarios=(regh==="con_empleados"||regh==="sin_empleados")?regh:null;
                          upd.llevaContabilidad=contab;
                          // Ajustes fiscales avanzados (Commit 1.8) — sólo 2 campos: SS indep y salarioEsBruto.
                          // Pensión/salud obligatorias viven en ing.aportes (Ingresos). PV/AFC/salud prepagada viven como egresos AP_TRIB_*.
                          // Los campos pensionObligatoriaMensual / saludObligatoriaMensual / pensionVoluntariaMensual que existían antes de 1.8
                          // se preservan tal cual si el usuario tenía datos legacy — el motor post-1.7 usa fallback legacy para los obligatorios
                          // y la migración silenciosa de sanitize() limpia PV legacy en el próximo load.
                          const ind=+document.getElementById("own_apt_ind_"+ow.id)?.value||0;
                          const bru=document.getElementById("own_apt_bruto_"+ow.id)?.value!=="neto";
                          const prev=ow.aportes||{};
                          const tieneAportes=
                            ind>0 || !bru ||
                            +prev.pensionObligatoriaMensual>0 ||
                            +prev.saludObligatoriaMensual>0 ||
                            +prev.pensionVoluntariaMensual>0;
                          upd.aportes=tieneAportes?{
                            ...prev,
                            segSocialIndependienteMensual:ind>0?ind:null,
                            salarioEsBruto:bru,
                          }:null;
                        }
                        // Limpiar override legado si existía
                        delete upd.impuestoDeclaradoAnual;
                        const nw=(u.owners||[]).map(o=>o.id===ow.id?upd:o);
                        setU({...u,owners:nw,p:{...u.p,_editOwnerId:null}});
                        showToast(""+nm+" actualizado");
                      }} style={{flex:1,padding:"8px",background:T.gn,border:"none",borderRadius:6,color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>Guardar cambios</button>
                      <button onClick={()=>{setU({...u,p:{...u.p,_editOwnerId:null}})}} style={{padding:"8px 14px",background:T.bg3,border:"1px solid "+T.border,borderRadius:6,color:T.tx2,cursor:"pointer",fontSize:12}}>Cancelar</button>
                    </div>
                  </div>}
                </div>})}
                <div style={{marginTop:8,padding:12,background:T.bg,borderRadius:10,border:"1px dashed "+T.border}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.tx2,marginBottom:8}}>Agregar propietario</div>
                  <input id="new_owner_name" placeholder="Nombre (ej: Mi empresa SAS)" style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none",marginBottom:8}}/>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{const el=document.getElementById("new_owner_name");const nm=el?.value?.trim();if(!nm){showToast("Escribe un nombre");return}const nw=[...(u.owners||[]),{id:"own_"+Date.now(),name:nm,type:"natural",regimen:"ordinario"}];setU({...u,owners:nw});el.value="";showToast(""+nm+" agregado como Persona Natural")}} style={{flex:1,padding:"10px",background:T.bg3,border:"1px solid "+T.border,borderRadius:8,color:T.gn,cursor:"pointer",fontSize:12,fontWeight:600}}>Natural</button>
                    <button onClick={()=>{const el=document.getElementById("new_owner_name");const nm=el?.value?.trim();if(!nm){showToast("Escribe un nombre");return}const nw=[...(u.owners||[]),{id:"own_"+Date.now(),name:nm,type:"juridica",regimen:"ordinario"}];setU({...u,owners:nw});el.value="";showToast(""+nm+" agregado como Persona Jurídica")}} style={{flex:1,padding:"10px",background:T.bg3,border:"1px solid "+T.border,borderRadius:8,color:T.bl,cursor:"pointer",fontSize:12,fontWeight:600}}>Jurídica</button>
                  </div>
                </div>
              </div>
              <div style={{marginTop:12,padding:12,background:T.bg3,borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Cómo guardamos tus datos</div>
                <div style={{fontSize:12,color:T.tx3,marginBottom:8}}>{authUser?"Tus datos viajan cifrados (HTTPS) y se guardan cifrados en el servidor de nuestro proveedor (Supabase). No usamos cifrado de extremo a extremo: el equipo de Finpathia puede acceder a la base de datos para operar el servicio y darte soporte.":"Sin cuenta, tus datos se guardan solo en este navegador. Si usas el Asesor IA o creas una cuenta, se envían a nuestros servidores."}</div>
              </div>
              <div style={{marginTop:12,padding:12,background:T.bg3,borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>PIN de seguridad</div>
                <div style={{fontSize:12,color:T.tx3,marginBottom:8}}>Bloquea la pantalla de la app en este dispositivo después de 15 minutos de inactividad. No cifra tus datos.</div>
                {localStorage.getItem("fp3_pin")?
                  <div style={{display:"flex",gap:8}}><Bt v="s" sz="s" onClick={()=>{if(confirm("¿Desactivar PIN de seguridad?"))localStorage.removeItem("fp3_pin");showToast("PIN desactivado")}} st={{flex:1,justifyContent:"center"}}>Desactivar PIN</Bt><Bt v="s" sz="s" onClick={()=>{const p=prompt("Nuevo PIN (4 dígitos):");if(p&&p.length===4&&/^\d{4}$/.test(p)){localStorage.setItem("fp3_pin",p);showToast("PIN actualizado")}else if(p)alert("El PIN debe ser 4 dígitos")}} st={{flex:1,justifyContent:"center"}}>Cambiar PIN</Bt></div>
                  :<Bt v="s" onClick={()=>{const p=prompt("Crea un PIN de 4 dígitos:");if(p&&p.length===4&&/^\d{4}$/.test(p)){localStorage.setItem("fp3_pin",p);showToast("PIN activado — se bloquea tras 15 min")}else if(p)alert("El PIN debe ser 4 dígitos")}} st={{justifyContent:"center"}}>Activar PIN de seguridad</Bt>}
              </div>
              <Bt v="s" onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept=".json";inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);localStorage.setItem(SK,JSON.stringify(d));setU(sanitize(d));alert("Datos importados correctamente. Recarga la página.")}catch{alert("Error: archivo no válido")}};r.readAsText(f)};inp.click()}} st={{justifyContent:"center"}}>Importar Datos (JSON)</Bt>
              <Bt v="d" onClick={()=>{if(confirm("¿Borrar TODOS tus datos financieros? Esta acción no se puede deshacer. Tus inversiones, gastos, ingresos y deudas se perderán."))setU(mkU(u?.p?.name||"Usuario",u?.p?.email||""))}} st={{justifyContent:"center"}}>Borrar Datos</Bt></div></Cd></div>;
    return <MiCuenta onUpgrade={()=>setPg("price")} supabase={supabase} accountId={accountId} role={role} displayName={displayName} plan={planAccount} maxMembers={maxMembers} currentUserId={authUser?.id} currentUserName={u?.p?.name||authUser?.user_metadata?.name||authUser?.email?.split("@")[0]||"El administrador"} onChange={refreshAccount} isLegacy={isLegacy} configContent={cuentaConfig} defaultTab={pg==="set"?"config":undefined} subscriptionStatus={subscriptionStatus} graceUntil={graceUntil} pagoUnico={pagoUnico} onDescargarDatos={async()=>{const{exportarMisDatos}=await import("./lib/excelExport.js");await exportarMisDatos(u,isEN)}}/>;}
    default:return<div style={{padding:56,textAlign:"center",color:T.tx3}}>Próximamente</div>}};

  return <RoleProvider value={{role,isLegacy,accountId}}><div className="fp-app" style={{background:T.bg,minHeight:"100vh",display:"flex",fontFamily:"'Inter',system-ui",color:T.tx}}><DefsIconos/>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:${T.bg};overflow-x:hidden}input:focus,select:focus{border-color:${T.gn}!important;outline:none}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.bg3};border-radius:3px}::selection{background:${T.gn}30}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE GLOBAL — Sesión 5-may-2026
   Reglas globales que evitan los problemas más comunes en celular:
   overflow horizontal silencioso, inputs que zoomean en iOS, tablas
   que se desbordan, tap targets muy chicos.
   Los componentes individuales también usan clamp() para fontSizes.
   ═══════════════════════════════════════════════════════════════════ */
html, body, #root { max-width: 100vw; overflow-x: hidden; }
img, video, iframe, canvas, svg { max-width: 100%; height: auto; }

/* En mobile las tablas se vuelven scrollables horizontalmente en lugar de desbordar */
@media (max-width: 768px) {
  table { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }
  /* iOS NO zoomea cuando el font del input es >=16px */
  input, textarea, select { font-size: 16px !important; }
  /* Tap targets mínimos según Apple HIG */
  button { min-height: 40px; }
}
`}</style>
    {sb&&<aside style={{width:220,minWidth:220,height:"100vh",position:mb?"fixed":"sticky",top:0,background:T.bg2,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",zIndex:100,overflowY:"auto"}}><div style={{padding:"20px 18px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontSize:16,fontWeight:700,color:T.gn}}>FINPATHIA</div>{mb&&<button onClick={()=>sSb(false)} aria-label="Cerrar menú" style={{background:"none",border:"none",color:T.tx2,cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:10}}><IconoCerrar size={20} strokeWidth={1.8}/></button>}</div><nav style={{flex:1,padding:"0 8px"}}>{nvs.map(n=>{if(n.hidden)return null;
            if(n.sep)return<div key={n.id} style={{padding:n.l?"10px 12px 4px":"6px 0",fontSize:11,fontWeight:700,color:T.tx3,letterSpacing:"0.1em",borderTop:n.l?`1px solid ${T.border}`:"none",marginTop:n.l?4:0}}>{n.l||""}</div>;
            // Sub-item del menú desplegable: solo se muestra si el padre está expandido o si el sub-item es la página actual
            if(n.parent){
              const parentExpanded=expandedMenus[n.parent]||pg===n.id||nvs.some(x=>x.parent===n.parent&&x.id===pg); // 31-oct-2026: estando en una calculadora se ven sus hermanas
              if(!parentExpanded)return null;
              const a=pg===n.id;
              return<button key={n.id} onClick={()=>{setPg(n.id);if(mb)sSb(false)}} style={{width:"calc(100% - 12px)",marginLeft:12,display:"flex",alignItems:"center",justifyContent:"flex-start",textAlign:"left",gap:8,padding:"7px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:a?600:400,marginBottom:1,background:a?T.gnB:"transparent",color:a?T.gn:T.tx2,transition:"all .15s",borderLeft:`2px solid ${a?T.gn:T.border}`}}><span style={{fontSize:13}}><IconoMenu id={n.id}/></span>{n.l}</button>;
            }
            // Item con hijos (menú desplegable): clickear navega Y expande/colapsa
            if(n.hasChildren){
              const a=pg===n.id;
              const childActive=nvs.some(x=>x.parent===n.id&&pg===x.id);
              const expanded=expandedMenus[n.id]||a||childActive;
              const highlight=a||childActive;
              return<button key={n.id} onClick={()=>{
                setPg(n.goesTo||n.id);
                // Un padre con `goesTo` es solo la puerta de sus vistas:
                // colapsarlas al entrar escondería la que no abriste.
                if(!n.goesTo)setExpandedMenus(prev=>({...prev,[n.id]:!prev[n.id]}));
                if(mb)sSb(false);
              }} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:highlight?600:400,marginBottom:1,background:highlight?T.gnB:"transparent",color:highlight?T.gn:T.tx2,transition:"all .15s"}}><span style={{fontSize:14}}><IconoMenu id={n.id}/></span><span style={{flex:1,textAlign:"left"}}>{n.l}</span><span style={{fontSize:11,color:T.tx3,transform:expanded?"rotate(90deg)":"none",transition:"transform 0.15s"}}>▸</span></button>;
            }
            const a=pg===n.id||(n.id==="asesor"&&pg==="coach");return<button key={n.id} onClick={()=>{setPg(n.id);if(mb)sSb(false)}} style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:a?600:400,marginBottom:1,background:a?T.gnB:"transparent",color:a?T.gn:T.tx2,transition:"all .15s"}}><span style={{fontSize:14}}><IconoMenu id={n.id}/></span>{n.l}{n.id==="price"&&plan==="free"&&<span style={{marginLeft:"auto",background:T.gn,color:"#000",fontSize:11,fontWeight:700,padding:"1px 6px",borderRadius:999}}>PRO</span>}</button>})}</nav><div style={{padding:12,borderTop:`1px solid ${T.border}`}}><div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:8}}><div style={{width:28,height:28,borderRadius:999,background:T.gnB,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:T.gn}}>{(u?.p?.name||"U").charAt(0)}</div><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{u?.p?.name||"Usuario"}</div><div style={{fontSize:11,color:T.tx3}}>{plan==="free"?"Free":plan==="basico"?"Básico ":plan==="pro_familiar"?"Pro Familiar ":trialActive?"Pro Trial":"Pro "}</div></div></div><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",marginBottom:6,fontSize:11,color:T.tx3}}><span></span> {isEN?"Encrypted · we never sell your data":"Conexión cifrada · no vendemos tus datos"}</div><button onClick={()=>window.open("https://wa.me/?text=Encontré esta plataforma para gestionar tu patrimonio con inteligencia artificial.%0A%0APones tus inversiones, ingresos, gastos y deudas → te dice en qué nivel de libertad financiera estás, simula escenarios y un asesor IA analiza tus números reales.%0A%0A14 días gratis del plan completo, sin tarjeta.%0A%0Ahttps://finpathia.com","_blank")} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(37,211,102,0.1)",border:"1px solid rgba(37,211,102,0.2)",color:"#25d366",cursor:"pointer",padding:"8px",borderRadius:8,fontSize:12,marginBottom:6}}>Compartir por WhatsApp</button><button onClick={logout} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:T.bg3,border:"1px solid "+T.border,color:T.tx3,cursor:"pointer",padding:"8px",borderRadius:8,fontSize:12}}>Cerrar sesión</button></div></aside>}
    {mb&&sb&&<div onClick={()=>sSb(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99}}/>}
    <main style={{flex:1,minWidth:0,display:"flex",flexDirection:"column"}}>{isAdvisor&&viewMode==="client"&&currentClient&&<div style={{background:"linear-gradient(135deg,rgba(59,130,246,0.18),rgba(59,130,246,0.14))",borderBottom:"2px solid rgba(59,130,246,0.4)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,gap:12,flexWrap:"wrap"}}><span style={{color:"#bfdbfe",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14}}></span><span><strong style={{color:"#fff"}}>Viendo como asesor:</strong> {currentClient.name||currentClient.email} <span style={{opacity:0.7}}>({currentClient.email})</span></span></span><button onClick={returnToAdvisorWorkspace} style={{background:"linear-gradient(135deg,#3b82f6,#3b82f6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>← Volver a mis clientes</button></div>}{isAdvisor&&viewMode==="personal"&&<div style={{background:"linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.10))",borderBottom:"1px solid rgba(59,130,246,0.25)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,gap:12,flexWrap:"wrap"}}><span style={{color:"#93c5fd",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14}}></span><span>Modo personal — gestionas tu propio patrimonio.</span></span><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>{setViewMode("workspace");setCurrentClientId(null)}} style={{background:"linear-gradient(135deg,#3b82f6,#3b82f6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>Ir a mis clientes</button></div></div>}{u?.p?.demo&&<div style={{background:"linear-gradient(135deg,rgba(245,158,11,0.1),rgba(245,158,11,0.08))",borderBottom:"1px solid rgba(245,158,11,0.2)",padding:"8px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,gap:10,flexWrap:"wrap"}}><span style={{color:T.orange}}>{isEN?<>This is <strong>sample data</strong>, not yours{authUser?" — nothing is saved and your account stays as it was":""}.</>:<>Estos son <strong>datos de ejemplo</strong>, no los tuyos{authUser?" — no se guardan y tu cuenta queda como estaba":""}.</>}</span>{authUser?<button onClick={salirDemo} style={{background:T.gn,color:"#000",border:"none",padding:"6px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>{isEN?"Start with my own data →":"Empezar con mis datos →"}</button>:<button onClick={()=>{setPg("price")}} style={{background:T.gn,color:"#000",border:"none",padding:"6px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>{isEN?"Create an account to save →":"Crear cuenta para guardar →"}</button>}</div>}{!isLegacy&&role==="reader"&&viewMode!=="client"&&<RoleBanner accountName={displayName}/>}<AvisoTasa est={estTrmPais} t={t} fm={fm}/><header style={{height:52,padding:"0 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`,background:T.bg2,position:"sticky",top:0,zIndex:50}}><div style={{display:"flex",alignItems:"center",gap:6}}>{(!sb||mb)&&<button onClick={()=>sSb(true)} title="Abrir menú" aria-label="Abrir menú" style={{background:"none",border:"none",color:T.tx,cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:10}}><IconoMenuHamburguesa size={22} strokeWidth={1.8}/></button>}{!sb&&!mb&&<span style={{fontSize:14,fontWeight:700,color:T.gn,marginLeft:4}}>FINPATHIA</span>}</div><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"nowrap",minWidth:0}}>{!isLegacy&&memberships&&memberships.length>1&&viewMode!=="client"&&<AccountSwitcher memberships={memberships} activeAccountId={accountId} onSwitch={handleAccountSwitch}/>}{!mb&&<button onClick={()=>setShowImport(true)} style={{background:"linear-gradient(135deg,#3b82f6,#2563eb)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:4}}>{isEN?"Import Excel":"Importar Excel"}</button>}<Bg cl={T.gn}>{fm(t.nw)}</Bg>{/* 3-nov-2026: en EE. UU. todo está en dólares; el cambio COP/USD es solo de Colombia */}{!isUS&&<button onClick={()=>setCur(c=>c==="COP"?"USD":"COP")} style={{background:cur==="USD"?"#3b82f6":"#00c805",border:"none",color:"#fff",padding:"4px 8px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:12}}
                  // 03-ago-2026 — la TRM real llega del Banco de la República
                  // pero nunca se mostraba: no había forma de saber con qué tasa
                  // se estaba convirtiendo. Ahora va en el title del botón.
                  title={estTrm.trm ? `TRM $${Math.round(estTrm.trm).toLocaleString("es-CO")}${u?.trmSrc?` — ${u.trmSrc}`:""}` : "No pudimos obtener la TRM; vuelve a intentar"}
                  >{cur==="USD"?"USD":"COP"}</button>}<BotonTema/>{!mb&&<button onClick={()=>setU(p=>p?{...p,lang:isEN?"es":"en"}:p)} style={{background:"rgba(var(--fp-ink),0.08)",border:"1px solid rgba(var(--fp-ink),0.15)",color:"var(--fp-txt)",padding:"4px 10px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:12}} title="Toggle language">{isEN?"EN":"ES"}</button>}{!mb&&!isUS&&u.trm&&<span style={{fontSize:11,color:T.tx3}}>TRM: ${Math.round(u.trm).toLocaleString("es-CO")}</span>}<button onClick={()=>setMasked(m=>!m)} title={masked?"Mostrar valores":"Ocultar valores"} style={{background:"none",border:"1px solid "+T.border,color:T.tx3,cursor:"pointer",padding:"4px 8px",borderRadius:6,fontSize:12,display:"inline-flex",alignItems:"center"}}>{masked?<EyeOff size={15} strokeWidth={1.75}/>:<Eye size={15} strokeWidth={1.75}/>}</button>{plan==="free"&&!mb&&<Bt sz="s" onClick={()=>setPg("price")}>Upgrade</Bt>}</div></header><div style={{flex:1,padding:mb?"16px 14px":"36px 48px 56px",maxWidth:1280,width:"100%",margin:"0 auto"}}>{/* 31-oct-2026: ancho de lectura centrado y más margen («que se vea más descansado») */}
      {/* Suspense: los módulos pesados se cargan bajo demanda (25-jul-2026).
          El respaldo es sobrio a propósito — aparece por fracciones de segundo
          al entrar a una sección por primera vez, y un spinner llamativo se
          vería peor que un texto quieto. */}
      {noSinc&&authUser&&<AvisoNoSincronizado onReintentar={reintentarCarga} cargando={reintentando}/>}
      {conflicto&&authUser&&<div role="alert" style={{background:"rgba(245,158,11,0.12)",borderBottom:"1px solid rgba(245,158,11,0.35)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",fontSize:13,color:T.txt}}>
        <span>Hay cambios más nuevos guardados desde otra pestaña, otro dispositivo u otra persona de tu cuenta. Para no borrarlos, lo último que hiciste aquí no se guardó.</span>
        <span style={{display:"flex",gap:8}}>
          <button onClick={()=>window.location.reload()} style={{background:"#f59e0b",color:"#000",border:"none",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>Recargar y ver lo más nuevo</button>
          <button onClick={()=>{if(!confirm("Esto reemplaza lo que se guardó desde el otro lado con lo que ves en esta pantalla. ¿Seguro?"))return;forzarSiguienteGuardado();setConflicto(false);setU(p=>p?{...p}:p)}} style={{background:"transparent",color:T.tx2,border:"1px solid "+T.border,padding:"6px 12px",borderRadius:8,cursor:"pointer",fontSize:12}}>Guardar lo mío de todas formas</button>
        </span>
      </div>}
      <Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.tx3,fontSize:13}}>Cargando…</div>}>
        {u&&<NavRecorrido pg={pg} setPg={setPg} mb={mb}/>}{noSinc&&authUser?<fieldset disabled style={{border:0,margin:0,padding:0,minWidth:0}}>{rp()}</fieldset>:rp()}
      </Suspense>
      </div>{paywall&&<div onClick={()=>setPaywall(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:12,padding:"22px 22px",maxWidth:420,width:"100%"}}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>Estás en modo consulta</div>
        <div style={{fontSize:13,color:T.tx2,lineHeight:1.5,marginBottom:14}}>{planVencido?"Tu plan Pro venció.":"Tu prueba de 14 días terminó."} Tus datos siguen aquí y puedes verlos cuando quieras. Para agregar o editar, {planVencido?"renueva":"activa"} FINPATHIA Pro: <strong>$24.900 un mes</strong> o $249.000 el año (2 meses gratis), con PSE, tarjeta o Efecty.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>{setPaywall(false);track("paywall_consulta_click");setPg("price")}} style={{background:T.gn,color:"#000",border:"none",padding:"11px 18px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13}}>Ver planes →</button><button onClick={()=>setPaywall(false)} style={{background:"transparent",color:T.tx3,border:"1px solid "+T.border,padding:"11px 18px",borderRadius:10,cursor:"pointer",fontSize:13}}>Ahora no</button><button onClick={async()=>{const{exportarMisDatos}=await import("./lib/excelExport.js");await exportarMisDatos(u,isEN)}} style={{background:"transparent",color:T.tx2,border:"1px solid "+T.border,padding:"11px 14px",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:13}}>Descargar mis datos</button></div>
      </div></div>}{showImport&&<Suspense fallback={null}><CsvImport onImport={handleImport} onClose={()=>setShowImport(false)}/></Suspense>}<PWAInstallPrompt/>{showOnboarding&&<OnboardingTour open={showOnboarding} userName={u?.p?.name||authUser?.user_metadata?.name||""} isPioneros={sessionStorage.getItem("fp3_promo_code")==="PIONEROS2026"} onSelectDemo={()=>{setShowOnboarding(false);setPg("dash");(u?.jurisdiction==="US"?demoUS:demo)();showToast("Datos de ejemplo cargados — explora tranquilo")}} onSelectImport={()=>{setShowOnboarding(false);setShowImport(true)}} onSelectManual={()=>{setShowOnboarding(false);setPg("inv");showToast("Paso 1 de 4: agrega tus activos")}} onClose={()=>setShowOnboarding(false)}/>}{pagoEstado&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,display:"flex",justifyContent:"center",padding:"14px 12px",pointerEvents:"none"}}>
      <div style={{pointerEvents:"auto",maxWidth:520,width:"100%",background:pagoEstado.tipo==="exito"?"#0f2a1a":pagoEstado.tipo==="cancelado"?"#2a2416":"#12203a",border:"1px solid "+(pagoEstado.tipo==="exito"?"rgba(0,200,5,0.4)":pagoEstado.tipo==="cancelado"?"rgba(245,158,11,0.35)":"rgba(59,130,246,0.35)"),borderRadius:12,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start",boxShadow:"0 8px 28px rgba(0,0,0,0.45)"}}>
        <span style={{fontSize:20,flexShrink:0}}>{pagoEstado.tipo==="exito"?"":pagoEstado.tipo==="cancelado"?"↩️":""}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:pagoEstado.tipo==="exito"?"#3ddc45":pagoEstado.tipo==="cancelado"?"#f59e0b":"#60a5fa"}}>{pagoEstado.titulo}</div>
          <div style={{fontSize:12,color:"#cbd5e1",marginTop:3,lineHeight:1.5}}>{pagoEstado.msg}</div>
        </div>
        {(pagoEstado.tipo!=="procesando"||pagoEstado.cerrable)&&<button onClick={()=>setPagoEstado(null)} style={{background:"transparent",border:"none",color:"#64748b",cursor:"pointer",fontSize:18,lineHeight:1,padding:0,flexShrink:0}}>×</button>}
      </div>
    </div>}
    <AvisoVersion/>{toast&&<div style={{position:"fixed",top:"max(16px, env(safe-area-inset-top))",left:"50%",transform:"translateX(-50%)",maxWidth:"calc(100vw - 32px)",boxSizing:"border-box",textAlign:"center",background:"#00c805",color:"#000",padding:"12px 24px",borderRadius:12,fontWeight:700,fontSize:13,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",animation:"slideUp 0.3s ease"}}>{toast}</div>}</main>
  </div></RoleProvider>;
}
// v1775826625
