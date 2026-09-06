import LandingPage from "./components/LandingPage";
import BitcoinRetirementUS from "./components/BitcoinRetirementUS";

// ═══ CARGA DIFERIDA (25-jul-2026) ═══════════════════════════════════════════
// Santiago: "se demora mucho en cargar desde cel". El bundle pesaba 2,05 MB a
// PROCESAR (530 KB comprimidos: descargar era rápido, pero analizar y ejecutar
// 2 MB de JS en un celular son 2-3 segundos de CPU antes de poder tocar nada).
// Y Analytics mostraba que el tráfico de la pauta se iba a los 2 SEGUNDOS.
// Estos módulos no se necesitan para ver la portada ni el dashboard: se cargan
// cuando el usuario entra a su sección.
const TuNorte = lazy(() => import("./components/TuNorte"));
const IngresosModule = lazy(() => import("./components/IngresosModule"));
const GastosModule = lazy(() => import("./components/GastosModule"));
const DeudasModule = lazy(() => import("./components/DeudasModule"));
const InversionesModule = lazy(() => import("./components/InversionesModule"));
const MiCuenta = lazy(() => import("./components/MiCuenta"));
const AdminMetrics = lazy(() => import("./components/AdminMetrics"));
const FlujoAnual = lazy(() => import("./components/FlujoAnual"));
const CsvImport = lazy(() => import("./components/CsvImport"));
const CalculadoraWizard = lazy(() => import("./components/CalculadoraWizard"));
const SimuladorAvanzado = lazy(() => import("./components/SimuladorAvanzado"));
const DeclaracionFlow = lazy(() => import("./components/DeclaracionFlow"));
const PensionesColpensiones = lazy(() => import("./components/PensionesColpensiones"));
const BorradorDeclaracionF110 = lazy(() => import("./components/BorradorDeclaracionF110"));
const TaxOptimizerUS = lazy(() => import("./components/TaxOptimizerUS"));
const DashboardUS = lazy(() => import("./components/DashboardUS"));
const AssetsModuleUS = lazy(() => import("./components/AssetsModuleUS"));
const VistaFamiliarConsolidada = lazy(() => import("./components/VistaFamiliarConsolidada"));
const DashboardFiscal = lazy(() => import("./components/DashboardFiscal"));
const EstrategiaTributaria = lazy(() => import("./components/EstrategiaTributaria"));
const AsesorIA = lazy(() => import("./components/AsesorIA"));
const MetasModule = lazy(() => import("./components/MetasModule"));
import LandingAsesores from "./components/LandingAsesores";
import HeroVariantA from "./components/HeroVariantA";
import HeroVariantB from "./components/HeroVariantB";
import HeroVariantC from "./components/HeroVariantC";
import LandingPioneros from "./components/LandingPioneros";
import LandingSeguridad from "./components/LandingSeguridad";
import LandingTerminos from "./components/LandingTerminos";
import LandingPrivacidad from "./components/LandingPrivacidad";
import OnboardingTour from "./components/OnboardingTour";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { track, trackSignup, trackCheckoutStarted, captureUTMs, identifyUser } from "./lib/analytics";
import PageHeader from "./components/PageHeader";
import StatCard from "./components/StatCard";
import { ChartGradients, ChartTooltip, axisProps, gridProps, CHART } from "./lib/chartTheme.jsx";
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
import TreemapPatrimonio from "./components/TreemapPatrimonio";
import BarraComposicion from "./components/BarraComposicion";
import AnoEnCurso from "./components/AnoEnCurso";
import { generarHallazgos } from "./lib/hallazgos.js";
import { generarRecomendaciones } from "./lib/recomendaciones.js";
import SimuladorUS from "./components/SimuladorUS";
import AportesCalculadora from "./components/AportesCalculadora";
import TaxPlanningUS from "./components/TaxPlanningUS";
import IncomeModuleUS from "./components/IncomeModuleUS";
import ExpensesModuleUS from "./components/ExpensesModuleUS";
import { normalizeFiscalData, getFiscalWarnings } from "./lib/normalize.js";
import { montoPromedioMensual, añosParaMeta, ingresoInversionAnual, mesesLibreDeuda, vaCOP, vcCOP } from "./lib/flowHelpers.js";
import RetirementModuleUS from "./components/RetirementModuleUS";
import GoalsModuleUS from "./components/GoalsModuleUS";
import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense} from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { useAccount } from "./lib/useAccount";
import { RoleProvider } from "./lib/RoleContext.jsx";
import RoleBanner from "./components/RoleBanner";
import AccountSwitcher from "./components/AccountSwitcher";
import { useJurisdiction } from "./hooks/useJurisdiction";
import { UVT, calcImpRenta, estimarImpuesto } from "./lib/taxCO";
import { migrateAportesVoluntariosV17, migrateDeclaracionesV55, migrateFiscalCodePVLegacy, migratePlanOptimizacionNamespace, migrateDeudaViviendaWizardLegacy } from "./lib/migrations";
import { getPlansForApp, STRIPE_PRICE_IDS } from "./lib/plans.js";
import DeclaracionUpload from "./components/DeclaracionUpload";
import GlosarioPage from "./components/GlosarioPage";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend } from "recharts";

const T={bg:"#09090b",bg2:"#18181b",bg3:"#27272a",card:"#111113",border:"rgba(255,255,255,0.06)",borderL:"rgba(255,255,255,0.1)",tx:"#fafafa",tx2:"#a1a1aa",tx3:"#71717a",gn:"#22c55e",gnB:"rgba(34,197,94,0.08)",rd:"#ef4444",rdB:"rgba(239,68,68,0.06)",bl:"#3b82f6",pr:"#a78bfa",or:"#f59e0b",gd:"#eab308",ch:["#22c55e","#3b82f6","#f59e0b","#a78bfa","#ec4899","#06b6d4","#eab308"]};
const fm=n=>n==null?"$0":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
const pc=n=>(n||0).toFixed(1)+"%";
const SK="fp3";
const sL=async(uid,accountId)=>{
  try{
    if(isSupabaseConfigured&&uid){
      // Multi-cuenta (Fase 2): si tenemos accountId, leer por account_id.
      // Sino, fallback legacy a leer por uid (período transitorio donde
      // useAccount aun no resolvió, o usuario sin membresía multi-usuario).
      const q=supabase.from("user_data").select("data,jurisdiction");
      const{data,error}=accountId
        ?await q.eq("account_id",accountId).maybeSingle()
        :await q.eq("id",uid).maybeSingle();
      if(!error&&data?.data){
        let sd=data.data;
        if(sd._encrypted&&sd.payload){
          const encKey=localStorage.getItem("fp3_enc_key");
          if(encKey){try{sd=await E2E.decrypt(sd.payload,encKey,uid)}catch{return null}}
          else{return null}
        }
        sd=sanitize(sd);
        if(data.jurisdiction)sd.jurisdiction=data.jurisdiction;
        localStorage.setItem(SK,JSON.stringify(sd));return sd}
    }
    const r=localStorage.getItem(SK);return r?sanitize(JSON.parse(r)):null;
  }catch{return null}
};

