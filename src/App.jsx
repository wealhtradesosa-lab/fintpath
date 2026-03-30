import LandingPage from "./components/LandingPage";
import IngresosModule from "./components/IngresosModule";
import GastosModule from "./components/GastosModule";
import InversionesModule from "./components/InversionesModule";
import DeudasModule from "./components/DeudasModule";
import PensionesColpensiones from "./components/PensionesColpensiones";
import CsvImport from "./components/CsvImport";
import PensionColombia from "./components/PensionColombia";
import SimuladorAvanzado from "./components/SimuladorAvanzado";
import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend } from "recharts";

const T={bg:"#09090b",bg2:"#18181b",bg3:"#27272a",card:"#111113",border:"rgba(255,255,255,0.06)",borderL:"rgba(255,255,255,0.1)",tx:"#fafafa",tx2:"#a1a1aa",tx3:"#71717a",gn:"#22c55e",gnB:"rgba(34,197,94,0.08)",rd:"#ef4444",rdB:"rgba(239,68,68,0.06)",bl:"#3b82f6",pr:"#a78bfa",or:"#f59e0b",gd:"#eab308",ch:["#22c55e","#3b82f6","#f59e0b","#a78bfa","#ec4899","#06b6d4","#eab308"]};
const fm=n=>n==null?"$0":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
const pc=n=>(n||0).toFixed(1)+"%";
const SK="fp3";
const sL=async()=>{try{const r=localStorage.getItem(SK);return r?JSON.parse(r):null}catch{return null}};
const sS=async d=>{try{localStorage.setItem(SK,JSON.stringify(d))}catch{}};
const mkU=(n,e)=>({p:{name:n,email:e,plan:"free"},trm:4200,inv:[],deu:[],gas:{},ibk:[],ingresos:[],pen:{age:35,rAge:60,sv:2500,cur:120000,ret:7,inf:3,des:6000,btcC:56,btcP:50000}});

const DI=[{id:"i1",n:"Beach House Alpha",ub:"Miami, FL",tp:"Real Estate",vc:460000,va:599000,un:[{n:"Main Suite",ig:[{c:"Airbnb",m:4200,t:"v"}],gs:[{c:"Mgmt",m:275,t:"f"},{c:"HOA",m:642,t:"f"},{c:"Utilities",m:768,t:"v"},{c:"Insurance",m:150,t:"f"},{c:"Taxes",m:400,t:"f"}]},{n:"Guest Studio",ig:[{c:"Airbnb",m:1800,t:"v"}],gs:[{c:"Cleaning",m:300,t:"v"}]}]},{id:"i2",n:"Mountain Retreat",ub:"Aspen, CO",tp:"Real Estate",vc:320000,va:480000,ig:[{c:"Rental",m:3500,t:"v"}],gs:[{c:"Caretaker",m:500,t:"f"},{c:"Utilities",m:350,t:"v"}]},{id:"i3",n:"Commercial Unit",ub:"Austin, TX",tp:"Real Estate",vc:197000,va:240000,ig:[{c:"Lease",m:1420,t:"f"}],gs:[{c:"Admin",m:183,t:"f"}]},{id:"i4",n:"P2P Lending",ub:"Online",tp:"Investment",vc:280000,va:280000,ig:[{c:"21% Return",m:4900,t:"f"}],gs:[]},{id:"i5",n:"Growth Equity",ub:"Online",tp:"Investment",vc:105000,va:210000,ig:[{c:"Dividends",m:1316,t:"v"}],gs:[]},{id:"i6",n:"Warehouse",ub:"Denver",tp:"Real Estate",vc:132000,va:265000,ig:[{c:"Rent",m:2370,t:"f"}],gs:[{c:"Admin",m:237,t:"f"}]},{id:"i7",n:"Lakeside Land",ub:"Tahoe",tp:"Real Estate",vc:67000,va:184000,ig:[],gs:[]},{id:"i8",n:"Business",ub:"Local",tp:"Income",vc:0,va:0,ig:[{c:"Distribution",m:1658,t:"f"}],gs:[]},{id:"i9",n:"Emergency Fund",ub:"HYSA",tp:"Cash",vc:150000,va:150000,ig:[],gs:[]}];
const DD=[{id:"d1",n:"Beach Mortgage",la:"i1",tp:"mortgage",mt:354000,pg:3486,ts:6.5},{id:"d2",n:"Construction",la:"i6",tp:"loan",mt:120000,pg:1200,ts:8},{id:"d3",n:"Personal LOC",la:null,tp:"loan",mt:63000,pg:1100,ts:12},{id:"d4",n:"Family Loan",la:null,tp:"personal",mt:41000,pg:410,ts:0},{id:"d5",n:"Auto Loan",la:null,tp:"loan",mt:42000,pg:420,ts:10},{id:"d6",n:"Credit Card",la:null,tp:"credit_card",mt:12000,pg:120,ts:15}];
const DG={"Vivienda":[{c:"Arriendo",m:2800,t:"f"},{c:"Empleada",m:474,t:"f"},{c:"Luz",m:211,t:"v"},{c:"Agua",m:152,t:"v"},{c:"Internet",m:105,t:"f"},{c:"Mercado",m:1200,t:"v"}],"Educación":[{c:"Colegio Hijo 1",m:763,t:"f"},{c:"Colegio Hijo 2",m:763,t:"f"},{c:"Transporte",m:316,t:"f"},{c:"Actividades",m:272,t:"f"}],"Seguros":[{c:"Seguro Vida",m:650,t:"f"},{c:"Plan Salud",m:580,t:"f"},{c:"Seguro Hogar",m:143,t:"f"}],"Transporte":[{c:"Gasolina",m:211,t:"v"},{c:"Seguro Auto",m:269,t:"f"},{c:"Paseos",m:342,t:"v"}]};
const DIB=[{tk:"AAPL",n:"Apple",sh:25,pr:198.5,cb:155,tg:220},{tk:"MSFT",n:"Microsoft",sh:15,pr:430,cb:310,tg:500},{tk:"TSLA",n:"Tesla",sh:8,pr:382,cb:442,tg:500},{tk:"NVDA",n:"NVIDIA",sh:12,pr:920,cb:480,tg:1100},{tk:"PLTR",n:"Palantir",sh:50,pr:25,cb:17.5,tg:35},{tk:"QQQ",n:"QQQ",sh:20,pr:485,cb:380,tg:550},{tk:"BTC",n:"Bitcoin",sh:0.15,pr:68000,cb:42000,tg:120000}];
const DING=[{id:"ing_1",nombre:"Salario Principal",categoria:"Salario",mensual:8500,tipo:"fijo",fuente:"Empresa Tech"},{id:"ing_2",nombre:"Freelance Consulting",categoria:"Freelance",mensual:2400,tipo:"variable",fuente:"Clientes varios"},{id:"ing_3",nombre:"Dividendos ETF",categoria:"Dividendos",mensual:850,tipo:"variable",fuente:"Vanguard"},{id:"ing_4",nombre:"Arriendo Oficina",categoria:"Arriendo",mensual:1200,tipo:"fijo",fuente:"Local comercial"}];
const ADV=[{id:"kiyosaki",nm:"Kiyosaki",av:"🟡",cl:"#eab308",bg:"rgba(234,179,8,0.06)",ti:"Padre Rico"},{id:"robbins",nm:"Robbins",av:"🔴",cl:"#ef4444",bg:"rgba(239,68,68,0.06)",ti:"Money Master"},{id:"dalio",nm:"Dalio",av:"🔵",cl:"#3b82f6",bg:"rgba(59,130,246,0.06)",ti:"Principles"},{id:"buffett",nm:"Buffett",av:"🟢",cl:"#22c55e",bg:"rgba(34,197,94,0.06)",ti:"Oráculo"},{id:"munger",nm:"Munger",av:"🟣",cl:"#a78bfa",bg:"rgba(167,139,250,0.06)",ti:"Modelos Mentales"}];

