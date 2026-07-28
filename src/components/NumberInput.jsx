// ═══════════════════════════════════════════════════════════════════════════
// NumberInput — input inteligente para montos grandes
//
// PROBLEMA que resuelve:
//   Cargar 39.500.000.000 sin separadores obliga a contar ceros con el dedo.
//   Es fácil equivocarse en un 10x error (Santiago screenshot 18-jul-2026).
//
// FEATURES:
//   • Muestra separadores de miles Colombia (39.500.000.000) en tiempo real
//   • Cursor position preservada al escribir (no se descontrola)
//   • Shortcuts K y M estilo Excel: "500M" → 500.000.000 · "250K" → 250.000
//   • Soporta decimales con coma: "21,5" → 21.5
//   • Selección total al hacer focus (patrón Excel/Google Sheets)
//   • inputMode="decimal" → teclado numérico automático en mobile
//   • Drop-in replacement para <input type="number">
//
// USO:
//   <NumberInput value={cap} onChange={setCap} placeholder="0" />
//
// El padre recibe siempre un número puro (o "" si está vacío), NUNCA un
// string formateado. Todos los cálculos siguen funcionando idénticos.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";

// ── Formateo: número → "39.500.000.000" ─────────────────────────────────
const formatNumber = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "";
  const parts = num.toString().split(".");
  // Separador de miles con punto (formato Colombia)
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  // Separador decimal con coma (formato Colombia)
  return parts.join(",");
};

// ── Parse: string → número. Soporta shortcuts K/M ────────────────────────
const parseNumber = (str) => {
  if (typeof str !== "string") return typeof str === "number" ? str : "";
  const trimmed = str.trim();
  if (!trimmed) return "";

  // Shortcut K → miles (500K = 500.000)
  const kMatch = trimmed.match(/^([\d.,]+)\s*[kK]$/);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(/\./g, "").replace(",", "."));
    return isNaN(num) ? "" : Math.round(num * 1000);
  }
  // Shortcut M → millones (500M = 500.000.000 · 39,5M = 39.500.000)
  const mMatch = trimmed.match(/^([\d.,]+)\s*[mM]$/);
  if (mMatch) {
    const num = parseFloat(mMatch[1].replace(/\./g, "").replace(",", "."));
    return isNaN(num) ? "" : Math.round(num * 1000000);
  }

  // 26-jul-2026 (Santiago: "al ingresar tasas no me deja poner valores como
  // 0,5%, lo mínimo que me deja es 1%").
  // CAUSA: el parse quitaba TODOS los puntos por ser separador de miles en
  // formato colombiano. Al escribir "0.5" —como se teclea naturalmente en un
  // teclado numérico— quedaba "05" = 5. La tasa se multiplicaba por diez sin
  // aviso: un 0,5% se guardaba como 5%.
  // Con coma sí funcionaba, pero eso obliga a conocer una convención que la
  // app nunca explicó, y en un campo de tasa el error pasa desapercibido.
  //
  // AHORA se distingue por la forma del texto:
  //   · un solo punto con 1-2 dígitos detrás y nada más → es DECIMAL
  //     ("0.5" → 0,5 · "22.99" → 22,99)
  //   · el resto sigue tratándose como separador de miles
  //     ("1.500" → 1500 · "39.500.000" → 39500000)
  // Un separador de miles nunca deja 1 o 2 dígitos sueltos al final, así que
  // la regla no rompe el caso de los montos.
  const decimalConPunto = /^\d{1,3}\.\d{1,2}$/.test(trimmed);
  const cleaned = decimalConPunto
    ? trimmed
    : trimmed.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? "" : num;
};

// ── Cuenta dígitos hasta una posición (para restaurar cursor) ────────────
const countDigitsBefore = (str, position) => {
  return str.substring(0, position).replace(/[^\d]/g, "").length;
};

