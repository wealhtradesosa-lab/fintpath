import { useState, useEffect } from "react";
import { parseDecimalEs } from "../lib/formato.js";

/**
 * Campo numérico que acepta coma o punto al escribir (es-CO) y entrega SIEMPRE
 * un número (o "") a onChange. El texto se muestra con coma decimal.
 */
export default function InputDecimalEs({ value, onChange, ...rest }) {
  const show = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? "" : String(Number(v)).replace(".", ","));
  const [txt, setTxt] = useState(show(value));
  useEffect(() => {
    // Sincroniza solo si el valor externo cambió por otra vía.
    if (parseDecimalEs(txt) !== (value === "" || value == null ? "" : Number(value))) setTxt(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={txt}
      onChange={(e) => {
        const t = e.target.value;
        if (!/^[0-9.,%\s-]*$/.test(t)) return;
        setTxt(t);
        onChange(parseDecimalEs(t));
      }}
      onBlur={() => setTxt(show(value))}
    />
  );
}
