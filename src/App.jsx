import LandingPage from "./components/LandingPage";
import IngresosModule from "./components/IngresosModule";
import GastosModule from "./components/GastosModule";
import InversionesModule from "./components/InversionesModule";
import DeudasModule from "./components/DeudasModule";
import PensionesColpensiones from "./components/PensionesColpensiones";
import CsvImport from "./components/CsvImport";
import MetasModule from "./components/MetasModule";
import PensionColombia from "./components/PensionColombia";
import SimuladorAvanzado from "./components/SimuladorAvanzado";
import AsesorIA from "./components/AsesorIA";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend } from "recharts";

const T={bg:"#09090b",bg2:"#18181b",bg3:"#27272a",card:"#111113",border:"rgba(255,255,255,0.06)",borderL:"rgba(255,255,255,0.1)",tx:"#fafafa",tx2:"#a1a1aa",tx3:"#71717a",gn:"#22c55e",gnB:"rgba(34,197,94,0.08)",rd:"#ef4444",rdB:"rgba(239,68,68,0.06)",bl:"#3b82f6",pr:"#a78bfa",or:"#f59e0b",gd:"#eab308",ch:["#22c55e","#3b82f6","#f59e0b","#a78bfa","#ec4899","#06b6d4","#eab308"]};
const fm=n=>n==null?"$0":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
const pc=n=>(n||0).toFixed(1)+"%";
const SK="fp3";
const sL=async(uid)=>{
  try{
    if(isSupabaseConfigured&&uid){
      const{data,error}=await supabase.from("user_data").select("data").eq("id",uid).single();
      if(!error&&data?.data){const sd=sanitize(data.data);localStorage.setItem(SK,JSON.stringify(sd));return sd}
    }
    const r=localStorage.getItem(SK);return r?sanitize(JSON.parse(r)):null;
  }catch{return null}
};

const sanitize=(d)=>{if(!d||typeof d!=="object")return null;if(!d.p)d.p={};if(!d.p.name)d.p.name="Usuario";if(!d.p.email)d.p.email="";if(!d.p.plan)d.p.plan="free";if(!d.inv)d.inv=[];if(!d.deu)d.deu=[];if(!d.gas)d.gas={};if(!d.ingresos)d.ingresos=[];if(!d.metas)d.metas=[];if(!d.ibk)d.ibk=[];if(!d.pen)d.pen={};return d};
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
const sS=async(d,uid)=>{
  try{
    localStorage.setItem(SK,JSON.stringify(d));
    takeSnapshot(d);
    if(isSupabaseConfigured&&uid){
      clearTimeout(_svT);
      _svT=setTimeout(async()=>{
        try{await supabase.from("user_data").upsert({id:uid,data:d,updated_at:new Date().toISOString()},{onConflict:"id"})}catch{}
      },2000);
    }
  }catch{}
};
const mkU=(n,e)=>({p:{name:n,email:e,plan:"free"},trm:4200,inv:[],deu:[],gas:{},ibk:[],ingresos:[],pen:{age:35,rAge:60,sv:2500,cur:120000,ret:7,inf:3,des:6000,btcC:56,btcP:50000},metas:[]});

const DI=[{id:"i1",n:"Apartamento Bogotá",ub:"Bogotá, Chapinero",tp:"Real Estate",vc:650000000,va:850000000,un:[{n:"Apto 301",ig:[{c:"Arriendo",m:4200000,t:"f"}],gs:[{c:"Admin",m:580000,t:"f"},{c:"Predial",m:220000,t:"f"}]}]},{id:"i2",n:"Casa Orlando",ub:"Orlando, FL",tp:"Real Estate",vc:280000,va:360000,un:[{n:"Casa principal",ig:[{c:"Airbnb",m:3200,t:"v"}],gs:[{c:"Property Tax",m:280,t:"f"},{c:"Insurance",m:180,t:"f"},{c:"HOA",m:150,t:"f"}]}]},{id:"i3",n:"Fondo Bancolombia",ub:"Colombia",tp:"Fondo de Inversión",vc:120000000,va:145000000,un:[]},{id:"i4",n:"CDT Davivienda",ub:"Colombia",tp:"CDT",vc:80000000,va:86000000,un:[]},{id:"i5",n:"Portafolio ETFs",ub:"USA",tp:"Acciones",vc:35000,va:48000,un:[]},{id:"i6",n:"Bitcoin",ub:"",tp:"Crypto",vc:15000000,va:22000000,un:[]}];
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
const cT=(inv,ds,gf,ing)=>{let ab=0,ti=0,tg=0;(inv||[]).forEach(i=>{ab+=i.va});const ingT=(ing||[]).reduce((s,i)=>i.sim===false?s:s+((i.mensual||0)*(i.moneda==="USD"?4200:1)),0);ti=ingT;const td=(ds||[]).reduce((s,d)=>s+(d.mt||0),0),tc=(ds||[]).filter(d=>(d.mt||0)>0&&d.sim!==false).reduce((s,d)=>s+(d.pg||0),0),gfm=Object.values(gf||{}).flat().reduce((s,g)=>g.sim===false?s:s+(g.m||0),0),ni=ti-tg,te=gfm+tc,cf=ni-te;return{ab,td,nw:ab-td,ti,tg,ni,gfm,tc,te,cf,ind:te>0?(ni/te)*100:0,dta:ab>0?(td/ab)*100:0,ingT}};

const Cd=({children,s,...p})=><div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",...s}} {...p}>{children}</div>;
const St=({l,v,sub,cl})=><div style={{padding:"16px 20px"}}><div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>{l}</div><div style={{fontSize:24,fontWeight:700,color:cl||T.tx,letterSpacing:"-0.03em"}}>{v}</div>{sub&&<div style={{fontSize:12,color:T.tx3,marginTop:3}}>{sub}</div>}</div>;
const Bg=({children,cl})=><span style={{background:`${cl||T.gn}15`,color:cl||T.gn,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{children}</span>;
const Bt=({children,onClick,v,sz,dis,st})=>{const vs={p:{background:`linear-gradient(135deg,${T.gn},#16a34a)`,color:"#fff"},s:{background:"transparent",color:T.tx2,border:`1px solid ${T.border}`},d:{background:T.rdB,color:T.rd}};const ss={s:{padding:"6px 14px",fontSize:12},m:{padding:"10px 20px",fontSize:14},l:{padding:"14px 28px",fontSize:16}};return<button onClick={onClick} disabled={dis} style={{...(vs[v||"p"]),...(ss[sz||"m"]),borderRadius:10,border:"none",cursor:dis?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:6,fontWeight:600,opacity:dis?.5:1,...(st||{})}}>{children}</button>};
const In=({l,value:v,onChange:oc,type:tp,placeholder:ph,options:opts})=><div style={{display:"flex",flexDirection:"column",gap:5}}>{l&&<label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>{l}</label>}{opts?<select value={v||""} onChange={e=>oc(e.target.value)} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.tx,fontSize:14,outline:"none"}}>{opts.map(o=><option key={o.v!=null?o.v:o} value={o.v!=null?o.v:o}>{o.l||o}</option>)}</select>:<input type={tp||"text"} value={v!=null?v:""} onChange={e=>oc(e.target.value)} placeholder={ph} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.tx,fontSize:14,outline:"none"}}/>}</div>;
const Md=({open,onClose,title,children,wide})=>{if(!open)return null;return<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1e3,padding:20}}><div onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:`1px solid ${T.borderL}`,borderRadius:20,width:"100%",maxWidth:wide?700:520,maxHeight:"85vh",overflow:"auto",padding:32}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><h3 style={{fontSize:18,fontWeight:700,margin:0,color:T.tx}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:18}}>✕</button></div>{children}</div></div>};

