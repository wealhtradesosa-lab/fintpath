import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid } from "recharts";
const T={bg:"#0c0c0f",bg2:"#141418",bg3:"#1e1e24",card:"#141418",border:"rgba(255,255,255,0.06)",txt:"#fafafa",txt2:"#a1a1aa",txt3:"#71717a",green:"#22c55e",greenDim:"rgba(34,197,94,0.1)",red:"#ef4444",blue:"#3b82f6",orange:"#f97316",orangeDim:"rgba(249,115,22,0.1)",gold:"#eab308"};
const SM=1959000;
const fC=v=>{if(Math.abs(v)>=1e9)return"$"+(v/1e9).toFixed(1)+"B";if(Math.abs(v)>=1e6)return"$"+(v/1e6).toFixed(1)+"M";if(Math.abs(v)>=1e3)return"$"+(v/1e3).toFixed(0)+"K";return"$"+Math.round(v).toLocaleString("es-CO")};
const fU=v=>"$"+Math.round(v).toLocaleString("en-US");
const fB=v=>v.toFixed(4)+" ₿";
const pc=v=>(v||0).toFixed(1)+"%";
const TT={background:"#1e1e24",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,color:"#fafafa",fontSize:12};
const Cd=({children,style:s,glow})=><div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",...(glow?{borderColor:glow+"30",boxShadow:`0 0 20px ${glow}10`}:{}),...s}}>{children}</div>;
const MC=({l,v,sub,color})=><Cd><div style={{padding:"20px 24px"}}><div style={{fontSize:12,color:T.txt3,marginBottom:6}}>{l}</div><div style={{fontSize:26,fontWeight:800,color:color||T.txt,letterSpacing:"-0.03em"}}>{v}</div>{sub&&<div style={{fontSize:12,color:color||T.txt3,marginTop:3}}>{sub}</div>}</div></Cd>;
const Rw=({l,v,color,bold})=><div style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:14,color:T.txt2}}>{l}</span><span style={{fontSize:14,fontWeight:bold?700:600,color:color||T.txt,fontFamily:"monospace"}}>{v}</span></div>;
const Sl=({label,value,onChange,min,max,step,color,display,sub})=><div style={{marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:14,color:T.txt2}}>{label}: <strong style={{color:color||T.orange}}>{display}</strong></span></div><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} style={{width:"100%",height:8,borderRadius:4,cursor:"pointer",accentColor:color||T.orange}}/>{sub&&<div style={{fontSize:11,color:T.txt3,marginTop:4}}>{sub}</div>}</div>;

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
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:48,height:48,borderRadius:14,background:T.orangeDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>₿</div>
        <div><h1 style={{fontSize:24,fontWeight:800,margin:0,color:T.orange}}>Pensionarse con Bitcoin</h1><p style={{fontSize:13,color:T.txt3,margin:0}}>Simulador profesional • Sistema pensional colombiano + DCA Bitcoin</p></div>
      </div>
      <div style={{textAlign:"right"}}><div style={{fontSize:13,color:T.green}}>● BTC {fU(pBTC)}</div><div style={{fontSize:13,color:T.orange}}>● USD/COP ${trm.toLocaleString()}</div></div>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:24}}>{tabs.map(t=>{const a=tab===t.id;return<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 20px",borderRadius:10,border:a?`1px solid ${T.orange}`:`1px solid ${T.border}`,background:a?T.orangeDim:"transparent",color:a?T.orange:T.txt3,cursor:"pointer",fontSize:14,fontWeight:a?700:500}}>{t.i} {t.l}</button>})}</div>

    {tab==="resumen"&&<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}><MC l={"Tu inversión ("+anios+" años)"} v={fC(btc.ti)} sub={"Aporte mensual: "+fC(apMes)}/><MC l={"Valor BTC acumulado"} v={fU(btc.vf)} sub={fB(btc.ba)+" Bitcoin"} color={T.green}/><MC l="Pensión mensual" v={fC(penMes)} sub={"Sistema tradicional"} color={T.blue}/><MC l="Retiro mensual BTC" v={fC(btc.rMC)} sub={mult.toFixed(1)+"x más que pensión"} color={T.orange}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Cd style={{padding:24}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>₿ Acumulación BTC (USD)</div><ResponsiveContainer width="100%" height={220}><BarChart data={btc.yd}><XAxis dataKey="anio" tick={{fill:T.txt3,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:T.txt3,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>"$"+(v/1e6).toFixed(1)+"M"}/><Tooltip contentStyle={TT} formatter={v=>fU(v)}/><Bar dataKey="valorUSD" radius={[4,4,0,0]}>{btc.yd.map((_,i)=><Cell key={i} fill={T.orange}/>)}</Bar></BarChart></ResponsiveContainer></Cd>
        <Cd style={{padding:24}}><div style={{fontSize:15,fontWeight:700,marginBottom:20}}>Ingreso Mensual en Retiro</div>
          <div style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:T.txt2}}>Pensión</span><span style={{fontSize:13,fontWeight:700,color:T.blue}}>{fC(penMes)}</span></div><div style={{height:28,background:T.bg3,borderRadius:8,overflow:"hidden"}}><div style={{width:`${Math.min((penMes/Math.max(btc.rMC,1))*100,100)}%`,height:"100%",background:T.blue,borderRadius:8,minWidth:20}}/></div></div>
          <div style={{marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:T.txt2}}>BTC {regla}%</span><span style={{fontSize:13,fontWeight:700,color:T.orange}}>{fC(btc.rMC)}</span></div><div style={{height:28,background:T.bg3,borderRadius:8,overflow:"hidden"}}><div style={{width:"100%",height:"100%",background:T.orange,borderRadius:8}}/></div></div>
          <div style={{background:T.bg3,borderRadius:14,padding:20,textAlign:"center"}}>
            <div style={{fontSize:12,color:T.txt3,marginBottom:8}}>Después de {anios} años ahorrando</div>
            <div style={{fontSize:14,color:T.txt2}}>Tu retiro mensual con BTC</div>
            <div style={{fontSize:42,fontWeight:800,color:T.orange,margin:"4px 0"}}>{fC(btc.rMC)}</div>
            <div style={{fontSize:13,color:T.txt3,marginBottom:12}}>vs pensión: {fC(penMes)}/mes</div>
            <div style={{fontSize:36,fontWeight:800,color:T.green}}>{mult.toFixed(1)}x</div>
            <div style={{fontSize:13,color:T.txt3}}>más que la pensión tradicional</div>
            <div style={{fontSize:12,color:T.txt3,marginTop:8,borderTop:"1px solid "+T.border,paddingTop:8}}>En {anios} años con BTC: {fC(btcTotal)} total • Con pensión: {fC(penTotal)} total</div>
          </div>
        </Cd>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Cd style={{padding:24}}><div style={{fontSize:15,fontWeight:700,color:T.blue,marginBottom:16}}>🏛️ Pensión Tradicional</div><Rw l="Mensual:" v={fC(penMes)} color={T.blue} bold/><Rw l="Impuesto anual:" v={"-"+fC(penAI)} color={T.red}/><Rw l={"En " + anios + " años:"} v={fC(penTotal)} bold/><div style={{padding:"12px 16px",fontSize:13,color:T.red}}>⚠ No heredable • Sujeto a reformas</div></Cd>
        <Cd glow={T.orange} style={{padding:24}}><div style={{fontSize:15,fontWeight:700,color:T.orange,marginBottom:16}}>🟠 Estrategia Bitcoin</div><Rw l="BTC acumulado:" v={fB(btc.ba)} color={T.orange} bold/><Rw l={"Retiro mensual ("+regla+"%):"} v={fC(btc.rMC)} color={T.orange} bold/><Rw l="Multiplicador:" v={mult.toFixed(1)+"x"} color={T.green} bold/><div style={{padding:"12px 16px",fontSize:13,color:T.green}}>✓ Heredable • Auto-custodia • Escasez absoluta</div></Cd>
      </div>
    </div>}

    {tab==="simulador"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div><Cd style={{padding:24,marginBottom:16}}><div style={{fontSize:16,fontWeight:700,marginBottom:20}}>⚙️ Parámetros de Simulación</div>
        <Sl label="Salario mensual" value={salSM} onChange={setSalSM} min={1} max={25} step={1} display={salSM+" SMMLV ("+fC(salSM*SM)+"/mes)"} color={T.txt} sub={"Aporte mensual a pensión (16%): "+fC(salSM*SM*0.16)+"/mes → "+fC(salSM*SM*0.16/trm)+" USD/mes a BTC"}/>
        <Sl label="Años Cotizando" value={anios} onChange={setAnios} min={1} max={30} step={1} display={anios+" años"} color={T.green}/>
        <Sl label="CAGR Bitcoin" value={cagr} onChange={setCagr} min={5} max={80} step={0.1} display={pc(cagr)} color={T.orange} sub="Histórico: 69.8% • Conservador: 20-30% • Muy conservador: 10-20%"/>
        <Sl label="Precio BTC" value={pBTC} onChange={setPBTC} min={10000} max={200000} step={1000} display={fU(pBTC)} color={T.gold}/>
      </Cd>
      <Cd glow={T.orange} style={{padding:24}}><div style={{fontSize:16,fontWeight:700,marginBottom:16}}>Tu Resultado</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div><div style={{fontSize:12,color:T.txt3}}>Aporte mensual</div><div style={{fontSize:22,fontWeight:800,marginTop:4}}>{fC(apMes)}/mes</div></div>
        <div><div style={{fontSize:12,color:T.txt3}}>Valor BTC</div><div style={{fontSize:22,fontWeight:800,color:T.green,marginTop:4}}>{fU(btc.vf)}</div></div>
        <div><div style={{fontSize:12,color:T.txt3}}>BTC Acumulado</div><div style={{fontSize:22,fontWeight:800,marginTop:4}}>{fB(btc.ba)}</div></div>
        <div><div style={{fontSize:12,color:T.txt3}}>Retorno</div><div style={{fontSize:22,fontWeight:800,color:T.orange,marginTop:4}}>+{pc(btc.ret)}</div></div>
      </div></Cd></div>
      <Cd style={{padding:24}}><div style={{fontSize:16,fontWeight:700,marginBottom:16}}>📊 Proyección Año por Año</div><div style={{maxHeight:500,overflowY:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Año","Precio BTC","BTC","Valor USD"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:h==="Año"?"left":"right",color:T.txt3,fontWeight:600,fontSize:11,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,background:T.card}}>{h}</th>)}</tr></thead>
        <tbody>{btc.yd.map(d=><tr key={d.anio} style={{borderBottom:`1px solid ${T.border}`}}><td style={{padding:"10px 12px",fontWeight:600}}>{d.anio}</td><td style={{padding:"10px 12px",textAlign:"right",fontFamily:"monospace",color:T.txt2}}>{fU(d.precioBTC)}</td><td style={{padding:"10px 12px",textAlign:"right",fontFamily:"monospace",color:T.orange}}>{d.btcAcum.toFixed(4)}</td><td style={{padding:"10px 12px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:T.green}}>{d.valorUSD>=1e6?"$"+(d.valorUSD/1e6).toFixed(2)+"M":"$"+(d.valorUSD/1e3).toFixed(0)+"K"}</td></tr>)}</tbody></table></div></Cd>
    </div>}

    {tab==="proyeccion"&&<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}><MC l="Ventaja BTC" v={mult.toFixed(1)+"x"} color={T.green}/><MC l="Capital Heredable" v={fU(btc.vf)} color={T.green}/><MC l={"BTC Año "+anios} v={fU(btc.yd[btc.yd.length-1]?.valorUSD||0)} color={T.orange}/><MC l="Total BTC" v={fB(btc.ba)} color={T.orange}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Cd glow={T.blue} style={{padding:28}}><div style={{fontSize:15,fontWeight:700,color:T.blue,marginBottom:12}}>🏛️ Pensión Tradicional (" + anios + " años)</div><div style={{fontSize:32,fontWeight:800}}>{fC(penTotal)}</div><div style={{fontSize:13,color:T.txt3,marginTop:4}}>{`Total recibido en ${anios} años de retiro`}</div><div style={{fontSize:13,color:T.red,marginTop:12}}>⚠ Al fallecer, se pierde todo</div></Cd>
        <Cd glow={T.green} style={{padding:28}}><div style={{fontSize:15,fontWeight:700,color:T.green,marginBottom:12}}>🟠 Estrategia BTC ({regla}% anual)</div><div style={{fontSize:32,fontWeight:800}}>{fC(btcTotal+btc.vfC)}</div><div style={{fontSize:13,color:T.txt3,marginTop:4}}>Total retirado + capital preservado</div><div style={{fontSize:13,color:T.green,marginTop:12}}>✓ Heredas ~{fU(btc.vf)} en BTC</div></Cd>
      </div>
      <Cd glow={T.green} style={{padding:40,textAlign:"center",background:"linear-gradient(135deg,rgba(34,197,94,0.05),rgba(34,197,94,0.02))"}}>
        <div style={{fontSize:16,color:T.txt2}}>Con la estrategia Bitcoin recibes</div>
        <div style={{fontSize:72,fontWeight:800,background:"linear-gradient(135deg,#22c55e,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{mult.toFixed(1)}x</div>
        <div style={{fontSize:16,color:T.txt2}}>más ingreso que la pensión tradicional</div>
        <div style={{fontSize:14,color:T.txt3,marginTop:8}}>Y el capital es 100% heredable</div>
      </Cd>
      <Cd style={{padding:24,marginTop:20}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Crecimiento Portafolio BTC</div><ResponsiveContainer width="100%" height={250}><AreaChart data={btc.yd}><CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="anio" tick={{fill:T.txt3,fontSize:11}} axisLine={false}/><YAxis tick={{fill:T.txt3,fontSize:10}} axisLine={false} tickFormatter={v=>"$"+(v/1e6).toFixed(1)+"M"}/><Tooltip contentStyle={TT} formatter={v=>fU(v)}/><defs><linearGradient id="btcG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.orange} stopOpacity={0.3}/><stop offset="100%" stopColor={T.orange} stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey="valorUSD" stroke={T.orange} fill="url(#btcG)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></Cd>
    </div>}

    {tab==="analisis"&&<div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Cd style={{padding:24}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>💸 Composición del Aporte Mensual</div><Rw l="Empleado (4%)" v={fC(empMes)} color={T.orange}/><Rw l="Empleador (12%)" v={fC(emrMes)} color={T.orange}/><Rw l={"Impuesto Renta ("+impR+"%)"} v={fC(impMes)} color={T.red}/><div style={{display:"flex",justifyContent:"space-between",padding:"14px 16px",background:T.bg3,borderRadius:10,marginTop:8}}><span style={{fontWeight:700}}>Total Mensual</span><span style={{fontSize:16,fontWeight:800,color:T.orange,fontFamily:"monospace"}}>{fC(apMes)}</span></div></Cd>
        <Cd style={{padding:24}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>⚠ Riesgos y Consideraciones</div>{[{i:"🟠",t:"Volatilidad BTC",d:"Drawdowns históricos de -80%. Requiere horizonte largo.",c:T.orange},{i:"🏛️",t:"Riesgo Pensional",d:"Reformas, cambios de reglas, inflación, insolvencia de fondos.",c:T.blue},{i:"✓",t:"Ventajas BTC",d:"Auto-custodia, heredable, escasez absoluta de 21M, sin intermediarios.",c:T.green}].map(r=><div key={r.t} style={{display:"flex",gap:12,padding:"12px 14px",background:T.bg3,borderRadius:12,marginBottom:8,border:`1px solid ${r.c}15`}}><span style={{fontSize:18,flexShrink:0}}>{r.i}</span><div><div style={{fontSize:14,fontWeight:700,marginBottom:2}}>{r.t}</div><div style={{fontSize:12,color:T.txt3,lineHeight:1.5}}>{r.d}</div></div></div>)}</Cd>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Cd style={{padding:24}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>📋 Supuestos del Modelo</div><Rw l="SMMLV 2026:" v={"$"+SM.toLocaleString("es-CO")+" COP"}/><Rw l="Aporte pensión:" v="16% del salario"/><Rw l="Tasa reemplazo:" v={tasaR+"%"}/><Rw l="Regla retiro BTC:" v={regla+"% anual"}/><Rw l="CAGR BTC:" v={pc(cagr)} color={T.orange}/></Cd>
        <Cd glow={T.orange} style={{padding:28,display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"center",background:"linear-gradient(135deg,rgba(249,115,22,0.05),rgba(249,115,22,0.02))"}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>🎯 Conclusión</div>
          <div style={{fontSize:14,color:T.txt2}}>Invirtiendo <span style={{color:T.green,fontWeight:700}}>{fC(btc.ti)}</span> en BTC</div>
          <div style={{fontSize:36,fontWeight:800,color:T.orange,margin:"12px 0"}}>{mult.toFixed(1)}x más ingreso</div>
          <div style={{fontSize:14,color:T.txt2}}>{fC(btc.rMC)}/mes vs {fC(penMes)}/mes</div>
          <div style={{fontSize:12,color:T.orange,marginTop:12}}>* Usando CAGR {pc(cagr)} (conservador vs 69.8% histórico)</div>
        </Cd>
      </div>
    </div>}

    <div style={{textAlign:"center",marginTop:32,padding:"16px 0",borderTop:`1px solid ${T.border}`}}><p style={{fontSize:12,color:T.txt3}}>⚠ Not financial advice • Simulador educativo • Resultados pasados no garantizan rendimientos futuros</p></div>
  </div>;
}
