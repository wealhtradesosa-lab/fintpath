import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid } from "recharts";
const Zz={bg:"#0c0c0f",bg2:"#141418",bg3:"#1e1e24",card:"#141418",border:"rgba(255,255,255,0.06)",txt:"#fafafa",txt2:"#a1a1aa",txt3:"#71717a",green:"#22c55e",greenDim:"rgba(34,197,94,0.1)",red:"#ef4444",blue:"#3b82f6",orange:"#f97316",orangeDim:"rgba(249,115,22,0.1)",gold:"#eab308"};
const SM=1959000;
const fC=v=>{if(Math.abs(v)>=1e9)return"$"+(v/1e9).toFixed(1)+"B";if(Math.abs(v)>=1e6)return"$"+(v/1e6).toFixed(1)+"M";if(Math.abs(v)>=1e3)return"$"+(v/1e3).toFixed(0)+"K";return"$"+Math.round(v).toLocaleString("es-CO")};
const fU=v=>"USD $"+Math.round(v).toLocaleString("en-US");
const fB=v=>v.toFixed(4)+" ₿";
const pc=v=>(v||0).toFixed(1)+"%";
const TT={background:"#1e1e24",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,color:"#fafafa",fontSize:12};
const Cd=({children,style:s,glow})=><div style={{background:Zz.card,border:`1px solid ${Zz.border}`,borderRadius:16,overflow:"hidden",...(glow?{borderColor:glow+"30",boxShadow:`0 0 20px ${glow}10`}:{}),...s}}>{children}</div>;
const MC=({l,v,sub,color})=><Cd><div style={{padding:"20px 24px"}}><div style={{fontSize:12,color:Zz.txt3,marginBottom:6}}>{l}</div><div style={{fontSize:26,fontWeight:800,color:color||Zz.txt,letterSpacing:"-0.03em"}}>{v}</div>{sub&&<div style={{fontSize:12,color:color||Zz.txt3,marginTop:3}}>{sub}</div>}</div></Cd>;
const Rw=({l,v,color,bold})=><div style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${Zz.border}`}}><span style={{fontSize:14,color:Zz.txt2}}>{l}</span><span style={{fontSize:14,fontWeight:bold?700:600,color:color||Zz.txt,fontFamily:"monospace"}}>{v}</span></div>;
const Sl=({label,value,onChange,min,max,step,color,display,sub})=><div style={{marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:14,color:Zz.txt2}}>{label}: <strong style={{color:color||Zz.orange}}>{display}</strong></span></div><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} style={{width:"100%",height:8,borderRadius:4,cursor:"pointer",accentColor:color||Zz.orange}}/>{sub&&<div style={{fontSize:11,color:Zz.txt3,marginTop:4}}>{sub}</div>}</div>;

export default function PensionBTC({trm:pTrm}){
  const[tab,setTab]=useState("resumen");
  const[salSM,setSalSM]=useState(25);
  const[anios,setAnios]=useState(10);
  const[cagr,setCagr]=useState(55.8);
  const[tasaR,setTasaR]=useState(55);
  const[impR,setImpR]=useState(19);
  const[regla,setRegla]=useState(4);
  const[pBTC,setPBTC]=useState(68813);
  const trm=pTrm||4200;
  const salMes=salSM*SM;
  const apMes=salMes*0.16;
  const empMes=salMes*0.04;
  const emrMes=salMes*0.12;
  const impMes=salMes*(impR/100);

  const btc=useMemo(()=>{
    const cd=cagr/100,amU=apMes/trm;let ba=0;const yd=[];
    for(let y=1;y<=anios;y++){for(let m=1;m<=12;m++){const mg=(y-1)*12+m;ba+=amU/(pBTC*Math.pow(1+cd,mg/12));}const pf=pBTC*Math.pow(1+cd,y);yd.push({anio:y,precioBTC:Math.round(pf),btcAcum:ba,valorUSD:Math.round(ba*pf)});}
    const pf=pBTC*Math.pow(1+cd,anios),vf=ba*pf,rA=vf*(regla/100),rM=rA/12,rMC=rM*trm,ti=apMes*12*anios,ret=ti>0?((vf*trm-ti)/ti)*100:0;
    return{ba,pf,vf,vfC:vf*trm,rM,rMC,ti,ret,yd};
  },[salSM,anios,cagr,pBTC,trm,regla,apMes]);

  const penMes=salMes*(tasaR/100);
  const penAI=penMes*12*0.19;
  const penTotal=penMes*12*anios;
  const mult=penMes>0?btc.rMC/penMes:0;
  const btcTotal=btc.rMC*12*anios;
  const tabs=[{id:"resumen",i:"📊",l:"Resumen"},{id:"simulador",i:"⚙️",l:"Simulador"},{id:"proyeccion",i:"📈",l:"Proyección"},{id:"analisis",i:"🔍",l:"Análisis"}];

  return<div style={{maxWidth:1100,margin:"0 auto"}}>
    <style>{"@media print { body { background: #fff !important; color: #000 !important; } [data-no-print] { display: none !important; } .recharts-wrapper { page-break-inside: avoid; } }"}</style>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:48,height:48,borderRadius:14,background:Zz.orangeDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>₿</div>
        <div><h1 style={{fontSize:24,fontWeight:800,margin:0,color:Zz.orange}}>Pensionarse con Bitcoin</h1><p style={{fontSize:13,color:Zz.txt3,margin:0}}>Simulador profesional • Sistema pensional colombiano + DCA Bitcoin</p></div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>{document.body.setAttribute("data-date",new Date().toLocaleDateString("es-CO"));window.print()}} style={{background:Zz.orange,color:"#000",border:"none",padding:"10px 20px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13,whiteSpace:"nowrap"}}>📄 Exportar PDF</button>
        <div style={{textAlign:"right"}}><div style={{fontSize:13,color:Zz.green}}>● BTC {fU(pBTC)}</div><div style={{fontSize:13,color:Zz.orange}}>● USD/COP {"$"+trm.toLocaleString()}</div></div>
      </div>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:24}}>{tabs.map(t=>{const a=tab===t.id;return<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 20px",borderRadius:10,border:a?`1px solid ${Zz.orange}`:`1px solid ${Zz.border}`,background:a?Zz.orangeDim:"transparent",color:a?Zz.orange:Zz.txt3,cursor:"pointer",fontSize:14,fontWeight:a?700:500}}>{t.i} {t.l}</button>})}</div>

    {tab==="resumen"&&<div>
      {/* PASO A PASO - Lo que pasa con tu dinero */}
      <div style={{background:"linear-gradient(135deg,rgba(249,115,22,0.06),rgba(249,115,22,0.02))",border:"1px solid "+Zz.orange+"20",borderRadius:16,padding:24,marginBottom:20}}>
        <div style={{fontSize:16,fontWeight:800,color:Zz.orange,marginBottom:12}}>¿Cómo funciona esta estrategia?</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:6}}>💰</div>
            <div style={{fontSize:13,fontWeight:700,color:Zz.txt}}>PASO 1: Ahorrar</div>
            <div style={{fontSize:12,color:Zz.txt2,marginTop:4}}>Cada mes inviertes <strong style={{color:Zz.orange}}>{fC(apMes)}</strong> en Bitcoin (lo mismo que irías a pensión)</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:6}}>📈</div>
            <div style={{fontSize:13,fontWeight:700,color:Zz.txt}}>PASO 2: Crecer</div>
            <div style={{fontSize:12,color:Zz.txt2,marginTop:4}}>Durante <strong style={{color:Zz.green}}>{anios} años</strong> tu BTC crece. Inviertes {fC(btc.ti)} y terminas con <strong style={{color:Zz.green}}>{fU(btc.vf)}</strong></div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:6}}>🏖️</div>
            <div style={{fontSize:13,fontWeight:700,color:Zz.txt}}>PASO 3: Retirar</div>
            <div style={{fontSize:12,color:Zz.txt2,marginTop:4}}>Retiras solo el <strong style={{color:Zz.orange}}>{regla}% al año</strong> de tu BTC para vivir = <strong style={{color:Zz.orange}}>{fC(btc.rMC)}/mes</strong></div>
          </div>
        </div>
      </div>

      {/* RESULTADO PRINCIPAL */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Cd glow={Zz.blue} style={{padding:28,textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:700,color:Zz.blue,marginBottom:12}}>🏛️ PENSIÓN TRADICIONAL</div>
          <div style={{fontSize:12,color:Zz.txt3,marginBottom:4}}>Tu mesada mensual sería:</div>
          <div style={{fontSize:36,fontWeight:800,color:Zz.blue}}>{fC(penMes)}</div>
          <div style={{fontSize:12,color:Zz.txt3,marginTop:4}}>COP por mes</div>
          <div style={{fontSize:12,color:Zz.txt3,marginTop:12,borderTop:"1px solid "+Zz.border,paddingTop:10}}>
            En {anios} años recibes: {fC(penTotal)}<br/>
            <span style={{color:Zz.red}}>⚠ No se hereda. Se pierde al fallecer.</span>
          </div>
        </Cd>
        <Cd glow={Zz.orange} style={{padding:28,textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:700,color:Zz.orange,marginBottom:12}}>🟠 AHORRO EN BITCOIN</div>
          <div style={{fontSize:12,color:Zz.txt3,marginBottom:4}}>Tu retiro mensual sería:</div>
          <div style={{fontSize:36,fontWeight:800,color:Zz.orange}}>{fC(btc.rMC)}</div>
          <div style={{fontSize:12,color:Zz.txt3,marginTop:4}}>COP por mes ({regla}% anual de tu BTC)</div>
          <div style={{fontSize:12,color:Zz.txt3,marginTop:12,borderTop:"1px solid "+Zz.border,paddingTop:10}}>
            En {anios} años recibes: {fC(btcTotal)}<br/>
            <span style={{color:Zz.green}}>✓ Tu capital de {fU(btc.vf)} se hereda.</span>
          </div>
        </Cd>
      </div>

      {/* MULTIPLICADOR */}
      <Cd glow={Zz.green} style={{padding:28,textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:14,color:Zz.txt2}}>Con Bitcoin recibirías cada mes</div>
        <div style={{fontSize:64,fontWeight:800,color:Zz.green,lineHeight:1}}>{mult.toFixed(1)}x</div>
        <div style={{fontSize:15,color:Zz.txt2,marginTop:4}}>más que con pensión tradicional</div>
        <div style={{fontSize:13,color:Zz.txt3,marginTop:12}}>{fC(btc.rMC)}/mes con BTC vs {fC(penMes)}/mes con pensión</div>
      </Cd>

      {/* EXPLICACIÓN PASO A PASO */}
      <Cd style={{padding:28,marginBottom:20,border:"1px solid "+Zz.orange+"20"}}>
        <div style={{fontSize:16,fontWeight:800,color:Zz.orange,marginBottom:16}}>📖 ¿Cómo funciona? — Explicado paso a paso</div>
        <div style={{fontSize:14,color:Zz.txt2,lineHeight:2}}>
          <div style={{background:Zz.bg3,borderRadius:12,padding:16,marginBottom:10}}>
            <strong style={{color:Zz.green}}>1. Ahorras cada mes:</strong> De tu salario de {fC(salSM*SM)} mensuales, destinas {fC(apMes)} cada mes a comprar Bitcoin. Haces esto durante <strong>{anios} años</strong> ({anios*12} meses).
          </div>
          <div style={{background:Zz.bg3,borderRadius:12,padding:16,marginBottom:10}}>
            <strong style={{color:Zz.green}}>2. Tu inversión total:</strong> En {anios} años habrás invertido {fC(btc.ti)} en total.
          </div>
          <div style={{background:Zz.bg3,borderRadius:12,padding:16,marginBottom:10}}>
            <strong style={{color:Zz.green}}>3. Tu Bitcoin se valoriza:</strong> Gracias al crecimiento del Bitcoin ({pc(cagr)} anual), tus {fC(btc.ti)} se convierten en <strong style={{color:Zz.orange}}>{fU(btc.vf)}</strong> ({fC(btc.vfC)}).
          </div>
          <div style={{background:Zz.bg3,borderRadius:12,padding:16,marginBottom:10}}>
            <strong style={{color:Zz.green}}>4. Vives de tu Bitcoin:</strong> No vendes todo. Solo retiras el <strong style={{color:Zz.orange}}>{regla}% al año</strong> para vivir. Ejemplo: si tienes {fU(btc.vf)}, el {regla}% es {fU(btc.vf*regla/100).replace(" USD","")}/año = <strong style={{color:Zz.orange}}>{fC(btc.rMC)} al mes</strong>.
          </div>
          <div style={{background:Zz.bg3,borderRadius:12,padding:16,marginBottom:10}}>
            <strong style={{color:Zz.green}}>5. Tu capital se preserva:</strong> El otro <strong>{100-regla}%</strong> queda invertido (<strong style={{color:Zz.green}}>{fU(btc.vf*(1-regla/100))}</strong>). Este capital sigue creciendo y al fallecer se <strong>hereda a tu familia</strong>.
          </div>
          <div style={{background:Zz.orange+"10",borderRadius:12,padding:16,border:"1px solid "+Zz.orange+"20"}}>
            <strong style={{color:Zz.orange}}>Comparación:</strong> Con pensión recibes {fC(penMes)}/mes pero al morir se pierde todo. Con Bitcoin recibes <strong style={{color:Zz.green}}>{fC(btc.rMC)}/mes</strong> ({mult.toFixed(1)}x más) y dejas {fU(btc.vf*(1-regla/100))} a tus hijos.
          </div>
        </div>
      </Cd>

      {/* GRÁFICO: Ingreso mensual comparado */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Cd style={{padding:24}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>₿ Tu BTC crece así (USD)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={btc.yd}><XAxis dataKey="anio" tick={{fill:Zz.txt3,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:Zz.txt3,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>"$"+(v/1e6).toFixed(1)+"M"}/><Tooltip contentStyle={TT} labelStyle={{color:"#fafafa"}} itemStyle={{color:"#fafafa"}} formatter={v=>fU(v)}/><Bar dataKey="valorUSD" radius={[4,4,0,0]}>{btc.yd.map((_,i)=><Cell key={i} fill={Zz.orange}/>)}</Bar></BarChart>
          </ResponsiveContainer>
        </Cd>
        <Cd style={{padding:24}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Comparación: ingreso mensual</div>
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:Zz.blue}}>🏛️ Pensión</span><span style={{fontSize:14,fontWeight:700,color:Zz.blue}}>{fC(penMes)}/mes</span></div>
            <div style={{height:32,background:Zz.bg3,borderRadius:8,overflow:"hidden"}}><div style={{width:`${Math.min((penMes/Math.max(btc.rMC,1))*100,100)}%`,height:"100%",background:Zz.blue,borderRadius:8,minWidth:20}}/></div>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:Zz.orange}}>🟠 Bitcoin ({regla}%)</span><span style={{fontSize:14,fontWeight:700,color:Zz.orange}}>{fC(btc.rMC)}/mes</span></div>
            <div style={{height:32,background:Zz.bg3,borderRadius:8,overflow:"hidden"}}><div style={{width:"100%",height:"100%",background:Zz.orange,borderRadius:8}}/></div>
          </div>
        </Cd>
      </div>

      {/* DETALLE */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Cd style={{padding:24}}>
          <div style={{fontSize:14,fontWeight:700,color:Zz.blue,marginBottom:12}}>🏛️ Detalle Pensión</div>
          <Rw l="Tu salario mensual:" v={fC(salMes)} bold/>
          <Rw l={"Tasa reemplazo ("+tasaR+"%):"} v={fC(penMes)+"/mes"} color={Zz.blue} bold/>
          <Rw l="Impuestos al año:" v={"-"+fC(penAI)} color={Zz.red}/>
          <Rw l={"Total en "+anios+" años:"} v={fC(penTotal)} bold/>
          <div style={{padding:"12px 16px",fontSize:12,color:Zz.red}}>⚠ Si falleces, tu familia no recibe nada más</div>
        </Cd>
        <Cd style={{padding:24}}>
          <div style={{fontSize:14,fontWeight:700,color:Zz.orange,marginBottom:12}}>🟠 Detalle Bitcoin</div>
          <Rw l="Aporte mensual:" v={fC(apMes)+"/mes"} bold/>
          <Rw l={"Invertido en "+anios+" años:"} v={fC(btc.ti)}/>
          <Rw l="BTC acumulado:" v={fB(btc.ba)} color={Zz.orange} bold/>
          <Rw l="Valor de tu BTC (USD):" v={fU(btc.vf)} color={Zz.green} bold/>
          <Rw l={"Retiras "+regla+"% al año:"} v={fC(btc.rMC)+"/mes"} color={Zz.orange} bold/>
          <div style={{padding:"12px 16px",fontSize:12,color:Zz.green}}>✓ Tu familia hereda {fU(btc.vf)} en Bitcoin</div>
        </Cd>
      </div>

      {/* EXPLICACIÓN DE LA REGLA */}
      <div style={{background:Zz.bg3,borderRadius:14,padding:20,marginTop:16,border:"1px solid "+Zz.border}}>
        <div style={{fontSize:14,fontWeight:700,color:Zz.orange,marginBottom:8}}>📘 ¿Qué es la "Regla del {regla}%"?</div>
        <div style={{fontSize:13,color:Zz.txt2,lineHeight:1.7}}>
          Es una estrategia de retiro inventada por estudios de finanzas. Funciona así: si tienes por ejemplo <strong>{fU(btc.vf)}</strong> en BTC, 
          cada año retiras solo el <strong>{regla}%</strong> = <strong>{fC(btc.rMC*12)}/año</strong> ({fC(btc.rMC)} al mes). 
          El resto de tu capital sigue invertido y creciendo. Es como vivir de los "intereses" sin comerte el capital. 
          A menor porcentaje, tu dinero dura más años. El 4% es el estándar más usado en planificación financiera.
        </div>
      </div>
    </div>}

    {tab==="simulador"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div><Cd style={{padding:24,marginBottom:16}}><div style={{fontSize:16,fontWeight:700,marginBottom:20}}>⚙️ Parámetros de Simulación</div>
        <Sl label="💼 Tu salario mensual" value={salSM} onChange={setSalSM} min={1} max={25} step={1} display={salSM+" salarios mínimos mensuales = "+fC(salSM*SM)+"/mes"} color={Zz.txt} sub={"Tu aporte MENSUAL a BTC: "+fC(apMes)+" (el 16% de tu salario, igual que se aporta a pensión)"}/>
        <Sl label="⏰ ¿Cuántos años vas a ahorrar?" value={anios} onChange={setAnios} min={1} max={30} step={1} display={anios+" años"} color={Zz.green} sub={"En "+anios+" años habrás aportado "+fC(apMes*12*anios)+" en total ("+fC(apMes)+" x "+anios*12+" meses)"}/>
        <Sl label="📈 Crecimiento anual del Bitcoin (CAGR)" value={cagr} onChange={setCagr} min={5} max={80} step={0.1} display={pc(cagr)+" al año"} color={Zz.orange} sub="Es el % que sube Bitcoin cada año en promedio. Histórico: 69.8% • Conservador: 20-30% • Muy conservador: 10-15%"/>
        <Sl label="💰 Precio actual de 1 Bitcoin" value={pBTC} onChange={setPBTC} min={10000} max={200000} step={1000} display={fU(pBTC)} color={Zz.gold} sub={"= "+fC(pBTC*trm)+" COP"}/>
      <Sl label={"🏦 ¿Cuánto retirar al año? (Regla del "+regla+"%)"} value={regla} onChange={setRegla} min={2} max={8} step={0.5} display={regla+"% anual"} color={Zz.orange} sub={"Si tienes $100M en BTC y retiras "+regla+"%, sacas $"+Math.round(100*regla/100)+"M al año ($"+ Math.round(100*regla/100/12*10)/10 +"M/mes). El resto sigue creciendo. A menor %, tu capital dura para siempre."}/>
        <Sl label={"📊 Tasa de reemplazo pensional"} value={tasaR} onChange={setTasaR} min={30} max={80} step={1} display={tasaR+"%"} color={Zz.blue} sub={"Es el % de tu salario que recibirías como pensión. En Colombia varía entre 55% y 80% según semanas cotizadas."}/>
      </Cd>
      <Cd glow={Zz.orange} style={{padding:24}}><div style={{fontSize:16,fontWeight:700,marginBottom:16}}>Tu Resultado después de {anios} años</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div><div style={{fontSize:12,color:Zz.txt3}}>Aporte mensual</div><div style={{fontSize:22,fontWeight:800,marginTop:4}}>{fC(apMes)}/mes</div></div>
        <div><div style={{fontSize:12,color:Zz.txt3}}>Valor BTC</div><div style={{fontSize:22,fontWeight:800,color:Zz.green,marginTop:4}}>{fU(btc.vf)}</div></div>
        <div><div style={{fontSize:12,color:Zz.txt3}}>BTC Acumulado</div><div style={{fontSize:22,fontWeight:800,marginTop:4}}>{fB(btc.ba)}</div></div>
        <div><div style={{fontSize:12,color:Zz.txt3}}>Retorno total</div><div style={{fontSize:22,fontWeight:800,color:Zz.orange,marginTop:4}}>+{pc(btc.ret)}</div></div>
      </div>
      <div style={{marginTop:16,padding:"16px 0",borderTop:"1px solid "+Zz.border}}>
        <div style={{fontSize:12,color:Zz.txt3,marginBottom:8}}>💸 <strong>¿Cuánto retiras por mes?</strong> — Elige qué porcentaje de tu portafolio retiras cada año para vivir:</div>
        <Sl label="Retiro anual" value={regla} onChange={setRegla} min={1} max={10} step={0.5} display={regla+"% → "+fC(btc.rMC)+"/mes"} color={Zz.orange} sub={"Retiras "+fC(btc.rMC)+" mensuales. Tu capital de "+fU(btc.vf)+" sigue creciendo. La regla del 4% es la más usada para no agotar el portafolio."}/>
      </div>
      <div style={{background:Zz.bg3,borderRadius:10,padding:14,marginTop:8}}>
        <div style={{fontSize:13,fontWeight:700,color:Zz.orange,marginBottom:4}}>Tu ingreso mensual en retiro: {fC(btc.rMC)}</div>
        <div style={{fontSize:12,color:Zz.txt3}}>Esto es {mult.toFixed(1)}x más de lo que recibirías con pensión tradicional ({fC(penMes)}/mes)</div>
      </div>
    </Cd></div>
      <Cd style={{padding:24}}><div style={{fontSize:16,fontWeight:700,marginBottom:16}}>📊 Proyección Año por Año</div><div style={{maxHeight:500,overflowY:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Año","Precio BTC","BTC","Valor USD"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:h==="Año"?"left":"right",color:Zz.txt3,fontWeight:600,fontSize:11,textTransform:"uppercase",borderBottom:`1px solid ${Zz.border}`,position:"sticky",top:0,background:Zz.card}}>{h}</th>)}</tr></thead>
        <tbody>{btc.yd.map(d=><tr key={d.anio} style={{borderBottom:`1px solid ${Zz.border}`}}><td style={{padding:"10px 12px",fontWeight:600}}>{d.anio}</td><td style={{padding:"10px 12px",textAlign:"right",fontFamily:"monospace",color:Zz.txt2}}>{fU(d.precioBTC)}</td><td style={{padding:"10px 12px",textAlign:"right",fontFamily:"monospace",color:Zz.orange}}>{d.btcAcum.toFixed(4)}</td><td style={{padding:"10px 12px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:Zz.green}}>{d.valorUSD>=1e6?"$"+(d.valorUSD/1e6).toFixed(2)+"M":"$"+(d.valorUSD/1e3).toFixed(0)+"K"}</td></tr>)}</tbody></table></div></Cd>
    </div>}

    {tab==="proyeccion"&&<div>
      {/* COMPARACIÓN LADO A LADO — Super claro */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        {/* PENSIÓN */}
        <Cd glow={Zz.blue} style={{padding:28}}>
          <div style={{fontSize:15,fontWeight:700,color:Zz.blue,marginBottom:16}}>🏛️ Pensión Tradicional</div>
          <div style={{background:Zz.bg3,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{fontSize:11,color:Zz.txt3}}>Tu mesada mensual de pensión:</div>
            <div style={{fontSize:28,fontWeight:800,color:Zz.blue,marginTop:4}}>{fC(penMes)}<span style={{fontSize:13,fontWeight:400,color:Zz.txt3}}>/mes</span></div>
          </div>
          <div style={{background:Zz.bg3,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{fontSize:11,color:Zz.txt3}}>Si vives {anios} años después de pensionarte, recibes en total:</div>
            <div style={{fontSize:22,fontWeight:800,marginTop:4}}>{fC(penTotal)}</div>
            <div style={{fontSize:11,color:Zz.txt3,marginTop:2}}>({fC(penMes)} × {anios*12} meses)</div>
          </div>
          <div style={{fontSize:12,color:Zz.red,fontWeight:600}}>⚠ Al fallecer se pierde TODO. No es heredable.</div>
        </Cd>

        {/* BITCOIN */}
        <Cd glow={Zz.green} style={{padding:28}}>
          <div style={{fontSize:15,fontWeight:700,color:Zz.green,marginBottom:16}}>🟠 Estrategia Bitcoin</div>
          <div style={{background:Zz.bg3,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{fontSize:11,color:Zz.txt3}}>Tu retiro mensual de Bitcoin:</div>
            <div style={{fontSize:28,fontWeight:800,color:Zz.orange,marginTop:4}}>{fC(btc.rMC)}<span style={{fontSize:13,fontWeight:400,color:Zz.txt3}}>/mes</span></div>
            <div style={{fontSize:11,color:Zz.txt3,marginTop:2}}>(retiras {regla}% al año de tu portafolio)</div>
          </div>
          <div style={{background:Zz.bg3,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{fontSize:11,color:Zz.txt3}}>Si retiras durante {anios} años, sacas en total:</div>
            <div style={{fontSize:22,fontWeight:800,marginTop:4}}>{fC(btcTotal)}</div>
            <div style={{fontSize:11,color:Zz.txt3,marginTop:2}}>({fC(btc.rMC)} × {anios*12} meses)</div>
          </div>
          <div style={{background:Zz.bg3,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{fontSize:11,color:Zz.txt3}}>Y ADEMÁS tu capital sigue ahí:</div>
            <div style={{fontSize:22,fontWeight:800,color:Zz.green,marginTop:4}}>{fU(btc.vf)}</div>
            <div style={{fontSize:11,color:Zz.txt3,marginTop:2}}>(= {fC(btc.vfC)} al cambio actual)</div>
          </div>
          <div style={{fontSize:12,color:Zz.green,fontWeight:600}}>✅ El capital es 100% heredable para tu familia.</div>
        </Cd>
      </div>

      {/* RESUMEN NUMÉRICO */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        <MC l="BTC te da vs Pensión" v={mult.toFixed(1)+"x más"} color={Zz.green}/>
        <MC l={"Tu BTC en "+anios+" años (USD)"} v={fU(btc.vf)} color={Zz.orange}/>
        <MC l="BTC acumulados" v={fB(btc.ba)} color={Zz.orange}/>
        <MC l="Capital heredable (USD)" v={fU(btc.vf*(1-regla/100))} color={Zz.green}/>
      </div>
      <Cd glow={Zz.green} style={{padding:40,textAlign:"center",background:"linear-gradient(135deg,rgba(34,197,94,0.05),rgba(34,197,94,0.02))"}}>
        <div style={{fontSize:16,color:Zz.txt2}}>Cada mes con Bitcoin recibirías</div>
        <div style={{fontSize:72,fontWeight:800,background:"linear-gradient(135deg,#22c55e,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{mult.toFixed(1)}x</div>
        <div style={{fontSize:16,color:Zz.txt2}}>más que con la pensión tradicional</div>
        <div style={{fontSize:14,color:Zz.txt3,marginTop:8}}>Y el capital es 100% heredable</div>
      </Cd>
      <Cd style={{padding:24,marginTop:20}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Crecimiento Portafolio BTC</div><ResponsiveContainer width="100%" height={250}><AreaChart data={btc.yd}><CartesianGrid strokeDasharray="3 3" stroke={Zz.border}/><XAxis dataKey="anio" tick={{fill:Zz.txt3,fontSize:11}} axisLine={false}/><YAxis tick={{fill:Zz.txt3,fontSize:10}} axisLine={false} tickFormatter={v=>"$"+(v/1e6).toFixed(1)+"M"}/><Tooltip contentStyle={TT} labelStyle={{color:"#fafafa"}} itemStyle={{color:"#fafafa"}} formatter={v=>fU(v)}/><defs><linearGradient id="btcG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={Zz.orange} stopOpacity={0.3}/><stop offset="100%" stopColor={Zz.orange} stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey="valorUSD" stroke={Zz.orange} fill="url(#btcG)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></Cd>
    </div>}

    {tab==="analisis"&&<div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Cd style={{padding:24}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>💸 Composición del Aporte Mensual</div><Rw l="Empleado (4%)" v={fC(empMes)} color={Zz.orange}/><Rw l="Empleador (12%)" v={fC(emrMes)} color={Zz.orange}/><Rw l={"Impuesto Renta ("+impR+"%)"} v={fC(impMes)} color={Zz.red}/><div style={{display:"flex",justifyContent:"space-between",padding:"14px 16px",background:Zz.bg3,borderRadius:10,marginTop:8}}><span style={{fontWeight:700}}>Total Mensual</span><span style={{fontSize:16,fontWeight:800,color:Zz.orange,fontFamily:"monospace"}}>{fC(apMes)}</span></div></Cd>
        <Cd style={{padding:24}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>⚠ Riesgos y Consideraciones</div>{[{i:"🟠",t:"Volatilidad BTC",d:"Drawdowns históricos de -80%. Requiere horizonte largo.",c:Zz.orange},{i:"🏛️",t:"Riesgo Pensional",d:"Reformas, cambios de reglas, inflación, insolvencia de fondos.",c:Zz.blue},{i:"✓",t:"Ventajas BTC",d:"Auto-custodia, heredable, escasez absoluta de 21M, sin intermediarios.",c:Zz.green}].map(r=><div key={r.t} style={{display:"flex",gap:12,padding:"12px 14px",background:Zz.bg3,borderRadius:12,marginBottom:8,border:`1px solid ${r.c}15`}}><span style={{fontSize:18,flexShrink:0}}>{r.i}</span><div><div style={{fontSize:14,fontWeight:700,marginBottom:2}}>{r.t}</div><div style={{fontSize:12,color:Zz.txt3,lineHeight:1.5}}>{r.d}</div></div></div>)}</Cd>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Cd style={{padding:24}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>📋 Supuestos del Modelo</div><Rw l="SMMLV 2026:" v={"$"+SM.toLocaleString("es-CO")+" COP"}/><Rw l="Aporte pensión:" v="16% del salario"/><Rw l="Tasa reemplazo:" v={tasaR+"%"}/><Rw l="Retiro anual del portafolio:" v={regla+"% → "+fC(btc.rMC)+"/mes"}/><Rw l="CAGR BTC:" v={pc(cagr)} color={Zz.orange}/></Cd>
        <Cd glow={Zz.orange} style={{padding:28,display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"center",background:"linear-gradient(135deg,rgba(249,115,22,0.05),rgba(249,115,22,0.02))"}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>🎯 Conclusión</div>
          <div style={{fontSize:14,color:Zz.txt2}}>Invirtiendo <span style={{color:Zz.green,fontWeight:700}}>{fC(btc.ti)}</span> en BTC</div>
          <div style={{fontSize:36,fontWeight:800,color:Zz.orange,margin:"12px 0"}}>{mult.toFixed(1)}x más ingreso</div>
          <div style={{fontSize:14,color:Zz.txt2}}>{fC(btc.rMC)}/mes vs {fC(penMes)}/mes</div>
          <div style={{fontSize:12,color:Zz.orange,marginTop:12}}>* Usando CAGR {pc(cagr)} (conservador vs 69.8% histórico)</div>
        </Cd>
      </div>
    </div>}

    <div style={{textAlign:"center",marginTop:32,padding:"16px 0",borderTop:`1px solid ${Zz.border}`}}><p style={{fontSize:12,color:Zz.txt3}}>⚠ Not financial advice • Simulador educativo • Resultados pasados no garantizan rendimientos futuros</p></div>
  </div>;
}