const dfa=(ds,a)=>{const d=(ds||[]).filter(x=>x.la===a);return{s:d.reduce((a,x)=>a+(x.mt||0),0),p:d.reduce((a,x)=>a+(x.pg||0),0)}};
const iM=(inv,ds)=>{let ig=0,gs=0;if(inv.un)inv.un.forEach(u=>{(u.ig||[]).forEach(i=>ig+=i.m);(u.gs||[]).forEach(g=>gs+=g.m)});else{(inv.ig||[]).forEach(i=>ig+=i.m);(inv.gs||[]).forEach(g=>gs+=g.m)}const noi=ig-gs,db=dfa(ds,inv.id),eq=inv.va-db.s,gn=inv.va-inv.vc;return{ig,gs,noi,gn,roi:inv.vc>0?(gn/inv.vc)*100:0,cap:inv.va>0?((noi*12)/inv.va)*100:0,ds:db.s,dp:db.p,eq,coc:eq>0?(((noi-db.p)*12)/eq)*100:0}};
const cT=(inv,ds,gf,ing)=>{let ab=0,ti=0,tg=0;(inv||[]).forEach(i=>{ab+=i.va;const m=iM(i,ds);ti+=m.ig;tg+=m.gs});const ingT=(ing||[]).reduce((s,i)=>s+(i.mensual||0),0);ti+=ingT;const td=(ds||[]).reduce((s,d)=>s+(d.mt||0),0),tc=(ds||[]).reduce((s,d)=>s+(d.pg||0),0),gfm=Object.values(gf||{}).flat().reduce((s,g)=>s+(g.m||0),0),ni=ti-tg,te=gfm+tc,cf=ni-te;return{ab,td,nw:ab-td,ti,tg,ni,gfm,tc,te,cf,ind:te>0?(ni/te)*100:0,dta:ab>0?(td/ab)*100:0,ingT}};

const Cd=({children,s,...p})=><div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",...s}} {...p}>{children}</div>;
const St=({l,v,sub,cl})=><div style={{padding:"16px 20px"}}><div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>{l}</div><div style={{fontSize:24,fontWeight:700,color:cl||T.tx,letterSpacing:"-0.03em"}}>{v}</div>{sub&&<div style={{fontSize:12,color:T.tx3,marginTop:3}}>{sub}</div>}</div>;
const Bg=({children,cl})=><span style={{background:`${cl||T.gn}15`,color:cl||T.gn,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{children}</span>;
const Bt=({children,onClick,v,sz,dis,st})=>{const vs={p:{background:`linear-gradient(135deg,${T.gn},#16a34a)`,color:"#fff"},s:{background:"transparent",color:T.tx2,border:`1px solid ${T.border}`},d:{background:T.rdB,color:T.rd}};const ss={s:{padding:"6px 14px",fontSize:12},m:{padding:"10px 20px",fontSize:14},l:{padding:"14px 28px",fontSize:16}};return<button onClick={onClick} disabled={dis} style={{...(vs[v||"p"]),...(ss[sz||"m"]),borderRadius:10,border:"none",cursor:dis?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:6,fontWeight:600,opacity:dis?.5:1,...(st||{})}}>{children}</button>};
const In=({l,value:v,onChange:oc,type:tp,placeholder:ph,options:opts})=><div style={{display:"flex",flexDirection:"column",gap:5}}>{l&&<label style={{fontSize:10,fontWeight:600,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>{l}</label>}{opts?<select value={v||""} onChange={e=>oc(e.target.value)} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.tx,fontSize:14,outline:"none"}}>{opts.map(o=><option key={o.v!=null?o.v:o} value={o.v!=null?o.v:o}>{o.l||o}</option>)}</select>:<input type={tp||"text"} value={v!=null?v:""} onChange={e=>oc(e.target.value)} placeholder={ph} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.tx,fontSize:14,outline:"none"}}/>}</div>;
const Md=({open,onClose,title,children,wide})=>{if(!open)return null;return<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1e3,padding:20}}><div onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:`1px solid ${T.borderL}`,borderRadius:20,width:"100%",maxWidth:wide?700:520,maxHeight:"85vh",overflow:"auto",padding:32}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><h3 style={{fontSize:18,fontWeight:700,margin:0,color:T.tx}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:18}}>✕</button></div>{children}</div></div>};

