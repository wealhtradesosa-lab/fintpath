// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import InputEntero, { AVISO_ENTERO } from "../../src/components/InputEntero.jsx";
afterEach(cleanup);
describe("Deudas: plazo en meses solo enteros", () => {
  it.each(["12.5", "12,5"])("«%s» se rechaza con aviso, no queda 125", (t) => {
    const on = vi.fn();
    const { container } = render(<InputEntero value="12" onChange={on} />);
    fireEvent.change(container.querySelector("input"), { target: { value: t } });
    expect(on).not.toHaveBeenCalled();
    expect(container.textContent).toContain(AVISO_ENTERO);
  });
  it("36 → '36'", () => {
    const on = vi.fn();
    const { container } = render(<InputEntero value="" onChange={on} />);
    fireEvent.change(container.querySelector("input"), { target: { value: "36" } });
    expect(on).toHaveBeenCalledWith("36");
  });
});