// LoadingScreen: splash minimalista mientras el useEffect inicial resuelve.
// El timeout defensivo (Promise.race 8s) en el useEffect garantiza que
// setLd(false) siempre se ejecute; este splash nunca debería quedarse
// visible por más de 1-2 segundos en condiciones normales.
function LoadingScreen(){
  return <div style={{background:"#0c0c0f",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui"}}>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:32,fontWeight:900,background:"linear-gradient(135deg,#22c55e,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>FINPATHIA</div>
      <div style={{width:40,height:3,background:"linear-gradient(90deg,#22c55e,#3b82f6)",borderRadius:2,margin:"16px auto",animation:"pulse 1.5s infinite"}}/>
      <div style={{color:"#6b7280",fontSize:12}}>Cargando tu patrimonio...</div>
    </div>
  </div>;
}


const sanitize=(d)=>{if(!d||typeof d!=="object")return null;if(!d.p)d.p={};if(!d.p.name)d.p.name="Usuario";if(!d.p.email)d.p.email="";if(!d.p.plan)d.p.plan="free";if(!d.owners)d.owners=[{id:"own_1",name:"Personal",type:"natural",regimen:"ordinario"}];d.owners=d.owners.map(o=>({...o,regimen:o.regimen||"ordinario"}));if(!d.inv)d.inv=[];d.inv=d.inv.map(i=>{if(i.tp&&!isNaN(Number(i.tp))){i.tp=inferType(i);i.tipo=i.tp}return i});if(!d.deu)d.deu=[];
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
if(!d.ingresos)d.ingresos=[];if(!d.metas)d.metas=[];if(!d.ibk)d.ibk=[];if(!d.pen)d.pen={};if(!d.jurisdiction)d.jurisdiction="CO";if(d.componenteInflacionarioPct==null)d.componenteInflacionarioPct=50.88;return migrateDeudaViviendaWizardLegacy(migratePlanOptimizacionNamespace(migrateFiscalCodePVLegacy(migrateDeclaracionesV55(migrateAportesVoluntariosV17(d)))))};

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
const takeSnapshot=(d)=>{
  try{
    const snaps=JSON.parse(localStorage.getItem("fp3_snapshots")||"[]");
    const now=new Date();
    const key=now.getFullYear()+"-"+(now.getMonth()+1).toString().padStart(2,"0");
    const exists=snaps.find(s=>s.k===key);
    if(!exists&&d){
      const inv=(d.inv||[]).reduce((s,i)=>s+(i.va||0),0);
      const deu=(d.deu||[]).reduce((s,i)=>s+(i.mt||0),0);
      snaps.push({k:key,d:now.toISOString().split("T")[0],nw:inv-deu,a:inv,de:deu});
      if(snaps.length>60)snaps.shift();
      localStorage.setItem("fp3_snapshots",JSON.stringify(snaps));
    }
  }catch{}
};
const sS=async(d,uid,accountId,isLegacy,role)=>{
  try{
    localStorage.setItem(SK,JSON.stringify(d));
    takeSnapshot(d);
    if(isSupabaseConfigured&&uid){
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
        // Commit 12 Tarea 3 (BUG REPORTADO: 'no quedan guardados'): el catch
        // silencioso original ocultaba errores del upsert. Si Supabase rechazaba
        // el guardado (RLS, schema mismatch, tamaño), el usuario veia "✅ Guardado"
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
          let result;
          if(accountId&&!isLegacy){
            result=await supabase.from("user_data")
              .update({data:d,jurisdiction:d.jurisdiction||"CO",updated_at:new Date().toISOString()})
              .eq("account_id",accountId);
          }else{
            result=await supabase.from("user_data").upsert(
              {id:uid,data:d,jurisdiction:d.jurisdiction||"CO",updated_at:new Date().toISOString()},
              {onConflict:"id"}
            );
          }
          if(result.error){
            console.error("[fp3] Supabase save ERROR:",result.error);
            window.__fp3LastSaveError=result.error;
            // Toast visible al usuario para que sepa que hay un problema
            try{const ev=new CustomEvent("fp3-save-error",{detail:result.error});window.dispatchEvent(ev)}catch{}
          }else{
            window.__fp3LastSaveOk=new Date().toISOString();
            // Commit 23 Tarea 3: notificar al usuario cuando el upsert a Supabase
            // se confirma. Resuelve la duda 'se guardo o no?' que tenia el usuario
            // (caso del bug reportado 'AGREGO SALARIOS PERO NO QUEDAN GUARDADOS'
            // - los datos SI se guardaban, pero el toast '✅ Guardado' se mostraba
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
const ADV=[{id:"cashflow",nm:"Cashflowista",av:"💰",cl:"#eab308",bg:"rgba(234,179,8,0.06)",ti:"Ingreso Pasivo"},{id:"estratega",nm:"Estratega",av:"🎯",cl:"#ef4444",bg:"rgba(239,68,68,0.06)",ti:"5 Niveles de Libertad"},{id:"riesgo",nm:"Auditor",av:"🔬",cl:"#3b82f6",bg:"rgba(59,130,246,0.06)",ti:"Riesgo & Concentración"},{id:"valor",nm:"Fundamentalista",av:"📊",cl:"#22c55e",bg:"rgba(34,197,94,0.06)",ti:"Valor & Rendimiento"},{id:"contrarian",nm:"Contrarian",av:"🧠",cl:"#a78bfa",bg:"rgba(167,139,250,0.06)",ti:"Lo que NO hacer"}];

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

const cT=(inv,ds,gf,ing,taxData,trm=4200)=>{
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
  const independencia=egresosTotales>0?(disponibleCuenta/egresosTotales)*100:0;
  return{
    // ═══ Nuevo modelo explícito ═══
    brutoTotal, retencionMensual, disponibleCuenta,
    aportesObligatorios, gastosFamiliares, cuotasDeudas,
    impuestoBrutoMensual, impuestoNeto,
    egresosTotales, cashFlow, independencia,
    // ═══ Legacy aliases (compatibilidad) ═══
    ab, td, nw:ab-td,
    ti:brutoTotal, tg:0, ni:disponibleCuenta,
    gfm, tc:cuotasDeudas, te:egresosTotales, cf:cashFlow,
    ind:independencia, dta:ab>0?(td/ab)*100:0, ingT:brutoTotal,
    tTax:impuestoNeto,
  };
};

const Cd=({children,s,...p})=><div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",...s}} {...p}>{children}</div>;
const St=({l,v,sub,cl})=><div style={{padding:"16px 20px"}}><div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>{l}</div><div style={{fontSize:24,fontWeight:700,color:cl||T.tx,letterSpacing:"-0.03em"}}>{v}</div>{sub&&<div style={{fontSize:12,color:T.tx3,marginTop:3}}>{sub}</div>}</div>;
const Bg=({children,cl})=><span style={{background:`${cl||T.gn}15`,color:cl||T.gn,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{children}</span>;
const Bt=({children,onClick,v,sz,dis,st})=>{const vs={p:{background:`linear-gradient(135deg,${T.gn},#16a34a)`,color:"#fff"},s:{background:"transparent",color:T.tx2,border:`1px solid ${T.border}`},d:{background:T.rdB,color:T.rd}};const ss={s:{padding:"6px 14px",fontSize:12},m:{padding:"10px 20px",fontSize:14},l:{padding:"14px 28px",fontSize:16}};return<button onClick={onClick} disabled={dis} style={{...(vs[v||"p"]),...(ss[sz||"m"]),borderRadius:10,border:"none",cursor:dis?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:6,fontWeight:600,opacity:dis?.5:1,...(st||{})}}>{children}</button>};
const fmtNum=(v)=>{if(v==null||v==="")return"";const n=String(v).replace(/[^0-9.-]/g,"");if(!n||isNaN(Number(n)))return String(v);const parts=n.split(".");parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,",");return parts.join(".")};
const unfmtNum=(v)=>String(v).replace(/,/g,"");
const In=({l,value:v,onChange:oc,type:tp,placeholder:ph,options:opts})=><div style={{display:"flex",flexDirection:"column",gap:5}}>{l&&<label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>{l}</label>}{opts?<select value={v||""} onChange={e=>oc(e.target.value)} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.tx,fontSize:14,outline:"none"}}>{opts.map(o=><option key={o.v!=null?o.v:o} value={o.v!=null?o.v:o}>{o.l||o}</option>)}</select>:tp==="number"?<input type="text" inputMode="numeric" value={fmtNum(v)} onChange={e=>{const raw=unfmtNum(e.target.value);oc(raw)}} placeholder={ph} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.tx,fontSize:14,outline:"none"}}/>:<input type={tp||"text"} value={v!=null?v:""} onChange={e=>oc(e.target.value)} placeholder={ph} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.tx,fontSize:14,outline:"none"}}/>}</div>;
const Md=({open,onClose,title,children,wide})=>{if(!open)return null;return<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1e3,padding:20}}><div onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:`1px solid ${T.borderL}`,borderRadius:20,width:"100%",maxWidth:wide?700:520,maxHeight:"85vh",overflow:"auto",padding:32}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><h3 style={{fontSize:18,fontWeight:700,margin:0,color:T.tx}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:18}}>✕</button></div>{children}</div></div>};

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
  const trmPendiente = useRef(null);
  // Aplica la TRM que llegó antes de que existiera `u`. Sin esto, en la carga
  // normal (sesión más lenta que la petición) la tasa real se perdía.
  useEffect(() => {
    if (u && trmPendiente.current && u.trm !== trmPendiente.current.trm) {
      const { trm, trmSrc } = trmPendiente.current;
      trmPendiente.current = null;
      setU(p => p ? { ...p, trm, trmSrc } : p);
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
        const r = await fetch("/api/trm");
        const j = await r.json();
        if (vivo && j?.trm) setU(p => (p && p.trm !== j.trm) ? { ...p, trm: j.trm, trmSrc: j.source } : p);
      } catch {}
    };
    const id = setInterval(traer, 6 * 60 * 60 * 1000);
    const alVolver = () => { if (document.visibilityState === "visible") traer(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; clearInterval(id); document.removeEventListener("visibilitychange", alVolver); };
  }, []);
  });const[u,_setU]=useState(null);const setU=(v)=>{if(typeof v==="function"){_setU(p=>{const r=v(p);return r||p})}else{_setU(v)}};const[ld,setLd]=useState(true);const[pg,setPg]=useState("dash");const[md,setMd]=useState(null);const[f,sF]=useState({});const[aM,sAM]=useState("login");const[aF,sAF]=useState({n:"",e:"",p:""});const[adv,sAdv]=useState(null);const[sb,sSb]=useState(true);const[mb,sMb]=useState(false);const[simS,sSimS]=useState("actual");const[showImport,setShowImport]=useState(false);const[cur,setCur]=useState(()=>localStorage.getItem("fp3_cur")||"COP");const[showAuth,setShowAuth]=useState(false);const[loginRole,setLoginRole]=useState(()=>{if(typeof window==="undefined")return"client";const p=window.location.pathname;return(p==="/asesores"||p==="/asesores/")?"advisor":"client"});const[billingCycle,setBillingCycle]=useState("mensual");const[toast,setToast]=useState("");const[authUser,setAuthUser]=useState(null);const[authLoading,setAuthLoading]=useState(false);const[authError,setAuthError]=useState("");const[locked,setLocked]=useState(false);const[pinInput,setPinInput]=useState("");const[masked,setMasked]=useState(false);const[taxTab,setTaxTab]=useState("estrategia");const[descuentosOwnerId,setDescuentosOwnerId]=useState(null);const[aportesOwnerId,setAportesOwnerId]=useState(null);const[showAyuda,setShowAyuda]=useState(false);const[ownerJumpFromFamilyView,setOwnerJumpFromFamilyView]=useState(null);
  // State para menús desplegables del sidebar (sesión 1-may-2026 v3:
  // colapsar Vista familiar y Declaraciones anteriores bajo Impuestos
  // para no llenar el menú lateral). Por default abierto si la página
  // actual es uno de los hijos.
  const[expandedMenus,setExpandedMenus]=useState(()=>({tax:false}));
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
  const[showOnboarding,setShowOnboarding]=useState(false);
  const[recoveryEmail,setRecoveryEmail]=useState("");
  // ═══ MULTI-USUARIO STATE (Fase 2 commit 1) ═══
  // useAccount detecta la cuenta activa del usuario y su rol. Si la migración
  // 01+01b+01c+01d aún no está aplicada, devuelve isLegacy=true con defaults
  // (admin) y todo el flujo cae al camino legacy. Cuando está aplicada, los
  // saves van a public.user_data por account_id en lugar de por id.
  const{accountId,role,isLegacy,displayName,plan:planAccount,maxMembers,memberships,subscriptionStatus,graceUntil,loading:accountLoading,refresh:refreshAccount}=useAccount(authUser,supabase);
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
      try{const d=await sL(uid,accountId);if(d)setU(sanitize(d))}
      catch(e){console.warn("[fp3] reload tras switch falló:",e)}
    })();
  },[accountId,accountLoading]);
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
      pathname: typeof window !== "undefined" ? window.location.pathname : "",
      referrer: typeof document !== "undefined" ? document.referrer : "",
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
            const d=await Promise.race([sL(session.user.id,accountIdRef.current),timeout]);
            if(d)setU(sanitize(d));
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
      const r=await fetch('/api/trm');
      const j=await r.json();
      if(j.trm){
        trmPendiente.current={trm:j.trm,trmSrc:j.source};
        setU(p=>p?{...p,trm:j.trm,trmSrc:j.source}:p);
      }
    }catch{}
    // Handle Stripe success redirect
    const params=new URLSearchParams(window.location.search);
    const successFlag=params.get('success');
    const sessionId=params.get('session_id');
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
    if(cancelado==='true'){
      setPagoEstado({tipo:"cancelado",titulo:"No se completó el pago",msg:"No te cobramos nada y tu plan sigue igual. Podés intentarlo cuando quieras."});
      window.history.replaceState({},'',window.location.pathname);
    } else if(successFlag==='true'||(successFlag==='1'&&sessionId&&sessionId!=='{CHECKOUT_SESSION_ID}')){
      setPagoEstado({tipo:"procesando",titulo:"Confirmando tu pago…",msg:"Un momento, estamos activando tu plan."});
      try{
        const userId=(await supabase.auth.getUser()).data?.user?.id;
        if(userId&&sessionId&&sessionId!=='{CHECKOUT_SESSION_ID}'){
          const r=await fetch('/.netlify/functions/stripe-recover-activation',{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({userId,sessionId}),
          });
          const data=await r.json();
          if(data.ok){
            setPagoEstado({tipo:"exito",titulo:"¡Listo! Tu plan está activo",msg:"Gracias por confiar en FINPATHIA. Ya tenés acceso completo."});
            setTimeout(()=>window.location.reload(),2500);
          }else{
            // Pro/Básico: la activación la hace el webhook, no esta función.
            // No es un error del usuario — su pago SÍ se registró.
            setPagoEstado({tipo:"exito",titulo:"Pago recibido",msg:"Tu suscripción quedó registrada. La activación puede tardar unos segundos; si no ves el cambio, recargá la página."});
            setTimeout(()=>window.location.reload(),4000);
          }
        }else{
          setPagoEstado({tipo:"exito",titulo:"Pago recibido",msg:"Tu suscripción quedó registrada. Si no ves el cambio en unos segundos, recargá la página."});
        }
      }catch(e){
        setPagoEstado({tipo:"exito",titulo:"Pago recibido",msg:"Tu suscripción quedó registrada. Si no ves el cambio, escribinos a soporte@finpathia.com y lo revisamos."});
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
    if(isAdvisorViewingClient){
      sS(u,targetId);
    }else{
      sS(u,targetId,accountIdRef.current,isLegacyRef.current,roleRef.current);
    }
  },[u]);

  // Commit 12 Tarea 3: listener de errores de Supabase para hacer visible al
  // usuario cuando un guardado falla. Antes el catch silencioso ocultaba el
  // problema y el usuario veia "✅ Guardado" sin que los datos llegaran al
  // backend. Al recargar la pagina se perdian.
  useEffect(()=>{
    const handler=(e)=>{
      const err=e.detail;
      const msg=err?.message||err?.code||String(err);
      console.error("[fp3] Save error caught by listener:",err);
      setToast(`⚠️ Error guardando: ${msg.slice(0,80)}. Revisa la consola.`);
      setTimeout(()=>setToast(""),8000);
    };
    window.addEventListener("fp3-save-error",handler);
    return ()=>window.removeEventListener("fp3-save-error",handler);
  },[]);

  // Commit 23 Tarea 3: listener de OK de Supabase. Cuando el upsert se
  // confirma (despues del debounce de 2s en sS()), mostramos toast
  // '☁️ Sincronizado' por 2 segundos. Esto reemplaza el feedback enganoso
  // '✅ Guardado' inmediato por un flujo de dos etapas honesto:
  //   '💾 Guardando…' (al instante, localStorage hecho)
  //   '☁️ Sincronizado' (a los ~2s, backend confirmo)
  // Solo se muestra si hay un toast 'Guardando' activo o si el toast esta
  // vacio (no sobreescribir mensajes informativos).
  useEffect(()=>{
    const handler=()=>{
      // Lee toast actual desde el state callback para evitar dependencia
      setToast(prev=>{
        if(prev && !prev.includes("Guardando")) return prev; // respetar otros toasts
        return "☁️ Sincronizado";
      });
      setTimeout(()=>setToast(prev=>prev==="☁️ Sincronizado"?"":prev),2000);
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
      setToast("🔒 Solo lectura · pedile al admin de la cuenta que actualice este dato");
      setTimeout(()=>setToast(prev=>prev.startsWith("🔒")?"":prev),3500);
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

  const trm=u?.trm||4200;
  const { regPack, jurisdiction } = useJurisdiction(u);
  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),3000)};
  // logout: limpia COMPLETAMENTE el estado local + supabase. Debe dejar
  // la app en el mismo estado que si acabara de abrirse por primera vez.
  // Si supabase.signOut falla (común cuando el token ya expiró del lado
  // servidor), limpiamos igual lo local para que el usuario nunca quede
  // atrapado en un estado "medio-logueado".
  const logout=async()=>{
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
  const auth=async()=>{
    if(!aF.e||!aF.p){setAuthError("Ingresa email y contraseña");return}
    // Sesión 4-may-2026: subimos mínimo de 6 → 8 caracteres + validación
    // de seguridad básica (no permitir passwords débiles obvios). Esto se
    // aplica solo en SIGNUP — login deja pasar passwords viejas para no
    // bloquear users existentes que tengan password de 6 chars.
    if(aM==="signup"){
      // Sesión 4-may-2026: validar aceptación de Términos y Privacidad.
      // Sin esto, los términos no son legalmente vinculantes en Colombia.
      if(!aF.acceptTerms){setAuthError("Debés aceptar los Términos y Condiciones y la Política de Privacidad para crear tu cuenta.");return}
      if(aF.p.length<8){setAuthError("La contraseña debe tener mínimo 8 caracteres");return}
      // Lista de passwords débiles más comunes (top 20 en breaches conocidos).
      // Si el user intenta uno de estos, lo rechazamos con mensaje claro.
      const weakList=["12345678","password","qwerty12","11111111","00000000","abcdefgh","87654321","password1","password2","contrasena","password123","qwertyuiop","asdfghjkl","zxcvbnm123","12345abc","abc12345"];
      if(weakList.includes(aF.p.toLowerCase())){setAuthError("Esa contraseña es muy común. Elegí algo único — por ejemplo una frase corta con números.");return}
      // Anti-patrón: solo numéros (ej: "12345678" o "11223344")
      if(/^\d+$/.test(aF.p)){setAuthError("La contraseña no puede ser solo números. Agregá letras o símbolos.");return}
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
        track("login_completed",{ method:"email", user_id: data.user.id });
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
        setAuthUser(data.user);localStorage.setItem("fp3_enc_key",aF.p);
        try{
          const d=await Promise.race([
            // Multi-cuenta (Fase 2): paso accountIdRef.current. Inicialmente
            // null porque useAccount no resolvió tras setAuthUser; sL cae a
            // path legacy y trae los datos correctamente.
            sL(data.user.id,accountIdRef.current),
            new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout cargando datos")),10000))
          ]);
          if(d){const __sd=sanitize(d);setU(__sd);setPg("dash");if(cuentaVacia(__sd))setShowOnboarding(true);}
          else{const nd=mkU(aF.n||"Usuario",aF.e);nd.p.plan="free";nd.p.trialEnd=new Date(Date.now()+getTrialDays(aF.e)*86400000).toISOString().split("T")[0];nd.jurisdiction=aF.country||"CO";setU(nd);await sS(nd,data.user.id);setShowOnboarding(true)}
        }catch(loadErr){
          // Si falla la carga de datos: limpiamos el estado a medio-loguear para no
          // dejar al usuario atrapado con authUser seteado pero sin data (lo que
          // causaría loader infinito). Mostramos error accionable.
          setAuthUser(null);
          try{await supabase.auth.signOut({scope:"local"})}catch{}
          localStorage.removeItem("fp3_enc_key");
          setAuthError("No se pudo cargar tus datos: "+loadErr.message+". Volvé a intentar.");
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
          body:JSON.stringify({email:aF.e,password:aF.p,name:aF.n||""})
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
        let friendly=errMsg;if(errMsg.includes("already been registered")||errMsg.includes("already registered")||errMsg.includes("already exists"))friendly="Este email ya tiene cuenta. Probá iniciar sesión.";else if(errMsg.includes("Cuenta llena")||errMsg.includes("límite del plan"))friendly="Estamos teniendo un problema técnico al crear tu cuenta. Por favor intentá de nuevo o escribinos a soporte@finpathia.com.";else if(errMsg.includes("Invalid email")||errMsg.includes("invalid email"))friendly="El email no es válido. Verificá que esté bien escrito.";else if(errMsg.includes("Password should be"))friendly="La contraseña no cumple con los requisitos de seguridad.";setAuthError(friendly);setAuthLoading(false);return}
        const{data,error}=await supabase.auth.signInWithPassword({email:aF.e,password:aF.p});
        if(error){setAuthError(error.message);setAuthLoading(false);return}
        setAuthUser(data.user);localStorage.setItem("fp3_enc_key",aF.p);const nd=mkU(aF.n||"Usuario",aF.e);nd.p.plan="free";nd.p.trialEnd=new Date(Date.now()+getTrialDays(aF.e)*86400000).toISOString().split("T")[0];nd.jurisdiction=aF.country||"CO";setU(nd);await sS(nd,data.user.id);
        // Sesión 4-may-2026: tracking GA4 — signup completed con metadata
        // de promo (Pioneros) y user_id para atribución cross-device.
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
        setShowOnboarding(true);
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
  const demo=()=>{showToast("📊 Datos de ejemplo cargados");window.gtag?.("event","demo_opened",{method:"button"});setU(p=>{
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
    nd.owners=[
      {id:"own_1",name:"Pedro Pérez",type:"natural"},
      {id:"own_j1",name:"Inversiones Pérez SAS",type:"juridica"},
    ];
    nd.inv=[
      {id:"d_i1",n:"Apartamento Chapinero",ub:"Bogotá",tp:"Real Estate",va:850000000,vc:520000000,tasa:"",owner:"own_j1"},
      {id:"d_i2",n:"Casa Campestre Tabio",ub:"Tabio, Cundinamarca",tp:"Real Estate",va:1200000000,vc:800000000,tasa:"",owner:"own_1"},
      {id:"d_i3",n:"Bodega Fontibón",ub:"Bogotá",tp:"Bodega",va:650000000,vc:400000000,tasa:"",owner:"own_j1"},
      {id:"d_i4",n:"Local Centro Comercial",ub:"Bogotá",tp:"Local Comercial",va:420000000,vc:350000000,tasa:"",owner:"own_j1"},
      {id:"d_i5",n:"Fondo Bancolombia",ub:"Colombia",tp:"Fondo de Inversión",va:180000000,vc:150000000,tasa:"8",owner:"own_1"},
      {id:"d_i6",n:"CDT Davivienda",ub:"Colombia",tp:"CDT",va:120000000,vc:120000000,tasa:"11.5",owner:"own_1"},
      {id:"d_i7",n:"Acciones ETF S&P500",ub:"USA",tp:"Acciones",va:95000000,vc:60000000,tasa:"",owner:"na"},
      {id:"d_i8",n:"Bitcoin",ub:"",tp:"Crypto",va:45000000,vc:20000000,tasa:"",owner:"na"},
      {id:"d_i9",n:"Ranger Raptor 2024",ub:"Bogotá",tp:"Vehículo",va:220000000,vc:280000000,tasa:"",owner:"own_1"},
      {id:"d_i10",n:"Rapicredit Fondeo",ub:"Colombia",tp:"Fondo de Inversión",va:500000000,vc:500000000,tasa:"20",owner:"own_j1"},
    ];
    nd.ingresos=[
      {id:"d_ig1",nombre:"Salario Empresa Tech",categoria:"Salario",mensual:18000000,tipo:"fijo",fuente:"TechCorp",owner:"own_1",moneda:"COP"},
      {id:"d_ig2",nombre:"Arriendo Apto Chapinero",categoria:"Arriendo",mensual:4500000,tipo:"fijo",fuente:"Apto Chapinero",owner:"own_j1",moneda:"COP",capital:"850000000",tasa:"6.4"},
      {id:"d_ig3",nombre:"Arriendo Bodega",categoria:"Arriendo",mensual:8500000,tipo:"fijo",fuente:"Bodega Fontibón",owner:"own_j1",moneda:"COP"},
      {id:"d_ig4",nombre:"Arriendo Local",categoria:"Arriendo",mensual:3800000,tipo:"fijo",fuente:"Local CC",owner:"own_j1",moneda:"COP"},
      {id:"d_ig5",nombre:"Rendimiento CDT",categoria:"Rendimiento",mensual:1150000,tipo:"fijo",fuente:"CDT Davivienda",owner:"own_1",moneda:"COP",capital:"120000000",tasa:"11.5"},
      {id:"d_ig6",nombre:"Rendimiento Rapicredit",categoria:"Rendimiento",mensual:8333000,tipo:"fijo",fuente:"Rapicredit",owner:"own_j1",moneda:"COP",capital:"500000000",tasa:"20"},
      {id:"d_ig7",nombre:"Freelance consultoría",categoria:"Honorarios",mensual:5000000,tipo:"variable",fuente:"Clientes",owner:"own_1",moneda:"COP"},
      // 26-jul-2026 (Santiago: "podríamos cambiar el ejemplo de Pedro Pérez,
      // ponerle más cosas para que se vea en detalle cómo funciona la
      // plataforma, por ejemplo algunos ingresos variables o de unos meses,
      // para que se vea cómo el flujo cambia por mes").
      // Los 7 ingresos originales eran TODOS mensuales fijos, así que la demo
      // mostraba un flujo plano — justo lo que la plataforma NO es. Estos 4
      // agregan los casos que la diferencian:
      {id:"d_ig8",nombre:"Prima de servicios",categoria:"Salario",mensual:9000000,tipo:"fijo",
       frecuencia:"variable",fuente:"TechCorp",owner:"own_1",moneda:"COP",
       // Junio y diciembre: el clásico colombiano. En el flujo se ven dos picos.
       montosMensuales:[0,0,0,0,0,9000000,0,0,0,0,0,9000000]},
      {id:"d_ig9",nombre:"Contrato proyecto Q4",categoria:"Honorarios",mensual:12000000,tipo:"variable",
       fuente:"Cliente corporativo",owner:"own_1",moneda:"COP",desdeMes:10,hastaMes:12,
       // Vigencia parcial: entra solo oct-dic. Su promedio anual es $3M, no $12M.
      },
      {id:"d_ig10",nombre:"Comisiones ventas",categoria:"Honorarios",mensual:0,tipo:"variable",
       frecuencia:"variable",fuente:"Clientes",owner:"own_1",moneda:"COP",
       // Mes a mes distinto: el caso que ninguna app de finanzas modela bien.
       montosMensuales:[3200000,1800000,4500000,2100000,6800000,3400000,2900000,5100000,4200000,7500000,8900000,11000000]},
      {id:"d_ig11",nombre:"Dividendos Inversiones Pérez",categoria:"Dividendos",mensual:24000000,tipo:"fijo",
       frecuencia:"anual",mesPago:4,fuente:"Inversiones Pérez SAS",owner:"own_j1",moneda:"COP",
       // Una vez al año, en abril. Promedio $2M/mes, pero abril salta.
      },
    ];
    nd.deu=[
      {id:"d_d1",n:"Hipoteca Casa Tabio",tp:"mortgage",mt:480000000,pg:5200000,ts:12,owner:"own_1"},
      {id:"d_d2",n:"Crédito Bodega",tp:"loan",mt:180000000,pg:3100000,ts:14,owner:"own_j1"},
      {id:"d_d3",n:"Tarjeta Visa",tp:"credit_card",mt:8500000,pg:1200000,ts:28,owner:"own_1"},
      {id:"d_d4",n:"Leasing Ranger Raptor",tp:"loan",mt:150000000,pg:3800000,ts:16,owner:"own_1"},
    ];
    nd.gas={
      "Vivienda":[{c:"Administración casa",m:1800000,t:"f",owner:"own_1"},{c:"Arriendo oficina",m:3500000,t:"f",owner:"own_j1"},{c:"Predial casa",m:450000,t:"f",owner:"own_1"},{c:"Predial bodega",m:380000,t:"f",owner:"own_j1"}],
      "Alimentación":[{c:"Mercado familiar",m:2800000,t:"f",owner:"own_1"},{c:"Restaurantes",m:1200000,t:"v",owner:"own_1"}],
      "Transporte":[{c:"Gasolina",m:800000,t:"v",owner:"own_1"},{c:"SOAT + Seguros",m:350000,t:"f",owner:"own_1"},{c:"Transporte empresa",m:600000,t:"f",owner:"own_j1"}],
      "Educación":[{c:"Colegio hijos",m:4500000,t:"f",owner:"own_1",desdeMes:2,hastaMes:11},
                   {c:"Matrícula anual",m:6500000,t:"f",owner:"own_1",frecuencia:"anual"},
                   {c:"Cursos online",m:200000,t:"v",owner:"own_1"}],
      "Salud":[{c:"Medicina prepagada familiar",m:1800000,t:"f",owner:"own_1"},{c:"Farmacia",m:300000,t:"v",owner:"own_1"}],
      // 26-jul-2026 — los seguros suelen pagarse ANUALES, y así se ve la
      // diferencia entre "$5.4M al año" y "$5.4M al mes": el error de
      // frecuencia que costó varias sesiones detectar en producción.
      "Seguros":[{c:"Seguro de vida",m:450000,t:"f",owner:"own_1"},
                 {c:"Póliza todo riesgo propiedades",m:8160000,t:"f",owner:"own_j1",frecuencia:"anual"},
                 {c:"Seguro vehículo (anual)",m:3200000,t:"f",owner:"own_1",frecuencia:"anual"}],
      // Impuestos: el predial y la renta caen en meses puntuales, no todos los meses.
      "Impuesto":[{c:"Predial (una vez al año)",m:4800000,t:"f",owner:"own_j1",frecuencia:"anual"},
                  {c:"Renta persona natural",m:18000000,t:"f",owner:"own_1",frecuencia:"anual"}],
      "Servicios":[{c:"Servicios casa",m:850000,t:"f",owner:"own_1"},{c:"Internet y telefonía empresa",m:350000,t:"f",owner:"own_j1"}],
      "Seguridad Social":[{c:"Pensión + EPS + ARL",m:3200000,t:"f",owner:"own_1"}],
      "Entretenimiento":[{c:"Streaming y suscripciones",m:250000,t:"f",owner:"own_1"},{c:"Vacaciones (mensualizado)",m:2000000,t:"v",owner:"own_1"}],
      "Personal":[{c:"Ropa y cuidado personal",m:500000,t:"v",owner:"own_1"}],
    };
    return nd;
  });setTimeout(()=>showToast("🧾 Impuestos calculados para Pedro Pérez y Pérez SAS"),1500)};
  const demoUS=()=>{
    showToast("🇺🇸 Demo USA cargado — Alex Johnson, Austin TX");
    setU(()=>{
      const nd=mkU("Alex Johnson","demo-us@finpathia.com");
      nd.p={name:"Alex Johnson",email:"demo-us@finpathia.com",plan:"pro",
        trialEnd:new Date(Date.now()+30*86400000).toISOString().split("T")[0],
        demo:true,anonymous:true};
      nd.jurisdiction="US";
      nd.trm=1;
      // Sesión 4-may-2026: Alex vive en Austin TX (no state income tax)
      // y filing como single (~30s, soltero, primer trabajo serio).
      // Cambiar a CA o NY desde el selector muestra el impacto del state tax.
      nd.taxConfig={filingStatus:"single",state:"TX"};
      nd.ingresos=[
        {id:"us_ig1",nombre:"W-2 — VP Engineering",categoria:"Salary",mensual:18500,tipo:"fijo",fuente:"Austin Tech Co.",owner:"own_1",moneda:"USD"},
        // Bono anual en marzo: se ve el pico en el flujo del año.
        {id:"us_ig2",nombre:"Annual Bonus",categoria:"Salary",mensual:65000,tipo:"variable",frecuencia:"anual",mesPago:3,fuente:"Austin Tech Co.",owner:"own_1",moneda:"USD"},
        {id:"us_ig3",nombre:"Rental Income — Duplex",categoria:"Rental",mensual:3400,tipo:"fijo",fuente:"East Austin duplex",owner:"own_1",moneda:"USD"},
        // Consultoría que varía mes a mes: el caso que ninguna app modela bien.
        {id:"us_ig4",nombre:"1099-NEC — Consulting",categoria:"Self-employed",mensual:0,tipo:"variable",frecuencia:"variable",fuente:"Advisory clients",owner:"own_1",moneda:"USD",
         montosMensuales:[4200,2800,6500,3100,8200,4400,3900,7100,5200,9500,11000,6800]},
        {id:"us_ig5",nombre:"Dividends — Index Funds",categoria:"Dividends",mensual:640,tipo:"variable",fuente:"Vanguard",owner:"own_1",moneda:"USD"},
        {id:"us_ig6",nombre:"Interest — HYSA",categoria:"Interest",mensual:305,tipo:"fijo",fuente:"Marcus HYSA",owner:"own_1",moneda:"USD"},
      ];
      // 02-ago-2026 (Santiago: "para el modelo de USA ponga que el demo tenga
      // un capital mayor, al menos 2 MM USD"). El demo anterior sumaba $90.200
      // de patrimonio: un perfil de primer trabajo, que no muestra para qué
      // sirve una herramienta de family office. Con $2,4M la concentración,
      // el FIRE number y la planeación fiscal empiezan a decir algo.
      nd.inv=[
        // 03-ago-2026 (Santiago: "con el demo no veo que Alex tenga ni un activo,
        // un carro, una casa"). Los tipos que le puse —"real_estate",
        // "rental_property", "529"— NO EXISTEN en ASSET_TYPES del módulo US:
        // los válidos son primary_home, rental_res y other_asset. Con un tipo
        // desconocido el activo no se renderiza, así que la casa y el duplex
        // estaban cargados pero invisibles.
        {id:"us_a1",n:"Primary Residence — Austin TX",tp:"primary_home",vc:620000,va:840000,owner:"own_1"},
        {id:"us_a2",n:"Rental Duplex — East Austin",tp:"rental_res",vc:310000,va:465000,owner:"own_1"},
        {id:"us_a3",n:"Traditional 401(k) — Fidelity",tp:"401k_trad",vc:290000,va:412000,owner:"own_1"},
        {id:"us_a4",n:"Roth IRA — Vanguard",tp:"roth_ira",vc:98000,va:154000,owner:"own_1"},
        {id:"us_a5",n:"Taxable Brokerage — VTI/VXUS",tp:"stocks_etf",vc:215000,va:318000,owner:"own_1",magi:410000},
        {id:"us_a6",n:"HSA — Fidelity (Invested)",tp:"hsa",vc:38000,va:52000,owner:"own_1"},
        {id:"us_a7",n:"Emergency Fund — HYSA",tp:"cash_equiv",vc:85000,va:85000,owner:"own_1",tasa:4.3},
        {id:"us_a8",n:"Bitcoin & ETH",tp:"crypto",vc:42000,va:71000,owner:"own_1"},
        {id:"us_a9",n:"529 Plan — Kids College",tp:"other_asset",vc:56000,va:68000,owner:"own_1"},
        // Faltaba el vehículo: hay un auto loan en las deudas pero ningún carro
        // en los activos, así que el patrimonio quedaba descuadrado.
        {id:"us_a10",n:"Tesla Model Y (2024)",tp:"other_asset",vc:52000,va:41000,owner:"own_1"},
      ];
      nd.deu=[
        {id:"us_d1",n:"Mortgage — Primary Residence",tp:"mortgage",mt:398000,pg:2850,ts:6.1,owner:"own_1"},
        {id:"us_d2",n:"Mortgage — Rental Duplex",tp:"mortgage",mt:212000,pg:1640,ts:7.3,owner:"own_1"},
        {id:"us_d3",n:"Student Loans — Navient",tp:"student_loan",mt:31000,pg:340,ts:6.5,owner:"own_1"},
        // 03-ago-2026 — era tp:"vehiculo", el nombre de Colombia. En US el tipo es "auto".
        {id:"us_d4",n:"Tesla Model Y — Auto Loan",tp:"auto",mt:38000,pg:690,ts:7.4,owner:"own_1"},
        // Tarjeta al 24,99% con $85K en HYSA al 4,3%: el asesor debería
        // detectar el diferencial y cuantificarlo.
        {id:"us_d5",n:"Chase Sapphire Credit Card",tp:"credit_card",mt:14800,pg:450,ts:24.99,owner:"own_1"},
      ];
      nd.gas={
        "Housing":[{c:"Rent — 1BR apartment",m:1850,t:"f",owner:"own_1"},{c:"Utilities & internet",m:180,t:"f",owner:"own_1"}],
        "Food":[{c:"Groceries",m:480,t:"v",owner:"own_1"},{c:"Dining & coffee",m:380,t:"v",owner:"own_1"}],
        "Transportation":[{c:"Car payment",m:390,t:"f",owner:"own_1"},{c:"Gas & insurance",m:210,t:"f",owner:"own_1"}],
        "Healthcare":[{c:"Health insurance",m:185,t:"f",owner:"own_1"},{c:"Gym",m:45,t:"f",owner:"own_1"}],
        "Subscriptions":[{c:"Streaming & apps",m:55,t:"f",owner:"own_1"},{c:"Tools",m:75,t:"f",owner:"own_1"}],
        "Personal":[{c:"Clothing & personal",m:150,t:"v",owner:"own_1"},{c:"Entertainment",m:250,t:"v",owner:"own_1"}],
      };
      nd.metas=[
        {name:"Emergency Fund (6 months)",type:"emergency",target:25500,saved:14000,monthly:500},
        {name:"Pay Off Credit Card (24.99% APR)",type:"debt_payoff",target:4800,saved:0,monthly:300,debtBalance:4800,debtRate:24.99},
        {name:"First Home Down Payment",type:"home",target:60000,saved:8400,monthly:800},
        {name:"Max Roth IRA this year",type:"custom",target:7000,saved:3500,monthly:583},
      ];
      nd.pen={age:32,rAge:65,sv:1000,cur:42000,ret:7,inf:3,des:5000};
      nd.owners=[{id:"own_1",name:"Alex Johnson",type:"natural"}];
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
    const brutoTotal=ing.reduce((s,i)=>s+((i.mensual||0)*(i.moneda==="USD"?(u&&u.trm||4200):1)),0);
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
    const ind=egresosTotales>0?((disponibleCuenta/egresosTotales)*100):0;
    const level=ind>=250?"Libertad Absoluta":ind>=150?"Libertad":ind>=100?"Independencia":ind>=82.5?"Vitalidad":ind>=65?"Seguridad":"Pre-Seguridad";
    const fireNum=egresosTotales*12*25;const firePct=fireNum>0?(nw/fireNum*100):0;
    const dta=totalPat>0?(totalDeu/totalPat*100):0;
    const runway=egresosTotales>0?Math.round(inv.filter(i=>["Cash","CDT","Renta Fija","Fondo de Inversión"].includes(i.tp||i.tipo)).reduce((s,i)=>s+vaCOP(i,trm),0)/egresosTotales):0;
    const invRows=inv.map(i=>"<tr><td>"+(i.n||i.nombre||"")+"</td><td>"+(i.tp||i.tipo||"Otro")+"</td><td class=r>"+fm(vaCOP(i,trm))+"</td><td class=r "+(vaCOP(i,trm)>=vcCOP(i,trm)?"style=color:#16a34a":"style=color:#dc2626")+">"+fm(vaCOP(i,trm)-vcCOP(i,trm))+"</td></tr>").join("");
    const ingRows=ing.map(i=>"<tr><td>"+(i.nombre||"")+"</td><td>"+(i.categoria||"")+"</td><td class=r>"+fm((i.mensual||0)*(i.moneda==="USD"?(u&&u.trm||4200):1))+"</td></tr>").join("");
    const gasRows=gasCats.map(g=>"<tr><td>"+g.cat+(g.esAporte?" <span style='font-size:9px;color:#f59e0b'>(aporte)</span>":"")+"</td><td class=r>"+fm(g.total)+"</td><td class=r>"+(brutoTotal>0?(g.total/brutoTotal*100).toFixed(1)+"%":"—")+"</td></tr>").join("");
    const deuRows=deu.map(d=>"<tr><td>"+(d.n||"")+"</td><td class=r>"+fm(d.mt||0)+"</td><td class=r>"+fm(d.pg||0)+"</td><td class=r>"+(d.ts||0)+"%</td></tr>").join("");
    // Bloque desglose family office (nuevo Fase 4)
    const desgloseFlujo="<div style='display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0 18px'>"
      +"<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px'>"
        +"<div style='font-size:9px;color:#6b7280;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;margin-bottom:8px'>💰 Ingresos Mensuales</div>"
        +"<div style='display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px'><span style='color:#374151'>Bruto Total</span><span style='font-weight:500'>"+fm(brutoTotal)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:10px;margin-bottom:8px;padding-left:8px;border-left:2px solid #e5e7eb'><span style='color:#8b5cf6'>− Retención (recuperable)</span><span style='color:#8b5cf6'>−"+fm(retencionMensual)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:13px;font-weight:800;padding-top:7px;border-top:1px solid #d1d5db;color:#16a34a'><span>= DISPONIBLE</span><span>"+fm(disponibleCuenta)+"</span></div>"
      +"</div>"
      +"<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px'>"
        +"<div style='font-size:9px;color:#6b7280;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;margin-bottom:8px'>💸 Egresos Mensuales</div>"
        +"<div style='display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px'><span style='color:#f59e0b'>A. Aportes obligatorios</span><span style='color:#f59e0b'>"+fm(aportesObligatorios)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px'><span>B. Gastos familiares</span><span>"+fm(gastosFamiliares)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px'><span>C. Cuotas deudas</span><span>"+fm(totalCuotas)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:10px;margin-bottom:6px'><span style='color:#8b5cf6'>D. Impuesto neto estimado</span><span style='color:#8b5cf6'>"+fm(impuestoNeto)+"</span></div>"
        +"<div style='display:flex;justify-content:space-between;font-size:13px;font-weight:800;padding-top:7px;border-top:1px solid #d1d5db;color:#dc2626'><span>= EGRESOS TOTALES</span><span>"+fm(egresosTotales)+"</span></div>"
      +"</div>"
    +"</div>";
    const html="<!DOCTYPE html><html><head><title>Reporte FINPATHIA</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;color:#1a1a1a;padding:32px 40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.6}h1{font-size:22px;font-weight:800}h2{font-size:15px;font-weight:700;margin:24px 0 8px;padding-bottom:4px;border-bottom:2px solid #22c55e}.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #22c55e}.logo{font-size:18px;font-weight:800;color:#22c55e}.dt{font-size:11px;color:#888}.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:10px 0}.g4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin:10px 0}.k{background:#f8f8f8;border-radius:8px;padding:10px;border-left:3px solid #22c55e}.kr{border-left-color:#ef4444}.kl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px}.kv{font-size:18px;font-weight:700;margin-top:2px}.ks{font-size:9px;color:#888;margin-top:2px}table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}th{text-align:left;padding:5px 8px;background:#f0f0f0;font-weight:600;font-size:9px;text-transform:uppercase;color:#666}td{padding:5px 8px;border-bottom:1px solid #eee}.r{text-align:right}.lb{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;margin:10px 0}.lt{font-size:18px;font-weight:700;color:#16a34a}.ft{margin-top:28px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#aaa;text-align:center}.ds{font-size:8px;color:#ccc;margin-top:16px;text-align:center;line-height:1.4}@media print{body{padding:20px}@page{size:letter;margin:12mm}}</style></head><body>"
    +"<div class=hd><div><div class=logo>FINPATHIA</div><h1>Reporte Financiero Personal</h1></div><div style=text-align:right><div class=dt>"+fecha+"</div><div class=dt>"+(u?.p?.name||"Usuario")+"</div></div></div>"
    +"<div class=lb><div style=font-size:11px;color:#666>NIVEL DE LIBERTAD FINANCIERA</div><div class=lt>"+level+"</div><div style=font-size:13px;color:#333;margin-top:4px>Índice: "+ind.toFixed(1)+"%</div></div>"
    +desgloseFlujo
    +"<div class=g4><div class=k><div class=kl>Patrimonio Neto</div><div class=kv>"+fm(nw)+"</div></div><div class=k><div class=kl>Disponible/mes</div><div class=kv>"+fm(disponibleCuenta)+"</div></div><div class='k "+(cf<0?"kr":"")+"'><div class=kl>Cash Flow/mes</div><div class=kv style=color:"+(cf>=0?"#16a34a":"#dc2626")+">"+fm(cf)+"</div></div><div class=k><div class=kl>FIRE Progress</div><div class=kv>"+firePct.toFixed(0)+"%</div><div class=ks>Meta: "+fm(fireNum)+"</div></div></div>"
    +"<h2>Patrimonio ("+inv.length+" activos)</h2><div class=g3><div class=k><div class=kl>Activos</div><div class=kv>"+fm(totalPat)+"</div></div><div class='k kr'><div class=kl>Deudas</div><div class=kv>"+fm(totalDeu)+"</div></div><div class=k><div class=kl>Neto</div><div class=kv>"+fm(nw)+"</div></div></div>"
    +"<table><thead><tr><th>Activo</th><th>Tipo</th><th class=r>Valor</th><th class=r>Ganancia</th></tr></thead><tbody>"+invRows+"</tbody></table>"
    +"<h2>Ingresos ("+ing.length+" fuentes)</h2><table><thead><tr><th>Fuente</th><th>Categoría</th><th class=r>Bruto/mes</th></tr></thead><tbody>"+ingRows+"<tr style=font-weight:700;border-top:2px+solid+#333><td colspan=2>Total Bruto</td><td class=r>"+fm(brutoTotal)+"</td></tr></tbody></table>"
    +"<h2>Gastos ("+gasCats.length+" categorías)</h2><table><thead><tr><th>Categoría</th><th class=r>Monto/mes</th><th class=r>% Bruto</th></tr></thead><tbody>"+gasRows+"<tr style=font-weight:700;border-top:2px+solid+#333><td>Total</td><td class=r>"+fm(totalGas)+"</td><td class=r>"+(brutoTotal>0?(totalGas/brutoTotal*100).toFixed(0)+"%":"—")+"</td></tr></tbody></table>"
    +(deu.length>0?"<h2>Deudas ("+deu.length+")</h2><table><thead><tr><th>Deuda</th><th class=r>Saldo</th><th class=r>Cuota/mes</th><th class=r>Tasa</th></tr></thead><tbody>"+deuRows+"<tr style=font-weight:700;border-top:2px+solid+#333><td>Total</td><td class=r>"+fm(totalDeu)+"</td><td class=r>"+fm(totalCuotas)+"</td><td></td></tr></tbody></table>":"")
    +"<h2>Indicadores</h2><div class=g3><div class=k><div class=kl>Independencia</div><div class=kv>"+ind.toFixed(1)+"%</div><div class=ks>Meta: 100%+</div></div><div class=k><div class=kl>Deuda/Activos</div><div class=kv>"+dta.toFixed(1)+"%</div><div class=ks>Ideal: &lt;30%</div></div><div class=k><div class=kl>Runway</div><div class=kv>"+runway+" meses</div><div class=ks>Sin ingresos</div></div></div>"
    +"<div class=ds>Este reporte es generado por FINPATHIA con fines informativos. No constituye asesoría financiera profesional.</div>"
    +"<div class=ft>FINPATHIA — finpathia.com — "+fecha+"</div></body></html>";
    const w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);
  };

  const handleImport=(key,rows,isGastos)=>{if(isGastos){const g={...(u&&u.gas||{})};rows.forEach(r=>{const cat=r.cat||"Otro";if(!g[cat])g[cat]=[];g[cat].push({c:r.c,m:r.m,t:r.t})});upd("gas",g)}else{upd(key,[...((u&&u[key])||[]),...rows])}};

  const fm=n=>{if(masked)return"$•••••";if(n==null||isNaN(n))return"$0";const v=cur==="USD"?(n/trm):n;if(Math.abs(v)>=1e9)return"$"+(v/1e9).toFixed(1)+"B";if(Math.abs(v)>=1e6)return"$"+(v/1e6).toFixed(1)+"M";return"$"+Math.round(v).toLocaleString("en-US")};
  // Commit 23 Tarea 3: feedback honesto del estado de guardado.
  // Antes 'showToast' decia '✅ Guardado' inmediato, pero tecnicamente solo
  // era localStorage — el upsert a Supabase tenia debounce de 2s y podia
  // tardar mas. Generaba la duda '¿se guardo realmente?' que reporto el
  // usuario. Ahora el flujo es:
  //   1. upd() → toast '💾 Guardando...' (honesto: localStorage hecho, backend pendiente)
  //   2. sS() debounce 2s → upsert a Supabase
  //   3. Si OK → evento 'fp3-save-ok' → toast '☁️ Sincronizado'
  //   4. Si error → evento 'fp3-save-error' → toast '⚠️ Error guardando'
  const upd=(k,v)=>{showToast("💾 Guardando…");setU(p=>p?{...p,[k]:v}:p);};
  const isAdmin=u?.p?.email==="santiagososa1@me.com"||u?.p?.email==="ajimenez001@gmail.com";
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
  const t=useMemo(()=>u?cT(u.inv,u.deu,u.gas,u.ingresos,estimarImpuesto(u),u.trm||4200):{},[u]);
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
      const token=inviteMatch[1];
      return<AcceptInvite token={token} onComplete={()=>{window.location.href="/"}}/>;
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
    return<><LandingPage onGetStarted={(meta)=>{const from=meta?.source||"home";sAM("signup");track("signup_modal_opened",{from,...(meta?.dias_restantes!=null?{dias_restantes:meta.dias_restantes}:{})});setShowAuth(true)}}/><PWAInstallPrompt/></>;
  }
  if(!u)return<div style={{background:T.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui",color:T.tx}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}input:focus,select:focus{border-color:#22c55e!important;outline:none}`}</style>
    {/* Modal SOLICITAR recuperación: el usuario escribe su email acá */}
    {showRecoveryRequest&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
      <div style={{background:T.bg2,border:`1px solid ${T.borderL||T.border}`,borderRadius:20,width:"100%",maxWidth:460,padding:"clamp(20px, 5vw, 32px)",position:"relative"}}>
        <button onClick={()=>{setShowRecoveryRequest(false);setResetSent(false);setResetError("")}} style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:20}}>✕</button>
        <div style={{fontSize:32,marginBottom:8,textAlign:"center"}}>📧</div>
        <h2 style={{fontSize:20,fontWeight:800,textAlign:"center",marginBottom:8,color:T.tx}}>Recuperar contraseña</h2>
        {!resetSent?<>
          <p style={{fontSize:13,color:T.tx3,textAlign:"center",marginBottom:20,lineHeight:1.5}}>
            Escribí tu email y te enviaremos un link para crear una contraseña nueva.
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
              if(!recoveryEmail||!recoveryEmail.includes("@")){setResetError("Escribí un email válido");return}
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
          <div style={{fontSize:48,textAlign:"center",marginBottom:12}}>✅</div>
          <p style={{fontSize:14,color:T.tx,textAlign:"center",marginBottom:12,lineHeight:1.5,fontWeight:600}}>
            Email enviado a <span style={{color:T.gn}}>{recoveryEmail}</span>
          </p>
          <p style={{fontSize:12,color:T.tx3,textAlign:"center",marginBottom:20,lineHeight:1.6}}>
            Revisá tu bandeja de entrada y la carpeta de spam. El link expira en 1 hora. Cuando lo abras vas a volver acá para crear tu nueva contraseña.
          </p>
          <button onClick={()=>{setShowRecoveryRequest(false);setResetSent(false)}} style={{width:"100%",background:T.bg3,color:T.tx,border:`1px solid ${T.border}`,padding:"12px 20px",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:13}}>
            Cerrar
          </button>
        </>}
      </div>
    </div>}
    {/* Modal de nueva contraseña tras click en link del email */}
    {showResetPassword&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
      <div style={{background:T.bg2,border:`1px solid ${T.borderL||T.border}`,borderRadius:20,width:"100%",maxWidth:460,padding:"clamp(20px, 5vw, 32px)"}}>
        <div style={{fontSize:32,marginBottom:8,textAlign:"center"}}>🔐</div>
        <h2 style={{fontSize:20,fontWeight:800,textAlign:"center",marginBottom:8,color:T.tx}}>Nueva contraseña</h2>
        <p style={{fontSize:13,color:T.tx3,textAlign:"center",marginBottom:24,lineHeight:1.5}}>
          Ingresá tu nueva contraseña. Debe tener al menos 8 caracteres.
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
              localStorage.removeItem("fp3_enc_key");
              setShowResetPassword(false);
              setResetNewPassword("");
              setAuthError("✅ Contraseña actualizada. Iniciá sesión con la nueva.");
              sAM("login");
            }catch(e){setResetError("No pudimos actualizar: "+e.message)}
            finally{setResetLoading(false)}
          }}
          disabled={resetLoading}
          style={{width:"100%",background:resetLoading?T.tx3:T.gn,color:"#000",border:"none",padding:"12px 20px",borderRadius:10,cursor:resetLoading?"wait":"pointer",fontWeight:700,fontSize:14}}
        >
          {resetLoading?"Actualizando...":"Actualizar contraseña"}
        </button>
        <div style={{marginTop:16,padding:"10px 12px",background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.15)",borderRadius:8,fontSize:11,color:T.tx3,lineHeight:1.5}}>
          ⚠️ Tu información está cifrada con tu contraseña. Al cambiarla, si tenías datos encriptados bajo la contraseña anterior no podrás recuperarlos — tendrás que volver a cargarlos.
        </div>
      </div>
    </div>}
    <div style={{width:"100%",maxWidth:420,padding:"clamp(24px, 6vw, 40px) clamp(20px, 5vw, 32px)"}}>
      <div onClick={()=>setShowAuth(false)} style={{fontSize:13,color:T.tx3,cursor:"pointer",marginBottom:24}}>← Volver</div>
      <div style={{background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.1)",borderRadius:12,padding:"12px 16px",marginBottom:20,fontSize:12,color:T.tx3,lineHeight:2}}>
        <span style={{color:T.gn}}>✓</span> <strong style={{color:T.tx2}}>Encriptación End-to-End</strong> · tus datos se encriptan con tu contraseña<br/>
        <span style={{color:T.gn}}>✓</span> Ni FINPATHIA puede leer tu información financiera<br/>
        <span style={{color:T.gn}}>✓</span> No vendemos ni compartimos datos. Cero publicidad<br/>
        <span style={{color:T.gn}}>✓</span> Exporta o borra todo en cualquier momento
      </div>
      <div style={{fontSize:28,fontWeight:800,background:"linear-gradient(135deg,#22c55e,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:20}}>FINPATHIA</div>
      <div role="tablist" aria-label="Crear cuenta o ingresar" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,marginBottom:24,borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`,background:T.bg2}}>
        <button type="button" role="tab" aria-selected={aM==="signup"} onClick={()=>sAM("signup")} style={{padding:"12px 10px",border:"none",borderBottom:aM==="signup"?`3px solid ${T.gn}`:"3px solid transparent",background:aM==="signup"?T.gnB:"transparent",color:aM==="signup"?T.gn:T.tx3,fontWeight:700,fontSize:14,cursor:"pointer"}}>Crear cuenta</button>
        <button type="button" role="tab" aria-selected={aM==="login"} onClick={()=>sAM("login")} style={{padding:"12px 10px",border:"none",borderBottom:aM==="login"?`3px solid ${T.gn}`:"3px solid transparent",background:aM==="login"?T.gnB:"transparent",color:aM==="login"?T.gn:T.tx3,fontWeight:700,fontSize:14,cursor:"pointer"}}>Ingresar</button>
      </div>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:6}}>{aM==="login"?"Inicia sesión":sessionStorage.getItem("fp3_promo_code")==="PIONEROS2026"?"🎁 Acceso Pioneros":"Crea tu cuenta gratis"}</h2>
      <p style={{color:T.tx3,fontSize:14,marginBottom:28}}>{aM==="login"?"Accede a tu patrimonio":sessionStorage.getItem("fp3_promo_code")==="PIONEROS2026"?"14 días de prueba + 3 meses gratis del Plan Pro":"14 días de acceso Pro incluidos"}</p>
      <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
        {aM==="login"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
          <label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>Ingresar como</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{v:"client",icon:"👤",label:"Cliente"},{v:"advisor",icon:"💼",label:"Asesor"}].map(o=>{
              const sel=loginRole===o.v;
              return<button key={o.v} type="button" onClick={()=>{setLoginRole(o.v);setAuthError("")}} style={{padding:"12px",borderRadius:10,border:"2px solid "+(sel?T.gn:T.border),background:sel?T.gnB:T.bg2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:sel?T.gn:T.tx2,fontWeight:sel?700:400,fontSize:13,transition:"all .15s"}}>
                <span style={{fontSize:18}}>{o.icon}</span>{o.label}
              </button>})}
          </div>
          <div style={{fontSize:10,color:T.tx3,marginTop:2}}>{loginRole==="advisor"?"Acceso al workspace de asesor (requiere plan Asesor)":"Acceso a tu dashboard personal"}</div>
        </div>}
        {aM==="signup"&&<In l="Nombre" value={aF.n} onChange={v=>sAF(p=>({...p,n:v}))} placeholder="Tu nombre"/>}
        <In l="Email" value={aF.e} onChange={v=>sAF(p=>({...p,e:v}))} type="email" placeholder="tu@email.com"/>
        <In l={aM==="signup"?"Contraseña (mínimo 8 caracteres)":"Contraseña"} value={aF.p} onChange={v=>sAF(p=>({...p,p:v}))} type="password" placeholder="••••••••"/>
        {aM==="signup"&&<div style={{display:"flex",flexDirection:"column",gap:5}}>
          <label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>País / Country</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{code:"CO",flag:"🇨🇴",name:"Colombia"},{code:"US",flag:"🇺🇸",name:"United States"}].map(c=>{
              const sel=(aF.country||"CO")===c.code;
              return<button key={c.code} type="button" onClick={()=>sAF(p=>({...p,country:c.code}))} style={{padding:"12px",borderRadius:10,border:"2px solid "+(sel?T.gn:T.border),background:sel?T.gnB:T.bg2,cursor:"pointer",display:"flex",alignItems:"center",gap:8,color:sel?T.gn:T.tx2,fontWeight:sel?700:400,fontSize:13,transition:"all .15s"}}>
                <span style={{fontSize:20}}>{c.flag}</span>{c.name}
              </button>})}
          </div>
          <div style={{fontSize:10,color:T.tx3,marginTop:2}}>🇲🇽 México · 🇪🇸 España — Próximamente</div>
        </div>}
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
      {authError&&<div style={{color:T.rd,fontSize:13,marginTop:12,padding:"12px 14px",background:T.rdB,border:`1px solid ${T.rd}30`,borderRadius:10,display:"flex",gap:10,alignItems:"flex-start"}}><span style={{fontSize:16,flexShrink:0}}>⚠️</span><div style={{flex:1}}><div style={{fontWeight:700,marginBottom:2}}>{aM==="login"?"No pudimos iniciar sesión":"No pudimos crear tu cuenta"}</div><div style={{fontSize:12,color:T.rd,opacity:0.9}}>{authError}</div></div></div>}
      <p style={{textAlign:"center",marginTop:16,color:T.tx3,fontSize:12}}>{aM==="login"?"¿Nuevo aquí? Usa la pestaña Crear cuenta arriba.":"¿Ya eres cliente? Usa la pestaña Ingresar arriba."}</p>
      <div style={{marginTop:24,textAlign:"center"}}><span onClick={()=>{const nd=mkU("Usuario","");nd.p.plan="pro";nd.p.trialEnd=new Date(Date.now()+14*86400000).toISOString().split("T")[0];nd.p.anonymous=true;setU(nd)}} style={{fontSize:13,color:T.gn,cursor:"pointer",fontWeight:600}}>Explorar sin cuenta — 14 días gratis →</span></div>
      <div style={{marginTop:16,padding:"16px",background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.12)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:12,fontWeight:600,color:T.orange,marginBottom:6}}>📊 ¿Quieres ver cómo funciona?</div><div style={{fontSize:11,color:T.tx3,marginBottom:10}}>Explora la plataforma con datos de ejemplo: patrimonio, ingresos, gastos, deudas, impuestos y simulador.</div><div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}><button onClick={()=>{const nd=mkU("Pedro Pérez","demo@finpathia.com");nd.p.plan="pro";nd.p.trialEnd=new Date(Date.now()+14*86400000).toISOString().split("T")[0];nd.p.demo=true;setU(nd);setTimeout(()=>demo(),500)}} style={{background:"linear-gradient(135deg,#f97316,#eab308)",color:"#000",border:"none",padding:"10px 20px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13}}>🇨🇴 Demo Colombia</button><button onClick={()=>demoUS()} style={{background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"#fff",border:"none",padding:"10px 20px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13}}>🇺🇸 Demo USA</button></div></div>
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
        <div style={{fontSize:48,marginBottom:16}}>🔒</div>
        <div style={{fontSize:22,fontWeight:800,color:T.tx,marginBottom:6}}>Sesión bloqueada</div>
        <div style={{fontSize:13,color:T.tx3,marginBottom:24}}>Ingresa tu PIN para continuar</div>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:16}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:40,height:48,borderRadius:10,border:"2px solid "+(pinInput.length>i?T.gn:T.border),display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:T.tx,background:T.bg2}}>{pinInput[i]?"•":""}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,maxWidth:220,margin:"0 auto"}}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map(n=><button key={n} onClick={()=>{if(n==="⌫")setPinInput(p=>p.slice(0,-1));else if(n!==""&&pinInput.length<4){const np=pinInput+n;setPinInput(np);if(np.length===4){if(np===pin){setLocked(false);setPinInput("")}else{setPinInput("");showToast("❌ PIN incorrecto")}}}}} style={{width:56,height:48,borderRadius:12,border:"1px solid "+T.border,background:n===""?"transparent":T.bg2,color:T.tx,fontSize:18,fontWeight:600,cursor:n===""?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{n}</button>)}
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
        showToast("❌ Error cargando cliente");
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
  const gateOverlay=(planNeeded)=><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:10,background:"rgba(9,9,11,0.5)",backdropFilter:"blur(2px)",borderRadius:16}}><div style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:20,padding:"40px 48px",textAlign:"center",boxShadow:"0 12px 40px rgba(0,0,0,.6)",maxWidth:340}}><div style={{width:56,height:56,borderRadius:16,background:T.gnB,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>🔒</div><div style={{fontSize:18,fontWeight:800,marginBottom:6,letterSpacing:"-0.02em"}}>{"Plan "+planNeeded}</div><div style={{fontSize:13,color:T.tx3,marginBottom:20,lineHeight:1.5}}>{"Desbloquea esta función con el plan "+planNeeded}</div><Bt onClick={()=>setPg("price")} st={{width:"100%",justifyContent:"center"}}>Upgrade a {planNeeded}</Bt></div></div>;
  const gated=(feat,planNeeded,content)=>{const ok=hasProAccess||(plan==="basico"&&["trd","pen","btc","sim"].includes(feat));if(ok||plan===planNeeded)return content;return<div style={{position:"relative"}}><div style={{filter:"blur(4px)",pointerEvents:"none",opacity:.3,maxHeight:400,overflow:"hidden"}}>{content}</div>{gateOverlay(planNeeded)}</div>};

  const getCoach=id=>{
    if(!u)return[];
    try{
    const msgs=[];
    const inv=((u&&u.inv)||[]).filter(i=>i.sim!==false),deu=((u&&u.deu)||[]).filter(d=>d.sim!==false),ing=((u&&u.ingresos)||[]).filter(i=>i.sim!==false);
    const gas={};Object.entries((u&&u.gas)||{}).forEach(([cat,items])=>{const fi=(items||[]).filter(g=>g.sim!==false);if(fi.length>0)gas[cat]=fi});
    const topA=inv.map(i=>({...i,...iM(i,deu)})).sort((a,b)=>b.noi-a.noi);
    const hiDebt=deu.filter(d=>(d.mt||0)>0).sort((a,b)=>b.ts-a.ts);
    const gasCats=Object.entries(gas).map(([cat,items])=>({cat,total:items.reduce((s,g)=>s+montoPromedioMensual(g),0),items}))/* frecuencia: un gasto anual no es un gasto mensual (fix 25-jul-2026) */.sort((a,b)=>b.total-a.total);
    const pasivos=ing.filter(i=>["Arriendo","Rendimiento","Dividendos","Inversión"].includes(i.categoria));
    const activos=ing.filter(i=>!["Arriendo","Rendimiento","Dividendos","Inversión"].includes(i.categoria));
    const ingPasivo=pasivos.reduce((s,i)=>s+((i.mensual||0)*(i.moneda==="USD"?4200:1)),0);
    const ingActivo=activos.reduce((s,i)=>s+((i.mensual||0)*(i.moneda==="USD"?4200:1)),0);
    const pctPasivo=t.ni>0?(ingPasivo/t.ni*100):0;
    const runway=t.te>0?Math.round(inv.filter(i=>["Cash","CDT","Renta Fija"].includes(i.tp||i.tipo)).reduce((s,i)=>s+vaCOP(i,trm),0)/t.te):0;
    const fireNum=t.gfm*12*25;
    const firePct=fireNum>0?(t.nw/fireNum*100):0;
    const reVal=inv.filter(i=>(i.tp||i.tipo)==="Real Estate").reduce((s,i)=>s+vaCOP(i,trm),0);
    const rePct=t.nw>0?(reVal/t.nw*100):0;
    const topGasto=gasCats[0];
    const worstDebt=hiDebt[0];
    const worstAsset=topA.length>1?topA[topA.length-1]:null;
    const currencies={COP:0,USD:0};
    ing.forEach(i=>{if(i.moneda==="USD")currencies.USD+=(i.mensual||0)*4200;else currencies.COP+=(i.mensual||0)});
    const usdPct=t.ni>0?(currencies.USD/t.ni*100):0;

    if(id==="cashflow"){
      msgs.push({t:"💰 Cuadrante de Ingresos",c:"Ingresos activos (trabajo): "+fm(ingActivo)+"/mes ("+(100-pctPasivo).toFixed(0)+"%)\nIngresos pasivos (activos): "+fm(ingPasivo)+"/mes ("+pctPasivo.toFixed(0)+"%)\n\n"+(pctPasivo>=70?"🟢 EXCELENTE: Más del 70% es pasivo. Eres inversionista.":pctPasivo>=40?"🟡 EN TRANSICIÓN: "+pctPasivo.toFixed(0)+"% pasivo. Aún dependes del trabajo.":"🔴 DEPENDIENTE: Solo "+pctPasivo.toFixed(0)+"% pasivo. Si dejas de trabajar, pierdes el "+(100-pctPasivo).toFixed(0)+"%.")});
      const prodA=inv.filter(i=>iM(i,deu).noi>0);
      const valorA=inv.filter(i=>{const va=+i.va||0,vc=+i.vc||0;return iM(i,deu).noi<=0&&va>vc*1.1});
      const deadA=inv.filter(i=>{const va=+i.va||0,vc=+i.vc||0;return iM(i,deu).noi<=0&&va<=vc*1.1&&va>0});
      let clasif="Generan renta ("+prodA.length+"):\n"+prodA.slice(0,5).map(a=>"  💰 "+(a.n||a.nombre||"Sin nombre")+": +"+fm(iM(a,deu).noi)+"/mes").join("\n");
      if(valorA.length>0)clasif+="\n\nSolo valorización ("+valorA.length+"):\n"+valorA.slice(0,3).map(a=>{const g=+a.vc>0?((+a.va-a.vc)/a.vc*100):0;return"  📈 "+(a.n||a.nombre||"Sin nombre")+": +"+g.toFixed(0)+"% plusvalía (no renta)"}).join("\n");
      if(deadA.length>0)clasif+="\n\nSin renta ni valorización ("+deadA.length+"):\n"+deadA.slice(0,3).map(a=>"  ⚠️ "+(a.n||a.nombre||"Sin nombre")+": "+fm(a.va)).join("\n");
      if(deadA.length===0&&valorA.length===0)clasif+="\n\n✅ Todos tus activos generan renta.";
      msgs.push({t:"📦 Clasificación de Activos",c:clasif});
      msgs.push({t:"🎯 Plan de Acción",c:"1. Convertir "+fm(deadA.reduce((s,i)=>s+vaCOP(i,trm),0))+" improductivos en productivos\n2. Reinvertir cash flow "+fm(t.cf)+"/mes en activos que generen ingreso\n3. Meta: ingreso pasivo > "+fm(t.te)+"/mes (hoy: "+fm(ingPasivo)+")\n4. Cada "+fm(Math.abs(t.cf)*12)+" ahorrado/año te acerca "+((t.te>0?Math.abs(t.cf)*12/t.te*100:0)).toFixed(0)+"% más"});
    }
    else if(id==="estratega"){
      const level=t.ind>=250?5:t.ind>=150?4:t.ind>=100?3:t.ind>=82.5?2:t.ind>=65?1:0;
      const names=["Pre-Seguridad","Seguridad","Vitalidad","Independencia","Libertad","Absoluta"];
      const factors=[0.65,0.825,1.0,1.5,2.5];
      const nextNeeded=t.te*(factors[Math.min(level,4)]||1);
      const gap=Math.max(0,nextNeeded-t.ni);
      msgs.push({t:"🏔️ Nivel "+level+"/5: "+names[level],c:"Independencia: "+pc(t.ind)+"\nIngresos: "+fm(t.ni)+"/mes vs Egresos: "+fm(t.te)+"/mes\n\n"+(level>=3?"🟢 ¡Independencia alcanzada! Tus ingresos cubren 100% de gastos.":"Siguiente: "+names[Math.min(level+1,5)]+" → necesitas "+fm(nextNeeded)+"/mes\nTe faltan: "+fm(gap)+"/mes de ingreso adicional")});
      msgs.push({t:"📅 Proyección FIRE",c:"FIRE Number: "+fm(fireNum)+"\nProgreso: "+firePct.toFixed(0)+"% ("+fm(t.nw)+" / "+fm(fireNum)+")\n\n"+(firePct>=100?"🟢 Tu patrimonio ya supera tu FIRE number.":"Necesitas acumular "+fm(Math.max(fireNum-t.nw,0))+" más.")});
      if(topGasto)msgs.push({t:"✂️ Aceleradores",c:"Mayor gasto: "+topGasto.cat+" ("+fm(topGasto.total)+"/mes)\n\nSi reduces gastos 15%: cash flow sube a "+fm(t.cf+t.gfm*0.15)+"/mes\nSi aumentas ingreso 20%: cash flow sube a "+fm(t.cf+t.ni*0.2)+"/mes\n\n💡 Combinar ambos te acelera al doble."});
    }
    else if(id==="riesgo"){
      // inferType is now module-level
          const types={};inv.forEach(i=>{const tp=inferType(i);types[tp]=(types[tp]||0)+vaCOP(i,trm)});
      const te=Object.entries(types).sort((a,b)=>b[1]-a[1]);
      const mx=te[0]||["",0];const mxP=t.nw>0?(mx[1]/t.nw*100):0;
      msgs.push({t:"🔬 Concentración",c:te.map(([tp,v])=>"• "+tp+": "+fm(v)+" ("+((v/(t.nw||1))*100).toFixed(0)+"%)").join("\n")+"\n\n"+(mxP>50?"🔴 "+mx[0]+" = "+mxP.toFixed(0)+"%. Riesgo extremo.":mxP>35?"🟡 "+mx[0]+" = "+mxP.toFixed(0)+"%. Cerca del límite.":"🟢 Diversificación aceptable.")});
      msgs.push({t:"⚡ Stress Test",c:"Caída inmobiliaria -20%:\n• Pierdes: "+fm(reVal*0.2)+"\n• Patrimonio: "+fm(t.nw-reVal*0.2)+"\n\nPierdes mayor ingreso"+(ing.length>0?" ("+ing.sort((a,b)=>(b.mensual||0)-(a.mensual||0))[0].nombre+")":"")+":\n• Cash flow: "+fm(t.cf-(ing.length>0?(ing.sort((a,b)=>(b.mensual||0)-(a.mensual||0))[0].mensual||0)*(ing.sort((a,b)=>(b.mensual||0)-(a.mensual||0))[0].moneda==="USD"?4200:1):0))+"/mes\n\nRunway sin ingresos: "+runway+" meses "+(runway<6?"🔴":"🟢")});
      msgs.push({t:"🌐 Moneda",c:"COP: "+fm(currencies.COP)+"/mes ("+(100-usdPct).toFixed(0)+"%)\nUSD: "+fm(currencies.USD)+"/mes ("+usdPct.toFixed(0)+"%)\n\n"+(usdPct<15?"🟡 Muy expuesto al COP. Recomendación: 30%+ en USD.":usdPct>70?"🟡 Muy dolarizado.":"🟢 Buena diversificación.")});
    }
    else if(id==="valor"){
      const ranked=topA.map(a=>{const m=iM(a,deu);const va=+a.va||0,vc=+a.vc||0;const aprec=vc>0?((va-vc)/vc*100):0;const yld=va>0?(m.noi*12/va*100):0;const tasa=+(a.tasa||0);const bestYld=Math.max(yld,tasa);const total=aprec+bestYld;const nm=(a.n||a.nombre||"Sin nombre");const tipo=bestYld>aprec?"💰 Renta":"📈 Valorización";return{nm,aprec,bestYld,total,tipo,m,va}}).sort((a,b)=>b.total-a.total);
      msgs.push({t:"📊 Ranking por Retorno Total",c:ranked.slice(0,8).map((a,i)=>(i+1)+". "+a.nm+"\n   "+a.tipo+": "+(a.aprec>0?"+"+a.aprec.toFixed(0)+"% valorización":"sin valorización")+(a.bestYld>0?" + "+a.bestYld.toFixed(1)+"% renta/año":"")+"\n   Retorno total: "+a.total.toFixed(1)+"%").join("\n\n")+"\n\n💡 Retorno = valorización + renta. Edita cada activo en Patrimonio para agregar su renta y gastos."});
      const poor=ranked.filter(a=>a.total<5&&a.va>50000000);
      const stars=ranked.filter(a=>a.total>15);
      msgs.push({t:"🔍 Optimización",c:(poor.length>0?"Bajo rendimiento (<5% total):\n"+poor.map(a=>"  ⚠ "+a.nm+": "+a.total.toFixed(1)+"% (val "+a.aprec.toFixed(0)+"% + renta "+a.bestYld.toFixed(1)+"%)\n    → En CDT al 10% generaría "+fm(a.va*0.1/12)+"/mes").join("\n")+"\n\n":"")+(stars.length>0?"Estrellas (>15% total):\n"+stars.map(a=>"  ⭐ "+a.nm+": "+a.total.toFixed(1)+"% ("+a.tipo+")").join("\n"):"Todo en rango normal.")});
      msgs.push({t:"💎 Margen de Seguridad",c:"Deuda/Activos: "+pc(t.dta)+"\n\n"+(t.dta<20?"🟢 Excelente margen. Puedes apalancarte.":t.dta<40?"🟡 Aceptable. No más deuda.":"🔴 Riesgo alto. Paga deuda primero.")+(worstDebt?"\n\nDeuda más cara: "+worstDebt.n+" al "+worstDebt.ts+"%. Pagarla = invertir al "+worstDebt.ts+"% garantizado.":"")});
    }
    else if(id==="contrarian"){
      const err=[];
      if(rePct>60)err.push("🏠 Concentración inmobiliaria "+rePct.toFixed(0)+"% — No compres más inmuebles.");
      if((100-pctPasivo)>80)err.push("💼 "+(100-pctPasivo).toFixed(0)+"% depende de trabajo — Si te enfermas, pierdes casi todo.");
      if(runway<6)err.push("⏰ Solo "+runway+" meses de runway — Mínimo necesitas 6 meses líquidos.");
      if(worstDebt&&worstDebt.ts>15)err.push("🔥 Deuda al "+worstDebt.ts+"% ("+worstDebt.n+") — Nada rinde eso consistentemente. Paga primero.");
      const bigG=gasCats.find(g=>t.ni>0&&g.total>t.ni*0.25);
      if(bigG)err.push("💸 "+bigG.cat+" = "+((bigG.total/t.ni)*100).toFixed(0)+"% del ingreso — Máx recomendado: 25%.");
      if(t.dta>50)err.push("📉 Deuda/Activos "+pc(t.dta)+" — Más de la mitad está financiada con deuda.");
      msgs.push({t:"🧠 ¿Qué Errores Estoy Cometiendo?",c:err.length>0?err.map(e=>"❌ "+e).join("\n\n"):"✅ No encuentro errores graves. Eso ya es mucho."});
      const worstTotal=worstAsset?(()=>{const wm=iM(worstAsset,deu);const wva=+worstAsset.va||0,wvc=+worstAsset.vc||0;return (wvc>0?((wva-wvc)/wvc*100):0)+(wva>0?(wm.noi*12/wva*100):0)})():99;
      msgs.push({t:"🚫 Antes de Agregar, Elimina",c:(hiDebt.length>0?"1. Pagar "+hiDebt[0].n+" ("+hiDebt[0].ts+"%) = invertir al "+hiDebt[0].ts+"% garantizado\n":"")+(worstAsset&&worstTotal<5?"2. Evaluar "+(worstAsset.n||worstAsset.nombre||"activo")+": retorno total "+worstTotal.toFixed(1)+"% — ¿vale el capital atrapado?\n":"")+(topGasto?"3. Recortar "+topGasto.cat+" 10% = +"+fm(topGasto.total*0.1)+"/mes\n":"")+"\n💡 Eliminar lo malo > agregar algo nuevo."});
      msgs.push({t:"⚖️ La Pregunta Clave",c:t.dta>30?"¿Pagar deuda o invertir?\n→ Deuda más cara: "+(worstDebt?worstDebt.ts:0)+"%. Si no encuentras inversiones >"+((worstDebt||{}).ts||0)+"% consistentes, PAGA DEUDA.":"¿Dónde poner "+fm(t.cf>0?t.cf*6:0)+" (ahorro 6 meses)?\n→ Con deuda baja, invierte en lo que entiendas y puedas monitorear."});
    }
    // Contextual quote based on situation
    const quotes = {
      cashflow: [
        {cond:pctPasivo<30, q:"\u00ABLos ricos no trabajan por dinero. Hacen que el dinero trabaje para ellos.\u00BB", a:"\u2014 Filosofía del ingreso pasivo"},
        {cond:pctPasivo>=30&&pctPasivo<70, q:"\u00ABLa clave no es cuánto ganas, sino cuánto conservas y cuánto trabaja para ti.\u00BB", a:"\u2014 Principio del flujo de efectivo"},
        {cond:pctPasivo>=70, q:"\u00ABLa verdadera riqueza se mide en tiempo: ¿cuántos meses puedes vivir sin trabajar?\u00BB", a:"\u2014 Definición de libertad financiera"},
      ],
      estratega: [
        {cond:t.ind<65, q:"\u00ABEl viaje de mil millas comienza con un solo paso. Tu primer paso es cubrir lo básico.\u00BB", a:"\u2014 Principio de seguridad financiera"},
        {cond:t.ind>=65&&t.ind<100, q:"\u00ABNo se trata de ser rico, se trata de tener opciones. Estás construyendo opciones.\u00BB", a:"\u2014 Filosofía de la vitalidad financiera"},
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
    if(q) msgs.push({t:"💬 Reflexión", c:q.q+"\n\n"+q.a});

    return msgs;
    }catch(e){return[{t:"⚠️ Error",c:"No se pudo analizar tu portafolio. Verifica que tus activos tengan nombre y valor. Error: "+e.message}];}
  };

  const has=u?(u.inv?.length||u.deu?.length||Object.keys((u&&u.gas)||{}).length)>0:false;
  const isUS=jurisdiction==="US";
  const lang=u?.lang||(isUS?"en":"es");
  const isEN=lang==="en";
  const nvs=[{id:"dash",i:"📊",l:"Dashboard"},{id:"_sep1",sep:true,l:isEN?"MY MONEY":"MI DINERO"},{id:"inv",i:"🏦",l:isEN?"Assets & Liabilities":"Patrimonio"},{id:"ing",i:"💰",l:isEN?"Income":"Ingresos"},{id:"gas",i:"💳",l:isEN?"Expenses":"Egresos"},{id:"deu",i:"📋",l:isEN?"Debts":"Deudas",hidden:isUS},{id:"tax",i:"🧾",l:isEN?"Tax Planning":"Impuestos",hasChildren:true},{id:"taxopt",i:"🎯",l:"Tax Optimizer",parent:"tax",hidden:!isUS},{id:"famtax",i:"👨‍👩‍👧‍👦",l:isEN?"Family Tax View":"Vista familiar",parent:"tax",hidden:isUS||((u?.owners||[]).length<=1)},{id:"prevtax",i:"📚",l:isEN?"Previous Returns":"Declaraciones anteriores",parent:"tax",hidden:isUS},{id:"_sep2",sep:true,l:isEN?"TOOLS":"HERRAMIENTAS"},{id:"sim",i:"🖥️",l:isUS?"Simulator":"Simulador"},{id:"norte",i:"🧭",l:isEN?"Your North":"Tu Norte"},{id:"flujo",i:"📅",l:isEN?"Annual Flow":"Flujo Anual"},{id:"met",i:"🎯",l:isEN?"Goals":"Metas"},{id:"trd",i:"💹",l:"Trading",
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
      hidden:true},{id:"pen",i:"🏛️",l:isEN?"Retirement":"Pensiones"},{id:"btc",i:"₿",l:isEN?"Bitcoin vs 401(k)":"Ahorro BTC"},{id:"buyvsinvest",i:"🏠",l:isEN?"Buy vs Invest":"Comprar o arrendar"},{id:"aportes",i:"💰",l:"Calcula tus aportes",hidden:isUS},{id:"glosario",i:"📚",l:isEN?"Glossary":"Glosario",hidden:isUS},{id:"_sep3",sep:true,l:isEN?"ARTIFICIAL INTELLIGENCE":"INTELIGENCIA ARTIFICIAL"},{id:"asesor",i:"🤖",l:isEN?"AI Advisor":"Asesor IA"},{id:"coach",i:"🧠",l:isEN?"AI Coaches":"Coaches IA"},{id:"_sep4",sep:true},{id:"price",i:"⭐",l:isEN?"Plans":"Planes"},{id:"cuenta",i:"⚙️",l:isEN?"My Account":"Mi cuenta"},{id:"metrics",i:"📈",l:"Cómo va el negocio",hidden:!isAdmin}];

  const secNames={dash:"Dashboard",inv:"Patrimonio",ing:"Ingresos",gas:"Egresos",deu:"Deudas",trd:"Trading",sim:"Simulador",met:"Metas",pen:"Pensiones",tax:"Planeación Tributaria",btc:"Ahorro BTC",coach:"Coaches IA",asesor:"Asesor IA",price:"Planes",cuenta:"Mi cuenta"};
  if(typeof document!=="undefined")document.title="FINPATHIA"+(secNames[pg]?" — "+secNames[pg]:"");
  const rp=()=>{if(!u)return null;switch(pg){
    case"dash":{
    // Encabezado de sección (25-jul-2026). La jerarquía existía solo como
    // comentarios en el código: el usuario bajaba por diez bloques sin
    // señalización y todo pesaba igual. Esto la vuelve visible sin quitar
    // un solo gráfico ni indicador — que era la condición de Santiago.
    const SecH=({n,t,s})=><div style={{margin:"40px 0 18px"}}>
      {/* 25-jul-2026 (Santiago: "están muy pequeños, cuesta saber en qué etapa
          estamos"). La primera versión usaba 15px, casi el mismo peso que los
          títulos de tarjeta: no separaba nada. Un divisor de sección tiene que
          leerse ANTES que el contenido que agrupa, o no cumple su función.
          Ahora el número va grande y translúcido al costado —marca de etapa,
          no dato— y el título al tamaño de un encabezado real. */}
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <span style={{fontSize:38,fontWeight:800,color:T.gn,opacity:0.22,fontFamily:"monospace",lineHeight:1,flexShrink:0}}>{String(n).padStart(2,"0")}</span>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:mb?20:24,fontWeight:800,color:T.tx,letterSpacing:"-0.02em",lineHeight:1.15}}>{t}</div>
          <div style={{fontSize:12.5,color:T.tx3,marginTop:3}}>{s}</div>
        </div>
      </div>
      <div style={{height:2,background:`linear-gradient(90deg, ${T.gn}55, transparent)`,borderRadius:3,marginTop:14}}/>
    </div>;
    if(isUS) return <DashboardUS u={u} t={t} ib={ib} pen={pen} setPg={setPg} generatePDF={generatePDF} mb={mb}/>;
    // Data prep
    const fd=[{name:"Ingresos",a:t.ti},{name:"Gastos",a:-(t.gfm+t.tg)},{name:"Deudas",a:-t.tc},{name:"Neto",a:t.cf}];
    const pj=[0,1,3,5,10].map(y=>({yr:y===0?"Hoy":`+${y}a`,v:t.nw*Math.pow(1.08,y)+t.cf*12*y}));
    // Patrimonio distribution
    const bc={};((u&&u.inv)||[]).filter(i=>i.sim!==false).forEach(i=>{const tp=inferType(i);bc[tp]=(bc[tp]||0)+vaCOP(i,trm)});if(ib.tv>0)bc.Trading=ib.tv*(trm||4200)/*💱 26-jul-2026: ib.tv está en USD porque las posiciones se cargan en dólares, pero se sumaba tal cual a una distribución donde todo lo demás pasó por vaCOP y está en pesos. Categoría en dólares mezclada entre categorías en pesos, y ~3.262 veces más chica de lo real.*/;
    const pie=Object.entries(bc).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    const totalPat=t.ab+ib.tv;
    // Income by category
    const incByCat={};((u&&u.ingresos)||[]).filter(i=>i.sim!==false).forEach(i=>{incByCat[i.categoria||"Otro"]=(incByCat[i.categoria||"Otro"]||0)+(i.mensual||0)});
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
    const topInc=[...((u&&u.ingresos)||[]).filter(i=>i.sim!==false)].sort((a,b)=>(b.mensual||0)-(a.mensual||0)).slice(0,5);
    // Health score (0-100)
    const healthScore=Math.min(100,Math.round(
      (t.ind>=100?30:t.ind*0.3) + // independence: 30 pts
      (t.dta<50?25:t.dta<80?15:0) + // debt ratio: 25 pts
      (t.cf>0?25:t.cf>-1000?10:0) + // cash flow positive: 25 pts
      (((u&&u.ingresos)||[]).filter(i=>i.sim!==false).length>=3?10:(((u&&u.ingresos)||[]).filter(i=>i.sim!==false).length>=2?5:0)) + // diversification: 10 pts
      (((u&&u.inv)||[]).filter(i=>i.sim!==false).length>=3?10:(((u&&u.inv)||[]).filter(i=>i.sim!==false).length>=1?5:0))  // assets: 10 pts
    ));
    const healthColor=healthScore>=80?T.gn:healthScore>=50?"#eab308":T.rd;
    const healthLabel=healthScore>=80?"Excelente":healthScore>=60?"Buena":healthScore>=40?"Regular":"Necesita atención";

    return<div>
      {/* Greeting con PageHeader (estilo Optimus) — Sesión 2-may-2026 */}
      {/* BUG FIX 5-may-2026: agregamos flexWrap:"wrap" + gap para que en mobile
          los botones (Resumen, Reporte PDF) bajen a línea siguiente cuando no
          hay espacio. Sin flexWrap, el flex:1 del contenido se reducía a ~80px
          en pantallas chicas, apilando todo el texto letra por letra. */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"clamp(14px, 3vw, 24px)",flexWrap:"wrap",gap:12}}>
        <div style={{flex:"1 1 280px",minWidth:0}}>
          <PageHeader
            label={new Date().getHours()<12?"Buenos días":new Date().getHours()<18?"Buenas tardes":"Buenas noches"}
            title={(u?.p?.name&&u?.p?.name!=="Usuario"&&u?.p?.name!=="")?(u?.p?.name||"").split(" ")[0]:(u?.p?.email||"").split("@")[0]}
            subtitle="Tu patrimonio y salud financiera, de un vistazo."
          />
          {((u?.p?.name)==="Usuario"||!(u?.p?.name))&&<div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.12)",borderRadius:12,padding:"10px 14px",marginTop:10,fontSize:12,color:T.bl,cursor:"pointer"}} onClick={()=>setPg("set")}>👤 Configura tu nombre en <strong>⚙️ Config</strong> para personalizar tu experiencia</div>}
          {/* Banner Pro Familiar — muestra estado de trial o suscripción activa.
              Lógica:
                - Si planAccount === "pro_familiar" Y trialActive (trial 14d Stripe
                  todavía no expira): "Plan Pro Familiar — Trial gratuito · X días"
                - Si planAccount === "pro_familiar" Y NO trialActive: "Plan Pro
                  Familiar activo" (post-trial, suscripción cobrando normal)
              El campo trialEnd en user_data.p.trialEnd se setea al signup como 14
              días desde signup. Coincide con el trial 14d de Stripe que damos
              automáticamente. Si el user pasa los 14 días sin cancelar, Stripe
              empieza a cobrar y el banner cambia a "activo". */}
          {planAccount==="pro_familiar"&&<div style={{background:trialActive?"linear-gradient(135deg,rgba(167,139,250,0.06),rgba(34,197,94,0.04))":"linear-gradient(135deg,rgba(167,139,250,0.06),rgba(59,130,246,0.04))",border:"1px solid rgba(167,139,250,0.15)",borderRadius:12,padding:"clamp(8px, 2vw, 12px) clamp(10px, 3vw, 16px)",marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 200px",minWidth:0}}>
              <span style={{fontSize:14,flexShrink:0}}>👨‍👩‍👧</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:"#a78bfa"}}>
                  {trialActive?"Plan Pro Familiar — Trial gratuito":"Plan Pro Familiar activo"}
                </div>
                <div style={{fontSize:10,color:T.tx3,lineHeight:1.4,marginTop:1}}>
                  {trialActive
                    ?(trialDays<=1?"⚠️ Tu trial vence HOY · se cobra $27 USD/mes":trialDays<=3?"⏰ Solo "+trialDays+" días · cancela antes":trialDays+" días · hasta 10 personas")
                    :"Hasta 10 personas pueden compartir esta cuenta"}
                </div>
              </div>
            </div>
            <button onClick={()=>setPg("acc")} style={{background:"linear-gradient(135deg,#a78bfa,#3b82f6)",color:"#fff",border:"none",padding:"10px 14px",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:11,flexShrink:0}}>Mi Cuenta →</button>
          </div>}
          {/* Banner Pro Trial — solo para users que NO compraron Pro Familiar.
              Mantiene el flow tradicional: signup → 14 días Pro free → upgrade
              al final del trial. */}
          {trialActive&&planAccount!=="pro_familiar"&&<div style={{background:trialDays<=3?"rgba(239,68,68,0.06)":trialDays<=5?"rgba(234,179,8,0.06)":"linear-gradient(135deg,rgba(34,197,94,0.08),rgba(59,130,246,0.05))",border:"1px solid "+(trialDays<=3?"rgba(239,68,68,0.15)":trialDays<=5?"rgba(234,179,8,0.15)":"rgba(34,197,94,0.15)"),borderRadius:12,padding:"14px 18px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 200px",minWidth:0}}>
              <span style={{fontSize:18,flexShrink:0}}>⭐</span>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:T.gn}}>Plan Pro — Trial gratuito</div><div style={{fontSize:11,color:T.tx3}}>{trialDays<=1?"⚠️ ¡Tu acceso Pro se vence HOY! Crea tu cuenta para no perder tus datos.":trialDays<=3?"⏰ ¡Solo "+trialDays+" días! Después pierdes el Asesor IA y los Coaches.":trialDays<=5?"Tu trial Pro se vence en "+trialDays+" días — crea tu cuenta para mantener acceso":trialDays+" días de acceso Pro completo"}</div></div>
            </div>
            {(trialDays<=5||u?.p?.anonymous)&&<button onClick={()=>{if(u?.p?.anonymous)logout();else setPg("price")}} style={{background:trialDays<=3?T.rd:T.gn,color:trialDays<=3?"#fff":"#000",border:"none",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,flexShrink:0}}>{u?.p?.anonymous?"Crear cuenta gratis →":"Mantener Pro →"}</button>}
          </div>}
          {!trialActive&&trialEnd&&plan==="free"&&u?.p?.anonymous&&<div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.12)",borderRadius:12,padding:"14px 18px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 200px",minWidth:0}}><span style={{fontSize:18,flexShrink:0}}>🔒</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:T.bl}}>Crea tu cuenta para mantener Pro</div><div style={{fontSize:11,color:T.tx3}}>Tu información seguirá protegida. Tus datos se sincronizan en la nube con encriptación.</div></div></div><button onClick={()=>{logout()}} style={{background:T.bl,color:"#fff",border:"none",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,flexShrink:0}}>Crear cuenta →</button></div>}
          {!trialActive&&trialEnd&&plan==="free"&&!u?.p?.anonymous&&<div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.12)",borderRadius:12,padding:"14px 18px",marginTop:12,display:"flex",flexWrap:"wrap",gap:8}}>
            {/* 25-jul-2026 — Aviso de fin de prueba. Aparece cuando el trial
                venció y la cuenta quedó en gratuito. Era código muerto hasta
                que se corrigió el bug del plan permanente (a4943d1).
                Redacción sobria a pedido de Santiago: sin disculpas ni
                explicaciones técnicas, que al usuario no le aportan. Sí se
                mantiene "tus datos están intactos" — es lo primero que uno
                teme cuando le cierran una puerta.
                Las tres opciones a la vista para que elija, con Pro Familiar
                destacado (único con trial de 14 días en Stripe: el usuario ve
                $0 hoy, que pesa más que la diferencia de precio). */}
            <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <span style={{fontSize:18,flexShrink:0}}>🔒</span>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13.5,fontWeight:700,color:T.rd}}>Tu prueba gratuita del plan Pro terminó</div>
                  <div style={{fontSize:11.5,color:T.tx3,marginTop:2,lineHeight:1.5}}>
                    Para seguir usando el <strong>motor fiscal</strong>, el <strong>Asesor IA</strong> y los <strong>Coaches</strong>, activá tu plan.
                    <br/>Tus datos están intactos y tu cuenta sigue activa en el plan gratuito.
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={()=>setPg("price")} style={{background:T.gn,color:"#000",border:"none",padding:"10px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>Activar Pro Familiar — $27/mes</button>
                <button onClick={()=>setPg("price")} style={{background:"transparent",color:T.gn,border:`1px solid ${T.gn}`,padding:"10px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>Pro — $16/mes</button>
                <button onClick={()=>setPg("price")} style={{background:"transparent",color:T.tx2,border:`1px solid ${T.border}`,padding:"10px 18px",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:12}}>Básico — $8/mes</button>
              </div>
            </div>
          </div>}
          <p style={{color:T.tx3,fontSize:13,margin:0}}>Resumen de tu situación financiera</p>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
          <button onClick={()=>setPg("resumen")} style={{background:T.bl,color:"#fff",border:"none",padding:"10px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>📋 Resumen</button>
          <button onClick={generatePDF} style={{background:T.gn,color:"#000",border:"none",padding:"10px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>📄 Reporte PDF</button>
        </div>
      </div>

      {(()=>{
        const hasIng=((u&&u.ingresos)||[]).filter(i=>i.sim!==false).length>0;
        const hasGas=Object.keys((u&&u.gas)||{}).length>0;
        const hasInv=((u&&u.inv)||[]).filter(i=>i.sim!==false).length>0;
        const hasDeu=((u&&u.deu)||[]).length>0;
        const steps=[
          {id:"ing",done:hasIng,icon:"💰",title:"Registra tus ingresos",desc:"Salario, rentas, dividendos — todo lo que entra cada mes",action:"Agregar ingresos",tip:"Usa 📸 para tomar foto de un recibo, 📥 para Excel, o agrega uno por uno"},
          {id:"gas",done:hasGas,icon:"💳",title:"Registra tus gastos",desc:"Vivienda, educación, transporte, seguros, entretenimiento",action:"Agregar gastos",tip:"Solo gastos mensuales — créditos y cuotas de deudas van en el Paso 4"},
          {id:"inv",done:hasInv,icon:"🏦",title:"Agrega tu patrimonio",desc:"Propiedades, fondos, acciones, CDTs, crypto, vehículos",action:"Agregar inversiones",tip:"Cada activo con su valor actual — propiedades, fondos, acciones, crypto"},
          {id:"deu",done:hasDeu,icon:"📋",title:"Registra tus deudas",desc:"Hipotecas, préstamos, tarjetas — con saldo y cuota",action:"Agregar deudas",tip:"Incluye saldo pendiente, cuota mensual y tasa de interés"},
        ];
        const done=steps.filter(s=>s.done).length;
        const pct=Math.round((done/steps.length)*100);
        if(done>=steps.length)return null;
        return <div style={{marginBottom:24}}>
        <div style={{background:"linear-gradient(135deg,rgba(34,197,94,.04),rgba(59,130,246,.03))",border:"1px solid rgba(34,197,94,.12)",borderRadius:20,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:T.bg3}}><div style={{height:"100%",width:pct+"%",background:"linear-gradient(90deg,#22c55e,#3b82f6)",borderRadius:3,transition:"width 0.5s"}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
            <div>
              <h3 style={{fontSize:22,fontWeight:800,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Configura tu FINPATHIA</h3>
              <p style={{color:T.tx3,fontSize:13,margin:0}}>{done===0?"Sigue estos 4 pasos para activar tu dashboard completo":"¡Vas bien! "+done+" de 4 pasos completados"}</p>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:13,fontWeight:700,color:T.gn}}>{pct}%</div>
              <Bt sz="s" onClick={demo} st={{background:T.bg3,color:T.tx2}}>📊 Probar con datos demo</Bt>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:10}}>
            {steps.map((s,i)=><button key={s.id} onClick={()=>setPg(s.id)} style={{background:s.done?"rgba(34,197,94,0.06)":T.bg2,border:"1px solid "+(s.done?"rgba(34,197,94,0.2)":T.border),borderRadius:14,padding:"18px 18px",cursor:"pointer",textAlign:"left",color:T.tx,transition:"all 0.2s",opacity:s.done?.6:1}} onMouseOver={e=>{if(!s.done)e.currentTarget.style.borderColor="#22c55e"}} onMouseOut={e=>{if(!s.done)e.currentTarget.style.borderColor=T.border}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{width:36,height:36,borderRadius:12,background:s.done?"rgba(34,197,94,0.12)":T.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{s.done?"✅":s.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:10,color:s.done?T.gn:T.tx3,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Paso {i+1}</span>
                    {s.done&&<span style={{fontSize:9,color:T.gn,fontWeight:600}}>✓ Listo</span>}
                  </div>
                  <div style={{fontSize:14,fontWeight:700,marginTop:2,color:s.done?T.tx3:T.tx,textDecoration:s.done?"line-through":"none"}}>{s.title}</div>
                  <div style={{fontSize:11,color:T.tx3,marginTop:2,lineHeight:1.4}}>{s.done?s.action+" ✓":s.desc}</div>
                  {!s.done&&<div style={{fontSize:10,color:T.bl,marginTop:6}}>💡 {s.tip}</div>}
                </div>
              </div>
            </button>)}
          </div>
          {done===0&&<div style={{marginTop:16,padding:"14px 18px",background:"rgba(59,130,246,0.06)",borderRadius:12,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>🧠</span>
            <div style={{fontSize:12,color:T.tx2,lineHeight:1.5}}><strong>Tip:</strong> En cada sección encontrarás el botón <strong>📥 Importar</strong> para cargar Excel, o <strong>📸 Subir factura</strong> para tomar foto de un recibo o extracto. La IA lee y organiza los datos.</div>
          </div>}
        </div>
      </div>;
      })()}

      <SecH n={1} t="¿Dónde estoy?" s="Tu patrimonio hoy y qué dice tu family office"/>
      {/* ══════════ 1 · ¿DÓNDE ESTOY? ══════════
          Patrimonio neto y salud financiera. El número que resume todo. */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"2fr 1fr",gap:14,marginBottom:14}}>
        <div style={{
          background:"rgba(255,255,255,0.02)",
          border:`1px solid ${CHART.border}`,
          borderRadius:14,
          padding:0,
          position:"relative",
          overflow:"hidden",
          backgroundImage:`radial-gradient(circle at 0% 0%, ${CHART.green}15 0%, transparent 50%)`,
        }}>
          {/* Accent line vertical */}
          <div style={{position:"absolute",left:0,top:24,bottom:24,width:2,background:CHART.green,borderRadius:"0 2px 2px 0"}}/>
          <div style={{padding:"18px 20px"}}>
            <div style={{fontSize:10,color:CHART.txt3,letterSpacing:"0.08em",fontWeight:700,textTransform:"uppercase"}}>PATRIMONIO NETO</div>
            <div style={{fontFamily:CHART.fontDisplay,fontSize:"clamp(2.5rem,6vw,4rem)",fontWeight:800,letterSpacing:"-0.045em",marginTop:6,lineHeight:1.0,fontVariantNumeric:"tabular-nums",color:CHART.txt}}>{fm(t.nw)}</div>
            <div style={{display:"flex",gap:28,marginTop:24,flexWrap:"wrap"}}>
              {[{l:"Activos",v:fm(totalPat),c:CHART.green},{l:"Deuda",v:fm(t.td),c:CHART.red},{l:"Ratio D/A",v:pc(t.dta),c:t.dta<50?CHART.green:CHART.red}].map(k=>
                <div key={k.l}><div style={{fontSize:10,color:CHART.txt3,letterSpacing:"0.06em",fontWeight:600,textTransform:"uppercase"}}>{k.l}</div><div style={{fontSize:18,fontWeight:700,color:k.c,marginTop:4,fontFamily:CHART.fontMono,fontVariantNumeric:"tabular-nums"}}>{k.v}</div></div>
              )}
            </div>
          </div>
        </div>
        <div style={{
          background:"rgba(255,255,255,0.02)",
          border:`1px solid ${CHART.border}`,
          borderRadius:14,
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
            marginBottom:14,
            boxShadow:`0 0 24px ${healthColor}30, inset 0 0 24px ${healthColor}10`,
          }}>
            <div style={{fontFamily:CHART.fontDisplay,fontSize:32,fontWeight:800,color:healthColor,fontVariantNumeric:"tabular-nums"}}>{healthScore}</div>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:healthColor,fontFamily:CHART.fontDisplay}}>{healthLabel}</div>
          <div style={{fontSize:10,color:CHART.txt3,marginTop:4,letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:600}}>Salud Financiera</div>
        </div>
      </div>

      {/* Ubicación (25-jul-2026, Santiago): "mejor el slot del patrimonio neto
          de primero y debajo lo que ve el family office". Correcto — primero
          el número, después la lectura del número. Antes iba sobre el
          patrimonio y el usuario leía conclusiones antes de ver el dato del
          que salen. */}
      {/* Posición en riqueza: le da escala al número anterior. */}
      {(() => {
        const nwUSD = trm > 0 ? t.nw / trm : t.nw / 4200;
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
          <Cd s={{padding:"18px 20px",marginBottom:14,background:"linear-gradient(135deg,rgba(168,85,247,0.04),rgba(59,130,246,0.03))"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
              <div>
                <div style={{fontSize:11,color:T.tx3,fontWeight:600,letterSpacing:1}}>📍 TU POSICIÓN EN RIQUEZA</div>
                <div style={{fontSize:13,color:T.tx2,marginTop:4}}>Con un patrimonio neto de <strong style={{color:T.gn}}>{fm(t.nw)}</strong> (≈ USD ${Math.round(nwUSD).toLocaleString("en-US")})</div>
              </div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <div style={{textAlign:"center",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:12,padding:"10px 18px",flex:1,minWidth:130}}>
                  <div style={{fontSize:10,color:"#a78bfa"}}>🇨🇴 COLOMBIA</div>
                  <div style={{fontSize:18,fontWeight:800,color:"#a78bfa",marginTop:2}}>{colLabel}</div>
                  <div style={{fontSize:10,color:T.tx3}}>Superas al {colPerc}%</div>
                </div>
                <div style={{textAlign:"center",background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.15)",borderRadius:12,padding:"10px 18px",flex:1,minWidth:130}}>
                  <div style={{fontSize:10,color:T.bl}}>🌍 GLOBAL</div>
                  <div style={{fontSize:18,fontWeight:800,color:T.bl,marginTop:2}}>{gloLabel}</div>
                  <div style={{fontSize:10,color:T.tx3}}>Superas al {gloPerc}%</div>
                </div>
                <div style={{textAlign:"center",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:12,padding:"10px 18px",flex:1,minWidth:130}}>
                  <div style={{fontSize:10,color:T.gn}}>🇺🇸 ESTADOS UNIDOS</div>
                  <div style={{fontSize:18,fontWeight:800,color:T.gn,marginTop:2}}>{usLabel}</div>
                  <div style={{fontSize:10,color:T.tx3}}>Superas al {usPerc}%</div>
                </div>
              </div>
            </div>
            <div style={{fontSize:10,color:T.tx3,marginTop:10,lineHeight:1.6}}>
              <strong>Fuentes:</strong> 🌍 UBS Global Wealth Report 2024 (umbral top 10%: USD $109,430 · top 1%: USD $936,430) · 🇨🇴 Credit Suisse Wealth Databook 2023 — Colombia (mediana adulto: ~USD $6,500) · 🇺🇸 Federal Reserve Survey of Consumer Finances 2022 (mediana hogar: USD $192,700 · top 10%: USD $1.9M · top 1%: USD $11.1M)
            </div>
          </Cd>
        );
      })()}

      {/* Cómo va el año (25-jul-2026). El resto de la sección 1 es una foto
          fija: cuánto tenés HOY. Esto agrega la trayectoria — de dónde venís
          y hacia dónde va el año. Se calcula del flujo, no del histórico de
          patrimonio, porque ese vive en localStorage y está vacío para
          cualquier usuario nuevo. */}
      {(()=>{ try{
        const hoy=new Date();
        return <AnoEnCurso user={u} trm={u?.trm||4200} fmt={fm} T={T} mesActual={hoy.getMonth()+1} año={hoy.getFullYear()} totales={t}/>;
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
          try{ recs=generarRecomendaciones(u,estimarImpuesto(u))||[] }catch{ recs=[] }
          const hs=generarHallazgos({
            user:u,
            recomendaciones:recs,
            trm:u?.trm||4200,
            patrimonioTotal:(t?.ab||0)+(ib?.tv||0),
            totales:t,
            descartados:hallazgosDescartados,
            max:4,
          });
          return <HallazgosProactivos hallazgos={hs} T={T} onIr={(pg)=>setPg(pg)} onDescartar={descartarHallazgo}/>;
        }catch(e){ return null }
      })()}


      <SecH n={2} t="¿Cómo se mueve tu plata?" s="Lo que entra, lo que sale y lo que queda cada mes"/>
      {/* ══════════ 2 · ¿CÓMO SE MUEVE MI PLATA? ══════════
          Indicadores de flujo: entra, sale, queda. */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:14}}>
        {[
          {l:"Ingresos/mes",v:fm(t.ti),c:T.gn,i:"💰"},
          {l:"Gastos/mes",v:fm(t.gfm+t.tg),c:T.rd,i:"💳"},
          {l:"Deudas/mes",v:fm(t.tc),c:"#f97316",i:"🏦"},
          {l:"Cash Flow",v:fm(t.cf)+"/mes",c:t.cf>=0?T.gn:T.rd,i:"📊"},
          {l:"Independencia",v:pc(t.ind),c:t.ind>=100?T.gn:T.tx2,i:t.ind>=100?"🏆":"📈"},
        ].map(k=><Cd key={k.l} s={{padding:"18px 20px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",fontWeight:600,letterSpacing:1}}>{k.l}</div><div style={{fontSize:22,fontWeight:700,color:k.c,marginTop:6}}>{k.v}</div></div><div style={{fontSize:22}}>{k.i}</div></div></Cd>)}
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
      <style>{`.fp-masonry > * { break-inside: avoid; page-break-inside: avoid; margin-bottom: 14px; display: block; }`}</style>
      <div className="fp-masonry" style={{columnCount:mb?1:2,columnGap:14,marginBottom:14}}>
        {/* Cash Flow Waterfall */}
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:14}}>Flujo de Caja Mensual</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={fd}><ChartGradients/><CartesianGrid {...gridProps}/><XAxis dataKey="name" {...axisProps}/><YAxis {...axisProps} tickFormatter={v=>fm(v).replace("$","")}/><Tooltip cursor={{fill:"rgba(255,255,255,0.03)"}} content={<ChartTooltip formatter={v=>fm(v)}/>}/><Bar dataKey="a" radius={[8,8,0,0]} maxBarSize={64}>{fd.map((d,i)=><Cell key={i} fill={d.a>=0?CHART.green:CHART.red}/>)}</Bar></BarChart>
          </ResponsiveContainer>
        </Cd>
        {/* Tax Estimate */}
        {(()=>{const tx=estimarImpuesto(u);return tx.total>0?<Cd s={{padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:14}}>🧾 Impuestos (Anual)</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:11,color:T.tx3}}>Total estimado</span>
            <span style={{fontSize:18,fontWeight:800,color:T.pr,fontFamily:"monospace"}}>{fm(tx.total)}/año</span>
          </div>
          <div style={{fontSize:11,color:T.tx3,marginBottom:8}}>{fm(tx.mes)}/mes estimado</div>
          {tx.detalle.map((d,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:"1px solid "+T.border,fontSize:11}}>
            <span style={{color:T.tx2}}>{d.type==="juridica"?"🏢":"👤"} {d.name}</span>
            <div style={{textAlign:"right"}}>
                    <span style={{color:T.tx2}}>{fm(d.impuesto)} <span style={{color:T.tx3}}>({d.tasa.toFixed(1)}%)</span></span>
                    <div style={{fontSize:9,color:T.tx3}}>Ingresos: {fm(d.ingreso)}/año</div>
                    {d.ahorroOptimo>100000&&<div style={{fontSize:9,color:T.gn}}>Optimizable: -{fm(d.ahorroOptimo)}</div>}
                  </div>
          </div>)}
          <button onClick={()=>setPg("tax")} style={{width:"100%",marginTop:10,padding:"8px",background:T.bg3,border:"1px solid "+T.border,borderRadius:8,color:T.pr,cursor:"pointer",fontSize:11,fontWeight:600}}>Ver detalle → 🧾 Impuestos</button>
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
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>Distribución Patrimonial</div>
          <div style={{fontSize:11,color:T.tx3,marginBottom:14}}>El tamaño de cada bloque es la plata que tenés ahí</div>
          {pie.length>0
            ?<BarraComposicion datos={pie} total={totalPat} paleta={T.ch} T={T} altura={44}/>
            :<div style={{height:140,display:"flex",alignItems:"center",justifyContent:"center",color:T.tx3,fontSize:13}}>Agrega inversiones</div>}
          {/* 25-jul-2026 (Santiago: "veo listado en gastos pero no en
              patrimonio"). Al reemplazar la dona por el treemap me llevé
              también su leyenda, mientras que ingresos y gastos conservaron
              la lista debajo del gráfico. Quedaba inconsistente y, peor, se
              perdía el detalle exacto: el treemap agrupa la cola en "Otros" y
              sin lista esos activos desaparecían de la vista. */}
          {pie.length>0&&<div style={{marginTop:14,borderTop:"1px solid "+T.border}}>
            {pie.map((p,i)=><div key={p.name} style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:i<pie.length-1?"1px solid "+T.border:"none",fontSize:12.5}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:(totalPat>0?(p.value/totalPat)*100:0)+"%",background:T.ch[i%T.ch.length],opacity:0.10,pointerEvents:"none"}}/>
              <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                <div style={{width:10,height:10,borderRadius:3,background:T.ch[i%T.ch.length],flexShrink:0}}/>
                <span style={{color:T.tx2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <span style={{fontWeight:700,fontFamily:"monospace",color:T.tx}}>{fm(p.value)}</span>
                <span style={{color:T.tx3,fontSize:11,minWidth:34,textAlign:"right"}}>{totalPat>0?((p.value/totalPat)*100).toFixed(1)+"%":""}</span>
              </div>
            </div>)}
          </div>}
        </Cd>
        {/* Top Ingresos */}
        <Cd s={{padding:0}}>
          <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+T.border}}>
            <span style={{fontSize:13,fontWeight:700,color:T.tx2}}>💰 Ingresos por fuente</span>
            <span style={{fontSize:13,fontWeight:700,color:T.gn}}>{fm(t.ti)}/mes</span>
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
              <div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:600}}>{inc.nombre||"—"}</div><div style={{fontSize:10,color:T.tx3}}>{inc.categoria}{inc.capital>0?" • Capital: "+fm(inc.capital):""}{inc.tasa?" • "+inc.tasa+"%":""}</div></div>
            </div>
            <div style={{fontWeight:700,fontFamily:"monospace",color:T.gn}}>{fm(inc.mensual||0)}</div>
          </div>):<div style={{padding:28,textAlign:"center",color:T.tx3,fontSize:13}}>Agrega ingresos</div>}
        </Cd>
        {/* Gastos by category */}
        <Cd s={{padding:0}}>
          <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+T.border}}>
            <span style={{fontSize:13,fontWeight:700,color:T.tx2}}>💳 Gastos por categoría</span>
            <span style={{fontSize:13,fontWeight:700,color:T.rd}}>{fm(t.gfm)}/mes</span>
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
            <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:T.ch[i%T.ch.length]}}/><span style={{fontSize:13}}>{exp.name}</span></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700,fontFamily:"monospace",color:T.rd}}>{fm(exp.value)}</span><span style={{fontSize:10,color:T.tx3}}>{t.gfm>0?pc((exp.value/t.gfm)*100):""}</span></div>
          </div>):<div style={{padding:28,textAlign:"center",color:T.tx3,fontSize:13}}>Agrega gastos</div>}
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
            .map(d=>({name:d.n||"Crédito",value:montoPromedioMensual({...d,mensual:(d.pg||0)*(d.moneda==="USD"?(trm||4200):1)}),tasa:d.ts||0,saldo:(d.mt||0)*(d.moneda==="USD"?(trm||4200):1)}))
            .filter(d=>d.value>0)
            .sort((a,b)=>b.value-a.value);
          if(!deudas.length) return null;
          const totalCuotas=deudas.reduce((s,d)=>s+d.value,0);
          return <Cd s={{padding:0}}>
            <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+T.border}}>
              <span style={{fontSize:13,fontWeight:700,color:T.tx2}}>🏦 Cuotas de deuda</span>
              <span style={{fontSize:13,fontWeight:700,color:"#f97316"}}>{fm(totalCuotas)}/mes</span>
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
                  <div style={{fontSize:10,color:T.tx3}}>{d.tasa>0?d.tasa+"% E.A. · ":""}saldo {fm(d.saldo)}</div>
                </div>
              </div>
              <div style={{fontWeight:700,fontFamily:"monospace",color:"#f97316",position:"relative"}}>{fm(d.value)}</div>
            </div>)}
          </Cd>;
        })()}
      </div>

      <SecH n={3} t="¿En qué está tu patrimonio?" s="Composición, liquidez real y evolución"/>
      {/* ══════════ 3 · ¿EN QUÉ ESTÁ MI PATRIMONIO? ══════════
          Composición: en qué está puesta la plata. */}
      {(() => {
        const nwUSD = trm > 0 ? t.nw / trm : t.nw / 4200;
        // Liquid assets (cash + investments, not real estate)
        const liquidAssets = ((u&&u.inv)||[]).filter(i=>i.sim!==false).filter(i => ["Investment","Fondo de Inversión","CDT","Acciones","Crypto","Renta Fija","Cash"].includes(i.tp||i.tipo)).reduce((s,i) => s + vaCOP(i,trm), 0);
        const runway = t.te > 0 ? Math.round(liquidAssets / t.te) : 999;
        const burnRate = t.nw > 0 ? ((t.te * 12) / t.nw * 100) : 0;
        const savingsRate = t.ti > 0 ? (t.cf / t.ti * 100) : 0;
        const fireNumber = t.gfm * 12 * 25;
        const fireProgress = fireNumber > 0 ? Math.min((t.nw / fireNumber) * 100, 100) : 0;
        const debtService = t.ti > 0 ? (t.tc / t.ti * 100) : 0;
        // Passive vs active income
        const passCats = ["Arriendo","Rendimiento","Dividendos","Inversión"];
        const passiveInc = ((u&&u.ingresos)||[]).filter(i=>i.sim!==false).filter(i => passCats.includes(i.categoria)).reduce((s,i) => s + (i.mensual||0), 0);
        const passiveRatio = t.ti > 0 ? (passiveInc / t.ti * 100) : 0;
        // Yield on cost
        const totalInvested = ((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((s,i) => s + vcCOP(i,trm), 0);
        const yieldOnCost = totalInvested > 0 ? (ingresoInversionAnual(u&&u.ingresos, trm) / totalInvested * 100) : 0;
        // Concentration risk
        const maxAsset = ((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((max,i) => vaCOP(i,trm) > max.v ? {n:i.n||i.nombre||"",v:vaCOP(i,trm)} : max, {n:"",v:0});
        const concRisk = (t.ab+ib.tv) > 0 ? (maxAsset.v / (t.ab+ib.tv) * 100) : 0;

        return (<>
          <Cd s={{padding:20,marginTop:14}}>
            <div style={{fontSize:14,fontWeight:700,color:T.tx2,marginBottom:14}}>🏦 Indicadores Family Office</div>
            <div style={{display:"grid",gridTemplateColumns:mb?"1fr 1fr":"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:14}}>
              {[
                {l:"Runway",v:runway >= 999 ? "∞" : runway + " meses",c:runway>=12?T.gn:runway>=6?"#eab308":T.rd,tip:"Meses que aguantas sin ningún ingreso. Ideal: 12-24.",i:"🛡️"},
                {l:"Burn rate",v:pc(burnRate),c:burnRate<=4?T.gn:burnRate<=8?"#eab308":T.rd,tip:"% del patrimonio que gastas al año. Ideal: <4%.",i:"🔥"},
                {l:"Tasa de ahorro",v:pc(savingsRate),c:savingsRate>=20?T.gn:savingsRate>=10?"#eab308":T.rd,tip:"% del ingreso que ahorras. Ideal: >20%.",i:"💰"},
                {l:"Debt service",v:pc(debtService),c:debtService<=30?T.gn:debtService<=50?"#eab308":T.rd,tip:"% del ingreso que va a pagar deudas. Ideal: <30%.",i:"📋"},
              ].map(k => (
                <div key={k.l} style={{background:T.bg3,borderRadius:12,padding:"14px 18px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,color:T.tx3,fontWeight:600,textTransform:"uppercase"}}>{k.l}</span>
                    <span style={{fontSize:14}}>{k.i}</span>
                  </div>
                  <div style={{fontSize:22,fontWeight:800,color:k.c,marginTop:6}}>{k.v}</div>
                  <div style={{fontSize:9,color:T.tx3,marginTop:4,lineHeight:1.3}}>{k.tip}</div>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:mb?"1fr 1fr":"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:14}}>
              {[
                {l:"Ingreso pasivo",v:pc(passiveRatio),c:passiveRatio>=80?T.gn:passiveRatio>=50?"#eab308":T.rd,tip:"% del ingreso que NO depende de tu trabajo.",i:"🔄"},
                {l:"Yield on cost",v:pc(yieldOnCost),c:yieldOnCost>=8?T.gn:yieldOnCost>=4?"#eab308":T.rd,tip:"Ingreso anual ÷ costo de inversión. Qué tan bien rentan tus activos.",i:"📈"},
                {l:"Concentración",v:pc(concRisk),c:concRisk<=30?T.gn:concRisk<=50?"#eab308":T.rd,tip:concRisk>30?"⚠ "+maxAsset.n+" es "+pc(concRisk)+" de tu patrimonio":"Ningún activo supera el 30%. Bien diversificado.",i:"⚠️"},
                {l:"FIRE progress",v:pc(fireProgress),c:fireProgress>=100?T.gn:fireProgress>=50?"#eab308":T.rd,tip:"Patrimonio ÷ (gastos×25 años). 100% = nunca más necesitas trabajar.",i:"🔥"},
              ].map(k => (
                <div key={k.l} style={{background:T.bg3,borderRadius:12,padding:"14px 18px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,color:T.tx3,fontWeight:600,textTransform:"uppercase"}}>{k.l}</span>
                    <span style={{fontSize:14}}>{k.i}</span>
                  </div>
                  <div style={{fontSize:22,fontWeight:800,color:k.c,marginTop:6}}>{k.v}</div>
                  <div style={{fontSize:9,color:T.tx3,marginTop:4,lineHeight:1.3}}>{k.tip}</div>
                </div>
              ))}
            </div>
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
            <div className="fp-fo2" style={{columnCount:mb?1:2,columnGap:12}}>
            {/* FIRE Number */}
            <div style={{background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <div style={{fontSize:11,color:T.tx3,fontWeight:600}}>🔥 FIRE NUMBER — ¿Cuánto necesitas para no trabajar más?</div>
                  <div style={{fontSize:10,color:T.tx3,marginTop:2}}>Fórmula: gastos mensuales × 12 × 25 años (regla del 4%)</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:18,fontWeight:800,color:fireProgress>=100?T.gn:"#eab308"}}>{fm(fireNumber)}</div>
                  <div style={{fontSize:10,color:T.tx3}}>necesitas en total</div>
                </div>
              </div>
              <div style={{height:12,background:"rgba(255,255,255,0.05)",borderRadius:8,overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:Math.min(fireProgress,100)+"%",background:fireProgress>=100?"linear-gradient(90deg,#22c55e,#3b82f6)":"linear-gradient(90deg,#eab308,#f97316)",borderRadius:8,transition:"width 0.5s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.tx3}}>
                <span>Tienes: {fm(t.nw)}</span>
                <span style={{color:fireProgress>=100?T.gn:"#eab308",fontWeight:700}}>{pc(fireProgress)}</span>
                <span>Meta: {fm(fireNumber)}</span>
              </div>
              {fireProgress<100&&<div style={{fontSize:10,color:T.tx3,marginTop:6}}>
                Te falta: {fm(fireNumber - t.nw)}. {(()=>{const a=añosParaMeta(t.nw,fireNumber,Math.max(0,t.cf),0.05);return a==null?"Con tu ahorro actual no se proyecta alcanzarlo — genera ahorro mensual positivo.":"Proyectado a 5% real anual"+(t.cf>0?" ("+fm(t.cf)+"/mes de ahorro)":", solo con tu patrimonio actual")+", llegas en ~"+(a<1?"menos de 1":(Math.round(a*10)/10))+" años.";})()}
              </div>}
              {fireProgress>=100&&<div style={{fontSize:11,color:T.gn,fontWeight:700,marginTop:6}}>
                🏆 ¡Ya superaste tu FIRE number! Técnicamente puedes dejar de trabajar y vivir de tu patrimonio por 25+ años.
              </div>}
            </div>

            {/* FECHA LIBRE DE DEUDA */}
            {t.td > 0 && (() => {
              const deudas = ((u&&u.deu)||[]).filter(d => d.sim !== false).map(d => ({...d, mt: d.mt||0, pg: d.pg||0, ts: d.ts||0})).filter(d => d.mt > 0 && d.pg > 0);
              const totalDeuda = deudas.reduce((s,d) => s + d.mt, 0);
              const totalCuota = deudas.reduce((s,d) => s + d.pg, 0);
              const { meses: mesesLibre, algunaNoAmortiza } = mesesLibreDeuda(deudas);
              const aniosLibre = (mesesLibre / 12).toFixed(1);
              const fechaLibre = new Date();
              fechaLibre.setMonth(fechaLibre.getMonth() + mesesLibre);
              const fechaStr = fechaLibre.toLocaleDateString("es-CO", {month:"long", year:"numeric"});
              // Avalancha: order by highest rate first
              const avalancha = [...deudas].sort((a,b) => (b.ts||0) - (a.ts||0));
              // Bola de nieve: order by smallest balance first
              const bolaNieve = [...deudas].sort((a,b) => a.mt - b.mt);
              
              return (
                <div style={{marginTop:14,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div>
                      <div style={{fontSize:11,color:T.tx3,fontWeight:600}}>📋 FECHA LIBRE DE DEUDA</div>
                      <div style={{fontSize:10,color:T.tx3,marginTop:2}}>Al ritmo actual de pago de cuotas</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:20,fontWeight:800,color:mesesLibre<=36?T.gn:mesesLibre<=72?"#eab308":T.rd}}>{fechaStr}</div>
                      <div style={{fontSize:10,color:T.tx3}}>en {aniosLibre} años ({mesesLibre} meses)</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:10}}>
                    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:T.rd,marginBottom:8}}>🏔️ Estrategia Avalancha (ahorra más intereses)</div>
                      <div style={{fontSize:10,color:T.tx3,marginBottom:8}}>Paga primero la de mayor tasa de interés</div>
                      {avalancha.slice(0,4).map((d,i) => (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                          <span style={{color:i===0?T.rd:T.tx2}}>{i+1}. {d.n||d.nombre||"Deuda"}</span>
                          <span style={{color:T.tx3,fontFamily:"monospace"}}>{d.ts||0}% → {fm(d.pg)}/mes</span>
                        </div>
                      ))}
                    </div>
                    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#eab308",marginBottom:8}}>⛄ Estrategia Bola de Nieve (motivación rápida)</div>
                      <div style={{fontSize:10,color:T.tx3,marginBottom:8}}>Paga primero la más pequeña</div>
                      {bolaNieve.slice(0,4).map((d,i) => (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                          <span style={{color:i===0?"#eab308":T.tx2}}>{i+1}. {d.n||d.nombre||"Deuda"}</span>
                          <span style={{color:T.tx3,fontFamily:"monospace"}}>{fm(d.mt)} saldo</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{fontSize:10,color:T.tx3,marginTop:8}}>
                    Al quedar libre de deuda, tu cash flow sube <strong style={{color:T.gn}}>+{fm(totalCuota)}/mes</strong> ({fm(totalCuota*12)}/año) — ese dinero pasa directo a inversión o ahorro.
                  </div>
                  {algunaNoAmortiza && <div style={{fontSize:10,color:T.rd,marginTop:6}}>⚠ Alguna cuota no alcanza a cubrir el interés — a ese ritmo esa deuda no se amortiza. Revisá la cuota o la tasa.</div>}
                </div>
              );
            })()}

            {/* TIMELINE DE INDEPENDENCIA */}
            <div style={{marginTop:14,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
              <div style={{fontSize:11,color:T.tx3,fontWeight:600,marginBottom:8}}>🎯 CAMINO A LA INDEPENDENCIA FINANCIERA</div>
              {(() => {
                const hitos = [];
                // Milestone 1: Emergency fund (6 months)
                const emerFund = t.te * 6;
                const liquidA = ((u&&u.inv)||[]).filter(i=>i.sim!==false).filter(i => ["Investment","Fondo de Inversión","CDT","Cash","Renta Fija"].includes(i.tp||i.tipo)).reduce((s,i) => s + vaCOP(i,trm), 0);
                hitos.push({name:"Fondo de emergencia (6 meses)",target:emerFund,current:liquidA,icon:"🛡️"});
                // Milestone 2: Debt free
                const totalD = ((u&&u.deu)||[]).filter(d=>d.sim!==false).reduce((s,d) => s + (d.mt||0), 0);
                hitos.push({name:"Libre de deudas",target:totalD,current:Math.max(0,totalD - t.td),icon:"📋"});
                // Milestone 3: 50% independence
                const half = t.gfm * 12 * 12.5;
                hitos.push({name:"50% independencia",target:half,current:t.nw,icon:"⚡"});
                // Milestone 4: FIRE number
                hitos.push({name:"FIRE number (25× gastos)",target:fireNumber,current:t.nw,icon:"🔥"});
                // Milestone 5: Absolute freedom (2.5x gastos)
                const absol = t.gfm * 12 * 62.5;
                hitos.push({name:"Libertad absoluta (62.5× gastos)",target:absol,current:t.nw,icon:"👑"});
                
                return hitos.map((h,i) => {
                  const prog = h.target > 0 ? Math.min((h.current / h.target) * 100, 100) : 0;
                  const done = prog >= 100;
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <span style={{fontSize:14,width:20}}>{h.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:8}}>
                          <span style={{color:done?T.gn:T.tx2,fontWeight:done?700:400}}>{h.name}</span>
                          <span style={{color:done?T.gn:T.tx3}}>{done?"✅ Logrado":fm(h.target)}</span>
                        </div>
                        <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:prog+"%",background:done?T.gn:prog>50?"#eab308":"#ef4444",borderRadius:3}}/>
                        </div>
                      </div>
                      <span style={{fontSize:10,color:done?T.gn:T.tx3,minWidth:36,textAlign:"right"}}>{Math.round(prog)}%</span>
                    </div>
                  );
                });
              })()}
            </div>

            {/* CONCENTRACIÓN DE RIESGO */}
            <div style={{marginTop:14,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
              <div style={{fontSize:11,color:T.tx3,fontWeight:600,marginBottom:14}}>⚠️ CONCENTRACIÓN DE RIESGO — ¿Qué tan diversificado estás?</div>
              {(() => {
                const assets = ((u&&u.inv)||[]).filter(i=>i.sim!==false).filter(i => vaCOP(i,trm) > 0).map(i => ({name:i.n||i.nombre||"",value:vaCOP(i,trm),type:i.tp||i.tipo||"Otro"})).concat(ib.tv>0?[{name:"Trading",value:ib.tv,type:"Acciones"}]:[]);
                const totalA = assets.reduce((s,a) => s + a.value, 0);
                if (totalA === 0) return <div style={{fontSize:11,color:T.tx3}}>Agrega activos en Patrimonio para ver el análisis.</div>;
                const sorted = [...assets].sort((a,b) => b.value - a.value);
                const top3 = sorted.slice(0,5);
                // Herfindahl index (0-10000, lower = more diversified)
                const hhi = assets.reduce((s,a) => s + Math.pow((a.value/totalA)*100, 2), 0);
                const hhiLabel = hhi < 1500 ? "Bien diversificado" : hhi < 2500 ? "Moderadamente concentrado" : "Muy concentrado";
                const hhiColor = hhi < 1500 ? T.gn : hhi < 2500 ? "#eab308" : T.rd;
                // By type
                const byType = {};
                assets.forEach(a => { byType[a.type] = (byType[a.type]||0) + a.value; });
                const typeArr = Object.entries(byType).sort((a,b) => b[1] - a[1]);

                return (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:12}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:T.tx2,marginBottom:8}}>Top 5 activos por valor</div>
                        {top3.map((a,i) => {
                          const pct = (a.value / totalA * 100);
                          const risk = pct > 40;
                          return (
                            <div key={i} style={{marginBottom:8}}>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:8}}>
                                <span style={{color:risk?T.rd:T.tx2}}>{risk?"⚠ ":""}{a.name}</span>
                                <span style={{color:risk?T.rd:T.tx3,fontWeight:600}}>{pct.toFixed(1)}% — {fm(a.value)}</span>
                              </div>
                              <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
                                <div style={{height:"100%",width:pct+"%",background:pct>40?T.rd:pct>25?"#eab308":T.gn,borderRadius:3}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:T.tx2,marginBottom:8}}>Diversificación por tipo</div>
                        {typeArr.map(([type,val],i) => {
                          const pct = (val / totalA * 100);
                          return (
                            <div key={type} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <div style={{width:8,height:8,borderRadius:3,background:T.ch[i%T.ch.length]}}/>
                                <span style={{color:T.tx2}}>{type}</span>
                              </div>
                              <span style={{color:T.tx3,fontFamily:"monospace"}}>{pct.toFixed(1)}% ({fm(val)})</span>
                            </div>
                          );
                        })}
                        <div style={{marginTop:8,fontSize:11,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{color:T.tx3}}>Índice Herfindahl:</span>
                          <span style={{fontWeight:700,color:hhiColor}}>{Math.round(hhi)} — {hhiLabel}</span>
                        </div>
                        <div style={{fontSize:9,color:T.tx3,marginTop:2}}>&lt;1500 diversificado · 1500-2500 moderado · &gt;2500 concentrado</div>
                      </div>
                    </div>
                    {sorted.filter(a => (a.value/totalA*100) > 30).length > 0 && (
                      <div style={{marginTop:10,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:8,padding:10,fontSize:11,color:T.rd}}>
                        <strong>⚠ Alerta de concentración:</strong> {sorted.filter(a => (a.value/totalA*100) > 30).map(a => a.name + " (" + (a.value/totalA*100).toFixed(0) + "%)").join(", ")} representan más del 30% de tu patrimonio. Un family office recomendaría diversificar para reducir riesgo.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* BENCHMARK: ¿Cómo rinde tu patrimonio? */}
            <div style={{marginTop:14,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
              <div style={{fontSize:11,color:T.tx3,fontWeight:600,marginBottom:14}}>📊 BENCHMARK — ¿Cómo rinde tu patrimonio vs alternativas?</div>
              {(() => {
                const totalInvested = ((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((s,i) => s + vcCOP(i,trm), 0);
                const totalValue = ((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((s,i) => s + vaCOP(i,trm), 0);
                const gain = totalValue - totalInvested;
                const gainPct = totalInvested > 0 ? ((totalValue / totalInvested) - 1) * 100 : 0;
                const incomeYield = totalInvested > 0 ? (ingresoInversionAnual(u&&u.ingresos, trm) / totalInvested * 100) : 0;
                const totalReturn = gainPct + incomeYield;
                
                const benchmarks = [
                  {name:"Tu portafolio (valoriz.)",pct:gainPct,color:gainPct>=0?T.gn:T.rd},
                  {name:"Tu portafolio (total: valoriz. + renta)",pct:totalReturn,color:totalReturn>=0?T.gn:T.rd},
                  {name:"S&P 500 (promedio 10 años)",pct:12.5,color:"#3b82f6"},
                  {name:"CDT Colombia (promedio)",pct:10.5,color:"#a78bfa"},
                  {name:"Inflación Colombia 2024",pct:5.2,color:"#f97316"},
                  {name:"Colchón (cuenta de ahorros)",pct:1.5,color:T.tx3},
                ];
                const maxPct = Math.max(...benchmarks.map(b => Math.abs(b.pct)), 1);
                
                return (
                  <>
                    {benchmarks.map((b,i) => (
                      <div key={i} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:8}}>
                          <span style={{color:i<2?T.tx:T.tx2,fontWeight:i<2?700:400}}>{b.name}</span>
                          <span style={{color:b.color,fontWeight:700}}>{b.pct>=0?"+":""}{b.pct.toFixed(1)}%</span>
                        </div>
                        <div style={{height:8,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:Math.max((Math.abs(b.pct)/maxPct)*100,2)+"%",background:b.color,borderRadius:3,opacity:i<2?1:0.6}}/>
                        </div>
                      </div>
                    ))}
                    <div style={{marginTop:8,fontSize:10,color:T.tx3,lineHeight:1.5}}>
                      {totalReturn > 12.5 
                        ? <span style={{color:T.gn}}>✅ Tu portafolio supera al S&P 500. Excelente gestión.</span>
                        : totalReturn > 5.2
                          ? <span style={{color:"#eab308"}}>📈 Tu portafolio supera la inflación pero está por debajo del S&P 500. Revisa si puedes mejorar la asignación.</span>
                          : <span style={{color:T.rd}}>⚠ Tu portafolio no supera la inflación. Tu dinero está perdiendo poder adquisitivo.</span>
                      }
                      <br/>Valorización: {fm(gain)} ({gainPct>=0?"+":""}{gainPct.toFixed(1)}%) · Renta anual: {fm(t.ti*12)} ({incomeYield.toFixed(1)}%)
                    </div>
                  </>
                );
              })()}
            </div>

            {/* PLANIFICACIÓN TRIBUTARIA — Usa estimarImpuesto() con propietarios + DIAN */}
            {(()=>{const tx=estimarImpuesto(u);if(tx.total<=0)return null;return<div style={{marginTop:14,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
              <div style={{fontSize:11,color:T.tx3,fontWeight:600,marginBottom:6}}>{`🧾 IMPUESTOS ESTIMADOS — Colombia · UVT $${UVT.toLocaleString("es-CO")} (AG 2025)`}</div>
              <div style={{fontSize:10,color:T.tx3,marginBottom:14,lineHeight:1.5}}>{`Estimación orientativa (borrador). No es la liquidación oficial ni asesoría tributaria. Temporada DIAN: AG 2025 (UVT $${UVT.toLocaleString("es-CO")}).`}</div>
              {tx.sinClasificar>0&&<div style={{background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.15)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:11,color:T.orange}}>⚠️ {tx.sinClasificar} ingreso(s) sin clasificación fiscal. Ve a <strong>💰 Ingresos</strong> y asigna propietario + clasificación DIAN para un cálculo más preciso.</div>}
              <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:T.rd,marginBottom:8}}>Impuesto estimado a cargo por propietario</div>
                  {tx.detalle.map((d,i)=>{const aCargo=d.impuestoACargo??d.impBruto??d.impuesto??0;return<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:T.tx2}}>{d.type==="juridica"?"🏢":"👤"} {d.name}</div>
                      <div style={{fontSize:10,color:T.tx3}}>{d.type==="juridica"?"Tarifa 35%":"Tabla Art. 241 ET"} • Ingreso: {fm(d.ingreso)}/año</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.rd,fontFamily:"monospace"}}>{fm(aCargo)}</div>
                      <div style={{fontSize:10,color:T.tx3}}>Tasa: {d.tasa.toFixed(1)}%</div>
                    </div>
                  </div>})}
                  {(()=>{const aCargo=tx.detalle.reduce((s,d)=>s+(d.impuestoACargo??d.impBruto??0),0);const rete=tx.detalle.reduce((s,d)=>s+(d.reteN||0),0);const saldo=tx.detalle.reduce((s,d)=>s+(d.saldoAPagar??d.impuesto??0),0);return<>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontWeight:700,fontSize:13,borderTop:"2px solid "+T.border,marginTop:4}}>
                    <span style={{color:T.tx}}>Impuesto estimado a cargo</span>
                    <span style={{color:T.rd}}>{fm(aCargo)}/año</span>
                  </div>
                  <div style={{fontSize:11,color:T.tx2,marginTop:4}}>Equivale a: <strong style={{color:T.rd}}>{fm(aCargo/12)}/mes</strong></div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"6px 0",marginTop:4}}>
                      <span style={{color:T.tx2}}>Retenciones estimadas</span>
                      <span style={{fontFamily:"monospace",color:T.gn}}>{fm(rete)}/año</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:700,padding:"6px 0"}}>
                      <span style={{color:T.tx}}>Saldo estimado a pagar</span>
                      <span style={{fontFamily:"monospace",color:T.pr}}>{fm(saldo)}/año</span>
                    </div>
                    <div style={{fontSize:10,color:T.tx3,marginTop:4,lineHeight:1.5}}>Impuesto estimado a cargo (antes de retenciones). Tu saldo a pagar suele ser menor — el motor ya resta retenciones/anticipos; no volver a restar del total post-rete.</div>
                  </>})()}
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:T.pr,marginBottom:8}}>Resumen fiscal</div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <span style={{color:T.tx2}}>Ingreso bruto total</span>
                    <span style={{fontFamily:"monospace",color:T.tx2}}>{fm(tx.detalle.reduce((s,d)=>s+d.ingreso,0))}/año</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <span style={{color:T.tx2}}>Impuesto estimado a cargo</span>
                    <span style={{fontFamily:"monospace",color:T.rd}}>{fm(tx.total)}/año</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <span style={{color:T.tx2}}>Tasa efectiva global</span>
                    <span style={{fontFamily:"monospace",color:T.rd}}>{(tx.detalle.reduce((s,d)=>s+d.ingreso,0)>0?(tx.total/tx.detalle.reduce((s,d)=>s+d.ingreso,0)*100):0).toFixed(1)}%</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <span style={{color:T.tx2}}>Neto después de impuestos</span>
                    <span style={{fontFamily:"monospace",color:T.gn}}>{fm(tx.detalle.reduce((s,d)=>s+d.ingreso,0)-tx.total)}/año</span>
                  </div>
                  <button onClick={()=>setPg("tax")} style={{width:"100%",marginTop:12,padding:"10px",background:T.bg,border:"1px solid "+T.border,borderRadius:8,color:T.pr,cursor:"pointer",fontSize:12,fontWeight:600}}>📊 Ver detalle completo y optimizar → 🧾 Impuestos</button>
                  <div style={{fontSize:9,color:T.tx3,marginTop:8,lineHeight:1.5}}>Estimación orientativa (borrador). No es la liquidación oficial ni asesoría tributaria. Finpathia no presta asesoría tributaria ni jurídica. Esta cifra es un borrador con base en los datos que ingresaste. El saldo real puede cambiar por retenciones, rentas exentas, deducciones, topes en UVT y ajustes de tu contador. Presenta tu declaración solo en los canales oficiales de la DIAN.</div>
                </div>
              </div>
            </div>})()}

            {/* FONDO EDUCACIÓN HIJOS */}
            {(() => {
              const gastosEdu = Object.values((u&&u.gas)||{}).flat().filter(g => g.sim!==false).filter(g => 
                (g.c||"").toLowerCase().includes("colegio") || (g.c||"").toLowerCase().includes("universidad") || (g.c||"").toLowerCase().includes("educación")
              );
              const gastoEduMes = gastosEdu.reduce((s,g) => s + (g.m||0), 0);
              if (gastoEduMes === 0) return null;
              const costoUni = 180000000; // Semestre universidad privada Colombia ~$180M
              const aniosUni = 5;
              const totalUni = costoUni * 2 * aniosUni; // 2 semestres x 5 años
              const inflEdu = 0.08; // 8% inflación educativa
              const totalUniInflado = totalUni * Math.pow(1 + inflEdu, 6); // en 6 años
              const ahorroPorHijo = totalUniInflado / (6 * 12); // mensual por 6 años
              const numHijos = Math.max(1, gastosEdu.filter(g => (g.c||"").toLowerCase().includes("colegio")).length);
              
              return (
                <div style={{marginTop:14,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
                  <div style={{fontSize:11,color:T.tx3,fontWeight:600,marginBottom:14}}>🎓 FONDO DE EDUCACIÓN — Proyección universitaria</div>
                  <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:12}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",marginBottom:8}}>Gasto educativo actual</div>
                      <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
                        Mensual en educación: <strong style={{color:"#a78bfa"}}>{fm(gastoEduMes)}</strong><br/>
                        Anual: <strong>{fm(gastoEduMes * 12)}</strong><br/>
                        Hijos detectados: <strong>{numHijos}</strong>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",marginBottom:8}}>Universidad (por hijo)</div>
                      <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
                        Semestre top Colombia: <strong>~{fm(costoUni)}</strong><br/>
                        5 años (10 semestres): <strong>{fm(totalUni)}</strong><br/>
                        Con inflación educativa (8%): <strong style={{color:"#eab308"}}>{fm(totalUniInflado)}</strong><br/>
                        Ahorrar mensual (6 años): <strong style={{color:"#a78bfa"}}>{fm(ahorroPorHijo)}/mes</strong><br/>
                        Por {numHijos} hijos: <strong style={{color:T.rd}}>{fm(ahorroPorHijo * numHijos)}/mes</strong>
                      </div>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:T.tx3,marginTop:8}}>
                    Basado en universidad privada top de Colombia. La inflación educativa (~8% anual) supera la inflación general.
                  </div>
                </div>
              );
            })()}

            {/* ACCIONES RECOMENDADAS */}
            <div style={{marginTop:14,background:"linear-gradient(135deg,rgba(34,197,94,0.06),rgba(59,130,246,0.03))",border:"1px solid rgba(34,197,94,0.1)",borderRadius:12,padding:"14px 20px"}}>
              <div style={{fontSize:11,color:T.gn,fontWeight:700,marginBottom:14}}>✅ ACCIONES RECOMENDADAS — Prioridades para tu situación</div>
              {(() => {
                const actions = [];
                // Check each area
                const runway2 = t.te > 0 ? Math.round((((u&&u.inv)||[]).filter(i=>i.sim!==false).filter(i => ["Investment","Fondo de Inversión","CDT","Cash","Renta Fija"].includes(i.tp||i.tipo)).reduce((s,i) => s + vaCOP(i,trm), 0)) / t.te) : 999;
                if (runway2 < 6) actions.push({pri:"🔴",text:"Fondo de emergencia insuficiente. Necesitas al menos 6 meses de gastos en activos líquidos.",cat:"Liquidez"});
                else if (runway2 < 12) actions.push({pri:"🟡",text:"Fondo de emergencia aceptable ("+runway2+" meses). Ideal: 12-24 meses.",cat:"Liquidez"});
                
                const debtSrv = t.ti > 0 ? (t.tc / t.ti * 100) : 0;
                if (debtSrv > 50) actions.push({pri:"🔴",text:"Más del 50% de tu ingreso va a deudas. Prioriza pagar la de mayor tasa.",cat:"Deuda"});
                else if (debtSrv > 30) actions.push({pri:"🟡",text:"El " + debtSrv.toFixed(0) + "% de tu ingreso va a deudas. Busca reducirlo debajo del 30%.",cat:"Deuda"});
                
                const maxA = ((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((max,i) => vaCOP(i,trm) > max.v ? {n:i.n||i.nombre||"",v:vaCOP(i,trm)} : max, {n:"",v:0});
                const concR = (t.ab+ib.tv) > 0 ? (maxA.v / (t.ab+ib.tv) * 100) : 0;
                if (concR > 40) actions.push({pri:"🟡",text:maxA.n + " es " + concR.toFixed(0) + "% de tu patrimonio. Diversifica para reducir riesgo.",cat:"Riesgo"});
                
                if (t.cf < 0) actions.push({pri:"🔴",text:"Tu cash flow es negativo. Gastas más de lo que ganas. Revisa gastos o busca más ingresos.",cat:"Cash Flow"});
                else if (t.ti > 0 && (t.cf/t.ti*100) < 10) actions.push({pri:"🟡",text:"Tu tasa de ahorro es baja (" + (t.cf/t.ti*100).toFixed(0) + "%). Intenta ahorrar al menos el 20%.",cat:"Ahorro"});
                
                const passI = ((u&&u.ingresos)||[]).filter(i=>i.sim!==false).filter(i => ["Arriendo","Rendimiento","Dividendos"].includes(i.categoria)).reduce((s,i) => s + (i.mensual||0), 0);
                if (t.ti > 0 && (passI/t.ti*100) < 50) actions.push({pri:"🟡",text:"Solo el " + (passI/t.ti*100).toFixed(0) + "% de tu ingreso es pasivo. Invierte más en activos que generen renta.",cat:"Independencia"});
                
                if (actions.length === 0) actions.push({pri:"🟢",text:"¡Excelente situación financiera! Mantén tu estrategia actual y sigue diversificando.",cat:"General"});
                
                return actions.map((a,i) => (
                  <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:i<actions.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                    <span style={{fontSize:14}}>{a.pri}</span>
                    <div>
                      <span style={{fontSize:10,color:T.tx3,fontWeight:600}}>{a.cat}</span>
                      <div style={{fontSize:12,color:T.tx2}}>{a.text}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
            </div>
          </Cd>

      {/* Cuánto de eso es realmente disponible. */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:14,marginTop:14,alignItems:"start"}}>
        {/* LIQUIDEZ REAL */}
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.bl,marginBottom:14}}>💧 Liquidez Real — ¿Cuánto puedes tener en efectivo?</div>
          {(() => {
            const cats = {
              inmediata: {label:"Inmediata (48h)",types:["Cash","CDT","Renta Fija"],color:T.gn,icon:"⚡"},
              corto: {label:"Corto plazo (30 días)",types:["Investment","Fondo de Inversión","Acciones","Crypto"],color:"#eab308",icon:"📅"},
              largo: {label:"Largo plazo (6+ meses)",types:["Real Estate","Bodega","Lote","Local Comercial","Negocio","Vehículo"],color:T.rd,icon:"🏗️"},
            };
            const totals2 = {};
            let grandTotal = 0;
            Object.entries(cats).forEach(([key, cat]) => {
              const val = ((u&&u.inv)||[]).filter(i=>i.sim!==false).filter(i => cat.types.includes(i.tp||i.tipo||"")).reduce((s,i) => s + vaCOP(i,trm), 0);
              totals2[key] = val;
              grandTotal += val;
            });

            return (
              <>
                {Object.entries(cats).map(([key, cat]) => {
                  const val = totals2[key];
                  const pct = grandTotal > 0 ? (val / grandTotal * 100) : 0;
                  return (
                    <div key={key} style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                        <span style={{color:T.tx2}}>{cat.icon} {cat.label}</span>
                        <span style={{fontWeight:700,color:cat.color,fontFamily:"monospace"}}>{fm(val)} <span style={{fontWeight:400,fontSize:10}}>({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div style={{height:8,background:T.bg3,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:pct+"%",background:cat.color,borderRadius:3}}/>
                      </div>
                    </div>
                  );
                })}
                <div style={{marginTop:8,padding:10,background:T.bg3,borderRadius:8,fontSize:11,color:T.tx2,lineHeight:1.6}}>
                  {totals2.inmediata >= t.te * 6 
                    ? <span style={{color:T.gn}}>✅ Tu liquidez inmediata cubre {Math.round(totals2.inmediata / (t.te||1))} meses de gastos. Bien protegido.</span>
                    : <span style={{color:"#eab308"}}>⚠ Tu liquidez inmediata solo cubre {Math.round(totals2.inmediata / (t.te||1))} meses. Un asesor recomendaría al menos 6 meses en activos líquidos.</span>
                  }
                  <br/><strong>{((totals2.largo / (grandTotal||1)) * 100).toFixed(0)}%</strong> de tu patrimonio está en activos ilíquidos (no puedes vender rápido).
                </div>
              </>
            );
          })()}
        </Cd>

        {/* COSTO DE VIDA */}
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"#f97316",marginBottom:14}}>⏱️ Tu Estilo de Vida en Números</div>
          {(() => {
            const gastoMes = t.te || 0;
            const gastoDia = gastoMes / 30;
            const gastoHora = gastoDia / 24;
            const gastoMin = gastoHora / 60;
            const ingresoHora = t.ti > 0 ? t.ti / 176 : 0; // 8h laborales
            const horasLibertad = ingresoHora > 0 ? gastoHora / ingresoHora : 0;

            return (
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                  {[
                    {l:"Por mes",v:fm(gastoMes),icon:"📅"},
                    {l:"Por día",v:fm(Math.round(gastoDia)),icon:"☀️"},
                    {l:"Por hora",v:fm(Math.round(gastoHora)),icon:"⏰"},
                    {l:"Por minuto",v:fm(Math.round(gastoMin)),icon:"⚡"},
                  ].map(k => (
                    <div key={k.l} style={{background:T.bg3,borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
                      <div style={{fontSize:10,color:T.tx3}}>{k.icon} {k.l}</div>
                      <div style={{fontSize:16,fontWeight:800,color:"#f97316",marginTop:2}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                <div className="fp-fo-ancho" style={{background:T.bg3,borderRadius:8,padding:12,marginBottom:8}}>
                  <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
                    💼 Tu ingreso por hora laboral: <strong style={{color:T.gn}}>{fm(Math.round(ingresoHora))}/hora</strong><br/>
                    ⚖️ Necesitas trabajar <strong style={{color:"#f97316"}}>{horasLibertad.toFixed(1)} horas</strong> por cada hora de gastos<br/>
                    {horasLibertad <= 1 
                      ? <span style={{color:T.gn}}>✅ Ganas más por hora de lo que gastas. Cada hora trabajada genera excedente.</span>
                      : <span style={{color:T.rd}}>⚠ Gastas más por hora de lo que ganas. Revisa tu estructura de costos.</span>
                    }
                  </div>
                </div>
                <div style={{fontSize:11,color:T.tx3,lineHeight:1.6}}>
                  💡 Cuando evalúes un gasto, piensa: <em>"¿Esto vale {fm(Math.round(ingresoHora))} × las horas que representa?"</em>
                  <br/>Un gasto de {fm(1000000)} = <strong>{ingresoHora > 0 ? (1000000 / ingresoHora).toFixed(1) : "∞"} horas</strong> de tu trabajo.
                </div>
              </>
            );
          })()}
        </Cd>
      </div>

      {/* Cómo evolucionó en el tiempo. */}
      {(()=>{
        const snaps=JSON.parse(localStorage.getItem("fp3_snapshots")||"[]");
        if(snaps.length<2)return null;
        const sorted=snaps.sort((a,b)=>a.k.localeCompare(b.k));
        const last=sorted[sorted.length-1];
        const prev=sorted[sorted.length-2];
        const change=last.nw-prev.nw;
        const months=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        const maxVal=Math.max(...sorted.map(s=>s.nw));
        const minVal=Math.min(...sorted.map(s=>s.nw));
        const range=maxVal-minVal||1;
        return<Cd s={{padding:20,marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><div><div style={{fontSize:13,fontWeight:700,color:T.bl}}>📈 Historial Patrimonio Neto</div><div style={{fontSize:11,color:T.tx3}}>{sorted.length} meses registrados</div></div><div style={{textAlign:"right"}}><div style={{fontSize:11,color:T.tx3}}>Último mes</div><div style={{fontSize:14,fontWeight:700,color:change>=0?T.gn:T.rd}}>{change>=0?"+":""}{fm(change)}</div></div></div>
          <div style={{display:"flex",alignItems:"flex-end",gap:3,height:100}}>
            {sorted.map((s,i)=>{const h=((s.nw-minVal)/range)*80+20;const m=parseInt(s.k.split("-")[1])-1;return<div key={s.k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}} title={months[m]+" "+s.k.split("-")[0]+": "+fm(s.nw)}><div style={{width:"100%",height:h,background:s.nw>=0?"linear-gradient(to top,"+T.gn+"40,"+T.gn+")":"linear-gradient(to top,"+T.rd+"40,"+T.rd+")",borderRadius:"4px 4px 0 0",minHeight:4,transition:"height 0.3s"}}/><div style={{fontSize:8,color:T.tx3}}>{months[m]}</div></div>})}
          </div>
        </Cd>;
      })()}

      <SecH n={4} t="¿Hacia dónde vas?" s="Proyección, independencia financiera y alertas"/>
      {/* ══════════ 4 · ¿HACIA DÓNDE VOY? ══════════
          Proyección e independencia financiera. */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"2fr 1fr",gap:14}}>
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:14}}>Proyección Patrimonial (8% anual)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={pj}><ChartGradients/><CartesianGrid {...gridProps}/><XAxis dataKey="yr" {...axisProps}/><YAxis {...axisProps} tickFormatter={v=>fm(v).replace("$","")}/><Tooltip content={<ChartTooltip formatter={v=>fm(v)}/>}/><Area type="monotone" dataKey="v" stroke={CHART.green} strokeWidth={2.5} fill="url(#gradGreen)"/></AreaChart>
          </ResponsiveContainer>
        </Cd>
        {/* Independence Progress */}
        <Cd s={{padding:"24px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:24}}>Independencia Financiera</div>
          <div style={{position:"relative",height:14,background:T.bg3,borderRadius:8,overflow:"hidden",marginBottom:8}}>
            <div style={{height:"100%",width:Math.min(t.ind,150)+"%",maxWidth:"100%",background:t.ind>=100?"linear-gradient(90deg,#22c55e,#3b82f6)":"linear-gradient(90deg,#ef4444,#eab308)",borderRadius:8,transition:"width 0.5s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.tx3}}>
            <span>0%</span><span style={{color:t.ind>=100?T.gn:T.tx2,fontWeight:700}}>{pc(t.ind)}</span><span>100%</span>
          </div>
          <div style={{marginTop:16,fontSize:12,color:T.tx2,lineHeight:1.6}}>
            {t.ind>=100
              ?<span style={{color:T.gn}}>🏆 ¡Tus ingresos cubren todos tus gastos y deudas!</span>
              :t.ind>=60
                ?<span>📈 Te falta {fm(t.te-t.ni)}/mes para cubrir todos tus gastos.</span>
                :<span style={{color:T.rd}}>⚠ Tus gastos superan tus ingresos en {fm(t.te-t.ni)}/mes.</span>
            }
          </div>
          {t.ind<100&&t.cf!==0&&<div style={{marginTop:8,fontSize:11,color:T.tx3}}>
            Meta: necesitas {fm(t.te)}/mes de ingresos para ser independiente.
          </div>}
        </Cd>
      </div>
      {/* Alertas de detalle. Cierra la página: son avisos puntuales, no el
          diagnóstico principal — ese lo da el bloque del family office arriba. */}
      <Cd s={{padding:20,marginTop:14,background:"linear-gradient(135deg,rgba(239,68,68,0.03),rgba(234,179,8,0.02))"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#eab308",marginBottom:14}}>🔔 Alertas del Asesor — Rebalanceo y Optimización</div>
        {(() => {
          const alerts = [];
          const inv = ((u&&u.inv)||[]).filter(i=>i.sim!==false);
          const ing = ((u&&u.ingresos)||[]).filter(i=>i.sim!==false);
          const totalA = inv.reduce((s,i) => s + vaCOP(i,trm), 0) + ib.tv;
          
          // 1. Real estate concentration
          const reVal = inv.filter(i => ["Real Estate","Bodega","Lote","Local Comercial"].includes(i.tp||i.tipo)).reduce((s,i) => s + vaCOP(i,trm), 0);
          const rePct = totalA > 0 ? (reVal / totalA * 100) : 0;
          if (rePct > 60) alerts.push({type:"🔴",title:"Concentración inmobiliaria extrema",msg:"El "+rePct.toFixed(0)+"% de tu patrimonio está en inmuebles. Si el mercado inmobiliario cae, tu patrimonio se impacta fuertemente. Considera diversificar al menos "+fm(reVal*0.15)+" hacia renta fija, fondos o acciones internacionales.",cat:"Diversificación"});
          else if (rePct > 45) alerts.push({type:"🟡",title:"Alta exposición inmobiliaria",msg:"El "+rePct.toFixed(0)+"% está en inmuebles. Es común en Colombia pero te expone a riesgo de liquidez. Un portafolio balanceado tiene máximo 40% en un solo tipo de activo.",cat:"Diversificación"});

          // 2. Single asset risk
          const maxAsset = inv.reduce((max,i) => vaCOP(i,trm) > max.v ? {n:i.n||i.nombre||"",v:vaCOP(i,trm)} : max, {n:"",v:0});
          const maxPct = totalA > 0 ? (maxAsset.v / totalA * 100) : 0;
          if (maxPct > 35) alerts.push({type:"🟡",title:maxAsset.n+" = "+maxPct.toFixed(0)+"% del patrimonio",msg:"Ningún activo debería superar el 30%. Considera vender una porción o no seguir incrementando esta posición. Mover "+fm(maxAsset.v*0.1)+" a otros activos reduciría tu riesgo.",cat:"Concentración"});

          // 3. Income dependency
          const maxIng = ing.reduce((max,i) => (i.mensual||0) > max.v ? {n:i.nombre||"",v:i.mensual||0} : max, {n:"",v:0});
          const maxIngPct = t.ti > 0 ? (maxIng.v / t.ti * 100) : 0;
          if (maxIngPct > 40) alerts.push({type:"🟡",title:"Dependencia de ingreso: "+maxIng.n,msg:"El "+maxIngPct.toFixed(0)+"% de tus ingresos viene de una sola fuente. Si esa fuente falla, tu cash flow cae "+fm(maxIng.v)+"/mes. Diversifica fuentes de ingreso.",cat:"Riesgo de ingreso"});

          // 4. Debt-to-income
          const dti = t.ti > 0 ? (t.tc / t.ti * 100) : 0;
          if (dti > 40) alerts.push({type:"🔴",title:"Carga de deuda alta: "+dti.toFixed(0)+"%",msg:"Más del 40% de tu ingreso va a cuotas. Prioriza pagar la deuda de mayor tasa. Meta: bajar a menos del 30%.",cat:"Deuda"});

          // 5. Savings rate
          const savR = t.ti > 0 ? (t.cf / t.ti * 100) : 0;
          if (savR < 10 && savR >= 0) alerts.push({type:"🟡",title:"Tasa de ahorro baja: "+savR.toFixed(0)+"%",msg:"Los family offices recomiendan ahorrar al menos 20% del ingreso. Busca reducir gastos variables o incrementar ingresos pasivos.",cat:"Ahorro"});
          if (savR < 0) alerts.push({type:"🔴",title:"Ahorro negativo — estás descapitalizándote",msg:"Gastas "+fm(Math.abs(t.cf))+"/mes más de lo que ganas. Esto erosiona tu patrimonio. Acción urgente: recortar gastos o generar más ingresos.",cat:"Cash Flow"});

          // 6. Vehicles depreciating
          const vehiculos = inv.filter(i => (i.tp||i.tipo) === "Vehículo");
          const vehVal = vehiculos.reduce((s,i) => s + vaCOP(i,trm), 0);
          const vehPct = totalA > 0 ? (vehVal / totalA * 100) : 0;
          if (vehPct > 5) alerts.push({type:"🟡",title:"Vehículos = "+vehPct.toFixed(1)+"% del patrimonio",msg:"Los vehículos pierden ~15% de valor por año. "+fm(vehVal)+" en activos que se deprecian. Un family office los considera gastos, no inversiones.",cat:"Depreciación"});

          // 7. Positive alerts
          const passI = ing.filter(i => ["Arriendo","Rendimiento","Dividendos"].includes(i.categoria)).reduce((s,i) => s + (i.mensual||0), 0);
          const passR = t.ti > 0 ? (passI / t.ti * 100) : 0;
          if (passR >= 80) alerts.push({type:"🟢",title:"Ingreso pasivo "+passR.toFixed(0)+"% — excelente",msg:"La mayoría de tu ingreso no depende de tu trabajo. Esto te da libertad y reduce riesgo. Mantén esta estructura.",cat:"Independencia"});

          const fireN = t.gfm * 12 * 25;
          const fireP = fireN > 0 ? (t.nw / fireN * 100) : 0;
          if (fireP >= 100) alerts.push({type:"🟢",title:"FIRE alcanzado — libertad financiera",msg:"Tu patrimonio supera tu FIRE number. Técnicamente puedes vivir de tus activos por 25+ años sin trabajar.",cat:"Libertad"});
          else if (fireP >= 70) { const aF=añosParaMeta(t.nw,fireN,Math.max(0,t.cf),0.05); alerts.push({type:"🟢",title:"FIRE al "+fireP.toFixed(0)+"% — muy cerca",msg:"Te falta "+fm(fireN - t.nw)+" para la independencia total. "+(aF!=null?"Proyectado a 5% real anual, llegas en ~"+(aF<1?"menos de 1":Math.round(aF*10)/10)+" años.":"Genera ahorro mensual positivo para proyectarlo."),cat:"Progreso"}); }

          if (alerts.length === 0) alerts.push({type:"🟢",title:"Sin alertas",msg:"Tu situación financiera está bien balanceada. Sigue monitoreando mensualmente.",cat:"General"});

          return (
            <div style={{display:"grid",gap:8}}>
              {alerts.sort((a,b) => {const o={"🔴":0,"🟡":1,"🟢":2};return (o[a.type]||2)-(o[b.type]||2)}).map((a,i) => (
                <div key={i} style={{display:"flex",gap:10,padding:12,background:a.type==="🔴"?"rgba(239,68,68,0.06)":a.type==="🟡"?"rgba(234,179,8,0.04)":"rgba(34,197,94,0.04)",border:"1px solid "+(a.type==="🔴"?"rgba(239,68,68,0.12)":a.type==="🟡"?"rgba(234,179,8,0.1)":"rgba(34,197,94,0.1)"),borderRadius:12}}>
                  <span style={{fontSize:18,flexShrink:0,marginTop:2}}>{a.type}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,fontWeight:700,color:a.type==="🔴"?T.rd:a.type==="🟡"?"#eab308":T.gn}}>{a.title}</span>
                      <span style={{fontSize:9,color:T.tx3,background:T.bg3,padding:"10px 14px",borderRadius:3}}>{a.cat}</span>
                    </div>
                    <div style={{fontSize:11,color:T.tx2,marginTop:4,lineHeight:1.6}}>{a.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </Cd>
      </>);
      })()}

    </div>}
        
case"inv":return isUS?<AssetsModuleUS inversiones={(u&&u.inv)||[]} deudas={(u&&u.deu)||[]} onUpdateAssets={v=>upd("inv",v)} onUpdateLiabs={v=>upd("deu",v)} initialTab="assets" plan={plan} onUpgrade={()=>setPg("price")}/>:<InversionesModule owners={u?.owners||[]} inversiones={(u&&u.inv)||[]} deudas={(u&&u.deu)||[]} onUpdate={v=>upd("inv",v)} fmt={fm} onImport={()=>setShowImport(true)} user={u} trm={trm||u?.trm||4200} plan={plan} onUpgrade={()=>setPg("price")}/>;
    case"ing":return isUS?<IncomeModuleUS ingresos={(u&&u.ingresos)||[]} onUpdate={v=>upd("ingresos",v)} trm={trm} plan={plan} onUpgrade={()=>setPg("price")}/>:<IngresosModule owners={u?.owners||[]} ingresos={(u&&u.ingresos)||[]} onUpdate={v=>upd("ingresos",v)} trm={trm} cur={cur} fmt={fm} onImport={()=>setShowImport(true)} user={u} plan={plan} onUpgrade={()=>setPg("price")} user={authUser}/>;
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
                  alert("✅ "+Object.keys(d.prices).length+" precios actualizados"+
                    (fall.length?"\n\n⚠️ Sin precio ("+fall.length+"): "+fall.join(", ")+"\nEsos conservan el valor anterior. Las opciones y algunos símbolos no están en la fuente.":""));
                }else{alert("No se encontraron precios"+(d.error?": "+d.error:""))}
              }catch(e){alert("Error: "+e.message)}
            }} st={{background:"#3b82f6",color:"#fff"}}>📊 Actualizar Precios</Bt><Bt sz="s" onClick={()=>{sF({});setMd("ib")}}>+ Posición</Bt>{((u&&u.ibk)||[]).length>1&&<Bt v="d" sz="s" onClick={()=>{if(confirm("⚠️ ¿Eliminar TODAS las posiciones de trading?"))upd("ibk",[])}}>🗑️ Limpiar</Bt>}</>}/><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:18}}><StatCard label="VALOR PORTFOLIO" value={fm(ib.tv)} accent={CHART.green} highlight/><StatCard label="P/L TOTAL" value={fm(ib.pnl)} sub={pc(ib.pp)} subColor={ib.pnl>=0?"positive":"negative"} accent={ib.pnl>=0?CHART.green:CHART.red} trend={ib.pnl>=0?"up":"down"}/><StatCard label="POSICIONES" value={ib.pos.length} accent={CHART.blue}/></div><Cd s={{padding:0}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Ticker","Nombre","Qty","Costo","Precio","Valor","P/L","%","Upside"].map(h=><th key={h} style={{padding:"9px 12px",textAlign:["Ticker","Nombre"].includes(h)?"left":"right",color:T.tx3,fontWeight:600,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>{h}</th>)}</tr></thead><tbody>{ib.pos.map((p,i)=><tr key={i} style={{borderBottom:`1px solid ${T.border}`}}><td style={{padding:"9px 12px",fontWeight:700,color:T.gn,fontFamily:"monospace"}}>{p.tk}</td><td style={{padding:"9px 12px"}}>{p.n}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>{p.sh}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>${p.cb.toFixed(2)}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>${p.pr.toFixed(2)}</td><td style={{padding:"9px 12px",textAlign:"right",fontWeight:600}}>{fm(p.va)}</td><td style={{padding:"9px 12px",textAlign:"right",fontWeight:600,color:p.pnl>=0?T.gn:T.rd}}>{fm(p.pnl)}</td><td style={{padding:"9px 12px",textAlign:"right",color:p.pp>=0?T.gn:T.rd}}>{pc(p.pp)}</td><td style={{padding:"9px 12px",textAlign:"right",color:p.up===null?T.tx3:T.bl}}>{p.up===null?"—":pc(p.up)}</td></tr>)}</tbody></table></div></Cd><Md open={md==="ib"} onClose={()=>setMd(null)} title="Agregar Posición"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>{[["tk","Ticker"],["n","Nombre"],["sh","Cantidad","number"],["cb","Costo unitario","number"],["pr","Precio actual","number"],["tg","Objetivo","number"]].map(([k,l,tp])=><In key={k} l={l} value={f[k]} onChange={v=>sF(p=>({...p,[k]:v}))} type={tp}/>)}
              <div style={{gridColumn:"1/-1"}}>
                <div style={{fontSize:11,color:T.tx3,marginBottom:6,fontWeight:600}}>Tipo de instrumento</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[{v:1,l:"Acción / ETF / Cripto",d:"El valor es cantidad × precio"},{v:100,l:"Opción",d:"Cada contrato equivale a 100 acciones"}].map(o=>
                    <button key={o.v} onClick={()=>sF(p=>({...p,mult:o.v}))} style={{flex:"1 1 200px",textAlign:"left",background:(+f.mult||1)===o.v?T.gn+"1a":T.bg3,border:"1px solid "+((+f.mult||1)===o.v?T.gn:T.border),borderRadius:10,padding:"10px 12px",cursor:"pointer",color:T.tx}}>
                      <div style={{fontSize:12.5,fontWeight:700}}>{o.l}</div>
                      <div style={{fontSize:10.5,color:T.tx3,marginTop:2}}>{o.d}</div>
                    </button>)}
                </div>
                {(+f.mult||1)===100&&+f.sh>0&&+f.pr>0&&<div style={{fontSize:11.5,color:T.gn,marginTop:8,fontFamily:"monospace"}}>
                  {f.sh} contrato{+f.sh===1?"":"s"} × ${f.pr} × 100 = {fm((+f.sh)*(+f.pr)*100)}
                </div>}
              </div></div><div style={{display:"flex",gap:12,justifyContent:"flex-end"}}><Bt v="s" onClick={()=>setMd(null)}>Cancelar</Bt><Bt onClick={()=>{add("ibk",{tk:f.tk||"",n:f.n||"",sh:+f.sh||0,cb:+f.cb||0,pr:+f.pr||0,tg:+f.tg||0,mult:+f.mult||1});setMd(null);sF({})}}>Agregar</Bt></div></Md></div>);
        case"gas":return isUS?<ExpensesModuleUS gastos={(u&&u.gas)||{}} onUpdate={v=>upd("gas",v)} agi={t.ti*12}/>:<GastosModule trm={trm||u?.trm||4200} owners={u?.owners||[]} ingresos={u?.ingresos||[]} gastos={(u&&u.gas)||{}} onUpdate={v=>upd("gas",v)} fmt={fm} onImport={()=>setShowImport(true)} plan={plan} onUpgrade={()=>setPg("price")} user={u} user={authUser}/>;
        case"deu":return isUS?<AssetsModuleUS inversiones={(u&&u.inv)||[]} deudas={(u&&u.deu)||[]} onUpdateAssets={v=>upd("inv",v)} onUpdateLiabs={v=>upd("deu",v)} initialTab="liabilities"/>:<DeudasModule trm={trm||u?.trm||4200} owners={u?.owners||[]} deudas={(u&&u.deu)||[]} inversiones={(u&&u.inv)||[]} onUpdate={v=>upd("deu",v)} fmt={fm} onImport={()=>setShowImport(true)} user={u} plan={plan} onUpgrade={()=>setPg("price")} user={authUser}/>;
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
      :<MetasModule metas={(u&&u.metas)||[]} onUpdate={v=>upd("metas",v)} cashFlow={t.cf} fmt={fm}/>;
    case"sim":return isUS?<SimuladorUS user={{ingresos:(u&&u.ingresos)||[],gastos:(u&&u.gas)||{},deudas:(u&&u.deu)||[],trm:u?.trm||1}} totals={t}/>:<SimuladorAvanzado impuestoData={estimarImpuesto(u)} user={{inv:(u&&u.inv)||[],gastos:(u&&u.gas)||{},deudas:(u&&u.deu)||[],ibkr:(u&&u.ibk)||[],trm:u?.trm||4200,ingresos:(u&&u.ingresos)||[],owners:(u&&u.owners)||[{id:"own_1",name:"Personal",type:"natural"}]}} totals={t} fmt={fm} onNavigate={setPg}/>;
    case"flujo":return <FlujoAnual user={u} trm={u?.trm||4200} isEN={isEN}/>;
    // Panel del dueño del producto — bloqueado por email en el cliente Y en la
    // función serverless (que además valida contra su propia lista de admins).
    case"metrics":return isAdmin?<AdminMetrics email={u?.p?.email} fmt={fm} T={T}/>:<div style={{padding:40,textAlign:"center",color:T.tx3}}>No disponible.</div>;
    case"pat":{const bc={};((u&&u.inv)||[]).filter(i=>i.sim!==false).forEach(i=>{const tp=inferType(i);bc[tp]=(bc[tp]||0)+vaCOP(i,trm)});if(ib.tv>0)bc.Trading=ib.tv*(trm||4200)/*💱 26-jul-2026: ib.tv está en USD porque las posiciones se cargan en dólares, pero se sumaba tal cual a una distribución donde todo lo demás pasó por vaCOP y está en pesos. Categoría en dólares mezclada entre categorías en pesos, y ~3.262 veces más chica de lo real.*/;const pie=Object.entries(bc).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);const gr=t.ab+ib.tv;return<div><PageHeader label="Patrimonio" title="Tus activos" subtitle="Distribución y rendimiento real."/><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:18}}><StatCard label="ACTIVOS TOTALES" value={fm(gr)} accent={CHART.green}/><StatCard label="PASIVOS" value={fm(t.td)} accent={CHART.red}/><StatCard label="PATRIMONIO NETO" value={fm(t.nw)} accent={CHART.blue} highlight/></div><div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:14}}><div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${CHART.border}`,borderRadius:16,padding:24,backgroundImage:`radial-gradient(circle at 0% 0%, ${CHART.green}08 0%, transparent 50%)`}}><div style={{fontSize:11,fontWeight:700,color:CHART.txt3,marginBottom:14,letterSpacing:"0.06em",textTransform:"uppercase"}}>Distribución</div>{pie.length>0?<ResponsiveContainer width="100%" height={240}><PieChart><Pie data={pie} dataKey="value" cx="50%" cy="50%" innerRadius={56} outerRadius={92} paddingAngle={3} stroke="none">{pie.map((_,i)=><Cell key={i} fill={CHART.series[i%CHART.series.length]}/>)}</Pie><Tooltip content={<ChartTooltip formatter={v=>fm(v)}/>}/></PieChart></ResponsiveContainer>:<div style={{height:240,display:"flex",alignItems:"center",justifyContent:"center",color:CHART.txt3}}>Agrega datos</div>}</div><div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${CHART.border}`,borderRadius:16,padding:24}}><div style={{fontSize:11,fontWeight:700,color:CHART.txt3,marginBottom:14,letterSpacing:"0.06em",textTransform:"uppercase"}}>Desglose por categoría</div>{pie.map((a,i)=>{const pct=(a.value/gr)*100;return<div key={a.name} style={{padding:"10px 0",borderBottom:i<pie.length-1?`1px solid ${CHART.border}`:"none"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:10,height:10,borderRadius:3,background:CHART.series[i%CHART.series.length],boxShadow:`0 0 8px ${CHART.series[i%CHART.series.length]}40`}}/><span style={{fontSize:13,fontWeight:500,color:CHART.txt}}>{a.name}</span></div><div style={{fontFamily:CHART.fontMono,fontVariantNumeric:"tabular-nums",display:"flex",alignItems:"baseline",gap:8}}><span style={{fontWeight:700,fontSize:13,color:CHART.txt}}>{fm(a.value)}</span><span style={{fontSize:11,color:CHART.txt3,minWidth:42,textAlign:"right"}}>{pct.toFixed(1)}%</span></div></div><div style={{height:3,background:CHART.border,borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:CHART.series[i%CHART.series.length],borderRadius:99,transition:"width 0.4s"}}/></div></div>})}</div></div></div>}
    case"pen":return isUS?<RetirementModuleUS user={u}/>:gated("pen","Básico",<PensionesColpensiones trm={(u&&u.trm)||4200}/>);
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
              showToast(`✅ Descuentos guardados para ${descOwner.name}`);
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
              showToast(`✅ Aportes guardados para ${aptOwner.name}`);
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
      return gated("tax","Pro",<DeclaracionFlow
        user={u}
        estimacion={estimarImpuesto(u)}
        onUpdateUser={(newUser)=>setU(newUser)}
        ano={2025}
      />);
    }
    case"famtax":return gated("tax","Pro",<VistaFamiliarConsolidada
      user={u}
      estimacion={estimarImpuesto(u)}
      ano={2025}
      onSelectOwner={()=>{setPg("tax")}}
    />);
    case"taxopt":return gated("tax","Pro",<TaxOptimizerUS user={u}/>);
    case"prevtax":return gated("tax","Pro",<DashboardFiscal
      user={authUser}
      u={u}
      owners={(u&&u.owners)||[]}
      estimacion={estimarImpuesto(u)}
      warnings={getFiscalWarnings(u)}
      onNavigate={setPg}
      onSaveDeclaracion={(ownerId,declaracion)=>{
        const owners=(u&&u.owners||[]).map(o=>{
          if(o.id!==ownerId)return o;
          const actuales=Array.isArray(o.declaraciones)?[...o.declaraciones]:[];
          const anoNuevo=Number(declaracion.anoGravable)||0;
          const idxMismoAno=actuales.findIndex(d=>Number(d?.anoGravable)===anoNuevo);
          if(idxMismoAno>=0){actuales[idxMismoAno]=declaracion}else{actuales.push(declaracion)}
          actuales.sort((a,b)=>(Number(b?.anoGravable)||0)-(Number(a?.anoGravable)||0));
          return{...o,declaraciones:actuales.slice(0,3)};
        });
        upd("owners",owners);
        const ow=owners.find(o=>o.id===ownerId);
        const n=ow?.declaraciones?.length||0;
        showToast("✅ Declaración guardada en "+(ow?.name||"owner")+" ("+n+"/3 años)");
      }}
      onMarkReviewed={(reviewKey)=>{
        const fr={...((u&&u.fiscalReviewed)||{}),[reviewKey]:{revisadoEn:new Date().toISOString()}};
        upd("fiscalReviewed",fr);
      }}
      onUnmarkReviewed={(reviewKey)=>{
        const fr={...((u&&u.fiscalReviewed)||{})};
        delete fr[reviewKey];
        upd("fiscalReviewed",fr);
      }}
      isPro={hasProAccess}
      onUpsell={()=>setPg("price")}
    />);
    case"aportes":return <AportesCalculadora fmt={fm}/>;
    case"glosario":return <GlosarioPage/>;
        // 03-ago-2026 (Santiago: "hagamos versión US completa"). El módulo de BTC
      // estaba oculto en US porque PensionColombia compara contra Colpensiones:
      // salarios mínimos, tasa de reemplazo, aporte obligatorio del 16%. Nada de
      // eso existe allá. Ahora cada jurisdicción tiene el suyo.
      case"norte":return gated("norte","Básico",<TuNorte user={u} totales={t} T={T} isEN={isEN}
        onGuardar={(n)=>setU(p=>p?{...p,norte:n}:p)}
        onReclasificar={(id,canasta)=>upd("inv",((u&&u.inv)||[]).map(i=>i.id===id?{...i,canastaManual:canasta}:i))} />);
      case"btc":return gated("btc","Básico",isUS?<BitcoinRetirementUS user={u}/>:<PensionColombia trm={(u&&u.trm)||4200}/>);
      case"buyvsinvest":return gated("buyvsinvest","Básico",<BuyVsInvest isUS={isUS}/>);
    case"asesor":{const _aInv=((u&&u.inv)||[]).filter(i=>i.sim!==false),_aDeu=((u&&u.deu)||[]).filter(d=>d.sim!==false),_aIng=((u&&u.ingresos)||[]).filter(i=>i.sim!==false),_aGas={};Object.entries((u&&u.gas)||{}).forEach(([cat,items])=>{const fi=(items||[]).filter(g=>g.sim!==false);if(fi.length>0)_aGas[cat]=fi});return gated("asesor","Pro",<AsesorIA user={{inv:_aInv,gas:_aGas,deu:_aDeu,ingresos:_aIng}} totals={t} userId={authUser?.id}/>);}
    case"coach":{const msgs=adv?getCoach(adv.id):[];return gated("coach","Pro",<div><PageHeader label="Coaches IA" title="5 asesores especializados" subtitle="Análisis cruzado de tu patrimonio. Solo se analizan ítems encendidos."/><div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginBottom:20}}>{ADV.map(a=>{const ac=adv?.id===a.id;return<button key={a.id} onClick={()=>sAdv(a)} style={{background:ac?`linear-gradient(135deg,${a.cl}20,${a.cl}10)`:T.card,border:`1px solid ${ac?a.cl:T.border}`,color:T.tx,padding:"14px 20px",borderRadius:14,cursor:"pointer",textAlign:"center",minWidth:90}}><div style={{fontSize:22,marginBottom:4}}>{a.av}</div><div style={{fontWeight:700,fontSize:11,color:ac?a.cl:T.tx}}>{a.nm}</div><div style={{fontSize:9,color:ac?`${a.cl}aa`:T.tx3}}>{a.ti}</div></button>})}</div><Cd>{adv?<div style={{padding:20}}><div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:14,borderBottom:`2px solid ${adv.cl}`,marginBottom:20}}><span style={{fontSize:28}}>{adv.av}</span><div><div style={{fontWeight:700,fontSize:15}}>{adv.nm}</div><div style={{fontSize:12,color:T.tx3}}>{adv.ti}</div></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:6,marginBottom:20}}>{[{l:"Patrimonio",v:fm(t.nw),c:T.tx},{l:"Cash Flow",v:fm(t.cf),c:t.cf>=0?T.gn:T.rd},{l:"Independencia",v:pc(t.ind),c:t.ind>=100?T.gn:T.tx2},{l:"Deuda/Act",v:pc(t.dta),c:t.dta<30?T.gn:T.rd}].map(m=><div key={m.l} style={{background:T.bg3,padding:8,borderRadius:8,borderLeft:`3px solid ${m.c}`}}><div style={{fontSize:9,color:T.tx3,textTransform:"uppercase"}}>{m.l}</div><div style={{fontSize:15,fontWeight:700,color:m.c}}>{m.v}</div></div>)}</div>{msgs.map((msg,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:14}}><div style={{width:32,height:32,borderRadius:"50%",background:adv.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{adv.av}</div><div style={{flex:1,background:adv.bg,padding:"14px 18px",borderRadius:"0 14px 14px 14px",border:`1px solid ${adv.cl}10`}}><div style={{fontWeight:700,fontSize:13,color:adv.cl,marginBottom:6}}>{msg.t}</div><div style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",color:T.tx}}>{msg.c}</div></div></div>)}</div>:<div style={{padding:56,textAlign:"center",color:T.tx3}}><div style={{fontSize:40,marginBottom:12}}>👆</div><p>Selecciona un coach</p></div>}</Cd></div>)}
    case"price":{
      const isCO=!isUS;
      // Pricing es source-of-truth en src/lib/plans.js (refactor item #9
      // del backlog 28-abr-2026). Antes había duplicación entre App.jsx y
      // LandingPage.jsx que causó al menos 2 desincronizaciones (Pro
      // Familiar oculto en home + monedas distintas). Ahora ambos consumen
      // la misma definición. Cualquier cambio de precio/feature se hace
      // en plans.js únicamente.
      const plans=getPlansForApp({plan,isUS,trm:trm||4200,billingCycle,trialActive,trialDays});
      return<div>
        <div style={{textAlign:"center",marginBottom:32}}>
          <h2 style={{fontSize:26,fontWeight:800,margin:"0 0 8px"}}>{isUS?"Choose your plan":"Elige tu plan"}</h2>
          <p style={{color:T.tx3,fontSize:15}}>{isUS?"Family office tools for everyone":"Herramientas de family office al alcance de todos"}</p>
          <div style={{display:"inline-flex",background:T.bg3,borderRadius:10,padding:3,marginTop:16}}>
            {["mensual","anual"].map(c=>(
              <button key={c} onClick={()=>setBillingCycle(c)} style={{padding:"8px 24px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:billingCycle===c?T.gn:"transparent",color:billingCycle===c?"#000":T.tx3}}>{isUS?(c==="mensual"?"Monthly":"Annual (save 25%)"):(c==="mensual"?"Mensual":"Anual (ahorra 25%)")}</button>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"repeat(auto-fit, minmax(240px, 1fr))",gap:16,maxWidth:1200,margin:"0 auto"}}>
          {plans.map(pl=>(
            <Cd key={pl.n} s={{border:pl.ac?"2px solid "+T.gn:pl.comingSoon?"1px dashed "+T.border:"1px solid "+T.border,position:"relative",opacity:pl.comingSoon?0.95:1}}>
              {pl.ac&&<div style={{background:"linear-gradient(135deg,"+T.gn+",#16a34a)",color:"#fff",textAlign:"center",padding:"6px 0",fontSize:12,fontWeight:700}}>MÁS POPULAR</div>}
              {pl.comingSoon&&<div style={{background:"linear-gradient(135deg,#a78bfa,#3b82f6)",color:"#fff",textAlign:"center",padding:"6px 0",fontSize:12,fontWeight:700}}>PRONTO DISPONIBLE</div>}
              <div style={{padding:24}}>
                <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>{pl.n}</div>
                <div style={{fontSize:12,color:T.tx3,marginBottom:14,lineHeight:1.4,minHeight:32}}>{pl.tag}</div>
                <div style={{marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:pl.comingSoon?22:36,fontWeight:800,color:pl.ac?T.gn:pl.comingSoon?T.tx3:T.tx}}>{billingCycle==="anual"&&pl.pAnualTotal?pl.pAnualTotal:pl.p[billingCycle]}</span>
                    {billingCycle==="anual"&&pl.pAnualTotal
                      ?<span style={{color:T.tx3,fontSize:14,fontWeight:600}}>/año</span>
                      :(pl.pr[billingCycle]&&<span style={{color:T.tx3,fontSize:14,fontWeight:600}}>{pl.pr[billingCycle]}</span>)}
                  </div>
                  {pl.pRef&&pl.pRef[billingCycle]&&<div style={{fontSize:11,color:T.tx3,marginTop:2}}>{pl.pRef[billingCycle]} · cobro en dólares</div>}
                </div>
                {/* 25-jul-2026 (Santiago): "si uno elige un solo pago, que salga
                    la cifra completa; si cambiamos las reglas o los valores,
                    generamos rechazo".
                    Antes la tarjeta anual mostraba "$12 USD/mes" en grande y
                    Stripe cobraba $144 de una: la cifra prominente no era la que
                    se cobraba. Ahora manda el monto real del cobro y la
                    equivalencia mensual queda como referencia secundaria. */}
                {billingCycle==="anual"&&pl.save&&<div style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:T.gn,fontWeight:600}}>{pl.save} vs plan mensual</div>
                  <div style={{fontSize:11,color:T.tx3,marginTop:2}}>Un solo pago · equivale a {pl.p.anual} USD/mes</div>
                </div>}
                {billingCycle==="mensual"&&pl.save&&<div style={{fontSize:12,color:T.tx3,marginBottom:12}}>{isUS?"or pay annually & save 25%":"o paga anual y ahorra 25%"}</div>}
                {!pl.save&&<div style={{marginBottom:12}}/>}
                <div className="fp-fo-ancho" style={{background:T.bg3,padding:"8px 12px",borderRadius:8,fontSize:11,color:T.tx2,marginBottom:14,fontWeight:600}}>👤 {pl.users}</div>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                  {pl.f.map(f=><div key={f} style={{fontSize:12,color:T.tx2,lineHeight:1.5}}><span style={{color:T.gn,marginRight:6,fontWeight:700}}>✓</span>{f}</div>)}
                  {(pl.no||[]).map(f=><div key={f} style={{fontSize:12,color:T.tx3,lineHeight:1.5}}><span style={{color:T.tx3,marginRight:6}}>✗</span>{f}</div>)}
                </div>
                {pl.comingSoon?(
                  <Bt v="s" sz="m" st={{width:"100%",justifyContent:"center"}} onClick={()=>{window.location.href="mailto:soporte@finpathia.com?subject=Plan Pro Familiar — interesado&body=Hola, quiero entrar a la lista de espera del plan Pro Familiar para mi familia/equipo. Mi email: "+(u?.p?.email||"")}}>Únete a la lista de espera</Bt>
                ):(
                <Bt v={pl.cur?"s":pl.rank>pl.rankActual?"p":"s"} sz="m" st={{width:"100%",justifyContent:"center",opacity:(pl.cur||pl.rank===0)?0.55:1,cursor:(pl.cur||pl.rank===0)?"default":"pointer"}} onClick={()=>{if(!pl.cur&&pl.rank!==0)(async()=>{
                  try{
                    // PriceIds vienen de src/lib/plans.js (STRIPE_PRICE_IDS),
                    // source-of-truth única. Refactor item #9.
                    const priceId=STRIPE_PRICE_IDS[pl.n]?.[billingCycle];
                    if(!priceId)return;
                    // Email fallback: u?.p?.email puede no estar cargado para users
                    // recién signup. authUser.email SIEMPRE está si hay sesión.
                    const userEmail=u?.p?.email||authUser?.email||"";
                    const userIdReal=authUser?.id||"";
                    if(!userEmail){alert("Necesitamos tu email para procesar el pago. Completá tu perfil primero (Configuración → Datos personales) y volvé a intentar.");return;}
                    if(!userIdReal){alert("Sesión no detectada. Hacé logout/login y volvé a intentar.");return;}
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
                      alert("Error de Stripe (HTTP "+r.status+"):\n"+txt.slice(0,200)+"\n\nRevisá la consola del browser (F12) o contactá soporte@finpathia.com.");
                      return;
                    }
                    const d=await r.json();
                    if(d.url)window.location.href=d.url;
                    else alert("Error de Stripe: "+(d.error||"No se pudo crear la sesión")+". Si el problema persiste, escribinos a soporte@finpathia.com");
                  }catch(e){
                    console.error("[checkout] fetch failed:",e);
                    const isBlocked=e.message&&/blocked|aborted|failed|network|cors/i.test(e.message);
                    alert(
                      "Error conectando con Stripe: "+e.message+
                      (isBlocked?"\n\n⚠️ Posible AdBlocker o extensión del browser bloqueando la conexión.\nProbá:\n• Desactivar adblocker para finpathia.com\n• Abrir en modo incógnito\n• Probar con otro browser":"\n\nVerificá tu conexión. Detalle del error en consola (F12 → Console).")
                    );
                  }
                })()}}>{
                  // 25-jul-2026: el botón decía "Comenzar" en TODAS las tarjetas,
                  // incluida Free — que no tiene precio, así que era un botón
                  // muerto (el handler hace `if(!priceId)return`). Quien ya tenía
                  // plan no distinguía qué era mejorar y qué era bajar.
                  pl.cur ? "Tu plan actual"
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
        <div style={{textAlign:"center",marginTop:24,color:T.tx3,fontSize:13,lineHeight:1.8}}>
          🔒 Pagos seguros con Stripe • Cancela cuando quieras • Sin compromisos<br/>
          {isCO&&<><span style={{fontSize:11}}>🇨🇴 Conversión a TRM ≈ ${Math.round(trm||4200).toLocaleString("es-CO")} COP/USD · tu banco aplica su propia tasa al cargo en USD.</span><br/></>}
          💬 ¿Preguntas? Escríbenos a soporte@finpathia.com
        </div>
        <div style={{marginTop:32,padding:"20px 24px",background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.15)",borderRadius:14,textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#3b82f6",marginBottom:4}}>💼 ¿Sos asesor financiero o contador?</div>
          <div style={{fontSize:12,color:T.tx3,marginBottom:10}}>Tenemos planes para gestionar hasta 40+ clientes con workspace dedicado, white-label y soporte prioritario.</div>
          <a href="/asesores" style={{display:"inline-block",background:"transparent",border:"1px solid #3b82f6",color:"#3b82f6",padding:"8px 18px",borderRadius:8,fontSize:12,fontWeight:600,textDecoration:"none"}}>Ver planes para asesores →</a>
        </div>
      </div>}
    case"resumen":{
      const nwUSD=trm>0?t.nw/trm:t.nw/4200;
      // BUG FIX 13-jun-2026: mismo bug del PDF — esta vista también sumaba
      // items con sim===false. Ahora filtramos igual que en cT() para que la
      // vista sea consistente con los KPIs del Dashboard.
      const passI=((u&&u.ingresos)||[]).filter(i=>i.sim!==false).filter(i=>i.sim!==false&&["Arriendo","Rendimiento","Dividendos"].includes(i.categoria)).reduce((s,i)=>s+(i.mensual||0),0);
      const passR=t.ti>0?(passI/t.ti*100):0;
      const totalInv=((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((s,i)=>s+vcCOP(i,trm),0);
      const totalVal=((u&&u.inv)||[]).filter(i=>i.sim!==false).reduce((s,i)=>s+vaCOP(i,trm),0);
      const gainPct=totalInv>0?((totalVal/totalInv)-1)*100:0;
      const fireN=t.gfm*12*25;
      const fireProg=fireN>0?Math.min((t.nw/fireN)*100,100):0;
      const fecha=new Date().toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"});
      return<div style={{maxWidth:800,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <button onClick={()=>setPg("dash")} style={{background:T.bg3,border:"none",color:T.tx2,padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13}}>← Dashboard</button>
          <button onClick={generatePDF} style={{background:T.gn,color:"#000",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>📄 Reporte PDF</button>
        </div>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:20,padding:"clamp(16px, 4vw, 32px)"}}>
          <div style={{borderBottom:"2px solid "+T.gn,paddingBottom:16,marginBottom:20}}>
            <div style={{fontSize:"clamp(18px, 5vw, 22px)",fontWeight:800,color:T.gn}}>FINPATHIA — Resumen Ejecutivo</div>
            <div style={{fontSize:13,color:T.tx3,marginTop:4}}>{u?.p?.name||"Usuario"} • {fecha}</div>
          </div>

          {/* Fase 3 (4-jul-2026): KPIs top del Resumen ahora reflejan el
              nuevo modelo family office. Muestran Patrimonio + Disponible
              (protagonista) + Independencia. El desglose Bruto→Retención→
              Disponible y Egresos por categoría va debajo en cards separadas. */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))",gap:12,marginBottom:20}}>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:10,color:T.tx3,letterSpacing:1,fontWeight:600}}>PATRIMONIO NETO</div>
              <div style={{fontSize:24,fontWeight:800,color:T.gn,marginTop:4}}>{fm(t.nw)}</div>
              <div style={{fontSize:10,color:T.tx3}}>≈ USD ${Math.round(nwUSD).toLocaleString("en-US")}</div>
            </div>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:10,color:T.tx3,letterSpacing:1,fontWeight:600}}>DISPONIBLE EN CUENTA</div>
              <div style={{fontSize:24,fontWeight:800,color:T.gn,marginTop:4}}>{fm(t.disponibleCuenta||t.ni||0)}</div>
              <div style={{fontSize:10,color:T.tx3}}>mensual, tras retención</div>
            </div>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:10,color:T.tx3,letterSpacing:1,fontWeight:600}}>CASH FLOW</div>
              <div style={{fontSize:24,fontWeight:800,color:t.cf>=0?T.gn:T.rd,marginTop:4}}>{fm(t.cf)}</div>
              <div style={{fontSize:10,color:T.tx3}}>{fm(t.cf*12)}/año</div>
            </div>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:10,color:T.tx3,letterSpacing:1,fontWeight:600}}>INDEPENDENCIA</div>
              <div style={{fontSize:24,fontWeight:800,color:t.ind>=100?T.gn:"#eab308",marginTop:4}}>{(t.ind).toFixed(0)}%</div>
              <div style={{fontSize:9,color:T.tx3}}>flujo: ingresos vs gastos hoy</div>
              <div style={{fontSize:10,color:T.tx3,marginTop:3}}>FIRE: {fireProg.toFixed(0)}% · capital para no trabajar</div>
            </div>
          </div>

          {/* Desglose Bruto → Retención → Disponible + Egresos por línea */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(280px, 100%), 1fr))",gap:14,marginBottom:24}}>
            {/* Ingresos con desglose */}
            <div style={{background:T.bg3,borderRadius:12,padding:16}}>
              <div style={{fontSize:10,color:T.tx3,letterSpacing:1.2,fontWeight:700,textTransform:"uppercase",marginBottom:12}}>💰 Ingresos mensuales</div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                <span style={{color:T.tx2}}>Bruto Total</span>
                <span style={{fontFamily:"monospace",color:T.tx}}>{fm(t.brutoTotal||t.ti||0)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:10,paddingLeft:8,borderLeft:`2px solid ${T.border}`}}>
                <span style={{color:"#a78bfa"}}>− Retención <span style={{fontSize:9,opacity:0.7}}>(recuperable)</span></span>
                <span style={{fontFamily:"monospace",color:"#a78bfa"}}>−{fm(t.retencionMensual||0)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
                <span style={{color:T.gn}}>= DISPONIBLE</span>
                <span style={{fontFamily:"monospace",color:T.gn}}>{fm(t.disponibleCuenta||t.ni||0)}</span>
              </div>
            </div>

            {/* Egresos con desglose 4 líneas */}
            <div style={{background:T.bg3,borderRadius:12,padding:16}}>
              <div style={{fontSize:10,color:T.tx3,letterSpacing:1.2,fontWeight:700,textTransform:"uppercase",marginBottom:12}}>💸 Egresos mensuales</div>
              {[
                {l:"A. Aportes obligatorios",v:t.aportesObligatorios||0,c:"#f59e0b"},
                {l:"B. Gastos familiares",v:t.gastosFamiliares||0,c:T.tx2},
                {l:"C. Cuotas de deudas",v:t.cuotasDeudas||0,c:T.tx2},
                {l:"D. Impuesto neto estimado (post-retención)",v:t.impuestoNeto||0,c:"#a78bfa"},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:5,opacity:r.v>0?1:0.5}}>
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
              <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>💰 Ingresos mensuales</div>
              {((u&&u.ingresos)||[]).filter(i=>i.sim!==false).filter(i=>i.sim!==false&&(i.mensual||0)>0).sort((a,b)=>(b.mensual||0)-(a.mensual||0)).slice(0,6).map((i,idx)=>(
                <div key={idx} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid "+T.border}}>
                  <span style={{color:T.tx2}}>{i.nombre}</span>
                  <span style={{fontWeight:600,fontFamily:"monospace",color:T.gn}}>{fm(i.mensual||0)}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",fontWeight:700}}>
                <span>Total</span><span style={{color:T.gn}}>{fm(t.ti)}/mes</span>
              </div>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>💳 Egresos principales</div>
              {Object.entries((u&&u.gas)||{}).map(([cat,items])=>({cat,total:(items||[]).filter(g=>g.sim!==false).reduce((s,g)=>s+(g.m||0),0)})).filter(g=>g.total>0).sort((a,b)=>b.total-a.total).slice(0,5).map((g,idx)=>(
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
                <span>Total</span><span style={{color:T.rd}}>{fm(t.te)}/mes</span>
              </div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(140px, 100%), 1fr))",gap:10,marginBottom:24}}>
            {[
              {l:"Activos",v:fm(totalVal),c:T.gn},
              {l:"Deuda total",v:fm(t.td),c:T.rd},
              {l:"Valorización",v:(gainPct>=0?"+":"")+gainPct.toFixed(1)+"%",c:gainPct>=0?T.gn:T.rd},
              {l:"Ingreso pasivo",v:passR.toFixed(0)+"%",c:passR>=80?T.gn:"#eab308"},
            ].map(k=>(
              <div key={k.l} style={{textAlign:"center",padding:10,background:T.bg3,borderRadius:8}}>
                <div style={{fontSize:9,color:T.tx3}}>{k.l}</div>
                <div style={{fontSize:16,fontWeight:800,color:k.c,marginTop:2}}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>🏦 Patrimonio por tipo</div>
            {(() => {
              const byType={};((u&&u.inv)||[]).filter(i=>i.sim!==false).forEach(i=>{const tp=i.tp||i.tipo||"Otro";byType[tp]=(byType[tp]||0)+vaCOP(i,trm)});
              return Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([tp,val],idx)=>{
                const pct=totalVal>0?(val/totalVal*100):0;
                return(
                  <div key={tp} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div style={{width:8,height:8,borderRadius:2,background:T.ch[idx%T.ch.length],flexShrink:0}}/>
                    <span style={{fontSize:12,color:T.tx2,flex:1}}>{tp}</span>
                    <div style={{width:120,height:6,background:T.bg3,borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:pct+"%",background:T.ch[idx%T.ch.length],borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:11,color:T.tx3,minWidth:70,textAlign:"right",fontFamily:"monospace"}}>{fm(val)} ({pct.toFixed(0)}%)</span>
                  </div>
                );
              });
            })()}
          </div>

          {((u&&u.deu)||[]).filter(d=>d.sim!==false).length>0&&<div style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>📋 Obligaciones financieras</div>
            {((u&&u.deu)||[]).filter(d=>d.sim!==false).map((d,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid "+T.border}}>
                <span style={{color:T.tx2}}>{d.n||d.nombre||"Deuda"} <span style={{color:T.tx3}}>({d.ts||0}%)</span></span>
                <div><span style={{color:T.rd,fontFamily:"monospace"}}>{fm(d.mt||0)}</span><span style={{color:T.tx3,marginLeft:8}}>cuota: {fm(d.pg||0)}</span></div>
              </div>
            ))}
          </div>}

          <div style={{background:"linear-gradient(135deg,rgba(34,197,94,0.06),rgba(59,130,246,0.03))",border:"1px solid rgba(34,197,94,0.1)",borderRadius:12,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,color:T.gn,marginBottom:8}}>📌 Diagnóstico</div>
            <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
              {t.ind>=100?"✅ Tus ingresos cubren el 100% de tus gastos y deudas. Estás en nivel de independencia financiera.":"⚠ Tus ingresos cubren el "+t.ind.toFixed(0)+"% de tus gastos. Te falta "+fm(t.te-t.ni)+"/mes para independencia total."}
              <br/>{t.cf>=0?"✅ Cash flow positivo de "+fm(t.cf)+"/mes disponible para inversión.":"❌ Cash flow negativo. Gastas "+fm(Math.abs(t.cf))+"/mes más de lo que ganas."}
              <br/>{passR>=80?"✅ El "+passR.toFixed(0)+"% de tus ingresos son pasivos. Excelente independencia.":"📈 Solo el "+passR.toFixed(0)+"% es ingreso pasivo. Meta: superar 80%."}
              <br/>{fireProg>=100?"🏆 Ya superaste tu FIRE number. Puedes vivir de tu patrimonio 25+ años.":"🔥 FIRE progress: "+fireProg.toFixed(0)+"%. Meta: "+fm(fireN)+". Te falta: "+fm(Math.max(0,fireN-t.nw))+"."}
            </div>
          </div>

          <div style={{textAlign:"center",marginTop:20,fontSize:10,color:T.tx3,borderTop:"1px solid "+T.border,paddingTop:12}}>
            FINPATHIA — Reporte generado el {fecha} • finpathia.com
          </div>
        </div>
      </div>}
    case"cuenta":
    case"set":{
    const cuentaConfig=<div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:20}}><Cd s={{padding:20}}><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 16px"}}>Perfil</h3><div style={{display:"flex",flexDirection:"column",gap:14}}><In l="Nombre" value={u?.p?.name||""} onChange={v=>setU(p=>({...p,p:{...p.p,name:v}}))}/><In l="Email" value={u?.p?.email||""} onChange={v=>setU(p=>({...p,p:{...p.p,email:v}}))}/><In l="TRM (Tasa de cambio USD→COP)" value={(u&&u.trm)} onChange={v=>setU(p=>({...p,trm:+v||4200}))} type="number"/>{(u?.jurisdiction||"CO")==="CO"&&<div><label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>Componente inflacionario (% exento rendimientos)</label><input type="number" step="0.01" value={u?.componenteInflacionarioPct!=null?u.componenteInflacionarioPct:50.88} onChange={e=>{const v=+e.target.value;if(!isNaN(v)&&v>=0&&v<=100)setU(p=>({...p,componenteInflacionarioPct:v}))}} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none"}}/><div style={{fontSize:10,color:T.tx3,marginTop:4,lineHeight:1.5}}>Art. 38-39 ET · Decreto 0771/2025: <strong>50,88%</strong> para año gravable 2024. Parte de intereses bancarios/CDT/FIC que NO constituye renta para persona natural no obligada a llevar contabilidad. Actualizable cuando la DIAN publique el decreto del próximo año.</div></div>}<div><label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>Jurisdicción fiscal</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[{code:"CO",flag:"🇨🇴",name:"Colombia"},{code:"US",flag:"🇺🇸",name:"United States"}].map(c=>{const sel=(u?.jurisdiction||"CO")===c.code;return<button key={c.code} type="button" onClick={()=>{if((u?.jurisdiction||"CO")===c.code)return;if(!confirm(`¿Cambiar jurisdicción fiscal a ${c.name}?\n\nEsto cambia las reglas fiscales, el módulo de pensiones (Colpensiones+RAIS vs 401k) y la planeación tributaria. Tus datos se conservan — solo cambia cómo se calculan y presentan.`))return;setU(p=>({...p,jurisdiction:c.code}));showToast(`✓ Jurisdicción cambiada a ${c.name}`)}} style={{padding:"10px 12px",borderRadius:8,border:"1px solid "+(sel?T.gn:T.border),background:sel?T.gnB:T.bg2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,color:sel?T.gn:T.tx2,fontWeight:sel?700:400,fontSize:12}}><span style={{fontSize:16}}>{c.flag}</span>{c.name}</button>})}</div><div style={{fontSize:10,color:T.tx3,marginTop:4,lineHeight:1.5}}>Define el módulo de pensiones, plan tributario y moneda por default.</div></div></div></Cd><Cd s={{padding:20}}><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 16px"}}>Datos</h3><div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{padding:12,background:T.bg3,borderRadius:10,fontSize:13}}><strong>Plan:</strong> {plan} {!hasProAccess&&<span onClick={()=>setPg("price")} style={{color:T.gn,cursor:"pointer",fontWeight:600}}> → Upgrade</span>}</div>{isAdmin&&<div style={{padding:12,background:T.bg3,borderRadius:10,fontSize:13}}><strong>Plan manual:</strong> <select value={(u?.p?.plan)||"free"} onChange={e=>setU(p=>({...p,p:{...p.p,plan:e.target.value}}))} style={{background:T.bg2,border:"1px solid "+T.border,color:T.tx,padding:"4px 8px",borderRadius:6,marginLeft:8}}><option value="free">Free</option><option value="basico">Básico</option><option value="pro">Pro</option><option value="pro_familiar">Pro Familiar</option></select></div>}<Bt v="s" onClick={()=>{if(((u&&u.inv)||[]).filter(i=>i.sim!==false).length>0||Object.keys((u&&u.gas)||{}).length>0){if(!confirm("⚠️ Esto reemplazará tus datos actuales con datos de ejemplo. ¿Continuar?"))return}demo()}} st={{justifyContent:"center"}}>Cargar datos demo</Bt><Bt v="s" onClick={()=>{const d=localStorage.getItem(SK);if(!d)return alert("No hay datos");const b=new Blob([d],{type:"application/json"});const u2=URL.createObjectURL(b);const a=document.createElement("a");a.href=u2;a.download="finpathia-backup-"+new Date().toISOString().split("T")[0]+".json";a.click()}} st={{justifyContent:"center"}}>📥 Exportar Datos (JSON)</Bt>
              <Bt v="s" onClick={()=>{try{const backups=JSON.parse(localStorage.getItem("fp3_backups")||"[]");if(!backups.length){alert("No hay backups disponibles");return}const last=backups[backups.length-1];const d=JSON.parse(last.data);if(confirm("¿Restaurar backup del "+new Date(last.date).toLocaleDateString("es-CO")+"? Esto reemplazará tus datos actuales.")){setU(sanitize(d));showToast("✅ Backup restaurado")}}catch{alert("Error restaurando backup")}}} st={{justifyContent:"center"}}>🔄 Restaurar último backup</Bt>
              <div style={{marginTop:12,padding:12,background:T.bg3,borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>🧾 Planeación Tributaria</div>
                <div style={{fontSize:11,color:T.tx3,marginBottom:10,lineHeight:1.6}}>Registra las personas o empresas <strong>en Colombia</strong> para las que quieras estimar impuestos. Al asignar un propietario a tus ingresos, la sección <strong>🧾 Impuestos</strong> calculará un aproximado del pago de renta por cada uno.<br/><br/>Es opcional: solo registra los que quieras analizar. Si tienes entidades en otros países (ej. USA), no las incluyas aquí.</div>
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
                    { count: pendIng, label: pendIng === 1 ? "ingreso" : "ingresos", emoji: "💰", page: "ing" },
                    { count: pendGas, label: pendGas === 1 ? "egreso" : "egresos", emoji: "💳", page: "gas" },
                    { count: pendDeu, label: pendDeu === 1 ? "deuda" : "deudas", emoji: "📋", page: "deu" },
                    { count: pendInv, label: pendInv === 1 ? "inversión" : "inversiones", emoji: "🏦", page: "inv" },
                  ].filter(s => s.count > 0);
                  return (
                    <div style={{marginBottom:12,padding:"12px 14px",background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:10}}>
                      <div style={{fontSize:11,fontWeight:700,color:T.or||"#f97316",marginBottom:6}}>🔧 Clasificación fiscal pendiente</div>
                      <div style={{fontSize:10,color:T.tx2,lineHeight:1.6,marginBottom:secciones.length>0?10:0}}>
                        {totalPend > 0 ? <>Hay <strong>{totalPend} item(s)</strong> sin clasificación fiscal explícita. El motor está usando inferencia automática, pero podés revisar y confirmar item por item directamente en cada sección para mayor precisión.</> : "Hay items con advertencias fiscales."}
                        {(errs > 0 || warnCount > 0) && <div style={{marginTop:4}}>{errs > 0 && <span style={{color:T.rd}}>• <strong>{errs} error(es)</strong> </span>}{warnCount > 0 && <span>• {warnCount} advertencia(s)</span>}</div>}
                      </div>
                      {secciones.length > 0 && (
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {secciones.map(s => (
                            <button key={s.page} onClick={()=>setPg(s.page)} style={{padding:"6px 10px",background:T.bg3,border:"1px solid "+T.border,borderRadius:6,color:T.tx,cursor:"pointer",fontSize:10,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
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
                    <span style={{fontSize:16}}>{ow.type==="juridica"?"🏢":"👤"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{ow.name}</div>
                      <div style={{fontSize:10,color:T.tx3}}>{ow.type==="juridica"?"Persona Jurídica":"Persona Natural"} · <span style={{color:T.bl}}>{regLabel}</span>{ow.type==="juridica"&&ow.perdidasFiscalesAcumuladas>0&&<span style={{color:T.gn,marginLeft:6}}>· 📉 {fm(ow.perdidasFiscalesAcumuladas)} pérdidas</span>}{ow.type==="juridica"&&ow.descuentosTributarios&&Object.values(ow.descuentosTributarios).some(v=>+v>0)&&<span style={{color:T.bl,marginLeft:6}}>· 💠 descuentos</span>}{ow.type==="natural"&&ow.aportes&&(+ow.aportes.segSocialIndependienteMensual>0||ow.aportes.salarioEsBruto===false)&&<span style={{color:T.or||T.bl,marginLeft:6}}>· ⚙️ ajustes avanzados</span>}</div>
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>{setU({...u,p:{...u.p,_editOwnerId:isEditing?null:ow.id}})}} style={{background:T.bg3,border:"1px solid "+T.border,color:T.tx2,cursor:"pointer",padding:"4px 8px",borderRadius:6,fontSize:10}}>{isEditing?"✖️ Cerrar":"✏️ Editar"}</button>
                      {i>0&&<button onClick={()=>{if(confirm("¿Eliminar "+ow.name+"?")){const nw=(u.owners||[]).filter(o=>o.id!==ow.id);setU({...u,owners:nw});showToast("Propietario eliminado")}}} style={{background:T.bg3,border:"1px solid "+T.border,color:T.rd,cursor:"pointer",padding:"4px 8px",borderRadius:6,fontSize:10}}>🗑️</button>}
                    </div>
                  </div>
                  {isEditing&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed "+T.border,display:"flex",flexDirection:"column",gap:10}}>
                    <div>
                      <label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:4}}>Nombre</label>
                      <input defaultValue={ow.name} id={"own_name_"+ow.id} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none"}}/>
                    </div>
                    <div>
                      <label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:4}}>Régimen tributario</label>
                      <select defaultValue={ow.regimen||"ordinario"} id={"own_reg_"+ow.id} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer"}}>
                        {regs.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
                      </select>
                      <div style={{fontSize:10,color:T.tx3,marginTop:4,lineHeight:1.4}}>El régimen determina la tarifa aplicable. Si no estás seguro, consultá con tu contador.</div>
                    </div>
                    {ow.type==="juridica"&&<>
                      <div style={{marginTop:6,paddingTop:10,borderTop:"1px dashed "+T.border}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.bl,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>🧾 Datos declaración anterior (opcional)</div>
                        <div style={{fontSize:10,color:T.tx3,marginBottom:10,lineHeight:1.4}}>Si tu contador te pasa estos datos de la declaración del año anterior, el simulador los aplica según el Estatuto Tributario.</div>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:4}}>Pérdidas fiscales acumuladas — Art. 147 ET</label>
                        <input type="number" defaultValue={ow.perdidasFiscalesAcumuladas||""} id={"own_perd_"+ow.id} placeholder="Ej: 250000000" style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none"}}/>
                        <div style={{fontSize:10,color:T.tx3,marginTop:4,lineHeight:1.4}}>Pérdidas fiscales de años anteriores que no se han compensado. Se compensan contra la utilidad de este año sin límite temporal.</div>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:4}}>Descuentos tributarios — Art. 256-259 ET</label>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                          <input type="number" defaultValue={ow.descuentosTributarios?.cti||""} id={"own_desc_cti_"+ow.id} placeholder="CT&I (Art. 158-1)" style={{background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:11,outline:"none"}}/>
                          <input type="number" defaultValue={ow.descuentosTributarios?.empleo||""} id={"own_desc_emp_"+ow.id} placeholder="Empleo 1ra vez (Art. 108-5)" style={{background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:11,outline:"none"}}/>
                          <input type="number" defaultValue={ow.descuentosTributarios?.exterior||""} id={"own_desc_ext_"+ow.id} placeholder="Impuestos exterior (Art. 254)" style={{background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:11,outline:"none"}}/>
                          <input type="number" defaultValue={ow.descuentosTributarios?.donaciones||""} id={"own_desc_don_"+ow.id} placeholder="Donaciones 25% (Art. 257)" style={{background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:11,outline:"none"}}/>
                          <input type="number" defaultValue={ow.descuentosTributarios?.otros||""} id={"own_desc_otr_"+ow.id} placeholder="Otros descuentos" style={{gridColumn:"1/-1",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:11,outline:"none"}}/>
                        </div>
                        <div style={{fontSize:10,color:T.tx3,marginTop:4,lineHeight:1.4}}>Valores en $ que tu contador declaró como descuentos directos del impuesto. Sujetos al tope del 25% del impuesto bruto (Art. 259 ET).</div>
                      </div>
                    </>}
                    {ow.type==="natural"&&<>
                      <div style={{marginTop:6,paddingTop:10,borderTop:"1px dashed "+T.border}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.bl,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>📋 Régimen tributario personal (opcional)</div>
                        <div style={{fontSize:10,color:T.tx3,marginBottom:10,lineHeight:1.4}}>Estos datos afectan la clasificación por cédula de tus honorarios y tu elegibilidad para depreciar activos (Art. 206 #10 y 128 ET).</div>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:4}}>¿Tenés 2+ empleados contratados ≥83% del año? (Art. 206 #10)</label>
                        <select defaultValue={ow.regimenHonorarios||"no_aplica"} id={"own_regh_"+ow.id} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer"}}>
                          <option value="no_aplica">No aplica — no tengo honorarios</option>
                          <option value="sin_empleados">Sin 2+ empleados — honorarios tributan sin exenta 25%</option>
                          <option value="con_empleados">Con 2+ empleados ≥83% del año — aplica exenta 25%</option>
                        </select>
                        <div style={{fontSize:10,color:T.tx3,marginTop:4,lineHeight:1.4}}>Si tus honorarios califican (Art. 206 #10), podés descontar la renta exenta del 25%. Afecta el impuesto en tus ingresos por honorarios.</div>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:4}}>¿Obligado o voluntariamente llevás contabilidad? (Art. 38-39, 128 ET)</label>
                        <select defaultValue={ow.llevaContabilidad?"si":"no"} id={"own_contab_"+ow.id} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer"}}>
                          <option value="no">No (default para persona natural común)</option>
                          <option value="si">Sí (empresario, RUT con contabilidad)</option>
                        </select>
                        <div style={{fontSize:10,color:T.tx3,marginTop:4,lineHeight:1.4}}>Si llevás contabilidad, podés depreciar activos (Art. 128 ET), pero pierdes el componente inflacionario de rendimientos (Art. 38-39 ET). La mayoría de las personas naturales NO llevan contabilidad.</div>
                      </div>
                      <div style={{marginTop:6,paddingTop:10,borderTop:"1px dashed "+T.border}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.or||T.bl,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>⚙️ Ajustes fiscales avanzados (opcional)</div>
                        <div style={{fontSize:10,color:T.tx3,marginBottom:10,lineHeight:1.4}}>Los aportes de pensión y salud obligatorias se editan dentro de cada salario en Ingresos. La Pensión Voluntaria, AFC y salud prepagada se registran como egresos con categoría "Aporte tributario". Los dos campos de abajo son para casos especiales que no encajan en ninguno de esos lugares.</div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:8}}>
                        <div>
                          <label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:4}}>SS independiente total /mes</label>
                          <input type="number" defaultValue={ow.aportes?.segSocialIndependienteMensual||""} id={"own_apt_ind_"+ow.id} placeholder="Auto: 4% del IBC (40% honorarios)" style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:11,outline:"none"}}/>
                        </div>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:4}}>¿Tu salario en Ingresos es bruto o neto?</label>
                        <select defaultValue={ow.aportes?.salarioEsBruto===false?"neto":"bruto"} id={"own_apt_bruto_"+ow.id} style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"8px 10px",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer"}}>
                          <option value="bruto">Bruto (antes de aportes — recomendado)</option>
                          <option value="neto">Neto (después de aportes — se hace gross-up)</option>
                        </select>
                        <div style={{fontSize:10,color:T.tx3,marginTop:4,lineHeight:1.4}}>Si registras tu salario neto (lo que cae a la cuenta), marca "Neto" y FINPATHIA sumará los aportes para calcular el salario gravable correcto.</div>
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
                        showToast("✅ "+nm+" actualizado");
                      }} style={{flex:1,padding:"8px",background:T.gn,border:"none",borderRadius:6,color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>Guardar cambios</button>
                      <button onClick={()=>{setU({...u,p:{...u.p,_editOwnerId:null}})}} style={{padding:"8px 14px",background:T.bg3,border:"1px solid "+T.border,borderRadius:6,color:T.tx2,cursor:"pointer",fontSize:12}}>Cancelar</button>
                    </div>
                  </div>}
                </div>})}
                <div style={{marginTop:8,padding:12,background:T.bg,borderRadius:10,border:"1px dashed "+T.border}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.tx2,marginBottom:8}}>Agregar propietario</div>
                  <input id="new_owner_name" placeholder="Nombre (ej: Mi empresa SAS)" style={{width:"100%",background:T.bg3,border:"1px solid "+T.border,color:T.txt,padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none",marginBottom:8}}/>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{const el=document.getElementById("new_owner_name");const nm=el?.value?.trim();if(!nm){showToast("Escribe un nombre");return}const nw=[...(u.owners||[]),{id:"own_"+Date.now(),name:nm,type:"natural",regimen:"ordinario"}];setU({...u,owners:nw});el.value="";showToast("✅ "+nm+" agregado como Persona Natural")}} style={{flex:1,padding:"10px",background:T.bg3,border:"1px solid "+T.border,borderRadius:8,color:T.gn,cursor:"pointer",fontSize:12,fontWeight:600}}>👤 Natural</button>
                    <button onClick={()=>{const el=document.getElementById("new_owner_name");const nm=el?.value?.trim();if(!nm){showToast("Escribe un nombre");return}const nw=[...(u.owners||[]),{id:"own_"+Date.now(),name:nm,type:"juridica",regimen:"ordinario"}];setU({...u,owners:nw});el.value="";showToast("✅ "+nm+" agregado como Persona Jurídica")}} style={{flex:1,padding:"10px",background:T.bg3,border:"1px solid "+T.border,borderRadius:8,color:T.bl,cursor:"pointer",fontSize:12,fontWeight:600}}>🏢 Jurídica</button>
                  </div>
                </div>
              </div>
              <div style={{marginTop:12,padding:12,background:T.bg3,borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>🔐 Encriptación End-to-End</div>
                <div style={{fontSize:11,color:T.tx3,marginBottom:8}}>{localStorage.getItem("fp3_enc_key")?"✅ Activa — Tus datos se encriptan con tu contraseña antes de salir de tu navegador. Ni FINPATHIA puede leerlos.":"⚠️ Solo disponible con cuenta. En Modo Privado tus datos nunca salen del navegador."}</div>
              </div>
              <div style={{marginTop:12,padding:12,background:T.bg3,borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>🔒 PIN de seguridad</div>
                <div style={{fontSize:11,color:T.tx3,marginBottom:8}}>Bloquea la app después de 15 minutos de inactividad. Nadie puede ver tus datos sin el PIN.</div>
                {localStorage.getItem("fp3_pin")?
                  <div style={{display:"flex",gap:8}}><Bt v="s" sz="s" onClick={()=>{if(confirm("¿Desactivar PIN de seguridad?"))localStorage.removeItem("fp3_pin");showToast("PIN desactivado")}} st={{flex:1,justifyContent:"center"}}>Desactivar PIN</Bt><Bt v="s" sz="s" onClick={()=>{const p=prompt("Nuevo PIN (4 dígitos):");if(p&&p.length===4&&/^\d{4}$/.test(p)){localStorage.setItem("fp3_pin",p);showToast("✅ PIN actualizado")}else if(p)alert("El PIN debe ser 4 dígitos")}} st={{flex:1,justifyContent:"center"}}>Cambiar PIN</Bt></div>
                  :<Bt v="s" onClick={()=>{const p=prompt("Crea un PIN de 4 dígitos:");if(p&&p.length===4&&/^\d{4}$/.test(p)){localStorage.setItem("fp3_pin",p);showToast("✅ PIN activado — se bloquea tras 15 min")}else if(p)alert("El PIN debe ser 4 dígitos")}} st={{justifyContent:"center"}}>Activar PIN de seguridad</Bt>}
              </div>
              <Bt v="s" onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept=".json";inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);localStorage.setItem(SK,JSON.stringify(d));setU(sanitize(d));alert("✅ Datos importados correctamente. Recarga la página.")}catch{alert("Error: archivo no válido")}};r.readAsText(f)};inp.click()}} st={{justifyContent:"center"}}>📤 Importar Datos (JSON)</Bt>
              <Bt v="d" onClick={()=>{if(confirm("⚠️ ¿Borrar TODOS tus datos financieros? Esta acción no se puede deshacer. Tus inversiones, gastos, ingresos y deudas se perderán."))setU(mkU(u?.p?.name||"Usuario",u?.p?.email||""))}} st={{justifyContent:"center"}}>Borrar Datos</Bt></div></Cd></div>;
    return <MiCuenta onUpgrade={()=>setPg("price")} supabase={supabase} accountId={accountId} role={role} displayName={displayName} plan={planAccount} maxMembers={maxMembers} currentUserId={authUser?.id} currentUserName={u?.p?.name||authUser?.user_metadata?.name||authUser?.email?.split("@")[0]||"El administrador"} onChange={refreshAccount} isLegacy={isLegacy} configContent={cuentaConfig} defaultTab={pg==="set"?"config":undefined} subscriptionStatus={subscriptionStatus} graceUntil={graceUntil}/>;}
    default:return<div style={{padding:56,textAlign:"center",color:T.tx3}}>Próximamente</div>}};

  return <RoleProvider value={{role,isLegacy,accountId}}><div style={{background:T.bg,minHeight:"100vh",display:"flex",fontFamily:"'Inter',system-ui",color:T.tx}}>
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
    {sb&&<aside style={{width:220,minWidth:220,height:"100vh",position:mb?"fixed":"sticky",top:0,background:T.bg2,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",zIndex:100,overflowY:"auto"}}><div style={{padding:"20px 18px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontSize:16,fontWeight:800,color:T.gn}}>FINPATHIA</div>{mb&&<button onClick={()=>sSb(false)} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:16}}>✕</button>}</div><nav style={{flex:1,padding:"0 8px"}}>{nvs.map(n=>{if(n.hidden)return null;
            if(n.sep)return<div key={n.id} style={{padding:n.l?"10px 12px 4px":"6px 0",fontSize:9,fontWeight:700,color:T.tx3,letterSpacing:"0.1em",borderTop:n.l?`1px solid ${T.border}`:"none",marginTop:n.l?4:0}}>{n.l||""}</div>;
            // Sub-item del menú desplegable: solo se muestra si el padre está expandido o si el sub-item es la página actual
            if(n.parent){
              const parentExpanded=expandedMenus[n.parent]||pg===n.id;
              if(!parentExpanded)return null;
              const a=pg===n.id;
              return<button key={n.id} onClick={()=>{setPg(n.id);if(mb)sSb(false)}} style={{width:"calc(100% - 12px)",marginLeft:12,display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:a?600:400,marginBottom:1,background:a?T.gnB:"transparent",color:a?T.gn:T.tx2,transition:"all .15s",borderLeft:`2px solid ${a?T.gn:T.border}`}}><span style={{fontSize:13}}>{n.i}</span>{n.l}</button>;
            }
            // Item con hijos (menú desplegable): clickear navega Y expande/colapsa
            if(n.hasChildren){
              const a=pg===n.id;
              const childActive=nvs.some(x=>x.parent===n.id&&pg===x.id);
              const expanded=expandedMenus[n.id]||a||childActive;
              const highlight=a||childActive;
              return<button key={n.id} onClick={()=>{
                setPg(n.id);
                setExpandedMenus(prev=>({...prev,[n.id]:!prev[n.id]}));
                if(mb)sSb(false);
              }} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:highlight?600:400,marginBottom:1,background:highlight?T.gnB:"transparent",color:highlight?T.gn:T.tx2,transition:"all .15s"}}><span style={{fontSize:14}}>{n.i}</span><span style={{flex:1,textAlign:"left"}}>{n.l}</span><span style={{fontSize:10,color:T.tx3,transform:expanded?"rotate(90deg)":"none",transition:"transform 0.15s"}}>▸</span></button>;
            }
            const a=pg===n.id;return<button key={n.id} onClick={()=>{setPg(n.id);if(mb)sSb(false)}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:a?600:400,marginBottom:1,background:a?T.gnB:"transparent",color:a?T.gn:T.tx2,transition:"all .15s"}}><span style={{fontSize:14}}>{n.i}</span>{n.l}{n.id==="price"&&plan==="free"&&<span style={{marginLeft:"auto",background:T.gn,color:"#000",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:99}}>PRO</span>}</button>})}</nav><div style={{padding:12,borderTop:`1px solid ${T.border}`}}><div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:8}}><div style={{width:28,height:28,borderRadius:99,background:T.gnB,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:T.gn}}>{(u?.p?.name||"U").charAt(0)}</div><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{u?.p?.name||"Usuario"}</div><div style={{fontSize:10,color:T.tx3}}>{plan==="free"?"Free":plan==="basico"?"Básico ⚡":plan==="pro_familiar"?"Pro Familiar 👨‍👩‍👧":trialActive?"Pro ⭐ Trial":"Pro ⭐"}</div></div></div><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",marginBottom:6,fontSize:10,color:T.tx3}}><span>🔒</span> Datos encriptados y privados</div><button onClick={()=>window.open("https://wa.me/?text=🏦 Encontré esta plataforma para gestionar tu patrimonio con inteligencia artificial.%0A%0APones tus inversiones, ingresos, gastos y deudas → te dice en qué nivel de libertad financiera estás, simula escenarios y un asesor IA analiza tus números reales.%0A%0A14 días gratis del plan completo, sin tarjeta.%0A%0A👉 https://finpathia.com","_blank")} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(37,211,102,0.1)",border:"1px solid rgba(37,211,102,0.2)",color:"#25d366",cursor:"pointer",padding:"8px",borderRadius:8,fontSize:12,marginBottom:6}}>💬 Compartir por WhatsApp</button><button onClick={logout} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:T.bg3,border:"1px solid "+T.border,color:T.tx3,cursor:"pointer",padding:"8px",borderRadius:8,fontSize:12}}>🚪 Cerrar sesión</button></div></aside>}
    {mb&&sb&&<div onClick={()=>sSb(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99}}/>}
    <main style={{flex:1,minWidth:0,display:"flex",flexDirection:"column"}}>{isAdvisor&&viewMode==="client"&&currentClient&&<div style={{background:"linear-gradient(135deg,rgba(59,130,246,0.18),rgba(167,139,250,0.14))",borderBottom:"2px solid rgba(59,130,246,0.4)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,gap:12,flexWrap:"wrap"}}><span style={{color:"#bfdbfe",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14}}>👁</span><span><strong style={{color:"#fff"}}>Viendo como asesor:</strong> {currentClient.name||currentClient.email} <span style={{opacity:0.7}}>({currentClient.email})</span></span></span><button onClick={returnToAdvisorWorkspace} style={{background:"linear-gradient(135deg,#3b82f6,#a78bfa)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11}}>← Volver a mis clientes</button></div>}{isAdvisor&&viewMode==="personal"&&<div style={{background:"linear-gradient(135deg,rgba(59,130,246,0.12),rgba(167,139,250,0.10))",borderBottom:"1px solid rgba(59,130,246,0.25)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,gap:12,flexWrap:"wrap"}}><span style={{color:"#93c5fd",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14}}>📊</span><span>Modo personal — gestionas tu propio patrimonio.</span></span><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>{setViewMode("workspace");setCurrentClientId(null)}} style={{background:"linear-gradient(135deg,#3b82f6,#a78bfa)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11}}>👥 Ir a mis clientes</button></div></div>}{u?.p?.demo&&<div style={{background:"linear-gradient(135deg,rgba(249,115,22,0.1),rgba(234,179,8,0.08))",borderBottom:"1px solid rgba(249,115,22,0.2)",padding:"8px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,gap:10,flexWrap:"wrap"}}><span style={{color:T.orange}}>📊 Estos son <strong>datos de ejemplo</strong>, no los tuyos{authUser?" — tu cuenta sigue vacía":""}.</span>{authUser?<button onClick={()=>{if(!confirm("Se borran los datos de ejemplo y arrancás con tu cuenta en blanco. ¿Seguimos?"))return;setU(mkU(u?.p?.name||"Usuario",u?.p?.email||""));setPg("dash");showToast("✨ Listo — ahora cargá tus datos reales")}} style={{background:T.gn,color:"#000",border:"none",padding:"6px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11}}>Empezar con mis datos →</button>:<button onClick={()=>{setPg("price")}} style={{background:T.gn,color:"#000",border:"none",padding:"6px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11}}>Crear cuenta para guardar →</button>}</div>}{!isLegacy&&role==="reader"&&viewMode!=="client"&&<RoleBanner accountName={displayName}/>}<header style={{height:52,padding:"0 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`,background:T.bg2,position:"sticky",top:0,zIndex:50}}><div style={{display:"flex",alignItems:"center",gap:6}}>{(!sb||mb)&&<button onClick={()=>sSb(true)} title="Abrir menú" style={{background:"none",border:"none",color:T.tx2,cursor:"pointer",fontSize:20,padding:"4px 8px"}}>☰</button>}{!sb&&!mb&&<span style={{fontSize:14,fontWeight:800,color:T.gn,marginLeft:4}}>FINPATHIA</span>}</div><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"nowrap",minWidth:0}}>{!isLegacy&&memberships&&memberships.length>1&&viewMode!=="client"&&<AccountSwitcher memberships={memberships} activeAccountId={accountId} onSwitch={handleAccountSwitch}/>}{!mb&&<button onClick={()=>setShowImport(true)} style={{background:"linear-gradient(135deg,#3b82f6,#2563eb)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11,display:"flex",alignItems:"center",gap:4}}>📥 Importar Excel</button>}<Bg cl={T.gn}>{fm(t.nw)}</Bg><button onClick={()=>setCur(c=>c==="COP"?"USD":"COP")} style={{background:cur==="USD"?"#3b82f6":"#22c55e",border:"none",color:"#fff",padding:"4px 8px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:11}}
                  // 03-ago-2026 — la TRM real llega del Banco de la República
                  // pero nunca se mostraba: no había forma de saber con qué tasa
                  // se estaba convirtiendo. Ahora va en el title del botón.
                  title={u?.trmSrc ? `TRM $${Math.round(u.trm).toLocaleString("es-CO")} — ${u.trmSrc}` : `TRM $${Math.round(u?.trm||4200).toLocaleString("es-CO")}`}
                  >{cur==="USD"?"🇺🇸 USD":"🇨🇴 COP"}</button>{!mb&&<button onClick={()=>setU(p=>p?{...p,lang:isEN?"es":"en"}:p)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fafafa",padding:"4px 10px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:11}} title="Toggle language">{isEN?"🇺🇸 EN":"🇨🇴 ES"}</button>}{!mb&&u.trm&&<span style={{fontSize:10,color:T.tx3}}>TRM: ${Math.round(u.trm).toLocaleString("es-CO")}</span>}<button onClick={()=>setMasked(m=>!m)} title={masked?"Mostrar valores":"Ocultar valores"} style={{background:"none",border:"1px solid "+T.border,color:T.tx3,cursor:"pointer",padding:"4px 8px",borderRadius:6,fontSize:11}}>{masked?"👁️":"🙈"}</button>{plan==="free"&&!mb&&<Bt sz="s" onClick={()=>setPg("price")}>Upgrade</Bt>}</div></header><div style={{flex:1,padding:mb?14:"22px 20px",maxWidth:1600,width:"100%"}}>
      {/* Suspense: los módulos pesados se cargan bajo demanda (25-jul-2026).
          El respaldo es sobrio a propósito — aparece por fracciones de segundo
          al entrar a una sección por primera vez, y un spinner llamativo se
          vería peor que un texto quieto. */}
      <Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.tx3,fontSize:13}}>Cargando…</div>}>
        {rp()}
      </Suspense>
      </div>{showImport&&<Suspense fallback={null}><CsvImport onImport={handleImport} onClose={()=>setShowImport(false)}/></Suspense>}<PWAInstallPrompt/>{showOnboarding&&<OnboardingTour open={showOnboarding} userName={u?.p?.name||authUser?.user_metadata?.name||""} isPioneros={sessionStorage.getItem("fp3_promo_code")==="PIONEROS2026"} onSelectDemo={()=>{setShowOnboarding(false);setPg("dash");(u?.jurisdiction==="US"?demoUS:demo)();showToast("📊 Datos de ejemplo cargados — explorá tranquilo")}} onSelectImport={()=>{setShowOnboarding(false);setShowImport(true)}} onSelectManual={()=>{setShowOnboarding(false);setPg("ing");showToast("✨ Paso 1 de 4 — registrá lo que entra cada mes")}} onClose={()=>setShowOnboarding(false)}/>}{pagoEstado&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,display:"flex",justifyContent:"center",padding:"14px 12px",pointerEvents:"none"}}>
      <div style={{pointerEvents:"auto",maxWidth:520,width:"100%",background:pagoEstado.tipo==="exito"?"#0f2a1a":pagoEstado.tipo==="cancelado"?"#2a2416":"#12203a",border:"1px solid "+(pagoEstado.tipo==="exito"?"rgba(34,197,94,0.4)":pagoEstado.tipo==="cancelado"?"rgba(234,179,8,0.35)":"rgba(59,130,246,0.35)"),borderRadius:12,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start",boxShadow:"0 8px 28px rgba(0,0,0,0.45)"}}>
        <span style={{fontSize:20,flexShrink:0}}>{pagoEstado.tipo==="exito"?"✅":pagoEstado.tipo==="cancelado"?"↩️":"⏳"}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:pagoEstado.tipo==="exito"?"#4ade80":pagoEstado.tipo==="cancelado"?"#eab308":"#60a5fa"}}>{pagoEstado.titulo}</div>
          <div style={{fontSize:12,color:"#cbd5e1",marginTop:3,lineHeight:1.5}}>{pagoEstado.msg}</div>
        </div>
        {pagoEstado.tipo!=="procesando"&&<button onClick={()=>setPagoEstado(null)} style={{background:"transparent",border:"none",color:"#64748b",cursor:"pointer",fontSize:18,lineHeight:1,padding:0,flexShrink:0}}>×</button>}
      </div>
    </div>}
    {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#22c55e",color:"#000",padding:"12px 24px",borderRadius:12,fontWeight:700,fontSize:13,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",animation:"slideUp 0.3s ease"}}>{toast}</div>}</main>
  </div></RoleProvider>;
}
// v1775826625
