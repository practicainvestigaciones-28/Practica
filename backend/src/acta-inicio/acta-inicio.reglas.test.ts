import { describe, expect, it } from "vitest";
import {
  TIPOS_CLAUSULA,
  aceptacionCompleta,
  aniosDeEjecucion,
  calcularFechaFin,
  esCorreoValido,
  faltantesContacto,
  tipoProyectoDesdeModalidad,
  validarDatosActa,
  type DatosActa,
} from "./acta-inicio.reglas";

const VALIDOS: DatosActa = {
  tipo_proyecto: "Desarrollo Tecnológico",
  numero_acta_aprobacion: "123",
  fecha_acta_aprobacion: "2026-09-01",
  centro_costos: "4567",
  fecha_inicio: "2027-01-01",
  duracion_meses: 24,
  vigencias: [
    { anio: 2027, valor_asignado: 30000000 },
    { anio: 2028, valor_asignado: 18115260 },
  ],
};
const HOY = "2026-10-15";

describe("calcularFechaFin / aniosDeEjecucion", () => {
  it("fecha fin = inicio + duración - 1 día", () => {
    expect(calcularFechaFin("2027-01-01", 24)).toBe("2028-12-31");
    expect(calcularFechaFin("2027-02-01", 12)).toBe("2028-01-31");
  });
  it("sin datos devuelve vacío", () => {
    expect(calcularFechaFin("", 12)).toBe("");
    expect(calcularFechaFin("2027-01-01", 0)).toBe("");
  });
  it("lista los años calendario que cubre la ejecución", () => {
    expect(aniosDeEjecucion("2027-01-01", 24)).toEqual([2027, 2028]);
    expect(aniosDeEjecucion("2027-02-01", 24)).toEqual([2027, 2028, 2029]);
    expect(aniosDeEjecucion("", 24)).toEqual([]);
  });
});

describe("validarDatosActa", () => {
  it("acepta datos completos", () => {
    expect(validarDatosActa(VALIDOS, 48115260, HOY)).toEqual([]);
  });
  it("el número del acta y el centro de costos solo admiten números", () => {
    const errores = validarDatosActa({ ...VALIDOS, numero_acta_aprobacion: "12-A", centro_costos: "CC 77" }, 48115260, HOY);
    expect(errores).toContain("El número del acta debe contener solo números.");
    expect(errores).toContain("El centro de costos debe contener solo números.");
  });
  it("las vigencias deben estar dentro de los años de ejecución", () => {
    const errores = validarDatosActa(
      { ...VALIDOS, vigencias: [{ anio: 2027, valor_asignado: 30000000 }, { anio: 2030, valor_asignado: 18115260 }] },
      48115260,
      HOY
    );
    expect(errores.some((e) => e.includes("El año 2030 no está dentro de la ejecución"))).toBe(true);
  });
  it("la financiación es el valor aprobado: puede diferir de la solicitada, pero debe ser mayor que cero, y no se repite año", () => {
    const distinta = validarDatosActa({ ...VALIDOS, vigencias: [{ anio: 2027, valor_asignado: 1 }] }, 48115260, HOY);
    expect(distinta).not.toContain("La suma de las vigencias debe coincidir con el valor solicitado a UNICESMAG.");
    const sinValor = validarDatosActa({ ...VALIDOS, vigencias: [{ anio: 2027, valor_asignado: 0 }] }, 48115260, HOY);
    expect(sinValor).toContain("El valor aprobado debe ser mayor que cero.");
    const repetido = validarDatosActa(
      { ...VALIDOS, vigencias: [{ anio: 2027, valor_asignado: 1 }, { anio: 2027, valor_asignado: 2 }] },
      3,
      HOY
    );
    expect(repetido).toContain("No puede haber dos vigencias con el mismo año.");
  });
  it("la fecha del acta no puede ser futura", () => {
    expect(validarDatosActa({ ...VALIDOS, fecha_acta_aprobacion: "2026-12-01" }, 48115260, HOY)).toContain(
      "La fecha del acta de aprobación no puede ser futura."
    );
  });
});

describe("tipoProyectoDesdeModalidad", () => {
  it("reconoce la modalidad sin importar tildes ni mayúsculas", () => {
    expect(tipoProyectoDesdeModalidad("Desarrollo Tecnologico")).toBe("Desarrollo Tecnológico");
    expect(tipoProyectoDesdeModalidad("investigación científica")).toBe("Investigación Científica");
  });
  it("devuelve null si no corresponde a ningún tipo del formato", () => {
    expect(tipoProyectoDesdeModalidad("Desarrollo Experimental")).toBeNull();
    expect(tipoProyectoDesdeModalidad(null)).toBeNull();
  });
});

describe("esCorreoValido", () => {
  it("acepta un correo normal y rechaza los que no lo son", () => {
    expect(esCorreoValido("vicerrector@unicesmag.edu.co")).toBe(true);
    expect(esCorreoValido("vicerrector@unicesmag")).toBe(false);
    expect(esCorreoValido("sin arroba.com")).toBe(false);
    expect(esCorreoValido("")).toBe(false);
  });
});

describe("faltantesContacto", () => {
  it("lista los campos vacíos", () => {
    expect(
      faltantesContacto({ identificacion: "1", telefono: "", correo: "a@b.co", correo_personal: null, programa_academico: null, institucion: "UNICESMAG" })
    ).toEqual(["teléfono", "correo personal", "programa académico"]);
  });
});

describe("aceptacionCompleta (aceptación del grupo)", () => {
  const todas = (id: number) => TIPOS_CLAUSULA.map((t) => ({ id_usuarioproyecto: id, tipo_clausula: t, aceptado: true }));
  it("es completa cuando todos aceptaron los cuatro numerales", () => {
    expect(aceptacionCompleta([1, 2], [...todas(1), ...todas(2)])).toBe(true);
  });
  it("no lo es si a alguien le falta un numeral", () => {
    expect(aceptacionCompleta([1, 2], [...todas(1), ...todas(2).slice(0, 3)])).toBe(false);
  });
  it("no cuenta las aceptaciones en falso ni con cero participantes", () => {
    expect(aceptacionCompleta([1], todas(1).map((a) => ({ ...a, aceptado: false })))).toBe(false);
    expect(aceptacionCompleta([], [])).toBe(false);
  });
});