export default function FinPath(){
  const[u,_setU]=useState(null);const setU=(v)=>{if(typeof v==="function"){_setU(p=>{const r=v(p);return r||p})}else{_setU(v)}};const[ld,setLd]=useState(true);const[pg,setPg]=useState("dash");const[md,setMd]=useState(null);const[f,sF]=useState({});const[aM,sAM]=useState("login");const[aF,sAF]=useState({n:"",e:"",p:""});const[adv,sAdv]=useState(null);const[sb,sSb]=useState(true);const[mb,sMb]=useState(false);const[simS,sSimS]=useState("actual");const[showImport,setShowImport]=useState(false);const[cur,setCur]=useState("COP");const[showAuth,setShowAuth]=useState(false);const[billingCycle,setBillingCycle]=useState("anual");const[toast,setToast]=useState("");const[authUser,setAuthUser]=useState(null);const[authLoading,setAuthLoading]=useState(false);const[authError,setAuthError]=useState("");
  useEffect(()=>{const c=()=>sMb(window.innerWidth<900);c();window.addEventListener("resize",c);return()=>window.removeEventListener("resize",c)},[]);
  useEffect(()=>{if(mb)sSb(false)},[mb]);
  useEffect(()=>{(async()=>{
    if(isSupabaseConfigured&&supabase){
      const{data:{session}}=await supabase.auth.getSession();
      if(session?.user){
        setAuthUser(session.user);
        const d=await sL(session.user.id);
        if(d)setU(sanitize(d));
      }
    }else{
      const d=await sL();
      if(d)setU(sanitize(d));
    }
    setLd(false);
    try{const r=await fetch('/api/trm');const j=await r.json();if(j.trm)setU(p=>p?{...p,trm:j.trm,trmSrc:j.source}:p)}catch{}
    // Handle Stripe success redirect
    const params=new URLSearchParams(window.location.search);
    if(params.get('success')==='true'){
      setU(p=>p?{...p,p:{...p.p,plan:'pro'}}:p);
      window.history.replaceState({},'',window.location.pathname);
    }
  })()},[]);
  useEffect(()=>{if(u)sS(u,authUser?.id)},[u]);

  // Auto-backup every 24h
  React.useEffect(()=>{
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
  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),3000)};
  const logout=async()=>{try{await supabase.auth.signOut()}catch{}localStorage.removeItem(SK);_setU(null);setShowAuth(false)};
  const auth=async()=>{
    if(!aF.e||!aF.p){setAuthError("Ingresa email y contraseña");return}
    setAuthLoading(true);setAuthError("");
    try{
    if(isSupabaseConfigured){
      if(aM==="login"){
        const{data,error}=await supabase.auth.signInWithPassword({email:aF.e,password:aF.p});
        if(error){setAuthError(error.message);setAuthLoading(false);return}
        setAuthUser(data.user);
        const d=await sL(data.user.id);
        if(d)setU(sanitize(d));else{const nd=mkU(aF.n||"Usuario",aF.e);nd.p.plan="pro";nd.p.trialEnd=new Date(Date.now()+14*86400000).toISOString().split("T")[0];setU(nd);await sS(nd,data.user.id)}
      }else{
        const sr=await fetch("/.netlify/functions/auth-signup",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({email:aF.e,password:aF.p,name:aF.n||""})
        });
        const srd=await sr.json();
        if(!sr.ok){setAuthError(srd.error||"Error creando cuenta");setAuthLoading(false);return}
        const{data,error}=await supabase.auth.signInWithPassword({email:aF.e,password:aF.p});
        if(error){setAuthError(error.message);setAuthLoading(false);return}
        setAuthUser(data.user);const nd=mkU(aF.n||"Usuario",aF.e);nd.p.plan="pro";nd.p.trialEnd=new Date(Date.now()+14*86400000).toISOString().split("T")[0];setU(nd);await sS(nd,data.user.id);
      }
    }else{setU(mkU(aF.n||"Usuario",aF.e))}
    }catch(e){setAuthError("Error: "+e.message)}
    setAuthLoading(false);
  };
  const demo=()=>{showToast("📊 Datos demo cargados");setU(p=>p?({...p,inv:[...DI],deu:[...DD],gas:JSON.parse(JSON.stringify(DG)),ingresos:[...DING]}):p)};
  const generatePDF=()=>{
    const fecha=new Date().toLocaleDateString("es-CO",{year:"numeric",month:"long",day:"numeric"});
    const inv=(u&&u.inv)||[];const deu=(u&&u.deu)||[];const gas=(u&&u.gas)||{};const ing=(u&&u.ingresos)||[];
    const gasCats=Object.entries(gas).map(([cat,items])=>({cat,total:items.reduce((s,g)=>s+(g.m||0),0)})).sort((a,b)=>b.total-a.total);
    const totalGas=gasCats.reduce((s,c)=>s+c.total,0);
    const totalIng=ing.reduce((s,i)=>s+((i.mensual||0)*(i.moneda==="USD"?(u&&u.trm||4200):1)),0);
    const totalDeu=deu.reduce((s,d)=>s+(d.mt||0),0);
    const totalCuotas=deu.reduce((s,d)=>s+(d.pg||0),0);
    const totalPat=inv.reduce((s,i)=>s+(+i.va||0),0);
    const nw=totalPat-totalDeu;const cf=totalIng-totalGas-totalCuotas;
    const ind=(totalGas+totalCuotas)>0?((totalIng/(totalGas+totalCuotas))*100):0;
    const level=ind>=250?"Libertad Absoluta":ind>=150?"Libertad":ind>=100?"Independencia":ind>=82.5?"Vitalidad":ind>=65?"Seguridad":"Pre-Seguridad";
    const fireNum=(totalGas+totalCuotas)*12*25;const firePct=fireNum>0?(nw/fireNum*100):0;
    const dta=totalPat>0?(totalDeu/totalPat*100):0;
    const runway=(totalGas+totalCuotas)>0?Math.round(inv.filter(i=>["Cash","CDT","Renta Fija","Fondo de Inversión"].includes(i.tp||i.tipo)).reduce((s,i)=>s+(+i.va||0),0)/(totalGas+totalCuotas)):0;
    const invRows=inv.map(i=>"<tr><td>"+(i.n||i.nombre||"")+"</td><td>"+(i.tp||i.tipo||"Otro")+"</td><td class=r>"+fm(+i.va||0)+"</td><td class=r "+((+i.va||0)>=(+i.vc||0)?"style=color:#16a34a":"style=color:#dc2626")+">"+fm((+i.va||0)-(+i.vc||0))+"</td></tr>").join("");
    const ingRows=ing.map(i=>"<tr><td>"+(i.nombre||"")+"</td><td>"+(i.categoria||"")+"</td><td class=r>"+fm((i.mensual||0)*(i.moneda==="USD"?(u&&u.trm||4200):1))+"</td></tr>").join("");
    const gasRows=gasCats.map(g=>"<tr><td>"+g.cat+"</td><td class=r>"+fm(g.total)+"</td><td class=r>"+(totalIng>0?(g.total/totalIng*100).toFixed(1)+"%":"—")+"</td></tr>").join("");
    const deuRows=deu.map(d=>"<tr><td>"+(d.n||"")+"</td><td class=r>"+fm(d.mt||0)+"</td><td class=r>"+fm(d.pg||0)+"</td><td class=r>"+(d.ts||0)+"%</td></tr>").join("");
    const html="<!DOCTYPE html><html><head><title>Reporte FINPATHIA</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;color:#1a1a1a;padding:32px 40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.6}h1{font-size:22px;font-weight:800}h2{font-size:15px;font-weight:700;margin:24px 0 8px;padding-bottom:4px;border-bottom:2px solid #22c55e}.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #22c55e}.logo{font-size:18px;font-weight:800;color:#22c55e}.dt{font-size:11px;color:#888}.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:10px 0}.g4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin:10px 0}.k{background:#f8f8f8;border-radius:8px;padding:10px;border-left:3px solid #22c55e}.kr{border-left-color:#ef4444}.kl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px}.kv{font-size:18px;font-weight:700;margin-top:2px}.ks{font-size:9px;color:#888;margin-top:2px}table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}th{text-align:left;padding:5px 8px;background:#f0f0f0;font-weight:600;font-size:9px;text-transform:uppercase;color:#666}td{padding:5px 8px;border-bottom:1px solid #eee}.r{text-align:right}.lb{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;margin:10px 0}.lt{font-size:18px;font-weight:700;color:#16a34a}.ft{margin-top:28px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#aaa;text-align:center}.ds{font-size:8px;color:#ccc;margin-top:16px;text-align:center;line-height:1.4}@media print{body{padding:20px}@page{size:letter;margin:12mm}}</style></head><body>"
    +"<div class=hd><div><div class=logo>FINPATHIA</div><h1>Reporte Financiero Personal</h1></div><div style=text-align:right><div class=dt>"+fecha+"</div><div class=dt>"+(u?.p?.name||"Usuario")+"</div></div></div>"
    +"<div class=lb><div style=font-size:11px;color:#666>NIVEL DE LIBERTAD FINANCIERA</div><div class=lt>"+level+"</div><div style=font-size:13px;color:#333;margin-top:4px>Índice: "+ind.toFixed(1)+"%</div></div>"
    +"<div class=g4><div class=k><div class=kl>Patrimonio Neto</div><div class=kv>"+fm(nw)+"</div></div><div class=k><div class=kl>Ingresos/mes</div><div class=kv>"+fm(totalIng)+"</div></div><div class='k "+(cf<0?"kr":"")+"'><div class=kl>Cash Flow/mes</div><div class=kv style=color:"+(cf>=0?"#16a34a":"#dc2626")+">"+fm(cf)+"</div></div><div class=k><div class=kl>FIRE Progress</div><div class=kv>"+firePct.toFixed(0)+"%</div><div class=ks>Meta: "+fm(fireNum)+"</div></div></div>"
    +"<h2>Patrimonio ("+inv.length+" activos)</h2><div class=g3><div class=k><div class=kl>Activos</div><div class=kv>"+fm(totalPat)+"</div></div><div class='k kr'><div class=kl>Deudas</div><div class=kv>"+fm(totalDeu)+"</div></div><div class=k><div class=kl>Neto</div><div class=kv>"+fm(nw)+"</div></div></div>"
    +"<table><thead><tr><th>Activo</th><th>Tipo</th><th class=r>Valor</th><th class=r>Ganancia</th></tr></thead><tbody>"+invRows+"</tbody></table>"
    +"<h2>Ingresos ("+ing.length+" fuentes)</h2><table><thead><tr><th>Fuente</th><th>Categoría</th><th class=r>Monto/mes</th></tr></thead><tbody>"+ingRows+"<tr style=font-weight:700;border-top:2px+solid+#333><td colspan=2>Total</td><td class=r>"+fm(totalIng)+"</td></tr></tbody></table>"
    +"<h2>Gastos ("+gasCats.length+" categorías)</h2><table><thead><tr><th>Categoría</th><th class=r>Monto/mes</th><th class=r>% Ingreso</th></tr></thead><tbody>"+gasRows+"<tr style=font-weight:700;border-top:2px+solid+#333><td>Total</td><td class=r>"+fm(totalGas)+"</td><td class=r>"+(totalIng>0?(totalGas/totalIng*100).toFixed(0)+"%":"—")+"</td></tr></tbody></table>"
    +(deu.length>0?"<h2>Deudas ("+deu.length+")</h2><table><thead><tr><th>Deuda</th><th class=r>Saldo</th><th class=r>Cuota/mes</th><th class=r>Tasa</th></tr></thead><tbody>"+deuRows+"<tr style=font-weight:700;border-top:2px+solid+#333><td>Total</td><td class=r>"+fm(totalDeu)+"</td><td class=r>"+fm(totalCuotas)+"</td><td></td></tr></tbody></table>":"")
    +"<h2>Indicadores</h2><div class=g3><div class=k><div class=kl>Independencia</div><div class=kv>"+ind.toFixed(1)+"%</div><div class=ks>Meta: 100%+</div></div><div class=k><div class=kl>Deuda/Activos</div><div class=kv>"+dta.toFixed(1)+"%</div><div class=ks>Ideal: &lt;30%</div></div><div class=k><div class=kl>Runway</div><div class=kv>"+runway+" meses</div><div class=ks>Sin ingresos</div></div></div>"
    +"<div class=ds>Este reporte es generado por FINPATHIA con fines informativos. No constituye asesoría financiera profesional.</div>"
    +"<div class=ft>FINPATHIA — finpathia.com — "+fecha+"</div></body></html>";
    const w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);
  };

  const handleImport=(key,rows,isGastos)=>{if(isGastos){const g={...(u&&u.gas||{})};rows.forEach(r=>{const cat=r.cat||"Otro";if(!g[cat])g[cat]=[];g[cat].push({c:r.c,m:r.m,t:r.t})});upd("gas",g)}else{upd(key,[...((u&&u[key])||[]),...rows])}};

  const fm=n=>{if(n==null||isNaN(n))return"$0";const v=cur==="USD"?(n/trm):n;if(Math.abs(v)>=1e9)return"$"+(v/1e9).toFixed(1)+"B";if(Math.abs(v)>=1e6)return"$"+(v/1e6).toFixed(1)+"M";return"$"+Math.round(v).toLocaleString("en-US")};
  const upd=(k,v)=>{showToast("✅ Guardado");setU(p=>p?{...p,[k]:v}:p);};
  const isAdmin=u?.p?.email==="santiagososa1@me.com"||u?.p?.email==="ajimenez001@gmail.com";
  const trialEnd=u?.p?.trialEnd;
  const trialActive=trialEnd&&new Date(trialEnd)>=new Date();
  const trialDays=trialEnd?Math.max(0,Math.ceil((new Date(trialEnd)-new Date())/(86400000))):0;
  const plan=isAdmin?"pro":trialActive?"pro":(u?.p?.plan||"free");
  const t=useMemo(()=>u?cT(u.inv,u.deu,u.gas,u.ingresos):{},[u]);
  const ib=useMemo(()=>{if(!u?.ibk?.length)return{tc:0,tv:0,pnl:0,pp:0,pos:[]};let tc=0,tv=0;const pos=u.ibk.map(p=>{const va=p.sh*p.pr,cbb=p.sh*p.cb,pnl=va-cbb,pp=cbb>0?((va/cbb)-1)*100:0,up=p.pr>0?((p.tg/p.pr)-1)*100:0;tc+=cbb;tv+=va;return{...p,va,cbb,pnl,pp,up}});return{tc,tv,pnl:tv-tc,pp:tc>0?((tv/tc)-1)*100:0,pos}},[u?.ibk]);
  const pen=useMemo(()=>{if(!u)return{};const p=u.pen||{},yrs=Math.max(0,(p.rAge||60)-(p.age||35)),mr=(p.ret||7)/100/12;let fv=+(p.cur||0);for(let m=0;m<yrs*12;m++)fv=fv*(1+mr)+(+(p.sv||0));const rfv=fv/Math.pow(1+(p.inf||3)/100,yrs),mo=rfv>0?rfv/360:0;const proj=[];let rv=+(p.cur||0);for(let y=0;y<=yrs;y++){proj.push({age:(p.age||35)+y,val:Math.round(rv)});for(let m=0;m<12&&y<yrs;m++)rv=rv*(1+mr)+(+(p.sv||0))}let ba=0;const bc=(p.btcC||56)/100,bp=p.btcP||50000;for(let y=1;y<=yrs;y++)for(let m=1;m<=12;m++)ba+=(+(p.sv||0))/(bp*Math.pow(1+bc,((y-1)*12+m)/12));const bfv=ba*bp*Math.pow(1+bc,yrs),bmo=(bfv*.04)/12;return{yrs,fv:Math.round(rfv),mo:Math.round(mo),ok:mo>=(p.des||6000),gap:Math.max(0,(p.des||6000)-mo),proj,ba,bfv,bmo:Math.round(bmo)}},[u?.pen]);
  const simT=useMemo(()=>{const im={actual:1,conservador:.8,optimista:1.3,crisis:.6},gm={actual:1,conservador:1.1,optimista:.85,crisis:1.05};const sni=t.ni*(im[simS]||1),sgf=t.gfm*(gm[simS]||1),ste=sgf+t.tc,scf=sni-ste;return{...t,ni:sni,gfm:sgf,te:ste,cf:scf,ind:ste>0?(sni/ste)*100:0}},[t,simS]);
  if(ld)return<div style={{background:T.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui"}}><div style={{textAlign:"center"}}><div style={{fontSize:32,fontWeight:900,background:"linear-gradient(135deg,#22c55e,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>FINPATHIA</div><div style={{width:40,height:3,background:"linear-gradient(90deg,#22c55e,#3b82f6)",borderRadius:2,margin:"16px auto",animation:"pulse 1.5s infinite"}}></div><div style={{color:T.tx3,fontSize:12}}>Cargando tu patrimonio...</div></div></div>;

  if(!u&&!showAuth)return<LandingPage onGetStarted={()=>setShowAuth(true)}/>;
  if(!u)return<div style={{background:T.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui",color:T.tx}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}input:focus,select:focus{border-color:#22c55e!important;outline:none}`}</style>
    <div style={{width:"100%",maxWidth:420,padding:"40px 32px"}}>
      <div onClick={()=>setShowAuth(false)} style={{fontSize:13,color:T.tx3,cursor:"pointer",marginBottom:24}}>← Volver</div>
      <div style={{background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:10,padding:"10px 14px",marginBottom:20,fontSize:12,color:T.tx2,display:"flex",alignItems:"center",gap:8}}>🔒 Tus datos financieros están protegidos con encriptación y solo tú puedes acceder.</div>
      <div style={{fontSize:28,fontWeight:800,background:"linear-gradient(135deg,#22c55e,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:24}}>FINPATHIA</div>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:6}}>{aM==="login"?"Inicia sesión":"Crea tu cuenta gratis"}</h2>
      <p style={{color:T.tx3,fontSize:14,marginBottom:28}}>{aM==="login"?"Accede a tu patrimonio":"14 días de acceso Pro incluidos"}</p>
      <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
        {aM==="signup"&&<In l="Nombre" value={aF.n} onChange={v=>sAF(p=>({...p,n:v}))} placeholder="Tu nombre"/>}
        <In l="Email" value={aF.e} onChange={v=>sAF(p=>({...p,e:v}))} type="email" placeholder="tu@email.com"/>
        <In l="Contraseña" value={aF.p} onChange={v=>sAF(p=>({...p,p:v}))} type="password" placeholder="••••••••"/>
      </div>
      <Bt sz="l" onClick={auth} dis={authLoading} st={{width:"100%",justifyContent:"center",borderRadius:12}}>{authLoading?"Cargando...":aM==="login"?"Ingresar":"Crear cuenta — 14 días Pro gratis"}</Bt>
      {authError&&<div style={{color:T.rd,fontSize:12,textAlign:"center",marginTop:8,padding:"8px 12px",background:T.rdB,borderRadius:8}}>{authError}</div>}
      <p style={{textAlign:"center",marginTop:20,color:T.tx3,fontSize:14}}>{"¿No tienes cuenta? "}<span onClick={()=>sAM(aM==="login"?"signup":"login")} style={{color:T.gn,cursor:"pointer",fontWeight:600}}>{aM==="login"?"Regístrate":"Ingresa"}</span></p>
      <div style={{marginTop:20,padding:"16px",background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.12)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:13,fontWeight:600,color:T.tx,marginBottom:6}}>🔒 ¿Prefieres no crear cuenta?</div><div style={{fontSize:11,color:T.tx3,marginBottom:10}}>Usa la plataforma completa sin registro. Tus datos se guardan solo en este navegador y nunca salen de tu dispositivo.</div><button onClick={()=>{const nd=mkU("Usuario","");nd.p.plan="pro";nd.p.trialEnd=new Date(Date.now()+14*86400000).toISOString().split("T")[0];nd.p.anonymous=true;setU(nd)}} style={{background:T.bl,color:"#fff",border:"none",padding:"10px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13}}>Usar sin cuenta — Modo Privado</button></div>
      {aM==="login"&&<p style={{textAlign:"center",marginTop:8}}><span onClick={async()=>{if(!aF.e){setAuthError("Escribe tu email primero");return}try{await supabase.auth.resetPasswordForEmail(aF.e);setAuthError("✅ Email enviado")}catch(e){setAuthError(e.message)}}} style={{color:T.tx3,cursor:"pointer",fontSize:12}}>¿Olvidaste tu contraseña?</span></p>}
    </div>
  </div>;

  // Feature gating — inline, no separate component
  const gateOverlay=(planNeeded)=><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:10,background:"rgba(9,9,11,0.5)",backdropFilter:"blur(2px)",borderRadius:16}}><div style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:20,padding:"40px 48px",textAlign:"center",boxShadow:"0 12px 40px rgba(0,0,0,.6)",maxWidth:340}}><div style={{width:56,height:56,borderRadius:16,background:T.gnB,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>🔒</div><div style={{fontSize:18,fontWeight:800,marginBottom:6,letterSpacing:"-0.02em"}}>{"Plan "+planNeeded}</div><div style={{fontSize:13,color:T.tx3,marginBottom:20,lineHeight:1.5}}>{"Desbloquea esta función con el plan "+planNeeded}</div><Bt onClick={()=>setPg("price")} st={{width:"100%",justifyContent:"center"}}>Upgrade a {planNeeded}</Bt></div></div>;
  const gated=(feat,planNeeded,content)=>{const ok=plan==="pro"||(plan==="basico"&&["trd","pen","btc","sim"].includes(feat));if(ok||plan===planNeeded)return content;return<div style={{position:"relative"}}><div style={{filter:"blur(4px)",pointerEvents:"none",opacity:.3,maxHeight:400,overflow:"hidden"}}>{content}</div>{gateOverlay(planNeeded)}</div>};

  const getCoach=id=>{
    if(!u)return[];
    try{
    const msgs=[];
    const inv=((u&&u.inv)||[]).filter(i=>i.sim!==false),deu=((u&&u.deu)||[]).filter(d=>d.sim!==false),gas=(u&&u.gas)||{},ing=((u&&u.ingresos)||[]).filter(i=>i.sim!==false);
    const topA=inv.map(i=>({...i,...iM(i,deu)})).sort((a,b)=>b.noi-a.noi);
    const hiDebt=deu.filter(d=>(d.mt||0)>0).sort((a,b)=>b.ts-a.ts);
    const gasCats=Object.entries(gas).map(([cat,items])=>({cat,total:items.reduce((s,g)=>s+(g.m||0),0),items})).sort((a,b)=>b.total-a.total);
    const pasivos=ing.filter(i=>["Arriendo","Rendimiento","Dividendos","Inversión"].includes(i.categoria));
    const activos=ing.filter(i=>!["Arriendo","Rendimiento","Dividendos","Inversión"].includes(i.categoria));
    const ingPasivo=pasivos.reduce((s,i)=>s+((i.mensual||0)*(i.moneda==="USD"?4200:1)),0);
    const ingActivo=activos.reduce((s,i)=>s+((i.mensual||0)*(i.moneda==="USD"?4200:1)),0);
    const pctPasivo=t.ni>0?(ingPasivo/t.ni*100):0;
    const runway=t.te>0?Math.round(inv.filter(i=>["Cash","CDT","Renta Fija"].includes(i.tp||i.tipo)).reduce((s,i)=>s+(i.va||0),0)/t.te):0;
    const fireNum=t.te*12*25;
    const firePct=fireNum>0?(t.nw/fireNum*100):0;
    const reVal=inv.filter(i=>(i.tp||i.tipo)==="Real Estate").reduce((s,i)=>s+(i.va||0),0);
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
      msgs.push({t:"🎯 Plan de Acción",c:"1. Convertir "+fm(deadA.reduce((s,i)=>s+(i.va||0),0))+" improductivos en productivos\n2. Reinvertir cash flow "+fm(t.cf)+"/mes en activos que generen ingreso\n3. Meta: ingreso pasivo > "+fm(t.te)+"/mes (hoy: "+fm(ingPasivo)+")\n4. Cada "+fm(Math.abs(t.cf)*12)+" ahorrado/año te acerca "+((t.te>0?Math.abs(t.cf)*12/t.te*100:0)).toFixed(0)+"% más"});
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
      const inferType=(i)=>{let tp=String(i.tp||i.tipo||i.type||"").trim();if(!tp||!isNaN(Number(tp)))tp="";const typeMap={"Other":"Otro","Investment":"Fondo de Inversión","Income":"Otro","Trading":"Acciones","Renta Fija":"CDT","Lote":"Real Estate"};if(tp&&typeMap[tp])return typeMap[tp];const validTypes=["Real Estate","Fondo de Inversión","CDT","Acciones","Crypto","Bodega","Vehículo","Local Comercial","Negocio","Cash","Otro"];if(tp&&validTypes.includes(tp))return tp;const nm=((i.n||i.nombre||"")+" "+(i.ub||"")).toLowerCase();if(/apart|apto|casa|lote|terreno|oficina|inmueble|propiedad|house|condo/i.test(nm))return"Real Estate";if(/bodega/i.test(nm))return"Bodega";if(/local/i.test(nm))return"Local Comercial";if(/fondo|fiduci|fund/i.test(nm))return"Fondo de Inversión";if(/cdt|renta fija|bonos|tes /i.test(nm))return"CDT";if(/accion|etf|portafolio|vti|spy|stock|share/i.test(nm))return"Acciones";if(/btc|bitcoin|crypto|eth|usdt/i.test(nm))return"Crypto";if(/vehic|carro|moto|auto/i.test(nm))return"Vehículo";if(/negocio|empresa|sas|company/i.test(nm))return"Negocio";if(/cash|ahorro|cuenta|saving/i.test(nm))return"Cash";if(/green|puerto|orlando|miami|backswing|district/i.test(nm))return"Real Estate";return"Otro"};
    const types={};inv.forEach(i=>{const tp=inferType(i);types[tp]=(types[tp]||0)+(i.va||0)});
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
  const nvs=[{id:"dash",i:"📊",l:"Dashboard"},{id:"_sep1",sep:true,l:"MI DINERO"},{id:"ing",i:"💰",l:"Ingresos"},{id:"gas",i:"💳",l:"Gastos"},{id:"inv",i:"🏦",l:"Patrimonio"},{id:"deu",i:"📋",l:"Deudas"},{id:"_sep2",sep:true,l:"HERRAMIENTAS"},{id:"sim",i:"🖥️",l:"Simulador"},{id:"met",i:"🎯",l:"Metas"},{id:"trd",i:"💹",l:"Trading"},{id:"pen",i:"🏛️",l:"Pensiones"},{id:"btc",i:"₿",l:"Ahorro BTC"},{id:"_sep3",sep:true,l:"INTELIGENCIA ARTIFICIAL"},{id:"asesor",i:"🤖",l:"Asesor IA"},{id:"coach",i:"🧠",l:"Coaches IA"},{id:"_sep4",sep:true},{id:"price",i:"⭐",l:"Planes"},{id:"set",i:"⚙️",l:"Config"}];

  const secNames={dash:"Dashboard",inv:"Patrimonio",ing:"Ingresos",gas:"Gastos",deu:"Deudas",trd:"Trading",sim:"Simulador",met:"Metas",pen:"Pensiones",btc:"Ahorro BTC",coach:"Coaches IA",asesor:"Asesor IA",price:"Planes",set:"Configuración"};
  if(typeof document!=="undefined")document.title="FINPATHIA"+(secNames[pg]?" — "+secNames[pg]:"");
  const rp=()=>{if(!u)return null;switch(pg){
    case"dash":{
    // Data prep
    const fd=[{name:"Ingresos",a:t.ti},{name:"Gastos",a:-(t.gfm+t.tg)},{name:"Deudas",a:-t.tc},{name:"Neto",a:t.cf}];
    const pj=[0,1,3,5,10].map(y=>({yr:y===0?"Hoy":`+${y}a`,v:t.nw*Math.pow(1.08,y)+t.cf*12*y}));
    // Patrimonio distribution
    const bc={};((u&&u.inv)||[]).forEach(i=>{const tp=(i.tp&&isNaN(Number(i.tp))&&i.tp!=="undefined")?i.tp:"Otro";bc[tp]=(bc[tp]||0)+(i.va||0)});if(ib.tv>0)bc.Trading=ib.tv;
    const pie=Object.entries(bc).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    const totalPat=t.ab+ib.tv;
    // Income by category
    const incByCat={};((u&&u.ingresos)||[]).forEach(i=>{incByCat[i.categoria||"Otro"]=(incByCat[i.categoria||"Otro"]||0)+(i.mensual||0)});
    const incPie=Object.entries(incByCat).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    // Expense by category
    const expByCat={};Object.entries((u&&u.gas)||{}).forEach(([cat,its])=>{expByCat[cat]=its.reduce((s,g)=>s+(g.m||0),0)});
    const expPie=Object.entries(expByCat).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    // Top income sources
    const topInc=[...((u&&u.ingresos)||[])].sort((a,b)=>(b.mensual||0)-(a.mensual||0)).slice(0,5);
    // Health score (0-100)
    const healthScore=Math.min(100,Math.round(
      (t.ind>=100?30:t.ind*0.3) + // independence: 30 pts
      (t.dta<50?25:t.dta<80?15:0) + // debt ratio: 25 pts
      (t.cf>0?25:t.cf>-1000?10:0) + // cash flow positive: 25 pts
      (((u&&u.ingresos)||[]).length>=3?10:(((u&&u.ingresos)||[]).length>=2?5:0)) + // diversification: 10 pts
      (((u&&u.inv)||[]).length>=3?10:(((u&&u.inv)||[]).length>=1?5:0))  // assets: 10 pts
    ));
    const healthColor=healthScore>=80?T.gn:healthScore>=50?"#eab308":T.rd;
    const healthLabel=healthScore>=80?"Excelente":healthScore>=60?"Buena":healthScore>=40?"Regular":"Necesita atención";

    return<div>
      {/* Greeting */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-0.03em",margin:"0 0 6px"}}>{new Date().getHours()<12?"Buenos días":new Date().getHours()<18?"Buenas tardes":"Buenas noches"}, {(u?.p?.name&&u?.p?.name!=="Usuario"&&u?.p?.name!=="")?(u?.p?.name||"").split(" ")[0]:(u?.p?.email||"").split("@")[0]}</h1>
          {((u?.p?.name)==="Usuario"||!(u?.p?.name))&&<div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.12)",borderRadius:10,padding:"10px 14px",marginTop:10,fontSize:12,color:T.bl,cursor:"pointer"}} onClick={()=>setPg("set")}>👤 Configura tu nombre en <strong>⚙️ Config</strong> para personalizar tu experiencia</div>}
          {trialActive&&<div style={{background:"linear-gradient(135deg,rgba(34,197,94,0.08),rgba(59,130,246,0.05))",border:"1px solid rgba(34,197,94,0.15)",borderRadius:12,padding:"12px 16px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>⭐</span>
              <div><div style={{fontSize:13,fontWeight:700,color:T.gn}}>Plan Pro — Trial gratuito</div><div style={{fontSize:11,color:T.tx3}}>{trialDays<=3?"¡Solo te quedan "+trialDays+" días!":"Te quedan "+trialDays+" días de acceso Pro completo"}</div></div>
            </div>
            {trialDays<=5&&<button onClick={()=>setPg("price")} style={{background:T.gn,color:"#000",border:"none",padding:"8px 20px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>Mantener Pro →</button>}
          </div>}
          {!trialActive&&trialEnd&&plan==="free"&&u?.p?.anonymous&&<div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.12)",borderRadius:12,padding:"12px 16px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>🔒</span><div><div style={{fontSize:13,fontWeight:700,color:T.bl}}>Crea tu cuenta para mantener Pro</div><div style={{fontSize:11,color:T.tx3}}>Tu información seguirá protegida. Tus datos se sincronizan en la nube con encriptación.</div></div></div><button onClick={()=>{logout()}} style={{background:T.bl,color:"#fff",border:"none",padding:"8px 20px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>Crear cuenta →</button></div>}
          {!trialActive&&trialEnd&&plan==="free"&&!u?.p?.anonymous&&<div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.12)",borderRadius:12,padding:"12px 16px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>😢</span>
              <div><div style={{fontSize:13,fontWeight:700,color:T.rd}}>Tu trial Pro terminó</div><div style={{fontSize:11,color:T.tx3}}>Upgrade para recuperar el Asesor IA, Coaches y Simulador completo</div></div>
            </div>
            <button onClick={()=>setPg("price")} style={{background:T.gn,color:"#000",border:"none",padding:"8px 20px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>Upgrade ahora →</button>
          </div>}
          <p style={{color:T.tx3,fontSize:13,margin:0}}>Resumen de tu situación financiera</p>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setPg("resumen")} style={{background:T.bl,color:"#fff",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>📋 Resumen</button>
          <button onClick={generatePDF} style={{background:T.gn,color:"#000",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>📄 Reporte PDF</button>
        </div>
      </div>

      {(()=>{
        const hasIng=((u&&u.ingresos)||[]).length>0;
        const hasGas=Object.keys((u&&u.gas)||{}).length>0;
        const hasInv=((u&&u.inv)||[]).length>0;
        const hasDeu=((u&&u.deu)||[]).length>0;
        const steps=[
          {id:"ing",done:hasIng,icon:"💰",title:"Registra tus ingresos",desc:"Salario, rentas, dividendos — todo lo que entra cada mes",action:"Agregar ingresos",tip:"Entra aquí y usa 📥 Importar Excel, o agrega uno por uno"},
          {id:"gas",done:hasGas,icon:"💳",title:"Registra tus gastos",desc:"Vivienda, educación, transporte, seguros, entretenimiento",action:"Agregar gastos",tip:"Solo gastos mensuales — créditos y cuotas de deudas van en el Paso 4"},
          {id:"inv",done:hasInv,icon:"🏦",title:"Agrega tu patrimonio",desc:"Propiedades, fondos, acciones, CDTs, crypto, vehículos",action:"Agregar inversiones",tip:"Cada activo con su valor actual — propiedades, fondos, acciones, crypto"},
          {id:"deu",done:hasDeu,icon:"📋",title:"Registra tus deudas",desc:"Hipotecas, préstamos, tarjetas — con saldo y cuota",action:"Agregar deudas",tip:"Incluye saldo pendiente, cuota mensual y tasa de interés"},
        ];
        const done=steps.filter(s=>s.done).length;
        const pct=Math.round((done/steps.length)*100);
        if(done>=steps.length)return null;
        return <div style={{marginBottom:24}}>
        <div style={{background:"linear-gradient(135deg,rgba(34,197,94,.04),rgba(59,130,246,.03))",border:"1px solid rgba(34,197,94,.12)",borderRadius:20,padding:"32px 28px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:T.bg3}}><div style={{height:"100%",width:pct+"%",background:"linear-gradient(90deg,#22c55e,#3b82f6)",borderRadius:2,transition:"width 0.5s"}}/></div>
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
            {steps.map((s,i)=><button key={s.id} onClick={()=>setPg(s.id)} style={{background:s.done?"rgba(34,197,94,0.06)":T.bg2,border:"1px solid "+(s.done?"rgba(34,197,94,0.2)":T.border),borderRadius:14,padding:"16px 18px",cursor:"pointer",textAlign:"left",color:T.tx,transition:"all 0.2s",opacity:s.done?.6:1}} onMouseOver={e=>{if(!s.done)e.currentTarget.style.borderColor="#22c55e"}} onMouseOut={e=>{if(!s.done)e.currentTarget.style.borderColor=T.border}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:s.done?"rgba(34,197,94,0.12)":T.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{s.done?"✅":s.icon}</div>
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
          {done===0&&<div style={{marginTop:16,padding:"12px 16px",background:"rgba(59,130,246,0.06)",borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>🧠</span>
            <div style={{fontSize:12,color:T.tx2,lineHeight:1.5}}><strong>Tip:</strong> En cada sección encontrarás el botón <strong>📥 Importar Excel</strong> para cargar tus datos desde un archivo. La IA analiza tu Excel y organiza los datos automáticamente.</div>
          </div>}
        </div>
      </div>;
      })()}

      {/* ═══ ROW 1: Net Worth Hero + Health Score ═══ */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"2fr 1fr",gap:14,marginBottom:14}}>
        <Cd s={{padding:0,background:"radial-gradient(ellipse at 30% 0%,rgba(34,197,94,.06)0%,transparent 60%)"}}>
          <div style={{padding:"32px 28px"}}>
            <div style={{fontSize:11,color:T.tx3,letterSpacing:2,fontWeight:600}}>PATRIMONIO NETO</div>
            <div style={{fontSize:"clamp(2rem,5vw,3rem)",fontWeight:800,letterSpacing:"-0.04em",marginTop:4}}>{fm(t.nw)}</div>
            <div style={{display:"flex",gap:20,marginTop:20,flexWrap:"wrap"}}>
              {[{l:"Activos",v:fm(totalPat),c:T.gn},{l:"Deuda",v:fm(t.td),c:T.rd},{l:"Ratio D/A",v:pc(t.dta),c:t.dta<50?T.gn:T.rd}].map(k=>
                <div key={k.l}><div style={{fontSize:10,color:T.tx3,letterSpacing:1}}>{k.l}</div><div style={{fontSize:18,fontWeight:700,color:k.c,marginTop:2}}>{k.v}</div></div>
              )}
            </div>
          </div>
        </Cd>
        <Cd s={{padding:"28px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
          <div style={{width:90,height:90,borderRadius:"50%",border:"4px solid "+healthColor,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
            <div style={{fontSize:28,fontWeight:800,color:healthColor}}>{healthScore}</div>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:healthColor}}>{healthLabel}</div>
          <div style={{fontSize:11,color:T.tx3,marginTop:2}}>Salud Financiera</div>
        </Cd>
      </div>

      {/* ═══ ROW 1b: Wealth Percentile ═══ */}
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
          <Cd s={{padding:"16px 24px",marginBottom:14,background:"linear-gradient(135deg,rgba(168,85,247,0.04),rgba(59,130,246,0.03))"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
              <div>
                <div style={{fontSize:11,color:T.tx3,fontWeight:600,letterSpacing:1}}>📍 TU POSICIÓN EN RIQUEZA</div>
                <div style={{fontSize:13,color:T.tx2,marginTop:4}}>Con un patrimonio neto de <strong style={{color:T.gn}}>{fm(t.nw)}</strong> (≈ USD ${Math.round(nwUSD).toLocaleString()})</div>
              </div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <div style={{textAlign:"center",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:12,padding:"10px 16px",flex:1,minWidth:130}}>
                  <div style={{fontSize:10,color:"#a78bfa"}}>🇨🇴 COLOMBIA</div>
                  <div style={{fontSize:18,fontWeight:800,color:"#a78bfa",marginTop:2}}>{colLabel}</div>
                  <div style={{fontSize:10,color:T.tx3}}>Superas al {colPerc}%</div>
                </div>
                <div style={{textAlign:"center",background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.15)",borderRadius:12,padding:"10px 16px",flex:1,minWidth:130}}>
                  <div style={{fontSize:10,color:T.bl}}>🌍 GLOBAL</div>
                  <div style={{fontSize:18,fontWeight:800,color:T.bl,marginTop:2}}>{gloLabel}</div>
                  <div style={{fontSize:10,color:T.tx3}}>Superas al {gloPerc}%</div>
                </div>
                <div style={{textAlign:"center",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:12,padding:"10px 16px",flex:1,minWidth:130}}>
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

      {/* ═══ ROW 2: 4 KPI Cards ═══ */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:14}}>
        {[
          {l:"Ingresos/mes",v:fm(t.ti),c:T.gn,i:"💰"},
          {l:"Gastos/mes",v:fm(t.gfm+t.tg),c:T.rd,i:"💳"},
          {l:"Cash Flow",v:fm(t.cf)+"/mes",c:t.cf>=0?T.gn:T.rd,i:"📊"},
          {l:"Independencia",v:pc(t.ind),c:t.ind>=100?T.gn:T.tx2,i:t.ind>=100?"🏆":"📈"},
        ].map(k=><Cd key={k.l} s={{padding:"18px 20px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",fontWeight:600,letterSpacing:1}}>{k.l}</div><div style={{fontSize:22,fontWeight:700,color:k.c,marginTop:6}}>{k.v}</div></div><div style={{fontSize:22}}>{k.i}</div></div></Cd>)}
      </div>

      {/* ═══ ROW 3: Charts ═══ */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
        {/* Cash Flow Waterfall */}
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:14}}>Flujo de Caja Mensual</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={fd}><XAxis dataKey="name" tick={{fill:T.tx3,fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:T.tx3,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fm(v)}/><Tooltip contentStyle={{background:"#1e1e24",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,color:"#fafafa",fontSize:12}} labelStyle={{color:"#fafafa"}} itemStyle={{color:"#fafafa"}} formatter={v=>fm(v)}/><Bar dataKey="a" radius={[6,6,0,0]}>{fd.map((d,i)=><Cell key={i} fill={d.a>=0?T.gn:T.rd}/>)}</Bar></BarChart>
          </ResponsiveContainer>
        </Cd>
        {/* Patrimonio Distribution */}
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:14}}>Distribución Patrimonial</div>
          {pie.length>0?<ResponsiveContainer width="100%" height={180}>
            <PieChart><Pie data={pie} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>{pie.map((_,i)=><Cell key={i} fill={T.ch[i%T.ch.length]}/>)}</Pie><Tooltip contentStyle={{background:"#1e1e24",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,color:"#fafafa",fontSize:12}} labelStyle={{color:"#fafafa"}} itemStyle={{color:"#fafafa"}} formatter={v=>fm(v)}/><Legend wrapperStyle={{fontSize:11}}/></PieChart>
          </ResponsiveContainer>:<div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",color:T.tx3,fontSize:13}}>Agrega activos en Patrimonio</div>}
        </Cd>
      </div>

      {/* ═══ ROW 4: Income + Expenses breakdown ═══ */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
        {/* Top Ingresos */}
        <Cd s={{padding:0}}>
          <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+T.border}}>
            <span style={{fontSize:13,fontWeight:700,color:T.tx2}}>💰 Ingresos por fuente</span>
            <span style={{fontSize:13,fontWeight:700,color:T.gn}}>{fm(t.ti)}/mes</span>
          </div>
          {topInc.length>0?topInc.map((inc,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 20px",borderBottom:"1px solid "+T.border}}>
            <div><div style={{fontSize:13,fontWeight:600}}>{inc.nombre||"—"}</div><div style={{fontSize:10,color:T.tx3}}>{inc.categoria}{inc.capital>0?" • Capital: "+fm(inc.capital):""}{inc.tasa?" • "+inc.tasa+"%":""}</div></div>
            <div style={{fontWeight:700,fontFamily:"monospace",color:T.gn}}>{fm(inc.mensual||0)}</div>
          </div>):<div style={{padding:28,textAlign:"center",color:T.tx3,fontSize:13}}>Agrega ingresos</div>}
        </Cd>
        {/* Gastos by category */}
        <Cd s={{padding:0}}>
          <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+T.border}}>
            <span style={{fontSize:13,fontWeight:700,color:T.tx2}}>💳 Gastos por categoría</span>
            <span style={{fontSize:13,fontWeight:700,color:T.rd}}>{fm(t.gfm)}/mes</span>
          </div>
          {expPie.length>0?expPie.map((exp,i)=><div key={exp.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 20px",borderBottom:"1px solid "+T.border}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:T.ch[i%T.ch.length]}}/><span style={{fontSize:13}}>{exp.name}</span></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700,fontFamily:"monospace",color:T.rd}}>{fm(exp.value)}</span><span style={{fontSize:10,color:T.tx3}}>{t.gfm>0?pc((exp.value/t.gfm)*100):""}</span></div>
          </div>):<div style={{padding:28,textAlign:"center",color:T.tx3,fontSize:13}}>Agrega gastos</div>}
        </Cd>
      </div>

      {/* ═══ ROW 5: Projection + Independence Meter ═══ */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"2fr 1fr",gap:14}}>
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:14}}>Proyección Patrimonial (8% anual)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={pj}><CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="yr" tick={{fill:T.tx3,fontSize:10}} axisLine={false}/><YAxis tick={{fill:T.tx3,fontSize:10}} axisLine={false} tickFormatter={v=>fm(v)}/><Tooltip contentStyle={{background:"#1e1e24",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,color:"#fafafa",fontSize:12}} labelStyle={{color:"#fafafa"}} itemStyle={{color:"#fafafa"}} formatter={v=>fm(v)}/><Area type="monotone" dataKey="v" stroke={T.gn} fill={T.gn+"15"}/></AreaChart>
          </ResponsiveContainer>
        </Cd>
        {/* Independence Progress */}
        <Cd s={{padding:"24px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:16}}>Independencia Financiera</div>
          <div style={{position:"relative",height:14,background:T.bg3,borderRadius:7,overflow:"hidden",marginBottom:8}}>
            <div style={{height:"100%",width:Math.min(t.ind,150)+"%",maxWidth:"100%",background:t.ind>=100?"linear-gradient(90deg,#22c55e,#3b82f6)":"linear-gradient(90deg,#ef4444,#eab308)",borderRadius:7,transition:"width 0.5s"}}/>
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
      {/* ═══ ROW 6: Family Office KPIs ═══ */}
      {(() => {
        const nwUSD = trm > 0 ? t.nw / trm : t.nw / 4200;
        // Liquid assets (cash + investments, not real estate)
        const liquidAssets = ((u&&u.inv)||[]).filter(i => ["Investment","Fondo de Inversión","CDT","Acciones","Crypto","Renta Fija","Cash"].includes(i.tp||i.tipo)).reduce((s,i) => s + (i.va||0), 0);
        const runway = t.te > 0 ? Math.round(liquidAssets / t.te) : 999;
        const burnRate = t.nw > 0 ? ((t.te * 12) / t.nw * 100) : 0;
        const savingsRate = t.ti > 0 ? (t.cf / t.ti * 100) : 0;
        const fireNumber = t.te * 12 * 25;
        const fireProgress = fireNumber > 0 ? Math.min((t.nw / fireNumber) * 100, 100) : 0;
        const debtService = t.ti > 0 ? (t.tc / t.ti * 100) : 0;
        // Passive vs active income
        const passCats = ["Arriendo","Rendimiento","Dividendos","Inversión"];
        const passiveInc = ((u&&u.ingresos)||[]).filter(i => passCats.includes(i.categoria)).reduce((s,i) => s + (i.mensual||0), 0);
        const passiveRatio = t.ti > 0 ? (passiveInc / t.ti * 100) : 0;
        // Yield on cost
        const totalInvested = ((u&&u.inv)||[]).reduce((s,i) => s + (i.vc||0), 0);
        const yieldOnCost = totalInvested > 0 ? (t.ti * 12 / totalInvested * 100) : 0;
        // Concentration risk
        const maxAsset = ((u&&u.inv)||[]).reduce((max,i) => (i.va||0) > max.v ? {n:i.n||i.nombre||"",v:i.va||0} : max, {n:"",v:0});
        const concRisk = t.ab > 0 ? (maxAsset.v / t.ab * 100) : 0;

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
                <div key={k.l} style={{background:T.bg3,borderRadius:12,padding:"14px 16px"}}>
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
                <div key={k.l} style={{background:T.bg3,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,color:T.tx3,fontWeight:600,textTransform:"uppercase"}}>{k.l}</span>
                    <span style={{fontSize:14}}>{k.i}</span>
                  </div>
                  <div style={{fontSize:22,fontWeight:800,color:k.c,marginTop:6}}>{k.v}</div>
                  <div style={{fontSize:9,color:T.tx3,marginTop:4,lineHeight:1.3}}>{k.tip}</div>
                </div>
              ))}
            </div>
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
              <div style={{height:12,background:"rgba(255,255,255,0.05)",borderRadius:6,overflow:"hidden",marginBottom:6}}>
                <div style={{height:"100%",width:Math.min(fireProgress,100)+"%",background:fireProgress>=100?"linear-gradient(90deg,#22c55e,#3b82f6)":"linear-gradient(90deg,#eab308,#f97316)",borderRadius:6,transition:"width 0.5s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.tx3}}>
                <span>Tienes: {fm(t.nw)}</span>
                <span style={{color:fireProgress>=100?T.gn:"#eab308",fontWeight:700}}>{pc(fireProgress)}</span>
                <span>Meta: {fm(fireNumber)}</span>
              </div>
              {fireProgress<100&&<div style={{fontSize:10,color:T.tx3,marginTop:6}}>
                Te falta: {fm(fireNumber - t.nw)}. {t.cf>0 ? "Al ritmo actual ("+fm(t.cf)+"/mes de ahorro), llegas en ~"+Math.ceil((fireNumber-t.nw)/(t.cf*12))+" años." : "Necesitas generar ahorro mensual positivo."}
              </div>}
              {fireProgress>=100&&<div style={{fontSize:11,color:T.gn,fontWeight:700,marginTop:6}}>
                🏆 ¡Ya superaste tu FIRE number! Técnicamente puedes dejar de trabajar y vivir de tu patrimonio por 25+ años.
              </div>}
            </div>

            {/* FECHA LIBRE DE DEUDA */}
            {t.td > 0 && (() => {
              const deudas = ((u&&u.deu)||[]).map(d => ({...d, mt: d.mt||0, pg: d.pg||0, ts: d.ts||0})).filter(d => d.mt > 0 && d.pg > 0);
              const totalDeuda = deudas.reduce((s,d) => s + d.mt, 0);
              const totalCuota = deudas.reduce((s,d) => s + d.pg, 0);
              const mesesLibre = totalCuota > 0 ? Math.ceil(totalDeuda / totalCuota) : 0;
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
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
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
                      <div style={{fontSize:11,fontWeight:700,color:T.rd,marginBottom:6}}>🏔️ Estrategia Avalancha (ahorra más intereses)</div>
                      <div style={{fontSize:10,color:T.tx3,marginBottom:6}}>Paga primero la de mayor tasa de interés</div>
                      {avalancha.slice(0,4).map((d,i) => (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                          <span style={{color:i===0?T.rd:T.tx2}}>{i+1}. {d.n||d.nombre||"Deuda"}</span>
                          <span style={{color:T.tx3,fontFamily:"monospace"}}>{d.ts||0}% → {fm(d.pg)}/mes</span>
                        </div>
                      ))}
                    </div>
                    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#eab308",marginBottom:6}}>⛄ Estrategia Bola de Nieve (motivación rápida)</div>
                      <div style={{fontSize:10,color:T.tx3,marginBottom:6}}>Paga primero la más pequeña</div>
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
                const liquidA = ((u&&u.inv)||[]).filter(i => ["Investment","Fondo de Inversión","CDT","Cash","Renta Fija"].includes(i.tp||i.tipo)).reduce((s,i) => s + (i.va||0), 0);
                hitos.push({name:"Fondo de emergencia (6 meses)",target:emerFund,current:liquidA,icon:"🛡️"});
                // Milestone 2: Debt free
                const totalD = ((u&&u.deu)||[]).reduce((s,d) => s + (d.mt||0), 0);
                hitos.push({name:"Libre de deudas",target:totalD,current:Math.max(0,totalD - t.td),icon:"📋"});
                // Milestone 3: 50% independence
                const half = t.te * 12 * 12.5;
                hitos.push({name:"50% independencia",target:half,current:t.nw,icon:"⚡"});
                // Milestone 4: FIRE number
                hitos.push({name:"FIRE number (25× gastos)",target:fireNumber,current:t.nw,icon:"🔥"});
                // Milestone 5: Absolute freedom (2.5x gastos)
                const absol = t.te * 12 * 62.5;
                hitos.push({name:"Libertad absoluta (62.5× gastos)",target:absol,current:t.nw,icon:"👑"});
                
                return hitos.map((h,i) => {
                  const prog = h.target > 0 ? Math.min((h.current / h.target) * 100, 100) : 0;
                  const done = prog >= 100;
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                      <span style={{fontSize:14,width:20}}>{h.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
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
              <div style={{fontSize:11,color:T.tx3,fontWeight:600,marginBottom:10}}>⚠️ CONCENTRACIÓN DE RIESGO — ¿Qué tan diversificado estás?</div>
              {(() => {
                const assets = ((u&&u.inv)||[]).filter(i => (i.va||0) > 0).map(i => ({name:i.n||i.nombre||"",value:i.va||0,type:i.tp||i.tipo||"Otro"}));
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
                        <div style={{fontSize:11,fontWeight:700,color:T.tx2,marginBottom:6}}>Top 5 activos por valor</div>
                        {top3.map((a,i) => {
                          const pct = (a.value / totalA * 100);
                          const risk = pct > 40;
                          return (
                            <div key={i} style={{marginBottom:4}}>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
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
                        <div style={{fontSize:11,fontWeight:700,color:T.tx2,marginBottom:6}}>Diversificación por tipo</div>
                        {typeArr.map(([type,val],i) => {
                          const pct = (val / totalA * 100);
                          return (
                            <div key={type} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <div style={{width:8,height:8,borderRadius:2,background:T.ch[i%T.ch.length]}}/>
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
              <div style={{fontSize:11,color:T.tx3,fontWeight:600,marginBottom:10}}>📊 BENCHMARK — ¿Cómo rinde tu patrimonio vs alternativas?</div>
              {(() => {
                const totalInvested = ((u&&u.inv)||[]).reduce((s,i) => s + (i.vc||0), 0);
                const totalValue = ((u&&u.inv)||[]).reduce((s,i) => s + (i.va||0), 0);
                const gain = totalValue - totalInvested;
                const gainPct = totalInvested > 0 ? ((totalValue / totalInvested) - 1) * 100 : 0;
                const incomeYield = totalInvested > 0 ? (t.ti * 12 / totalInvested * 100) : 0;
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
                      <div key={i} style={{marginBottom:6}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
                          <span style={{color:i<2?T.tx:T.tx2,fontWeight:i<2?700:400}}>{b.name}</span>
                          <span style={{color:b.color,fontWeight:700}}>{b.pct>=0?"+":""}{b.pct.toFixed(1)}%</span>
                        </div>
                        <div style={{height:8,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden"}}>
                          <div style={{height:"100%",width:Math.max((Math.abs(b.pct)/maxPct)*100,2)+"%",background:b.color,borderRadius:4,opacity:i<2?1:0.6}}/>
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

            {/* PLANIFICACIÓN TRIBUTARIA */}
            <div style={{marginTop:14,background:T.bg3,borderRadius:12,padding:"14px 20px"}}>
              <div style={{fontSize:11,color:T.tx3,fontWeight:600,marginBottom:10}}>🏛️ ESTIMACIÓN TRIBUTARIA — Colombia 2026</div>
              {(() => {
                const ingAnual = t.ti * 12;
                const uvt2026 = 49799; // UVT 2026 estimado
                const ingUVT = ingAnual / uvt2026;
                // Tabla de renta personas naturales Colombia 2026
                let impuesto = 0;
                if (ingUVT > 1700) {
                  if (ingUVT <= 4100) impuesto = (ingUVT - 1700) * 0.19 * uvt2026;
                  else if (ingUVT <= 8670) impuesto = ((4100-1700)*0.19 + (ingUVT-4100)*0.28) * uvt2026;
                  else if (ingUVT <= 18970) impuesto = ((4100-1700)*0.19 + (8670-4100)*0.28 + (ingUVT-8670)*0.33) * uvt2026;
                  else if (ingUVT <= 31000) impuesto = ((4100-1700)*0.19 + (8670-4100)*0.28 + (18970-8670)*0.33 + (ingUVT-18970)*0.35) * uvt2026;
                  else impuesto = ((4100-1700)*0.19 + (8670-4100)*0.28 + (18970-8670)*0.33 + (31000-18970)*0.35 + (ingUVT-31000)*0.39) * uvt2026;
                }
                const tasaEfectiva = ingAnual > 0 ? (impuesto / ingAnual * 100) : 0;
                const impMes = impuesto / 12;
                const patrimonio4x1000 = t.ab * 0.004; // Impuesto al patrimonio simplificado
                const ganOcasional = ((u&&u.inv)||[]).reduce((s,i) => s + Math.max(0, (i.va||0) - (i.vc||0)), 0);
                const impGanOcasional = ganOcasional * 0.15; // 15% ganancia ocasional

                return (
                  <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:12}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:T.rd,marginBottom:8}}>Renta estimada 2026</div>
                      <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
                        Ingreso anual: <strong>{fm(ingAnual)}</strong><br/>
                        En UVT: <strong>{Math.round(ingUVT).toLocaleString()} UVT</strong><br/>
                        Impuesto estimado: <strong style={{color:T.rd}}>{fm(impuesto)}/año</strong><br/>
                        Tasa efectiva: <strong style={{color:T.rd}}>{tasaEfectiva.toFixed(1)}%</strong><br/>
                        Equivale a: <strong style={{color:T.rd}}>{fm(impMes)}/mes</strong>
                      </div>
                      <div style={{marginTop:8,fontSize:10,color:T.tx3}}>Tabla art. 241 E.T. — UVT 2026 estimado: ${uvt2026.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"#eab308",marginBottom:8}}>Otros impuestos estimados</div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                        <span style={{color:T.tx2}}>4×1000 (GMF estimado)</span>
                        <span style={{color:"#eab308",fontFamily:"monospace"}}>{fm(patrimonio4x1000)}/año</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                        <span style={{color:T.tx2}}>Ganancia ocasional (15%)</span>
                        <span style={{color:"#eab308",fontFamily:"monospace"}}>{fm(impGanOcasional)} potencial</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                        <span style={{color:T.tx2}}>Valorización acumulada</span>
                        <span style={{color:T.gn,fontFamily:"monospace"}}>{fm(ganOcasional)}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"8px 0",fontWeight:700}}>
                        <span style={{color:T.tx}}>Carga fiscal total estimada</span>
                        <span style={{color:T.rd}}>{fm(impuesto + patrimonio4x1000)}/año</span>
                      </div>
                      <div style={{fontSize:10,color:T.tx3,marginTop:4}}>Estas son estimaciones. Consulta con tu contador para optimizar.</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* FONDO EDUCACIÓN HIJOS */}
            {(() => {
              const gastosEdu = Object.values((u&&u.gas)||{}).flat().filter(g => 
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
                  <div style={{fontSize:11,color:T.tx3,fontWeight:600,marginBottom:10}}>🎓 FONDO DE EDUCACIÓN — Proyección universitaria</div>
                  <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:12}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",marginBottom:6}}>Gasto educativo actual</div>
                      <div style={{fontSize:12,color:T.tx2,lineHeight:1.8}}>
                        Mensual en educación: <strong style={{color:"#a78bfa"}}>{fm(gastoEduMes)}</strong><br/>
                        Anual: <strong>{fm(gastoEduMes * 12)}</strong><br/>
                        Hijos detectados: <strong>{numHijos}</strong>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",marginBottom:6}}>Universidad (por hijo)</div>
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
              <div style={{fontSize:11,color:T.gn,fontWeight:700,marginBottom:10}}>✅ ACCIONES RECOMENDADAS — Prioridades para tu situación</div>
              {(() => {
                const actions = [];
                // Check each area
                const runway2 = t.te > 0 ? Math.round((((u&&u.inv)||[]).filter(i => ["Investment","Fondo de Inversión","CDT","Cash","Renta Fija"].includes(i.tp||i.tipo)).reduce((s,i) => s + (i.va||0), 0)) / t.te) : 999;
                if (runway2 < 6) actions.push({pri:"🔴",text:"Fondo de emergencia insuficiente. Necesitas al menos 6 meses de gastos en activos líquidos.",cat:"Liquidez"});
                else if (runway2 < 12) actions.push({pri:"🟡",text:"Fondo de emergencia aceptable ("+runway2+" meses). Ideal: 12-24 meses.",cat:"Liquidez"});
                
                const debtSrv = t.ti > 0 ? (t.tc / t.ti * 100) : 0;
                if (debtSrv > 50) actions.push({pri:"🔴",text:"Más del 50% de tu ingreso va a deudas. Prioriza pagar la de mayor tasa.",cat:"Deuda"});
                else if (debtSrv > 30) actions.push({pri:"🟡",text:"El " + debtSrv.toFixed(0) + "% de tu ingreso va a deudas. Busca reducirlo debajo del 30%.",cat:"Deuda"});
                
                const maxA = ((u&&u.inv)||[]).reduce((max,i) => (i.va||0) > max.v ? {n:i.n||i.nombre||"",v:i.va||0} : max, {n:"",v:0});
                const concR = t.ab > 0 ? (maxA.v / t.ab * 100) : 0;
                if (concR > 40) actions.push({pri:"🟡",text:maxA.n + " es " + concR.toFixed(0) + "% de tu patrimonio. Diversifica para reducir riesgo.",cat:"Riesgo"});
                
                if (t.cf < 0) actions.push({pri:"🔴",text:"Tu cash flow es negativo. Gastas más de lo que ganas. Revisa gastos o busca más ingresos.",cat:"Cash Flow"});
                else if (t.ti > 0 && (t.cf/t.ti*100) < 10) actions.push({pri:"🟡",text:"Tu tasa de ahorro es baja (" + (t.cf/t.ti*100).toFixed(0) + "%). Intenta ahorrar al menos el 20%.",cat:"Ahorro"});
                
                const passI = ((u&&u.ingresos)||[]).filter(i => ["Arriendo","Rendimiento","Dividendos"].includes(i.categoria)).reduce((s,i) => s + (i.mensual||0), 0);
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
          </Cd>

      {/* ═══ ROW 8b: Historial Patrimonio ═══ */}
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
        return<Cd s={{padding:20,marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div><div style={{fontSize:13,fontWeight:700,color:T.bl}}>📈 Historial Patrimonio Neto</div><div style={{fontSize:11,color:T.tx3}}>{sorted.length} meses registrados</div></div><div style={{textAlign:"right"}}><div style={{fontSize:11,color:T.tx3}}>Último mes</div><div style={{fontSize:14,fontWeight:700,color:change>=0?T.gn:T.rd}}>{change>=0?"+":""}{fm(change)}</div></div></div>
          <div style={{display:"flex",alignItems:"flex-end",gap:3,height:100}}>
            {sorted.map((s,i)=>{const h=((s.nw-minVal)/range)*80+20;const m=parseInt(s.k.split("-")[1])-1;return<div key={s.k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}} title={months[m]+" "+s.k.split("-")[0]+": "+fm(s.nw)}><div style={{width:"100%",height:h,background:s.nw>=0?"linear-gradient(to top,"+T.gn+"40,"+T.gn+")":"linear-gradient(to top,"+T.rd+"40,"+T.rd+")",borderRadius:"4px 4px 0 0",minHeight:4,transition:"height 0.3s"}}/><div style={{fontSize:8,color:T.tx3}}>{months[m]}</div></div>})}
          </div>
        </Cd>;
      })()}

      {/* ═══ ROW 9: Liquidez Real + Costo de Vida ═══ */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:14,marginTop:14}}>
        {/* LIQUIDEZ REAL */}
        <Cd s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.bl,marginBottom:12}}>💧 Liquidez Real — ¿Cuánto puedes tener en efectivo?</div>
          {(() => {
            const cats = {
              inmediata: {label:"Inmediata (48h)",types:["Cash","CDT","Renta Fija"],color:T.gn,icon:"⚡"},
              corto: {label:"Corto plazo (30 días)",types:["Investment","Fondo de Inversión","Acciones","Crypto"],color:"#eab308",icon:"📅"},
              largo: {label:"Largo plazo (6+ meses)",types:["Real Estate","Bodega","Lote","Local Comercial","Negocio","Vehículo"],color:T.rd,icon:"🏗️"},
            };
            const totals2 = {};
            let grandTotal = 0;
            Object.entries(cats).forEach(([key, cat]) => {
              const val = ((u&&u.inv)||[]).filter(i => cat.types.includes(i.tp||i.tipo||"")).reduce((s,i) => s + (i.va||0), 0);
              totals2[key] = val;
              grandTotal += val;
            });

            return (
              <>
                {Object.entries(cats).map(([key, cat]) => {
                  const val = totals2[key];
                  const pct = grandTotal > 0 ? (val / grandTotal * 100) : 0;
                  return (
                    <div key={key} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                        <span style={{color:T.tx2}}>{cat.icon} {cat.label}</span>
                        <span style={{fontWeight:700,color:cat.color,fontFamily:"monospace"}}>{fm(val)} <span style={{fontWeight:400,fontSize:10}}>({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div style={{height:8,background:T.bg3,borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:pct+"%",background:cat.color,borderRadius:4}}/>
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
          <div style={{fontSize:13,fontWeight:700,color:"#f97316",marginBottom:12}}>⏱️ Tu Estilo de Vida en Números</div>
          {(() => {
            const gastoMes = t.te || 0;
            const gastoDia = gastoMes / 30;
            const gastoHora = gastoDia / 24;
            const gastoMin = gastoHora / 60;
            const ingresoHora = t.ti > 0 ? t.ti / 176 : 0; // 8h laborales
            const horasLibertad = ingresoHora > 0 ? gastoHora / ingresoHora : 0;

            return (
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  {[
                    {l:"Por mes",v:fm(gastoMes),icon:"📅"},
                    {l:"Por día",v:fm(Math.round(gastoDia)),icon:"☀️"},
                    {l:"Por hora",v:fm(Math.round(gastoHora)),icon:"⏰"},
                    {l:"Por minuto",v:fm(Math.round(gastoMin)),icon:"⚡"},
                  ].map(k => (
                    <div key={k.l} style={{background:T.bg3,borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                      <div style={{fontSize:10,color:T.tx3}}>{k.icon} {k.l}</div>
                      <div style={{fontSize:16,fontWeight:800,color:"#f97316",marginTop:2}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:T.bg3,borderRadius:8,padding:12,marginBottom:8}}>
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

      {/* ═══ ROW 10: Alertas Inteligentes ═══ */}
      <Cd s={{padding:20,marginTop:14,background:"linear-gradient(135deg,rgba(239,68,68,0.03),rgba(234,179,8,0.02))"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#eab308",marginBottom:12}}>🔔 Alertas del Asesor — Rebalanceo y Optimización</div>
        {(() => {
          const alerts = [];
          const inv = (u&&u.inv)||[];
          const ing = (u&&u.ingresos)||[];
          const totalA = inv.reduce((s,i) => s + (i.va||0), 0);
          
          // 1. Real estate concentration
          const reVal = inv.filter(i => ["Real Estate","Bodega","Lote","Local Comercial"].includes(i.tp||i.tipo)).reduce((s,i) => s + (i.va||0), 0);
          const rePct = totalA > 0 ? (reVal / totalA * 100) : 0;
          if (rePct > 60) alerts.push({type:"🔴",title:"Concentración inmobiliaria extrema",msg:"El "+rePct.toFixed(0)+"% de tu patrimonio está en inmuebles. Si el mercado inmobiliario cae, tu patrimonio se impacta fuertemente. Considera diversificar al menos "+fm(reVal*0.15)+" hacia renta fija, fondos o acciones internacionales.",cat:"Diversificación"});
          else if (rePct > 45) alerts.push({type:"🟡",title:"Alta exposición inmobiliaria",msg:"El "+rePct.toFixed(0)+"% está en inmuebles. Es común en Colombia pero te expone a riesgo de liquidez. Un portafolio balanceado tiene máximo 40% en un solo tipo de activo.",cat:"Diversificación"});

          // 2. Single asset risk
          const maxAsset = inv.reduce((max,i) => (i.va||0) > max.v ? {n:i.n||i.nombre||"",v:i.va||0} : max, {n:"",v:0});
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
          const vehVal = vehiculos.reduce((s,i) => s + (i.va||0), 0);
          const vehPct = totalA > 0 ? (vehVal / totalA * 100) : 0;
          if (vehPct > 5) alerts.push({type:"🟡",title:"Vehículos = "+vehPct.toFixed(1)+"% del patrimonio",msg:"Los vehículos pierden ~15% de valor por año. "+fm(vehVal)+" en activos que se deprecian. Un family office los considera gastos, no inversiones.",cat:"Depreciación"});

          // 7. Positive alerts
          const passI = ing.filter(i => ["Arriendo","Rendimiento","Dividendos"].includes(i.categoria)).reduce((s,i) => s + (i.mensual||0), 0);
          const passR = t.ti > 0 ? (passI / t.ti * 100) : 0;
          if (passR >= 80) alerts.push({type:"🟢",title:"Ingreso pasivo "+passR.toFixed(0)+"% — excelente",msg:"La mayoría de tu ingreso no depende de tu trabajo. Esto te da libertad y reduce riesgo. Mantén esta estructura.",cat:"Independencia"});

          const fireN = t.te * 12 * 25;
          const fireP = fireN > 0 ? (t.nw / fireN * 100) : 0;
          if (fireP >= 100) alerts.push({type:"🟢",title:"FIRE alcanzado — libertad financiera",msg:"Tu patrimonio supera tu FIRE number. Técnicamente puedes vivir de tus activos por 25+ años sin trabajar.",cat:"Libertad"});
          else if (fireP >= 70) alerts.push({type:"🟢",title:"FIRE al "+fireP.toFixed(0)+"% — muy cerca",msg:"Te falta "+fm(fireN - t.nw)+" para la independencia total. Al ritmo actual, "+( t.cf>0 ? "llegas en ~"+Math.ceil((fireN-t.nw)/(t.cf*12))+" años." : "necesitas generar ahorro."),cat:"Progreso"});

          if (alerts.length === 0) alerts.push({type:"🟢",title:"Sin alertas",msg:"Tu situación financiera está bien balanceada. Sigue monitoreando mensualmente.",cat:"General"});

          return (
            <div style={{display:"grid",gap:8}}>
              {alerts.sort((a,b) => {const o={"🔴":0,"🟡":1,"🟢":2};return (o[a.type]||2)-(o[b.type]||2)}).map((a,i) => (
                <div key={i} style={{display:"flex",gap:10,padding:12,background:a.type==="🔴"?"rgba(239,68,68,0.06)":a.type==="🟡"?"rgba(234,179,8,0.04)":"rgba(34,197,94,0.04)",border:"1px solid "+(a.type==="🔴"?"rgba(239,68,68,0.12)":a.type==="🟡"?"rgba(234,179,8,0.1)":"rgba(34,197,94,0.1)"),borderRadius:10}}>
                  <span style={{fontSize:18,flexShrink:0,marginTop:2}}>{a.type}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,fontWeight:700,color:a.type==="🔴"?T.rd:a.type==="🟡"?"#eab308":T.gn}}>{a.title}</span>
                      <span style={{fontSize:9,color:T.tx3,background:T.bg3,padding:"2px 8px",borderRadius:4}}>{a.cat}</span>
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
        
case"inv":return<InversionesModule inversiones={(u&&u.inv)||[]} deudas={(u&&u.deu)||[]} onUpdate={v=>upd("inv",v)} fmt={fm} onImport={()=>setShowImport(true)}/>;
    case"ing":return<IngresosModule ingresos={(u&&u.ingresos)||[]} onUpdate={v=>upd("ingresos",v)} trm={trm} cur={cur} fmt={fm} onImport={()=>setShowImport(true)}/>;
    case"trd":return gated("trd","Básico",<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,margin:0}}>Trading</h2><Bt sz="s" onClick={async()=>{
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
                  alert("✅ Precios actualizados: "+Object.keys(d.prices).length+" acciones");
                }else{alert("No se encontraron precios")}
              }catch(e){alert("Error: "+e.message)}
            }} st={{background:"#3b82f6",color:"#fff"}}>📊 Actualizar Precios</Bt><Bt sz="s" onClick={()=>{sF({});setMd("ib")}}>+ Posición</Bt>{((u&&u.ibk)||[]).length>1&&<Bt v="d" sz="s" onClick={()=>{if(confirm("⚠️ ¿Eliminar TODAS las posiciones de trading?"))upd("ibk",[])}}>🗑️ Limpiar</Bt>}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:16}}><Cd><St l="Valor" v={fm(ib.tv)} cl={T.gn}/></Cd><Cd><St l="P/L" v={fm(ib.pnl)} cl={ib.pnl>=0?T.gn:T.rd} sub={pc(ib.pp)}/></Cd><Cd><St l="Posiciones" v={ib.pos.length}/></Cd></div><Cd s={{padding:0}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Ticker","Nombre","Qty","Costo","Precio","Valor","P/L","%","Upside"].map(h=><th key={h} style={{padding:"9px 12px",textAlign:["Ticker","Nombre"].includes(h)?"left":"right",color:T.tx3,fontWeight:600,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>{h}</th>)}</tr></thead><tbody>{ib.pos.map((p,i)=><tr key={i} style={{borderBottom:`1px solid ${T.border}`}}><td style={{padding:"9px 12px",fontWeight:700,color:T.gn,fontFamily:"monospace"}}>{p.tk}</td><td style={{padding:"9px 12px"}}>{p.n}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>{p.sh}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>${p.cb.toFixed(2)}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>${p.pr.toFixed(2)}</td><td style={{padding:"9px 12px",textAlign:"right",fontWeight:600}}>{fm(p.va)}</td><td style={{padding:"9px 12px",textAlign:"right",fontWeight:600,color:p.pnl>=0?T.gn:T.rd}}>{fm(p.pnl)}</td><td style={{padding:"9px 12px",textAlign:"right",color:p.pp>=0?T.gn:T.rd}}>{pc(p.pp)}</td><td style={{padding:"9px 12px",textAlign:"right",color:T.bl}}>{pc(p.up)}</td></tr>)}</tbody></table></div></Cd><Md open={md==="ib"} onClose={()=>setMd(null)} title="Agregar Posición"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>{[["tk","Ticker"],["n","Nombre"],["sh","Cantidad","number"],["cb","Costo","number"],["pr","Precio","number"],["tg","Objetivo","number"]].map(([k,l,tp])=><In key={k} l={l} value={f[k]} onChange={v=>sF(p=>({...p,[k]:v}))} type={tp}/>)}</div><div style={{display:"flex",gap:12,justifyContent:"flex-end"}}><Bt v="s" onClick={()=>setMd(null)}>Cancelar</Bt><Bt onClick={()=>{add("ibk",{tk:f.tk||"",n:f.n||"",sh:+f.sh||0,cb:+f.cb||0,pr:+f.pr||0,tg:+f.tg||0});setMd(null);sF({})}}>Agregar</Bt></div></Md></div>);
        case"gas":return<GastosModule gastos={(u&&u.gas)||{}} onUpdate={v=>upd("gas",v)} fmt={fm} onImport={()=>setShowImport(true)}/>;
        case"deu":return<DeudasModule deudas={(u&&u.deu)||[]} inversiones={(u&&u.inv)||[]} onUpdate={v=>upd("deu",v)} fmt={fm} onImport={()=>setShowImport(true)}/>;
    case"met":return<MetasModule metas={(u&&u.metas)||[]} onUpdate={v=>upd("metas",v)} cashFlow={t.cf} fmt={fm}/>;
    case"sim":return<SimuladorAvanzado user={{inv:(u&&u.inv)||[],gastos:(u&&u.gas)||{},deudas:(u&&u.deu)||[],ibkr:(u&&u.ibk)||[],ingresos:(u&&u.ingresos)||[]}} totals={t} fmt={fm}/>;
    case"pat":{const bc={};((u&&u.inv)||[]).forEach(i=>{const tp=(i.tp&&isNaN(Number(i.tp))&&i.tp!=="undefined")?i.tp:"Otro";bc[tp]=(bc[tp]||0)+(i.va||0)});if(ib.tv>0)bc.Trading=ib.tv;const pie=Object.entries(bc).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);const gr=t.ab+ib.tv;return<div><h2 style={{fontSize:22,fontWeight:700,margin:"0 0 20px"}}>Patrimonio</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:16}}><Cd><St l="Activos" v={fm(gr)} cl={T.gn}/></Cd><Cd><St l="Pasivos" v={fm(t.td)} cl={T.rd}/></Cd><Cd><St l="Neto" v={fm(t.nw)} cl={T.bl}/></Cd></div><div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:14}}><Cd s={{padding:20}}><div style={{fontSize:12,fontWeight:600,color:T.tx2,marginBottom:14}}>Distribución</div>{pie.length>0?<ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pie} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>{pie.map((_,i)=><Cell key={i} fill={T.ch[i%T.ch.length]}/>)}</Pie><Tooltip contentStyle={{background:"#1e1e24",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,color:"#fafafa",fontSize:12}} labelStyle={{color:"#fafafa"}} itemStyle={{color:"#fafafa"}} formatter={v=>fm(v)}/><Legend/></PieChart></ResponsiveContainer>:<div style={{height:220,display:"flex",alignItems:"center",justifyContent:"center",color:T.tx3}}>Agrega datos</div>}</Cd><Cd s={{padding:20}}><div style={{fontSize:12,fontWeight:600,color:T.tx2,marginBottom:14}}>Desglose</div>{pie.map((a,i)=><div key={a.name} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:T.ch[i%T.ch.length]}}/><span style={{fontSize:13}}>{a.name}</span></div><span style={{fontWeight:600,fontFamily:"monospace"}}>{fm(a.value)} <span style={{fontSize:11,color:T.tx3}}>{pc((a.value/gr)*100)}</span></span></div>)}</Cd></div></div>}
    case"pen":return gated("pen","Básico",<PensionesColpensiones trm={(u&&u.trm)||4200}/>);
    case"btc":return gated("btc","Básico",<PensionColombia trm={(u&&u.trm)||4200}/>);
    case"asesor":return gated("asesor","Pro",<AsesorIA user={{inv:(u&&u.inv)||[],gas:(u&&u.gas)||{},deu:(u&&u.deu)||[],ingresos:(u&&u.ingresos)||[]}} totals={t} userId={authUser?.id}/>);
    case"coach":{const msgs=adv?getCoach(adv.id):[];return gated("coach","Pro",<div><div style={{textAlign:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,margin:"0 0 6px"}}>Coaches Financieros IA</h2><p style={{color:T.tx3,fontSize:13}}>5 asesores analizan tus datos</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginBottom:20}}>{ADV.map(a=>{const ac=adv?.id===a.id;return<button key={a.id} onClick={()=>sAdv(a)} style={{background:ac?`linear-gradient(135deg,${a.cl}20,${a.cl}10)`:T.card,border:`1px solid ${ac?a.cl:T.border}`,color:T.tx,padding:"14px 20px",borderRadius:14,cursor:"pointer",textAlign:"center",minWidth:90}}><div style={{fontSize:22,marginBottom:4}}>{a.av}</div><div style={{fontWeight:700,fontSize:11,color:ac?a.cl:T.tx}}>{a.nm}</div><div style={{fontSize:9,color:ac?`${a.cl}aa`:T.tx3}}>{a.ti}</div></button>})}</div><Cd>{adv?<div style={{padding:20}}><div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:14,borderBottom:`2px solid ${adv.cl}`,marginBottom:20}}><span style={{fontSize:28}}>{adv.av}</span><div><div style={{fontWeight:700,fontSize:15}}>{adv.nm}</div><div style={{fontSize:12,color:T.tx3}}>{adv.ti}</div></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:6,marginBottom:20}}>{[{l:"Patrimonio",v:fm(t.nw),c:T.tx},{l:"Cash Flow",v:fm(t.cf),c:t.cf>=0?T.gn:T.rd},{l:"Independencia",v:pc(t.ind),c:t.ind>=100?T.gn:T.tx2},{l:"Deuda/Act",v:pc(t.dta),c:t.dta<30?T.gn:T.rd}].map(m=><div key={m.l} style={{background:T.bg3,padding:8,borderRadius:8,borderLeft:`3px solid ${m.c}`}}><div style={{fontSize:9,color:T.tx3,textTransform:"uppercase"}}>{m.l}</div><div style={{fontSize:15,fontWeight:700,color:m.c}}>{m.v}</div></div>)}</div>{msgs.map((msg,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:14}}><div style={{width:32,height:32,borderRadius:"50%",background:adv.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{adv.av}</div><div style={{flex:1,background:adv.bg,padding:"14px 18px",borderRadius:"0 14px 14px 14px",border:`1px solid ${adv.cl}10`}}><div style={{fontWeight:700,fontSize:13,color:adv.cl,marginBottom:6}}>{msg.t}</div><div style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",color:T.tx}}>{msg.c}</div></div></div>)}</div>:<div style={{padding:56,textAlign:"center",color:T.tx3}}><div style={{fontSize:40,marginBottom:12}}>👆</div><p>Selecciona un coach</p></div>}</Cd></div>)}
    case"price":{
      const plans=[
        {n:"Free",p:{mensual:"$0",anual:"$0"},pr:{mensual:"gratis",anual:"gratis"},save:null,
         f:["Dashboard básico","3 inversiones","Gastos y deudas","Simulador limitado","1 meta financiera"],
         no:["🤖 Asesor IA","Coaches IA","Pensiones","Trading","Alertas","PDF export"],
         cur:plan==="free"},
        {n:"Básico",p:{mensual:"$8",anual:"$6"},pr:{mensual:"/mes",anual:"/mes"},save:"Ahorra 25%",
         f:["Todo en Free","10 inversiones","10 metas","Simulador avanzado","Pensiones Colpensiones","BTC Simulator","Trading portfolio","CSV import","PDF export"],
         no:["🤖 Asesor IA","Coaches IA","Family Office KPIs","Alertas"],
         cur:plan==="basico",ac:false},
        {n:"Pro",p:{mensual:"$16",anual:"$12"},pr:{mensual:"/mes",anual:"/mes"},save:"Ahorra 25%",
         f:["Todo en Básico","Inversiones ilimitadas","Metas ilimitadas","🤖 Asesor Financiero IA","5 Coaches IA","Family Office KPIs","Alertas inteligentes","Percentil de riqueza","Concentración de riesgo","Benchmark vs mercado","Estimación tributaria","Fondo educación hijos","Resumen ejecutivo","Liquidez real","Costo de vida","Soporte prioritario"],
         no:[],
         cur:plan==="pro",ac:true}
      ];
      return<div>
        <div style={{textAlign:"center",marginBottom:32}}>
          <h2 style={{fontSize:26,fontWeight:800,margin:"0 0 8px"}}>Elige tu plan</h2>
          <p style={{color:T.tx3,fontSize:15}}>Herramientas de family office al alcance de todos</p>
          <div style={{display:"inline-flex",background:T.bg3,borderRadius:10,padding:3,marginTop:16}}>
            {["mensual","anual"].map(c=>(
              <button key={c} onClick={()=>setBillingCycle(c)} style={{padding:"8px 24px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:billingCycle===c?T.gn:"transparent",color:billingCycle===c?"#000":T.tx3}}>{c==="mensual"?"Mensual":"Anual (ahorra 25%)"}</button>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr 1fr",gap:16,maxWidth:950,margin:"0 auto"}}>
          {plans.map(pl=>(
            <Cd key={pl.n} s={{border:pl.ac?"2px solid "+T.gn:"1px solid "+T.border,position:"relative"}}>
              {pl.ac&&<div style={{background:"linear-gradient(135deg,"+T.gn+",#16a34a)",color:"#fff",textAlign:"center",padding:"6px 0",fontSize:12,fontWeight:700}}>MÁS POPULAR</div>}
              <div style={{padding:28}}>
                <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>{pl.n}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:4}}>
                  <span style={{fontSize:40,fontWeight:800,color:pl.ac?T.gn:T.tx}}>{pl.p[billingCycle]}</span>
                  <span style={{color:T.tx3,fontSize:14}}>{pl.pr[billingCycle]}</span>
                </div>
                {billingCycle==="anual"&&pl.save&&<div style={{fontSize:12,color:T.gn,fontWeight:600,marginBottom:12}}>{pl.save} — {pl.n==="Básico"?"$72/año (vs $96 mensual)":"$144/año (vs $192 mensual)"}</div>}
                {billingCycle==="mensual"&&pl.save&&<div style={{fontSize:12,color:T.tx3,marginBottom:12}}>o paga anual y ahorra 25%</div>}
                {!pl.save&&<div style={{marginBottom:12}}/>}
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
                  {pl.f.map(f=><div key={f} style={{fontSize:13,color:T.tx2}}><span style={{color:T.gn,marginRight:8}}>✓</span>{f}</div>)}
                  {(pl.no||[]).map(f=><div key={f} style={{fontSize:13,color:T.tx3}}><span style={{color:T.tx3,marginRight:8}}>✗</span>{f}</div>)}
                </div>
                <Bt v={pl.ac?"p":pl.cur?"s":"p"} sz="m" st={{width:"100%",justifyContent:"center"}} onClick={()=>{if(!pl.cur)(async()=>{
                  try{
                    const prices={
                      "Básico":{mensual:"price_1TIGRWKEnhNr9wQd2oEgNin9",anual:"price_1TIGRWKEnhNr9wQdJTMTGfYa"},
                      "Pro":{mensual:"price_1TIGRXKEnhNr9wQdC8eKj2xS",anual:"price_1TIGRYKEnhNr9wQd7QTFxT6z"}
                    };
                    const priceId=prices[pl.n]?.[billingCycle];
                    if(!priceId)return;
                    const r=await fetch("/.netlify/functions/stripe-checkout",{
                      method:"POST",
                      headers:{"Content-Type":"application/json"},
                      body:JSON.stringify({priceId,email:u?.p?.email||"",userId:authUser?.id||"",successUrl:window.location.origin+"/?success=true",cancelUrl:window.location.origin+"/?canceled=true"})
                    });
                    const d=await r.json();
                    if(d.url)window.location.href=d.url;
                    else alert("Error: "+(d.error||"No se pudo crear la sesión"));
                  }catch(e){alert("Error conectando con Stripe: "+e.message)}
                })()}}>{pl.cur?"Plan actual":"Comenzar"}</Bt>
              </div>
            </Cd>
          ))}
        </div>
        <div style={{textAlign:"center",marginTop:24,color:T.tx3,fontSize:13,lineHeight:1.8}}>
          🔒 Pagos seguros con Stripe • Cancela cuando quieras • Sin compromisos<br/>
          💬 ¿Preguntas? Escríbenos a soporte@finpath.co
        </div>
      </div>}
    case"resumen":{
      const nwUSD=trm>0?t.nw/trm:t.nw/4200;
      const passI=((u&&u.ingresos)||[]).filter(i=>["Arriendo","Rendimiento","Dividendos"].includes(i.categoria)).reduce((s,i)=>s+(i.mensual||0),0);
      const passR=t.ti>0?(passI/t.ti*100):0;
      const totalInv=((u&&u.inv)||[]).reduce((s,i)=>s+(i.vc||0),0);
      const totalVal=((u&&u.inv)||[]).reduce((s,i)=>s+(i.va||0),0);
      const gainPct=totalInv>0?((totalVal/totalInv)-1)*100:0;
      const fireN=t.te*12*25;
      const fireProg=fireN>0?Math.min((t.nw/fireN)*100,100):0;
      const fecha=new Date().toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"});
      return<div style={{maxWidth:800,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <button onClick={()=>setPg("dash")} style={{background:T.bg3,border:"none",color:T.tx2,padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13}}>← Dashboard</button>
          <button onClick={generatePDF} style={{background:T.gn,color:"#000",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>📄 Reporte PDF</button>
        </div>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:20,padding:32}}>
          <div style={{borderBottom:"2px solid "+T.gn,paddingBottom:16,marginBottom:20}}>
            <div style={{fontSize:22,fontWeight:800,color:T.gn}}>FINPATHIA — Resumen Ejecutivo</div>
            <div style={{fontSize:13,color:T.tx3,marginTop:4}}>{u?.p?.name||"Usuario"} • {fecha}</div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:24}}>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:10,color:T.tx3}}>PATRIMONIO NETO</div>
              <div style={{fontSize:24,fontWeight:800,color:T.gn,marginTop:4}}>{fm(t.nw)}</div>
              <div style={{fontSize:10,color:T.tx3}}>≈ USD ${Math.round(nwUSD).toLocaleString()}</div>
            </div>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:10,color:T.tx3}}>CASH FLOW MENSUAL</div>
              <div style={{fontSize:24,fontWeight:800,color:t.cf>=0?T.gn:T.rd,marginTop:4}}>{fm(t.cf)}</div>
              <div style={{fontSize:10,color:T.tx3}}>{fm(t.cf*12)}/año</div>
            </div>
            <div style={{textAlign:"center",padding:16,background:T.bg3,borderRadius:12}}>
              <div style={{fontSize:10,color:T.tx3}}>INDEPENDENCIA</div>
              <div style={{fontSize:24,fontWeight:800,color:t.ind>=100?T.gn:"#eab308",marginTop:4}}>{(t.ind).toFixed(0)}%</div>
              <div style={{fontSize:10,color:T.tx3}}>FIRE: {fireProg.toFixed(0)}%</div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>💰 Ingresos mensuales</div>
              {((u&&u.ingresos)||[]).filter(i=>(i.mensual||0)>0).sort((a,b)=>(b.mensual||0)-(a.mensual||0)).slice(0,6).map((i,idx)=>(
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
              {Object.entries((u&&u.gas)||{}).map(([cat,items])=>({cat,total:items.reduce((s,g)=>s+(g.m||0),0)})).sort((a,b)=>b.total-a.total).slice(0,5).map((g,idx)=>(
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

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:24}}>
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
              const byType={};((u&&u.inv)||[]).forEach(i=>{const tp=i.tp||i.tipo||"Otro";byType[tp]=(byType[tp]||0)+(i.va||0)});
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

          {((u&&u.deu)||[]).length>0&&<div style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:8}}>📋 Obligaciones financieras</div>
            {((u&&u.deu)||[]).map((d,i)=>(
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
    case"set":return<div><h2 style={{fontSize:22,fontWeight:700,margin:"0 0 20px"}}>Configuración</h2><div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:20}}><Cd s={{padding:20}}><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 16px"}}>Perfil</h3><div style={{display:"flex",flexDirection:"column",gap:14}}><In l="Nombre" value={u?.p?.name||""} onChange={v=>setU(p=>({...p,p:{...p.p,name:v}}))}/><In l="Email" value={u?.p?.email||""} onChange={v=>setU(p=>({...p,p:{...p.p,email:v}}))}/><In l="TRM (Tasa de cambio USD→COP)" value={(u&&u.trm)} onChange={v=>setU(p=>({...p,trm:+v||4200}))} type="number"/></div></Cd><Cd s={{padding:20}}><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 16px"}}>Datos</h3><div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{padding:12,background:T.bg3,borderRadius:10,fontSize:13}}><strong>Plan:</strong> {plan} {plan!=="pro"&&<span onClick={()=>setPg("price")} style={{color:T.gn,cursor:"pointer",fontWeight:600}}> → Upgrade</span>}</div>{isAdmin&&<div style={{padding:12,background:T.bg3,borderRadius:10,fontSize:13}}><strong>Plan manual:</strong> <select value={(u?.p?.plan)||"free"} onChange={e=>setU(p=>({...p,p:{...p.p,plan:e.target.value}}))} style={{background:T.bg2,border:"1px solid "+T.border,color:T.tx,padding:"4px 8px",borderRadius:6,marginLeft:8}}><option value="free">Free</option><option value="basico">Básico</option><option value="pro">Pro</option></select></div>}<Bt v="s" onClick={()=>{if(((u&&u.inv)||[]).length>0||Object.keys((u&&u.gas)||{}).length>0){if(!confirm("⚠️ Esto reemplazará tus datos actuales con datos de ejemplo. ¿Continuar?"))return}demo()}} st={{justifyContent:"center"}}>Cargar datos demo</Bt><Bt v="s" onClick={()=>{const d=localStorage.getItem(SK);if(!d)return alert("No hay datos");const b=new Blob([d],{type:"application/json"});const u2=URL.createObjectURL(b);const a=document.createElement("a");a.href=u2;a.download="finpathia-backup-"+new Date().toISOString().split("T")[0]+".json";a.click()}} st={{justifyContent:"center"}}>📥 Exportar Datos (JSON)</Bt>
              <Bt v="s" onClick={()=>{try{const backups=JSON.parse(localStorage.getItem("fp3_backups")||"[]");if(!backups.length){alert("No hay backups disponibles");return}const last=backups[backups.length-1];const d=JSON.parse(last.data);if(confirm("¿Restaurar backup del "+new Date(last.date).toLocaleDateString("es-CO")+"? Esto reemplazará tus datos actuales.")){setU(sanitize(d));showToast("✅ Backup restaurado")}}catch{alert("Error restaurando backup")}}} st={{justifyContent:"center"}}>🔄 Restaurar último backup</Bt>
              <Bt v="s" onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept=".json";inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);localStorage.setItem(SK,JSON.stringify(d));setU(sanitize(d));alert("✅ Datos importados correctamente. Recarga la página.")}catch{alert("Error: archivo no válido")}};r.readAsText(f)};inp.click()}} st={{justifyContent:"center"}}>📤 Importar Datos (JSON)</Bt>
              <Bt v="d" onClick={()=>{if(confirm("⚠️ ¿Borrar TODOS tus datos financieros? Esta acción no se puede deshacer. Tus inversiones, gastos, ingresos y deudas se perderán."))setU(mkU(u?.p?.name||"Usuario",u?.p?.email||""))}} st={{justifyContent:"center"}}>Borrar Datos</Bt></div></Cd></div>
      <div style={{marginTop:20,padding:16,background:T.bg3,borderRadius:12,fontSize:11,color:T.tx3,lineHeight:1.6,textAlign:"center"}}>
        FINPATHIA v12.5 • Tus datos están protegidos con encriptación<br/>
        ¿Necesitas ayuda? <span style={{color:T.gn}}>soporte@finpathia.com</span>
      </div></div>;
    default:return<div style={{padding:56,textAlign:"center",color:T.tx3}}>Próximamente</div>}};

  return<div style={{background:T.bg,minHeight:"100vh",display:"flex",fontFamily:"'Inter',system-ui",color:T.tx}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:${T.bg}}input:focus,select:focus{border-color:${T.gn}!important;outline:none}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.bg3};border-radius:3px}::selection{background:${T.gn}30}`}</style>
    {sb&&<aside style={{width:220,minWidth:220,height:"100vh",position:mb?"fixed":"sticky",top:0,background:T.bg2,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",zIndex:100,overflowY:"auto"}}><div style={{padding:"20px 18px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontSize:16,fontWeight:800,color:T.gn}}>FINPATHIA</div>{mb&&<button onClick={()=>sSb(false)} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:16}}>✕</button>}</div><nav style={{flex:1,padding:"0 8px"}}>{nvs.map(n=>{if(n.sep)return<div key={n.id} style={{padding:n.l?"10px 12px 4px":"6px 0",fontSize:9,fontWeight:700,color:T.tx3,letterSpacing:"0.1em",borderTop:n.l?`1px solid ${T.border}`:"none",marginTop:n.l?4:0}}>{n.l||""}</div>;const a=pg===n.id;return<button key={n.id} onClick={()=>{setPg(n.id);if(mb)sSb(false)}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:a?600:400,marginBottom:1,background:a?T.gnB:"transparent",color:a?T.gn:T.tx2,transition:"all .15s"}}><span style={{fontSize:14}}>{n.i}</span>{n.l}{n.id==="price"&&plan==="free"&&<span style={{marginLeft:"auto",background:T.gn,color:"#000",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:99}}>PRO</span>}</button>})}</nav><div style={{padding:12,borderTop:`1px solid ${T.border}`}}><div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:8}}><div style={{width:28,height:28,borderRadius:99,background:T.gnB,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:T.gn}}>{(u?.p?.name||"U").charAt(0)}</div><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{u?.p?.name||"Usuario"}</div><div style={{fontSize:10,color:T.tx3}}>{plan==="free"?(trialEnd?"Free":"Free"):plan==="basico"?"Básico ⚡":trialActive?"Pro ⭐ Trial":"Pro ⭐"}</div></div></div><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",marginBottom:6,fontSize:10,color:T.tx3}}><span>🔒</span> Datos encriptados y privados</div><button onClick={()=>window.open("https://wa.me/?text=🏦 Encontré esta plataforma para gestionar tu patrimonio con inteligencia artificial.%0A%0APones tus inversiones, ingresos, gastos y deudas → te dice en qué nivel de libertad financiera estás, simula escenarios y un asesor IA analiza tus números reales.%0A%0A14 días gratis del plan completo, sin tarjeta.%0A%0A👉 https://finpathia.com","_blank")} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(37,211,102,0.1)",border:"1px solid rgba(37,211,102,0.2)",color:"#25d366",cursor:"pointer",padding:"8px",borderRadius:8,fontSize:12,marginBottom:6}}>💬 Compartir por WhatsApp</button><button onClick={logout} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:T.bg3,border:"1px solid "+T.border,color:T.tx3,cursor:"pointer",padding:"8px",borderRadius:8,fontSize:12}}>🚪 Cerrar sesión</button></div></aside>}
    {mb&&sb&&<div onClick={()=>sSb(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99}}/>}
    <main style={{flex:1,minWidth:0,display:"flex",flexDirection:"column"}}><header style={{height:52,padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`,background:T.bg2,position:"sticky",top:0,zIndex:50}}><div style={{display:"flex",alignItems:"center",gap:10}}>{(!sb||mb)&&<button onClick={()=>sSb(true)} style={{background:"none",border:"none",color:T.tx2,cursor:"pointer",fontSize:18}}>☰</button>}{!sb&&<span style={{fontSize:14,fontWeight:800,color:T.gn}}>FINPATHIA</span>}</div><div style={{display:"flex",alignItems:"center",gap:10}}><button onClick={()=>setShowImport(true)} style={{background:"linear-gradient(135deg,#3b82f6,#2563eb)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11,display:"flex",alignItems:"center",gap:4,marginRight:6}}>📥 Importar Excel</button><Bg cl={T.gn}>{fm(t.nw)}</Bg><button onClick={()=>setCur(c=>c==="COP"?"USD":"COP")} style={{background:cur==="USD"?"#3b82f6":"#22c55e",border:"none",color:"#fff",padding:"4px 10px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:11,marginLeft:4}}>{cur==="USD"?"🇺🇸 USD":"🇨🇴 COP"}</button>{u.trm&&<span style={{fontSize:10,color:T.tx3,marginLeft:4}}>TRM: ${Math.round(u.trm).toLocaleString()}</span>}{plan==="free"&&<Bt sz="s" onClick={()=>setPg("price")}>Upgrade</Bt>}</div></header><div style={{flex:1,padding:mb?14:28,maxWidth:1200,width:"100%"}}>{rp()}</div>{showImport&&<CsvImport onImport={handleImport} onClose={()=>setShowImport(false)}/>}{toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#22c55e",color:"#000",padding:"12px 24px",borderRadius:12,fontWeight:700,fontSize:13,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",animation:"slideUp 0.3s ease"}}>{toast}</div>}</main>
  </div>;
}
