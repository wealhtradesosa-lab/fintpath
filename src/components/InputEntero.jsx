import { useState } from "react";

/** Campo de enteros (p. ej. plazo en meses). 24-oct-2026 (QA PR #56): «12,5» o «12.5»
 *  quedaba en 125 sin aviso. Ahora el punto o la coma no entran y se avisa. */
export const AVISO_ENTERO = "Solo meses enteros: sin punto ni coma.";
export default function InputEntero({ value, onChange, style, placeholder, aviso = AVISO_ENTERO, ...rest }) {
  const [msg, setMsg] = useState("");
  return (
    <>
      <input {...rest} type="text" inputMode="numeric" placeholder={placeholder} style={style} value={value ?? ""} autoComplete="off"
        onChange={(e) => {
          const t = e.target.value.trim();
          if (!/^\d*$/.test(t)) { setMsg(aviso); return; }
          setMsg("");
          onChange(t === "" ? "" : String(Number(t)));
        }} />
      {msg && <div role="alert" style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>{msg}</div>}
    </>
  );
}