export default function FinPath(){
  const[u,setU]=useState(null);const[ld,setLd]=useState(true);const[pg,setPg]=useState("dash");const[md,setMd]=useState(null);const[f,sF]=useState({});const[aM,sAM]=useState("login");const[aF,sAF]=useState({n:"",e:"",p:""});const[adv,sAdv]=useState(null);const[sb,sSb]=useState(true);const[mb,sMb]=useState(false);const[simS,sSimS]=useState("actual");const[showImport,setShowImport]=useState(false);const[cur,setCur]=useState("COP");const[showAuth,setShowAuth]=useState(false);
  useEffect(()=>{const c=()=>sMb(window.innerWidth<900);c();window.addEventListener("resize",c);return()=>window.removeEventListener("resize",c)},[]);
  useEffect(()=>{if(mb)sSb(false)},[mb]);
  useEffect(()=>{(async()=>{const d=await sL();if(d)setU(d);setLd(false);try{const r=await fetch('/api/trm');const j=await r.json();if(j.trm)setU(p=>p?{...p,trm:j.trm,trmSrc:j.source}:p)}catch{}})()},[]);
  useEffect(()=>{if(u)sS(u)},[u]);
  const trm=u?.trm||4200;
  const fm=n=>{const v=cur==="USD"?(n/trm):n;if(Math.abs(v)>=1e9)return"$"+(v/1e9).toFixed(1)+"B";if(Math.abs(v)>=1e6)return"$"+(v/1e6).toFixed(1)+"M";return"$"+Math.round(v).toLocaleString("en-US")};
  const upd=(k,v)=>setU(p=>({...p,[k]:v}));
  const plan=u?.p?.plan||"free";
  const t=useMemo(()=>u?cT(u.inv,u.deu,u.gas,u.ingresos):{},[u]);
  const ib=useMemo(()=>{if(!u?.ibk?.length)return{tc:0,tv:0,pnl:0,pp:0,pos:[]};let tc=0,tv=0;const pos=u.ibk.map(p=>{const va=p.sh*p.pr,cbb=p.sh*p.cb,pnl=va-cbb,pp=cbb>0?((va/cbb)-1)*100:0,up=p.pr>0?((p.tg/p.pr)-1)*100:0;tc+=cbb;tv+=va;return{...p,va,cbb,pnl,pp,up}});return{tc,tv,pnl:tv-tc,pp:tc>0?((tv/tc)-1)*100:0,pos}},[u?.ibk]);
  const pen=useMemo(()=>{if(!u)return{};const p=u.pen||{},yrs=Math.max(0,(p.rAge||60)-(p.age||35)),mr=(p.ret||7)/100/12;let fv=+(p.cur||0);for(let m=0;m<yrs*12;m++)fv=fv*(1+mr)+(+(p.sv||0));const rfv=fv/Math.pow(1+(p.inf||3)/100,yrs),mo=rfv>0?rfv/360:0;const proj=[];let rv=+(p.cur||0);for(let y=0;y<=yrs;y++){proj.push({age:(p.age||35)+y,val:Math.round(rv)});for(let m=0;m<12&&y<yrs;m++)rv=rv*(1+mr)+(+(p.sv||0))}let ba=0;const bc=(p.btcC||56)/100,bp=p.btcP||50000;for(let y=1;y<=yrs;y++)for(let m=1;m<=12;m++)ba+=(+(p.sv||0))/(bp*Math.pow(1+bc,((y-1)*12+m)/12));const bfv=ba*bp*Math.pow(1+bc,yrs),bmo=(bfv*.04)/12;return{yrs,fv:Math.round(rfv),mo:Math.round(mo),ok:mo>=(p.des||6000),gap:Math.max(0,(p.des||6000)-mo),proj,ba,bfv,bmo:Math.round(bmo)}},[u?.pen]);
  const simT=useMemo(()=>{const im={actual:1,conservador:.8,optimista:1.3,crisis:.6},gm={actual:1,conservador:1.1,optimista:.85,crisis:1.05};const sni=t.ni*(im[simS]||1),sgf=t.gfm*(gm[simS]||1),ste=sgf+t.tc,scf=sni-ste;return{...t,ni:sni,gfm:sgf,te:ste,cf:scf,ind:ste>0?(sni/ste)*100:0}},[t,simS]);
  const getCoach=id=>{if(!u||!t.ab)return[];const ok=t.cf>=0,gap=Math.abs(t.cf),topA=(u.inv||[]).map(i=>({...i,...iM(i,u.deu)})).sort((a,b)=>b.noi-a.noi).slice(0,5),hi=(u.deu||[]).sort((a,b)=>b.ts-a.ts),cv=t.tc>0?(t.ni/t.tc):99;const msgs=[];const intro={kiyosaki:"Veamos tu cuadrante. Estás pasando de Empleado a Inversionista.",robbins:"He revisado cada número. Posición MUY interesante.",dalio:"Analicemos tu máquina financiera.",buffett:"No necesitas ser genio — solo temperamento.",munger:"Antes de qué hacer, pensemos qué NO hacer."};
  msgs.push({t:"📊 Diagnóstico",c:`${intro[id]}\n\n• Patrimonio: ${fm(t.nw)}\n• Ingreso Neto: ${fm(t.ni)}/mes\n• Egresos: ${fm(t.te)}/mes\n• Cash Flow: ${fm(t.cf)}/mes\n• Independencia: ${pc(t.ind)}${t.ind>=100?" ✅":""}\n• Deuda/Activos: ${pc(t.dta)} • Cobertura: ${cv.toFixed(1)}x`});
  if(topA.length)msgs.push({t:"🏆 Top Activos",c:topA.map(a=>`• ${a.n}: NOI ${fm(a.noi)}/mes • ROI ${pc(a.roi)} • Cap ${pc(a.cap)}${a.ds>0?` • Deuda ${fm(a.ds)}`:""}`).join("\n")});
  if(hi.length){const da={kiyosaki:"No toda deuda es mala — deuda que compra activos = buena.",robbins:"Ataca la de mayor tasa primero.",dalio:"¿Tu apalancamiento es sostenible bajo estrés?",buffett:"Yo evito deuda.",munger:"Deuda >15% es suicidio financiero."};msgs.push({t:"💳 Deudas",c:`${da[id]}\n\n${hi.slice(0,4).map(d=>`• ${d.n}: ${fm(d.mt)} al ${d.ts}% → ${fm(d.pg)}/mes`).join("\n")}\n\nTotal: ${fm(t.td)}`})}
  let v;if(ok&&t.ind>120)v={kiyosaki:"🟢 ¡SÍ! Activos > gastos. ¡Cuadrante I!",robbins:"🟢 ¡La libertad está aquí!",dalio:"🟢 Sí, pero buffer 6 meses primero.",buffett:"🟢 Sí. Mantén disciplina.",munger:"🟢 Puedes. Pero libertad sin propósito es la peor."};
  else if(ok)v={kiyosaki:"🟡 Filo de navaja. "+fm(t.cf)+"/mes pero frágil.",robbins:"🟡 ¡Casi! 90 días más.",dalio:"🟡 Riesgo medio-alto.",buffett:"🟡 Paciencia. 3-6 meses más.",munger:"🟡 Todavía no."};
  else v={kiyosaki:"🔴 TODAVÍA NO. Gap "+fm(gap)+"/mes.",robbins:"🔴 Hoy no, pero PRONTO.",dalio:"🔴 Déficit insostenible sin empleo.",buffett:"🔴 No te apures.",munger:"🔴 Sería estúpido hoy."};
  msgs.push({t:"⚡ ¿Puedes Renunciar?",c:v[id]});return msgs};
  const auth=()=>{if(!aF.e||!aF.p)return;setU(mkU(aF.n||"Usuario",aF.e))};
  const logout=async()=>{try{localStorage.removeItem(SK)}catch{}setU(null)};
  const demo=()=>setU(p=>({...p,inv:[...DI],deu:[...DD],gas:JSON.parse(JSON.stringify(DG)),ibk:[...DIB],ingresos:[...DING]}));
  const handleImport=(key,rows,isGastos)=>{if(isGastos){const g={...u.gas};rows.forEach(r=>{const cat=r.cat||"Otro";if(!g[cat])g[cat]=[];g[cat].push({c:r.c,m:r.m,t:r.t});});upd("gas",g);}else{upd(key,[...(u[key]||[]),...rows]);}};
  const add=(m,it)=>upd(m,[...(u[m]||[]),{...it,id:m[0]+Date.now()}]);
  const del=(m,id)=>{if(confirm("¿Eliminar?"))upd(m,(u[m]||[]).filter(i=>i.id!==id))};

  if(ld)return<div style={{background:T.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui"}}><div style={{textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,color:T.gn}}>FINPATH</div><div style={{color:T.tx3,marginTop:8,fontSize:13}}>Cargando...</div></div></div>;

  if(!u&&!showAuth)return<LandingPage onGetStarted={()=>setShowAuth(true)}/>;
  if(!u)return<div style={{background:T.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui",color:T.tx}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}input:focus,select:focus{border-color:#22c55e!important;outline:none}`}</style>
    <div style={{width:"100%",maxWidth:420,padding:"40px 32px"}}>
      <div onClick={()=>setShowAuth(false)} style={{fontSize:13,color:T.tx3,cursor:"pointer",marginBottom:24}}>← Volver</div>
      <div style={{fontSize:28,fontWeight:800,background:"linear-gradient(135deg,#22c55e,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:24}}>FINPATH</div>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:6}}>{aM==="login"?"Bienvenido":"Crea tu cuenta"}</h2>
      <p style={{color:T.tx3,fontSize:14,marginBottom:28}}>{aM==="login"?"Ingresa a tu cuenta":"Empieza gratis — sin tarjeta"}</p>
      <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
        {aM==="signup"&&<In l="Nombre" value={aF.n} onChange={v=>sAF(p=>({...p,n:v}))} placeholder="Tu nombre"/>}
        <In l="Email" value={aF.e} onChange={v=>sAF(p=>({...p,e:v}))} type="email" placeholder="tu@email.com"/>
        <In l="Contraseña" value={aF.p} onChange={v=>sAF(p=>({...p,p:v}))} type="password" placeholder="••••••••"/>
      </div>
      <Bt sz="l" onClick={auth} st={{width:"100%",justifyContent:"center",borderRadius:12}}>{aM==="login"?"Ingresar":"Crear Cuenta Gratis"}</Bt>
      <p style={{textAlign:"center",marginTop:20,color:T.tx3,fontSize:14}}>{aM==="login"?"¿Sin cuenta? ":"¿Ya tienes? "}<span onClick={()=>sAM(aM==="login"?"signup":"login")} style={{color:T.gn,cursor:"pointer",fontWeight:600}}>{aM==="login"?"Regístrate":"Ingresa"}</span></p>
    </div>
  </div>;

  const has=(u.inv?.length||u.deu?.length||Object.keys(u.gas||{}).length)>0;
  const nvs=[{id:"dash",i:"📊",l:"Dashboard"},{id:"inv",i:"🏦",l:"Patrimonio"},{id:"ing",i:"💰",l:"Ingresos"},{id:"gas",i:"💳",l:"Gastos"},{id:"deu",i:"📋",l:"Deudas"},{id:"trd",i:"💹",l:"Trading"},{id:"sim",i:"🖥️",l:"Simulador"},{id:"pen",i:"🏛️",l:"Pensiones"},{id:"btc",i:"₿",l:"Ahorro BTC"},{id:"coach",i:"🧠",l:"Coaches IA"},{id:"price",i:"⭐",l:"Planes"},{id:"set",i:"⚙️",l:"Config"}];

  const rp=()=>{switch(pg){
    case"dash":{
    // Data prep
    const fd=[{name:"Ingresos",a:t.ti},{name:"Gastos",a:-(t.gfm+t.tg)},{name:"Deudas",a:-t.tc},{name:"Neto",a:t.cf}];
    const pj=[0,1,3,5,10].map(y=>({yr:y===0?"Hoy":`+${y}a`,v:t.nw*Math.pow(1.08,y)+t.cf*12*y}));
    // Patrimonio distribution
    const bc={};(u.inv||[]).forEach(i=>{const tp=(i.tp&&isNaN(Number(i.tp))&&i.tp!=="undefined")?i.tp:"Otro";bc[tp]=(bc[tp]||0)+(i.va||0)});if(ib.tv>0)bc.Trading=ib.tv;
    const pie=Object.entries(bc).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    const totalPat=t.ab+ib.tv;
    // Income by category
    const incByCat={};(u.ingresos||[]).forEach(i=>{incByCat[i.categoria||"Otro"]=(incByCat[i.categoria||"Otro"]||0)+(i.mensual||0)});
    const incPie=Object.entries(incByCat).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    // Expense by category
    const expByCat={};Object.entries(u.gas||{}).forEach(([cat,its])=>{expByCat[cat]=its.reduce((s,g)=>s+(g.m||0),0)});
    const expPie=Object.entries(expByCat).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    // Top income sources
    const topInc=[...(u.ingresos||[])].sort((a,b)=>(b.mensual||0)-(a.mensual||0)).slice(0,5);
    // Health score (0-100)
    const healthScore=Math.min(100,Math.round(
      (t.ind>=100?30:t.ind*0.3) + // independence: 30 pts
      (t.dta<50?25:t.dta<80?15:0) + // debt ratio: 25 pts
      (t.cf>0?25:t.cf>-1000?10:0) + // cash flow positive: 25 pts
      ((u.ingresos||[]).length>=3?10:((u.ingresos||[]).length>=2?5:0)) + // diversification: 10 pts
      ((u.inv||[]).length>=3?10:((u.inv||[]).length>=1?5:0))  // assets: 10 pts
    ));
    const healthColor=healthScore>=80?T.gn:healthScore>=50?"#eab308":T.rd;
    const healthLabel=healthScore>=80?"Excelente":healthScore>=60?"Buena":healthScore>=40?"Regular":"Necesita atención";

    return<div>
      {/* Greeting */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-0.03em",margin:"0 0 6px"}}>{new Date().getHours()<12?"Buenos días":new Date().getHours()<18?"Buenas tardes":"Buenas noches"}, {u.p.name.split(" ")[0]}</h1>
          <p style={{color:T.tx3,fontSize:13,margin:0}}>Resumen de tu situación financiera</p>
        </div>
        <button onClick={()=>{document.body.setAttribute("data-date",new Date().toLocaleDateString("es-CO"));window.print()}} style={{background:T.gn,color:"#000",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,flexShrink:0}}>📄 Exportar PDF</button>
      </div>

      {!has&&<div style={{background:"linear-gradient(135deg,rgba(34,197,94,.08),rgba(6,182,212,.05))",border:"1px solid rgba(34,197,94,.15)",borderRadius:16,padding:24,marginBottom:20,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}><div style={{flex:1}}><h3 style={{fontSize:16,fontWeight:700,margin:"0 0 6px"}}>Bienvenido a FINPATH</h3><p style={{color:T.tx2,fontSize:13,margin:0}}>Carga datos demo para explorar</p></div><Bt sz="s" onClick={demo}>Cargar Demo</Bt></div>}

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
    </div>}
        
case"inv":return<InversionesModule inversiones={u.inv} deudas={u.deu} onUpdate={v=>upd("inv",v)}/>;
    case"ing":return<IngresosModule ingresos={u.ingresos||[]} onUpdate={v=>upd("ingresos",v)}/>;
    case"trd":return<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,margin:0}}>Trading</h2><Bt sz="s" onClick={async()=>{
              const tickers=(u.ibk||[]).map(p=>p.tk).filter(Boolean).join(",");
              if(!tickers)return alert("No hay posiciones con ticker");
              try{
                const r=await fetch("/api/stock-price?tickers="+encodeURIComponent(tickers));
                const d=await r.json();
                if(d.prices){
                  const updated=(u.ibk||[]).map(p=>{
                    const q=d.prices[p.tk?.toUpperCase()];
                    if(q&&q.price>0)return{...p,pr:q.price,n:p.n||q.name};
                    return p;
                  });
                  upd("ibk",updated);
                  alert("✅ Precios actualizados: "+Object.keys(d.prices).length+" acciones");
                }else{alert("No se encontraron precios")}
              }catch(e){alert("Error: "+e.message)}
            }} st={{background:"#3b82f6",color:"#fff"}}>📊 Actualizar Precios</Bt><Bt sz="s" onClick={()=>{sF({});setMd("ib")}}>+ Posición</Bt>{(u.ibk||[]).length>1&&<Bt v="d" sz="s" onClick={()=>{if(confirm("¿Eliminar todas las posiciones?"))upd("ibk",[])}}>🗑️ Limpiar</Bt>}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:16}}><Cd><St l="Valor" v={fm(ib.tv)} cl={T.gn}/></Cd><Cd><St l="P/L" v={fm(ib.pnl)} cl={ib.pnl>=0?T.gn:T.rd} sub={pc(ib.pp)}/></Cd><Cd><St l="Posiciones" v={ib.pos.length}/></Cd></div><Cd s={{padding:0}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Ticker","Nombre","Qty","Costo","Precio","Valor","P/L","%","Upside"].map(h=><th key={h} style={{padding:"9px 12px",textAlign:["Ticker","Nombre"].includes(h)?"left":"right",color:T.tx3,fontWeight:600,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>{h}</th>)}</tr></thead><tbody>{ib.pos.map((p,i)=><tr key={i} style={{borderBottom:`1px solid ${T.border}`}}><td style={{padding:"9px 12px",fontWeight:700,color:T.gn,fontFamily:"monospace"}}>{p.tk}</td><td style={{padding:"9px 12px"}}>{p.n}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>{p.sh}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>${p.cb.toFixed(2)}</td><td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace"}}>${p.pr.toFixed(2)}</td><td style={{padding:"9px 12px",textAlign:"right",fontWeight:600}}>{fm(p.va)}</td><td style={{padding:"9px 12px",textAlign:"right",fontWeight:600,color:p.pnl>=0?T.gn:T.rd}}>{fm(p.pnl)}</td><td style={{padding:"9px 12px",textAlign:"right",color:p.pp>=0?T.gn:T.rd}}>{pc(p.pp)}</td><td style={{padding:"9px 12px",textAlign:"right",color:T.bl}}>{pc(p.up)}</td></tr>)}</tbody></table></div></Cd><Md open={md==="ib"} onClose={()=>setMd(null)} title="Agregar Posición"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>{[["tk","Ticker"],["n","Nombre"],["sh","Cantidad","number"],["cb","Costo","number"],["pr","Precio","number"],["tg","Objetivo","number"]].map(([k,l,tp])=><In key={k} l={l} value={f[k]} onChange={v=>sF(p=>({...p,[k]:v}))} type={tp}/>)}</div><div style={{display:"flex",gap:12,justifyContent:"flex-end"}}><Bt v="s" onClick={()=>setMd(null)}>Cancelar</Bt><Bt onClick={()=>{add("ibk",{tk:f.tk||"",n:f.n||"",sh:+f.sh||0,cb:+f.cb||0,pr:+f.pr||0,tg:+f.tg||0});setMd(null);sF({})}}>Agregar</Bt></div></Md></div>;
        case"gas":return<GastosModule gastos={u.gas} onUpdate={v=>upd("gas",v)}/>;
        case"deu":return<DeudasModule deudas={u.deu} inversiones={u.inv} onUpdate={v=>upd("deu",v)}/>;
    case"sim":return<SimuladorAvanzado user={{inv:u.inv||[],gastos:u.gas||{},deudas:u.deu||[],ibkr:u.ibk||[],ingresos:u.ingresos||[]}} totals={t}/>;
    case"pat":{const bc={};(u.inv||[]).forEach(i=>{const tp=(i.tp&&isNaN(Number(i.tp))&&i.tp!=="undefined")?i.tp:"Otro";bc[tp]=(bc[tp]||0)+(i.va||0)});if(ib.tv>0)bc.Trading=ib.tv;const pie=Object.entries(bc).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);const gr=t.ab+ib.tv;return<div><h2 style={{fontSize:22,fontWeight:700,margin:"0 0 20px"}}>Patrimonio</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:16}}><Cd><St l="Activos" v={fm(gr)} cl={T.gn}/></Cd><Cd><St l="Pasivos" v={fm(t.td)} cl={T.rd}/></Cd><Cd><St l="Neto" v={fm(t.nw)} cl={T.bl}/></Cd></div><div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:14}}><Cd s={{padding:20}}><div style={{fontSize:12,fontWeight:600,color:T.tx2,marginBottom:14}}>Distribución</div>{pie.length>0?<ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pie} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>{pie.map((_,i)=><Cell key={i} fill={T.ch[i%T.ch.length]}/>)}</Pie><Tooltip contentStyle={{background:"#1e1e24",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,color:"#fafafa",fontSize:12}} labelStyle={{color:"#fafafa"}} itemStyle={{color:"#fafafa"}} formatter={v=>fm(v)}/><Legend/></PieChart></ResponsiveContainer>:<div style={{height:220,display:"flex",alignItems:"center",justifyContent:"center",color:T.tx3}}>Agrega datos</div>}</Cd><Cd s={{padding:20}}><div style={{fontSize:12,fontWeight:600,color:T.tx2,marginBottom:14}}>Desglose</div>{pie.map((a,i)=><div key={a.name} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:T.ch[i%T.ch.length]}}/><span style={{fontSize:13}}>{a.name}</span></div><span style={{fontWeight:600,fontFamily:"monospace"}}>{fm(a.value)} <span style={{fontSize:11,color:T.tx3}}>{pc((a.value/gr)*100)}</span></span></div>)}</Cd></div></div>}
    case"pen":return<PensionesColpensiones trm={u.trm||4200}/>;
    case"btc":return<PensionColombia trm={u.trm||4200}/>;
    case"coach":{const msgs=adv?getCoach(adv.id):[];return<div><div style={{textAlign:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,margin:"0 0 6px"}}>Coaches Financieros IA</h2><p style={{color:T.tx3,fontSize:13}}>5 asesores analizan tus datos</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginBottom:20}}>{ADV.map(a=>{const ac=adv?.id===a.id;return<button key={a.id} onClick={()=>sAdv(a)} style={{background:ac?`linear-gradient(135deg,${a.cl}20,${a.cl}10)`:T.card,border:`1px solid ${ac?a.cl:T.border}`,color:T.tx,padding:"14px 20px",borderRadius:14,cursor:"pointer",textAlign:"center",minWidth:90}}><div style={{fontSize:22,marginBottom:4}}>{a.av}</div><div style={{fontWeight:700,fontSize:11,color:ac?a.cl:T.tx}}>{a.nm}</div><div style={{fontSize:9,color:ac?`${a.cl}aa`:T.tx3}}>{a.ti}</div></button>})}</div><Cd>{adv?<div style={{padding:20}}><div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:14,borderBottom:`2px solid ${adv.cl}`,marginBottom:20}}><span style={{fontSize:28}}>{adv.av}</span><div><div style={{fontWeight:700,fontSize:15}}>{adv.nm}</div><div style={{fontSize:12,color:T.tx3}}>{adv.ti}</div></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:6,marginBottom:20}}>{[{l:"Patrimonio",v:fm(t.nw),c:T.tx},{l:"Cash Flow",v:fm(t.cf),c:t.cf>=0?T.gn:T.rd},{l:"Independencia",v:pc(t.ind),c:t.ind>=100?T.gn:T.tx2},{l:"Deuda/Act",v:pc(t.dta),c:t.dta<30?T.gn:T.rd}].map(m=><div key={m.l} style={{background:T.bg3,padding:8,borderRadius:8,borderLeft:`3px solid ${m.c}`}}><div style={{fontSize:9,color:T.tx3,textTransform:"uppercase"}}>{m.l}</div><div style={{fontSize:15,fontWeight:700,color:m.c}}>{m.v}</div></div>)}</div>{msgs.map((msg,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:14}}><div style={{width:32,height:32,borderRadius:"50%",background:adv.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{adv.av}</div><div style={{flex:1,background:adv.bg,padding:"14px 18px",borderRadius:"0 14px 14px 14px",border:`1px solid ${adv.cl}10`}}><div style={{fontWeight:700,fontSize:13,color:adv.cl,marginBottom:6}}>{msg.t}</div><div style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",color:T.tx}}>{msg.c}</div></div></div>)}</div>:<div style={{padding:56,textAlign:"center",color:T.tx3}}><div style={{fontSize:40,marginBottom:12}}>👆</div><p>Selecciona un coach</p></div>}</Cd></div>}
    case"price":return<div><div style={{textAlign:"center",marginBottom:32}}><h2 style={{fontSize:26,fontWeight:800,margin:"0 0 8px"}}>Precios simples</h2><p style={{color:T.tx3,fontSize:15}}>Menos que un café al mes</p></div><div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr 1fr",gap:16,maxWidth:900,margin:"0 auto"}}>{[{n:"Free",p:"$0",pr:"siempre",f:["Dashboard","5 inversiones","Gastos y deudas","Simulador básico"],cur:plan==="free"},{n:"Pro",p:"$29",pr:"/año",f:["Todo en Free","Ilimitado","5 Coaches IA","Pensión + BTC","Simulador avanzado","CSV / PDF"],cur:plan==="pro",ac:true},{n:"Familia",p:"$49",pr:"/año",f:["Todo en Pro","3 miembros","Vista consolidada","Presupuesto compartido"],cur:plan==="family"}].map(pl=><Cd key={pl.n} s={{border:pl.ac?`2px solid ${T.gn}`:`1px solid ${T.border}`}}>{pl.ac&&<div style={{background:`linear-gradient(135deg,${T.gn},#16a34a)`,color:"#fff",textAlign:"center",padding:"6px 0",fontSize:12,fontWeight:700}}>MÁS POPULAR</div>}<div style={{padding:28}}><div style={{fontSize:18,fontWeight:700,marginBottom:4}}>{pl.n}</div><div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:16}}><span style={{fontSize:36,fontWeight:800}}>{pl.p}</span><span style={{color:T.tx3,fontSize:14}}>{pl.pr}</span></div><div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>{pl.f.map(f=><div key={f} style={{fontSize:13,color:T.tx2}}><span style={{color:T.gn,marginRight:8}}>✓</span>{f}</div>)}</div><Bt v={pl.ac?"p":pl.cur?"s":"p"} sz="m" st={{width:"100%",justifyContent:"center"}} onClick={()=>{if(!pl.cur)setU(pr=>({...pr,p:{...pr.p,plan:pl.n.toLowerCase()}}))}}>{pl.cur?"Plan Actual":"Elegir"}</Bt></div></Cd>)}</div><div style={{textAlign:"center",marginTop:24,color:T.tx3,fontSize:13}}>🔒 Stripe • Cancela cuando quieras • $29/año = ~$2.40/mes ☕</div></div>;
    case"set":return<div><h2 style={{fontSize:22,fontWeight:700,margin:"0 0 20px"}}>Configuración</h2><div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:20}}><Cd s={{padding:20}}><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 16px"}}>Perfil</h3><div style={{display:"flex",flexDirection:"column",gap:14}}><In l="Nombre" value={u.p.name} onChange={v=>setU(p=>({...p,p:{...p.p,name:v}}))}/><In l="Email" value={u.p.email} onChange={v=>setU(p=>({...p,p:{...p.p,email:v}}))}/><In l="TRM" value={u.trm} onChange={v=>setU(p=>({...p,trm:+v||4200}))} type="number"/></div></Cd><Cd s={{padding:20}}><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 16px"}}>Datos</h3><div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{padding:12,background:T.bg3,borderRadius:10,fontSize:13}}><strong>Plan:</strong> {plan} {plan==="free"&&<span onClick={()=>setPg("price")} style={{color:T.gn,cursor:"pointer",fontWeight:600}}> → Upgrade</span>}</div><Bt v="s" onClick={demo} st={{justifyContent:"center"}}>Cargar Demo</Bt><Bt v="s" onClick={()=>{const d=localStorage.getItem(SK);if(!d)return alert("No hay datos");const b=new Blob([d],{type:"application/json"});const u2=URL.createObjectURL(b);const a=document.createElement("a");a.href=u2;a.download="finpath-backup-"+new Date().toISOString().split("T")[0]+".json";a.click()}} st={{justifyContent:"center"}}>📥 Exportar Datos (JSON)</Bt>
              <Bt v="s" onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept=".json";inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);localStorage.setItem(SK,JSON.stringify(d));setU(d);alert("✅ Datos importados correctamente. Recarga la página.")}catch{alert("Error: archivo no válido")}};r.readAsText(f)};inp.click()}} st={{justifyContent:"center"}}>📤 Importar Datos (JSON)</Bt>
              <Bt v="d" onClick={()=>{if(confirm("¿Borrar?"))setU(mkU(u.p.name,u.p.email))}} st={{justifyContent:"center"}}>Borrar Datos</Bt><Bt v="d" onClick={logout} st={{justifyContent:"center"}}>Cerrar Sesión</Bt></div></Cd></div></div>;
    default:return<div style={{padding:56,textAlign:"center",color:T.tx3}}>Próximamente</div>}};

  return<div style={{background:T.bg,minHeight:"100vh",display:"flex",fontFamily:"'Inter',system-ui",color:T.tx}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:${T.bg}}input:focus,select:focus{border-color:${T.gn}!important;outline:none}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.bg3};border-radius:3px}::selection{background:${T.gn}30}`}</style>
    {sb&&<aside style={{width:220,minWidth:220,height:"100vh",position:mb?"fixed":"sticky",top:0,background:T.bg2,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",zIndex:100,overflowY:"auto"}}><div style={{padding:"20px 18px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontSize:16,fontWeight:800,color:T.gn}}>FINPATH</div>{mb&&<button onClick={()=>sSb(false)} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:16}}>✕</button>}</div><nav style={{flex:1,padding:"0 8px"}}>{nvs.map(n=>{const a=pg===n.id;return<button key={n.id} onClick={()=>{setPg(n.id);if(mb)sSb(false)}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:a?600:400,marginBottom:1,background:a?T.gnB:"transparent",color:a?T.gn:T.tx2,transition:"all .15s"}}><span style={{fontSize:14}}>{n.i}</span>{n.l}{n.id==="price"&&plan==="free"&&<span style={{marginLeft:"auto",background:T.gn,color:"#000",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:99}}>PRO</span>}</button>})}</nav><div style={{padding:12,borderTop:`1px solid ${T.border}`}}><div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px"}}><div style={{width:28,height:28,borderRadius:99,background:T.gnB,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:T.gn}}>{u.p.name.charAt(0)}</div><div><div style={{fontSize:12,fontWeight:600}}>{u.p.name}</div><div style={{fontSize:10,color:T.tx3}}>{plan==="free"?"Free":"Pro ⭐"}</div></div></div></div></aside>}
    {mb&&sb&&<div onClick={()=>sSb(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99}}/>}
    <main style={{flex:1,minWidth:0,display:"flex",flexDirection:"column"}}><header style={{height:52,padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`,background:T.bg2,position:"sticky",top:0,zIndex:50}}><div style={{display:"flex",alignItems:"center",gap:10}}>{(!sb||mb)&&<button onClick={()=>sSb(true)} style={{background:"none",border:"none",color:T.tx2,cursor:"pointer",fontSize:18}}>☰</button>}{!sb&&<span style={{fontSize:14,fontWeight:800,color:T.gn}}>FINPATH</span>}</div><div style={{display:"flex",alignItems:"center",gap:10}}><Bt v="s" sz="s" onClick={()=>setShowImport(true)} st={{marginRight:6}}>🧠 Importar Excel</Bt><Bg cl={T.gn}>{fm(t.nw)}</Bg><button onClick={()=>setCur(c=>c==="COP"?"USD":"COP")} style={{background:cur==="USD"?"#3b82f6":"#22c55e",border:"none",color:"#fff",padding:"4px 10px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:11,marginLeft:4}}>{cur==="USD"?"🇺🇸 USD":"🇨🇴 COP"}</button>{u.trm&&<span style={{fontSize:10,color:T.tx3,marginLeft:4}}>TRM: ${Math.round(u.trm).toLocaleString()}</span>}{plan==="free"&&<Bt sz="s" onClick={()=>setPg("price")}>Upgrade</Bt>}</div></header><div style={{flex:1,padding:mb?14:28,maxWidth:1200,width:"100%"}}>{rp()}</div>{showImport&&<CsvImport onImport={handleImport} onClose={()=>setShowImport(false)}/>}</main>
  </div>;
}
