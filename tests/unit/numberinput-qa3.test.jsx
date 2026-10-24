// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import NumberInputQA from "../../src/components/NumberInput.jsx";
import { parseNumber as pnQA } from "../../src/components/NumberInput.jsx";
describe("QA v3: montos sin decimales y foco", () => {
  it("monto: «1.500,50» → 1500 (se descarta lo decimal)", () => {
    expect(pnQA("1.500,50", { allowDecimals: false })).toBe(1500);
  });
  it("monto: teclear coma no la deja en pantalla", () => {
    const on = vi.fn();
    const { container } = render(<NumberInputQA allowDecimals={false} value="" onChange={on} />);
    const el = container.querySelector("input");
    fireEvent.change(el, { target: { value: "1.500,50" } });
    expect(el.value).toBe("1.500");
    expect(on).toHaveBeenLastCalledWith(1500);
  });
  it("teclear justo tras el foco no reselecciona lo escrito", async () => {
    vi.useFakeTimers();
    const { container } = render(<NumberInputQA allowDecimals={false} value="" onChange={() => {}} />);
    const el = container.querySelector("input");
    act(() => { el.focus(); fireEvent.focus(el); });
    fireEvent.change(el, { target: { value: "6", selectionStart: 1 } });
    el.setSelectionRange(1, 1);
    act(() => { vi.runAllTimers(); });
    expect(el.selectionStart).toBe(1); expect(el.selectionEnd).toBe(1);
    vi.useRealTimers();
  });
});
