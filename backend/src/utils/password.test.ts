import { describe, expect, it } from "vitest";
import { contraseñaInicialPorCedula } from "./password";

describe("contraseñaInicialPorCedula", () => {
  it("arma P.2027# + cédula", () => {
    expect(contraseñaInicialPorCedula("1085293957")).toBe("P.2027#1085293957");
  });
  it("ignora puntos y espacios de la cédula", () => {
    expect(contraseñaInicialPorCedula(" 1.085.293.957 ")).toBe("P.2027#1085293957");
  });
  it("falla si no hay cédula", () => {
    expect(() => contraseñaInicialPorCedula("  ")).toThrow();
  });
});
