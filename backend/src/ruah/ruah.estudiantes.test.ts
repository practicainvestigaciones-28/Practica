import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/env", () => ({ env: { RUAH_ENVIAR_CORREOS: false, RUAH_DATABASE_URL: "" } }));
vi.mock("../config/prisma", () => ({
  prisma: { estudianteRuah: { findMany: vi.fn() } },
}));
vi.mock("../auth/email.service", () => ({ enviarCorreoBienvenida: vi.fn() }));

import { prisma } from "../config/prisma";
import { buscarEstudiantes, MAXIMO_COINCIDENCIAS } from "./ruah.service";

const findMany = prisma.estudianteRuah.findMany as unknown as ReturnType<typeof vi.fn>;

describe("buscarEstudiantes", () => {
  beforeEach(() => findMany.mockReset());

  it("RE-01: con menos de 3 caracteres no consulta ni devuelve nada", async () => {
    expect(await buscarEstudiantes("22")).toEqual([]);
    expect(await buscarEstudiantes("  ")).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("RE-02: busca por código que EMPIEZA por lo escrito, sin símbolos y en mayúscula", async () => {
    findMany.mockResolvedValue([]);
    await buscarEstudiantes(" l10-8 ");
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ codigo: { startsWith: "L108" } });
    expect(arg.take).toBe(MAXIMO_COINCIDENCIAS);
    expect(arg.orderBy).toEqual([{ matriculado: "desc" }, { codigo: "asc" }]);
  });

  it("RE-03: devuelve código, nombre, correo, programa y si está matriculado", async () => {
    findMany.mockResolvedValue([
      { codigo: "2231104067", nombres: "David", apellidos: "Figueroa", correo_institucional: "d@u.co", matriculado: true, programa: { nombre: "Ingeniería de Sistemas" } },
      { codigo: "2231104068", nombres: "Ana", apellidos: "Pérez", correo_institucional: null, matriculado: false, programa: null },
    ]);
    const r = await buscarEstudiantes("2231104");
    expect(r).toEqual([
      { codigo: "2231104067", nombres: "David", apellidos: "Figueroa", correo_institucional: "d@u.co", programa: "Ingeniería de Sistemas", matriculado: true },
      { codigo: "2231104068", nombres: "Ana", apellidos: "Pérez", correo_institucional: null, programa: null, matriculado: false },
    ]);
  });
});
