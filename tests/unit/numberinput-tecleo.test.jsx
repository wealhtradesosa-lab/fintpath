// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { useState } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import NumberInput from "../../src/components/NumberInput.jsx";
afterEach(cleanup);

// Simula teclear carácter por carácter: el valor nuevo = lo que hay en pantalla + la tecla.
const teclear = (el, txt) => { for (const ch of txt) fireEvent.change(el, { target: { value: el.value + ch } }); };
const Campo = ({ onVal, ...p }) => { const [v, setV] = useState(""); return <NumberInput {...p} value={v} onChange={(x) => { setV(x); onVal(x); }} />; };

describe("QA PR #56: monto tecleado «1.500,50» (Mi futuro, Patrimonio, Deudas)", () => {
  it("queda 1.500 con aviso de centavos, nunca 150.050", () => {
    const onVal = vi.fn();
    const { getByRole, queryByRole } = render(<Campo onVal={onVal} allowDecimals={false} />);
    const el = getByRole("textbox");
    fireEvent.focus(el); teclear(el, "1.500,50");
    expect(onVal).toHaveBeenLastCalledWith(1500);
    expect(onVal.mock.calls.flat()).not.toContain(150050);
    expect(queryByRole("alert").textContent).toMatch(/Sin centavos: usamos \$1\.500/);
    fireEvent.blur(el);
    expect(el.value).toBe("1.500"); expect(queryByRole("alert")).toBeNull();
  });
  it("pegado «1.500,50» también da 1.500", () => {
    const onVal = vi.fn();
    const { getByRole } = render(<Campo onVal={onVal} allowDecimals={false} />);
    fireEvent.change(getByRole("textbox"), { target: { value: "1.500,50" } });
    expect(onVal).toHaveBeenLastCalledWith(1500);
  });
});

describe("Finanzas PR #56: plazo de deuda admite decimales como las tasas", () => {
  for (const t of ["12.5", "12,5"]) it(`«${t}» tecleado → 12,5`, () => {
    const onVal = vi.fn();
    const { getByRole } = render(<Campo onVal={onVal} allowDecimals allowShortcuts={false} />);
    const el = getByRole("textbox"); fireEvent.focus(el); teclear(el, t);
    expect(onVal).toHaveBeenLastCalledWith(12.5);
    fireEvent.blur(el); expect(el.value).toBe("12,5");
  });
});
