import { useState, useMemo, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const T={bg2:"#18181b",bg3:"#27272a",card:"#111113",border:"rgba(255,255,255,0.06)",txt:"#fafafa",txt2:"#a1a1aa",txt3:"#71717a",gn:"#22c55e",gnD:"rgba(34,197,94,0.1)",rd:"#ef4444",rdD:"rgba(239,68,68,0.08)",bl:"#3b82f6",pr:"#a78bfa"};
const fm=n=>"$"+Math.round(n).toLocaleString("en-US");
const pc=n=>(n||0).toFixed(1)+"%";

function Slider({label,value,base,max,color,onChange,sub}){
  const perc=base>0?Math.round((value/base)*100):100;
  const diff=value-base;
  return(
    <div style={{marginBottom:4,background:`${color}08`,padding:"8px 12px",borderRadius:8,borderLeft:`3px solid ${color}`}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:12,color:T.txt2,fontWeight:500}}>{label} {sub&&<span style={{fontSize:10,color:T.txt3}}>{sub}</span>}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {diff!==0&&<span style={{fontSize:10,color:diff>0?T.gn:T.rd,fontWeight:600}}>{diff>0?"+":""}{fm(diff)}</span>}
          <span style={{fontSize:12,fontWeight:700,color}}>{fm(value)}</span>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <input type="range" min="0" max={max} step={Math.max(Math.round(max*0.01),5)} value={value} onChange={e=>onChange(Number(e.target.value))} style={{flex:1,accentColor:color,height:4,cursor:"pointer"}}/>
        <span style={{fontSize:10,color:T.txt3,minWidth:32,textAlign:"right"}}>{perc}%</span>
      </div>
    </div>
  );
}