// ── Encuentra la posición equivalente en un string formateado nuevo ──────
const findCursorPosition = (formatted, targetDigitCount) => {
  if (targetDigitCount === 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) count++;
    if (count === targetDigitCount) return i + 1;
  }
  return formatted.length;
};

export default function NumberInput({
  value,
  onChange,
  placeholder = "0",
  style = {},
  disabled = false,
  allowDecimals = true,
  allowShortcuts = true,
  ...rest
}) {
  const [displayValue, setDisplayValue] = useState(() => formatNumber(value));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const pendingCursor = useRef(null);

  // Sync desde el padre cuando no estamos editando (por si cambia value)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatNumber(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Restaurar cursor después del render (formatNumber puede cambiar longitud)
  useEffect(() => {
    if (pendingCursor.current !== null && inputRef.current && document.activeElement === inputRef.current) {
      const pos = pendingCursor.current;
      inputRef.current.setSelectionRange(pos, pos);
      pendingCursor.current = null;
    }
  });

  const handleChange = (e) => {
    const input = e.target;
    const rawInput = input.value;
    const oldCursor = input.selectionStart;
    const oldDisplay = displayValue;

    // Validar: solo permitir dígitos, punto, coma, K, M, espacios, signo -
    // Si escribe algo raro, ignorar el cambio
    const validPattern = allowShortcuts ? /^[-\d.,kmKM\s]*$/ : /^[-\d.,\s]*$/;
    if (rawInput !== "" && !validPattern.test(rawInput)) return;

    // Si es shortcut K/M al final, esperar a blur para expandir. Mientras
    // tanto solo mostramos lo que el usuario escribió.
    const endsWithShortcut = allowShortcuts && /[kmKM]\s*$/.test(rawInput);
    if (endsWithShortcut) {
      setDisplayValue(rawInput);
      const parsed = parseNumber(rawInput);
      if (typeof parsed === "number") onChange(parsed);
      return;
    }

    // Parse a número puro
    const parsed = parseNumber(rawInput);

    // Reformatear
    let newFormatted;
    if (parsed === "" || rawInput === "") {
      newFormatted = "";
    } else if (typeof parsed === "number") {
      // Preservar coma decimal si el usuario la escribió sin decimales aún
      if (rawInput.endsWith(",") && !rawInput.includes(",", rawInput.indexOf(",") + 1)) {
        newFormatted = formatNumber(parsed) + ",";
      } else {
        newFormatted = formatNumber(parsed);
      }
    } else {
      newFormatted = rawInput;
    }

    // Calcular nueva posición del cursor (mantener misma cantidad de dígitos a la izquierda)
    const digitsBefore = countDigitsBefore(oldDisplay, oldCursor);
    const digitsInNewInput = countDigitsBefore(rawInput, oldCursor);
    // Si el usuario borró un separador, el conteo puede diferir — usamos el del input crudo
    const targetDigits = Math.min(digitsInNewInput, newFormatted.replace(/[^\d]/g, "").length);
    const newCursor = findCursorPosition(newFormatted, targetDigits);
    pendingCursor.current = newCursor;

    setDisplayValue(newFormatted);
    if (typeof parsed === "number") {
      onChange(parsed);
    } else if (rawInput === "") {
      onChange("");
    }
  };

  const handleFocus = (e) => {
    setIsFocused(true);
    // Seleccionar todo (patrón Excel: tocás y reescribís todo)
    setTimeout(() => {
      if (inputRef.current) inputRef.current.select();
    }, 0);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Al perder foco: expandir shortcuts pendientes (500M → 500.000.000)
    const parsed = parseNumber(displayValue);
    if (typeof parsed === "number") {
      setDisplayValue(formatNumber(parsed));
      onChange(parsed);
    } else if (displayValue === "" || displayValue == null) {
      setDisplayValue("");
      onChange("");
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={allowDecimals ? "decimal" : "numeric"}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      autoComplete="off"
      {...rest}
    />
  );
}
