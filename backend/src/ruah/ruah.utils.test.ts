import { describe, expect, it } from "vitest";
import { claveNombre, esDepartamento, nombrePropio, soloDigitos, tipoProgramaPorNombre, unirNombre } from "./ruah.utils";

describe("claveNombre", () => {
  it("ignora tildes, mayúsculas y espacios", () => {
    expect(claveNombre("INGENIERÍA  DE SISTEMAS")).toBe(claveNombre("Ingeniería de Sistemas"));
  });
  it("iguala 'Licenciatura en' con 'Lic.'", () => {
    expect(claveNombre("LICENCIATURA EN EDUCACION FISICA")).toBe(claveNombre("Lic. Educación Física"));
  });
  it("quita el prefijo Departamento", () => {
    expect(claveNombre("DEPARTAMENTO DE CIENCIAS BASICAS")).toBe(claveNombre("Ciencias Basicas"));
    expect(claveNombre("DEPARTAMENTO HUMANIDADES")).toBe(claveNombre("Humanidades"));
  });
  it("quita el prefijo Facultad (incluida la errata 'Faculta')", () => {
    expect(claveNombre("FACULTA CIENCIAS DE LA SALUD")).toBe(claveNombre("Ciencias de la Salud"));
  });
  it("distingue programas distintos", () => {
    expect(claveNombre("INGENIERÍA ELECTRÓNICA")).not.toBe(claveNombre("Ingeniería de Sistemas"));
  });
});

describe("nombrePropio / unirNombre", () => {
  it("capitaliza y deja en minúscula las palabras menores", () => {
    expect(nombrePropio("ADRIANA DEL PILAR")).toBe("Adriana del Pilar");
    expect(nombrePropio("ESPECIALIZACIÓN EN DERECHO EMPRESARIAL")).toBe("Especialización en Derecho Empresarial");
  });
  it("une partes ignorando las vacías", () => {
    expect(unirNombre("ADRIAN", null, "ESTEBAN")).toBe("Adrian Esteban");
  });
});

describe("tipoProgramaPorNombre / esDepartamento / soloDigitos", () => {
  it("clasifica posgrados", () => {
    expect(tipoProgramaPorNombre("ESPECIALIZACIÓN EN BIG DATA")).toBe("posgrado");
    expect(tipoProgramaPorNombre("COTERMINALIDAD - (Esp. en Derecho Empresarial)")).toBe("posgrado");
    expect(tipoProgramaPorNombre("DERECHO")).toBe("pregrado");
  });
  it("detecta departamentos", () => {
    expect(esDepartamento("DEPARTAMENTO DE IDIOMAS")).toBe(true);
    expect(esDepartamento("DERECHO")).toBe(false);
  });
  it("deja solo dígitos", () => {
    expect(soloDigitos(" 1.085.293-957 ")).toBe("1085293957");
    expect(soloDigitos(null)).toBe("");
  });
});
