import { useState, useRef } from "react";

const T={bg2:"#18181b",bg3:"#27272a",card:"#111113",border:"rgba(255,255,255,0.06)",txt:"#fafafa",txt2:"#a1a1aa",txt3:"#71717a",gn:"#22c55e",gnD:"rgba(34,197,94,0.1)",rd:"#ef4444",rdD:"rgba(239,68,68,0.08)"};

const TPLS={
  inv:{label:"Inversiones",headers:["nombre","ubicacion","tipo","valor_actual","valor_compra"],
    example:"Beach House,Miami,Real Estate,599000,460000\nIndex Fund,Online,Investment,210000,105000",
    parse:r=>({n:r[0],ub:r[1],tp:r[2],va:+(r[3])||0,vc:+(r[4])||0,ig:[],gs:[]}),key:"inv"},
  gastos:{label:"Gastos",headers:["categoria","concepto","monto_mensual","tipo(f/v)"],
    example:"Vivienda,Arriendo,2800,f\nVivienda,Luz,211,v\nEducación,Colegio,763,f",
    parse:r=>({cat:r[0]||"Otro",c:r[1],m:+(r[2])||0,t:r[3]||"f"}),key:"gas",isGastos:true},
  deu:{label:"Deudas",headers:["nombre","tipo","saldo","cuota","tasa"],
    example:"Hipoteca,mortgage,354000,3486,6.5\nTarjeta,credit_card,12000,120,15",
    parse:r=>({n:r[0],tp:r[1]||"loan",mt:+(r[2])||0,pg:+(r[3])||0,ts:+(r[4])||0,la:null}),key:"deu"},
  ibk:{label:"Trading",headers:["ticker","nombre","cantidad","costo","precio","objetivo"],
    example:"AAPL,Apple,25,155,198.5,220\nMSFT,Microsoft,15,310,430,500",
    parse:r=>({tk:r[0],n:r[1],sh:+(r[2])||0,cb:+(r[3])||0,pr:+(r[4])||0,tg:+(r[5])||0}),key:"ibk"},
};