export default function SimuladorAvanzado({user,totals}){
  const[simVals,setSimVals]=useState({});
  const[scenario,setScenario]=useState("actual");
  const setVal=useCallback((key,val)=>{setSimVals(prev=>({...prev,[key]:val}));},[]);
  const getVal=useCallback((key,def)=>simVals[key]!==undefined?simVals[key]:def,[simVals]);

  const applyScenario=id=>{
    setScenario(id);
    if(id==="actual"){setSimVals({});return;}
    const f={conservador:{i:.8,g:1.1},optimista:{i:1.3,g:.85},crisis:{i:.6,g:1.05}}[id]||{i:1,g:1};
    const nv={};
    (user.inv||[]).forEach(inv=>{
      const items=inv.un?inv.un.flatMap((u,ui)=>[...(u.ig||[]).map((ig,ii)=>({key:`i_${inv.id}_u${ui}_${ii}`,base:ig.m,isI:true})),...(u.gs||[]).map((g,gi)=>({key:`g_${inv.id}_u${ui}_${gi}`,base:g.m,isI:false}))]):[...(inv.ig||[]).map((ig,ii)=>({key:`i_${inv.id}_${ii}`,base:ig.m,isI:true})),...(inv.gs||[]).map((g,gi)=>({key:`g_${inv.id}_${gi}`,base:g.m,isI:false}))];
      items.forEach(it=>{nv[it.key]=Math.round(it.base*(it.isI?f.i:f.g));});
    });
    Object.entries(user.gastos||{}).forEach(([cat,items])=>{items.forEach((g,gi)=>{nv[`gf_${cat}_${gi}`]=Math.round(g.m*f.g);});});
    (user.deudas||[]).forEach((d,di)=>{nv[`debt_${di}`]=d.pg;});
    setSimVals(nv);
  };

  const simT=useMemo(()=>{
    let tI=0,tG=0;
    (user.inv||[]).forEach(inv=>{
      if(inv.un)inv.un.forEach((u,ui)=>{(u.ig||[]).forEach((ig,ii)=>{tI+=getVal(`i_${inv.id}_u${ui}_${ii}`,ig.m);});(u.gs||[]).forEach((g,gi)=>{tG+=getVal(`g_${inv.id}_u${ui}_${gi}`,g.m);});});
      else{(inv.ig||[]).forEach((ig,ii)=>{tI+=getVal(`i_${inv.id}_${ii}`,ig.m);});(inv.gs||[]).forEach((g,gi)=>{tG+=getVal(`g_${inv.id}_${gi}`,g.m);});}
    });
    let tGF=0;Object.entries(user.gastos||{}).forEach(([cat,items])=>{items.forEach((g,gi)=>{tGF+=getVal(`gf_${cat}_${gi}`,g.m);});});
    let tD=0;(user.deudas||[]).forEach((d,di)=>{tD+=getVal(`debt_${di}`,d.pg);});
    const ni=tI-tG,te=tGF+tD,cf=ni-te;
    return{tI,tG,ni,tGF,tD,te,cf,ind:te>0?(ni/te)*100:0};
  },[user,simVals,getVal]);

  const proj=useMemo(()=>{
    const nw=totals.nw||0;
    return Array.from({length:13},(_,i)=>({m:"M"+i,actual:nw+(totals.cf||0)*i,simulado:nw+simT.cf*i}));
  },[totals,simT]);

  const scs=[{id:"actual",i:"📋",l:"Actual",d:"Valores reales",c:T.bl},{id:"conservador",i:"🐢",l:"Conservador",d:"Ing -20%, gas +10%",c:T.txt2},{id:"optimista",i:"🚀",l:"Optimista",d:"Ing +30%, gas -15%",c:T.gn},{id:"crisis",i:"⚠️",l:"Crisis",d:"Ing -40%",c:T.rd}];

  return(
    <div>
      <h2 style={{fontSize:22,fontWeight:700,margin:"0 0 6px"}}>Simulador Financiero</h2>
      <p style={{color:T.txt3,fontSize:13,marginBottom:20}}>Ajusta cada ingreso y gasto con sliders en tiempo real</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
        {scs.map(sc=>{const a=scenario===sc.id;return(<button key={sc.id} onClick={()=>applyScenario(sc.id)} style={{padding:14,borderRadius:14,border:`2px solid ${a?sc.c:T.border}`,background:a?sc.c+"10":T.card,cursor:"pointer",textAlign:"center"}}><div style={{fontSize:20}}>{sc.i}</div><div style={{fontSize:11,fontWeight:700,color:a?sc.c:T.txt2}}>{sc.l}</div><div style={{fontSize:9,color:T.txt3}}>{sc.d}</div></button>);})}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        {[{l:"Ingreso Neto",v:fm(simT.ni),c:T.gn},{l:"Gastos Total",v:fm(simT.te),c:T.rd},{l:"Cash Flow",v:fm(simT.cf),c:simT.cf>=0?T.gn:T.rd},{l:"Independencia",v:pc(simT.ind),c:simT.ind>=100?T.gn:T.txt2}].map(m=>(<div key={m.l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:16}}><div style={{fontSize:10,color:T.txt3,textTransform:"uppercase",fontWeight:600}}>{m.l}</div><div style={{fontSize:22,fontWeight:700,color:m.c,marginTop:4}}>{m.v}</div></div>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{maxHeight:"70vh",overflowY:"auto",paddingRight:8}}>
          <h4 style={{fontSize:13,color:T.gn,fontWeight:700,margin:"0 0 8px",textTransform:"uppercase"}}>📈 Activos</h4>
          {(user.inv||[]).map(inv=>{
            const items=inv.un?inv.un.flatMap((u,ui)=>[...(u.ig||[]).map((ig,ii)=>({key:`i_${inv.id}_u${ui}_${ii}`,label:`${u.n}: ${ig.c}`,base:ig.m,tp:"i"})),...(u.gs||[]).map((g,gi)=>({key:`g_${inv.id}_u${ui}_${gi}`,label:`${u.n}: ${g.c}`,base:g.m,tp:"g"}))]):[...(inv.ig||[]).map((ig,ii)=>({key:`i_${inv.id}_${ii}`,label:ig.c,base:ig.m,tp:"i"})),...(inv.gs||[]).map((g,gi)=>({key:`g_${inv.id}_${gi}`,label:g.c,base:g.m,tp:"g"}))];
            if(!items.length)return null;
            const sI=items.filter(x=>x.tp==="i").reduce((s,x)=>s+getVal(x.key,x.base),0);
            const sG=items.filter(x=>x.tp==="g").reduce((s,x)=>s+getVal(x.key,x.base),0);
            return(<div key={inv.id} style={{marginBottom:10,background:"rgba(255,255,255,0.02)",borderRadius:10,border:`1px solid ${T.gn}20`,overflow:"hidden"}}><div style={{padding:"8px 12px",background:T.bg2,borderBottom:`1px solid ${T.gn}15`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><span style={{fontSize:13,fontWeight:700}}>{inv.n}</span><span style={{fontSize:10,color:T.txt3,marginLeft:6}}>{inv.ub}</span></div><div style={{display:"flex",gap:10}}>{sI>0&&<span style={{fontSize:11,color:T.gn,fontWeight:600}}>↑{fm(sI)}</span>}{sG>0&&<span style={{fontSize:11,color:T.txt2,fontWeight:600}}>↓{fm(sG)}</span>}<span style={{fontSize:12,fontWeight:700,color:sI-sG>=0?T.gn:T.rd,background:"rgba(255,255,255,0.05)",padding:"2px 8px",borderRadius:6}}>NOI: {fm(sI-sG)}</span></div></div><div style={{padding:"6px 8px"}}>{items.map(it=>(<Slider key={it.key} label={it.label} value={getVal(it.key,it.base)} base={it.base} max={Math.max(it.base*3,500)} color={it.tp==="i"?T.gn:T.rd} onChange={v=>setVal(it.key,v)}/>))}</div></div>);
          })}
          <h4 style={{fontSize:13,color:T.rd,fontWeight:700,margin:"16px 0 8px",textTransform:"uppercase"}}>💳 Gastos Familiares</h4>
          {Object.entries(user.gastos||{}).map(([cat,items])=>(<div key={cat}><div style={{fontSize:10,color:T.txt3,textTransform:"uppercase",fontWeight:700,margin:"8px 0 4px",paddingTop:4,borderTop:`1px solid ${T.border}`}}>{cat}</div>{items.map((g,gi)=>(<Slider key={`gf_${cat}_${gi}`} label={g.c} value={getVal(`gf_${cat}_${gi}`,g.m)} base={g.m} max={Math.max(g.m*3,500)} color={T.rd} onChange={v=>setVal(`gf_${cat}_${gi}`,v)} sub={g.t==="f"?"fijo":"var"}/>))}</div>))}
          <h4 style={{fontSize:13,color:T.pr,fontWeight:700,margin:"16px 0 8px",textTransform:"uppercase"}}>📋 Cuotas Deudas</h4>
          {(user.deudas||[]).map((d,di)=>{const lk=(user.inv||[]).find(i=>i.id===d.la);return(<Slider key={`debt_${di}`} label={d.n} value={getVal(`debt_${di}`,d.pg)} base={d.pg} max={Math.max(d.pg*3,500)} color={T.pr} onChange={v=>setVal(`debt_${di}`,v)} sub={lk?`→ ${lk.n}`:d.ts>0?`${d.ts}%`:""}/>);})}
          <button onClick={()=>{setSimVals({});setScenario("actual");}} style={{padding:"10px 20px",background:T.bg3,border:`1px solid ${T.border}`,color:T.txt2,borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:600,marginTop:12,width:"100%"}}>🔄 Reset</button>
        </div>
        <div><div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:20,position:"sticky",top:80}}>
          <div style={{fontSize:13,fontWeight:600,color:T.txt2,marginBottom:14}}>Proyección 12 Meses</div>
          <ResponsiveContainer width="100%" height={300}><AreaChart data={proj}><CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="m" tick={{fill:T.txt3,fontSize:10}} axisLine={false}/><YAxis tick={{fill:T.txt3,fontSize:10}} axisLine={false} tickFormatter={v=>"$"+(v/1e3).toFixed(0)+"k"}/><Tooltip contentStyle={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,color:T.txt,fontSize:12}} formatter={v=>fm(v)}/><Area type="monotone" dataKey="actual" stroke={T.txt3} fill={T.txt3+"08"} strokeDasharray="5 5" name="Actual"/><defs><linearGradient id="gsim" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.gn} stopOpacity={0.3}/><stop offset="100%" stopColor={T.gn} stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey="simulado" stroke={T.gn} fill="url(#gsim)" strokeWidth={2} name="Simulado"/><Legend/></AreaChart></ResponsiveContainer>
          <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div style={{background:T.bg2,padding:12,borderRadius:10,textAlign:"center"}}><div style={{fontSize:10,color:T.txt3}}>CF Actual</div><div style={{fontSize:18,fontWeight:700,color:totals.cf>=0?T.gn:T.rd}}>{fm(totals.cf)}</div></div>
            <div style={{background:simT.cf>=0?T.gnD:T.rdD,padding:12,borderRadius:10,textAlign:"center"}}><div style={{fontSize:10,color:T.txt3}}>CF Simulado</div><div style={{fontSize:18,fontWeight:700,color:simT.cf>=0?T.gn:T.rd}}>{fm(simT.cf)}</div></div>
            <div style={{background:T.bg2,padding:12,borderRadius:10,textAlign:"center",gridColumn:"1/-1"}}><div style={{fontSize:10,color:T.txt3}}>Impacto Anual</div><div style={{fontSize:22,fontWeight:800,color:(simT.cf-totals.cf)>=0?T.gn:T.rd}}>{(simT.cf-totals.cf)>=0?"+":""}{fm((simT.cf-totals.cf)*12)}/año</div></div>
          </div>
        </div></div>
      </div>
    </div>
  );
}