export default function CsvImport({onImport,onClose}){
  const[step,setStep]=useState(1);
  const[mod,setMod]=useState(null);
  const[parsed,setParsed]=useState([]);
  const[errors,setErrors]=useState([]);
  const fileRef=useRef();
  const fm=n=>"$"+Math.round(n).toLocaleString();

  const downloadTemplate=m=>{const t=TPLS[m];const csv=t.headers.join(",")+"\n"+t.example;const b=new Blob([csv],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`finpath_${m}_template.csv`;a.click();URL.revokeObjectURL(u);};

  const handleFile=e=>{
    const file=e.target.files[0];if(!file||!mod)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const lines=ev.target.result.trim().split("\n");const t=TPLS[mod];const rows=[];const errs=[];
      const start=lines[0].toLowerCase().includes(t.headers[0])?1:0;
      for(let i=start;i<lines.length;i++){
        const vals=lines[i].split(",").map(v=>v.trim().replace(/^"|"$/g,""));
        if(vals.length<2){errs.push(`Fila ${i+1}: pocos campos`);continue;}
        try{const item=t.parse(vals);item.id=t.key[0]+Date.now()+"_"+i;rows.push(item);}catch{errs.push(`Fila ${i+1}: error formato`);}
      }
      setParsed(rows);setErrors(errs);setStep(3);
    };
    reader.readAsText(file);
  };

  const handleConfirm=()=>{if(!mod||!parsed.length)return;const t=TPLS[mod];onImport(t.key,parsed,t.isGastos);onClose();};

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:24,width:"100%",maxWidth:700,maxHeight:"85vh",overflow:"auto",padding:32}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h3 style={{fontSize:20,fontWeight:700,margin:0,color:T.txt}}>📤 Importar CSV</h3>
          <button onClick={onClose} style={{background:T.bg3,border:"none",color:T.txt3,cursor:"pointer",width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        {step===1&&(<div>
          <p style={{color:T.txt2,fontSize:14,marginBottom:20}}>¿Qué datos quieres importar?</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {Object.entries(TPLS).map(([key,tpl])=>(<button key={key} onClick={()=>{setMod(key);setStep(2);}} style={{padding:20,borderRadius:14,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",textAlign:"left"}}>
              <div style={{fontSize:24,marginBottom:8}}>{key==="inv"?"📈":key==="gastos"?"💳":key==="deu"?"📋":"💹"}</div>
              <div style={{fontSize:14,fontWeight:700,color:T.txt}}>{tpl.label}</div>
              <div style={{fontSize:11,color:T.txt3,marginTop:4}}>{tpl.headers.join(", ")}</div>
            </button>))}
          </div>
        </div>)}

        {step===2&&mod&&(<div>
          <p style={{color:T.txt2,fontSize:14,marginBottom:16}}>Sube CSV de <strong style={{color:T.gn}}>{TPLS[mod].label}</strong></p>
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            <button onClick={()=>downloadTemplate(mod)} style={{background:T.bg3,border:`1px solid ${T.border}`,color:T.txt2,padding:"10px 18px",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:600}}>📥 Descargar Plantilla</button>
            <button onClick={()=>setStep(1)} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.txt3,padding:"10px 18px",borderRadius:10,cursor:"pointer",fontSize:13}}>← Cambiar</button>
          </div>
          <div style={{background:T.card,borderRadius:14,padding:12,marginBottom:16,border:`1px solid ${T.border}`}}>
            <div style={{fontSize:12,color:T.txt3,marginBottom:6}}>Columnas esperadas:</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{TPLS[mod].headers.map(h=>(<span key={h} style={{background:`${T.gn}15`,color:T.gn,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:6}}>{h}</span>))}</div>
          </div>
          <div onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${T.border}`,borderRadius:16,padding:48,textAlign:"center",cursor:"pointer"}}>
            <div style={{fontSize:32,marginBottom:8}}>📄</div>
            <p style={{color:T.txt2,margin:"0 0 4px",fontSize:14}}>Click para subir</p>
            <p style={{color:T.txt3,fontSize:12}}>CSV separado por comas</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{display:"none"}}/>
          </div>
        </div>)}

        {step===3&&(<div>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <span style={{background:T.gnD,color:T.gn,fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:8}}>✓ {parsed.length} registros</span>
            {errors.length>0&&<span style={{background:T.rdD,color:T.rd,fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:8}}>⚠ {errors.length} errores</span>}
          </div>
          {errors.length>0&&<div style={{background:T.rdD,borderRadius:10,padding:12,marginBottom:12}}>{errors.slice(0,5).map((e,i)=><p key={i} style={{color:T.rd,fontSize:12,margin:"3px 0"}}>{e}</p>)}</div>}
          {parsed.length>0&&<div style={{overflowX:"auto",maxHeight:250,borderRadius:10,border:`1px solid ${T.border}`,marginBottom:16}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>{Object.keys(parsed[0]).filter(k=>k!=="id"&&k!=="ig"&&k!=="gs"&&k!=="la").map(k=><th key={k} style={{padding:"8px 12px",color:T.txt3,borderBottom:`1px solid ${T.border}`,textAlign:"left",fontSize:10,textTransform:"uppercase"}}>{k}</th>)}</tr></thead>
              <tbody>{parsed.slice(0,8).map((r,i)=><tr key={i}>{Object.entries(r).filter(([k])=>k!=="id"&&k!=="ig"&&k!=="gs"&&k!=="la").map(([k,v])=><td key={k} style={{padding:"8px 12px",color:T.txt,borderBottom:`1px solid ${T.border}`}}>{typeof v==="number"?(v>100?fm(v):v):String(v)}</td>)}</tr>)}</tbody>
            </table>
            {parsed.length>8&&<p style={{padding:12,color:T.txt3,fontSize:12,textAlign:"center"}}>...y {parsed.length-8} más</p>}
          </div>}
          <div style={{display:"flex",gap:12,justifyContent:"flex-end"}}>
            <button onClick={()=>{setStep(2);setParsed([]);setErrors([]);}} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.txt2,padding:"10px 20px",borderRadius:10,cursor:"pointer",fontWeight:600}}>← Atrás</button>
            <button onClick={handleConfirm} style={{background:T.gn,color:"#000",padding:"10px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,border:"none"}}>✓ Importar {parsed.length}</button>
          </div>
        </div>)}
      </div>
    </div>
  );
}
