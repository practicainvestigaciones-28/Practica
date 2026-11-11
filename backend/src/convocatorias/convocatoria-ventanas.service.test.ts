import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/prisma", () => ({
  prisma: {
    convocatoriaVentana: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    convocatoria: { findUnique: vi.fn() },
    reclamacion: { count: vi.fn() },
    asignacionRevision: { count: vi.fn(), findMany: vi.fn() },
    proyecto: { findMany: vi.fn() },
    usuario: { findMany: vi.fn() },
  },
}));
vi.mock("../notificaciones/notificaciones.service", () => ({
  crearNotificacion: vi.fn(),
  ROL_ADMINISTRADOR: "Administrador",
  ROL_INVESTIGADOR: "Investigador",
  TIPO_NOTIFICACION: { INFORMATIVA: "informativa" },
}));

import { prisma } from "../config/prisma";
import { crearNotificacion } from "../notificaciones/notificaciones.service";
import {
  estaAbierta,
  validarVentanas,
  exigirVentanaAbierta,
  VentanaCerradaError,
  VentanaInvalidaError,
} from "./convocatoria-ventanas.service";
import { procesarAvisosVentanas } from "./ventanas.avisos";

const d = (s: string) => new Date(s);
const fin = d("2026-12-01T00:00:00Z");

const ventanaFindUnique = prisma.convocatoriaVentana.findUnique as unknown as ReturnType<typeof vi.fn>;
const ventanaFindMany = prisma.convocatoriaVentana.findMany as unknown as ReturnType<typeof vi.fn>;
const crear = crearNotificacion as unknown as ReturnType<typeof vi.fn>;

describe("validarVentanas", () => {
  it("VV-01: acepta fases secuenciales después del cierre de la convocatoria", () => {
    const r = validarVentanas(
      [
        { fase: "etica", abre_en: d("2026-12-10T00:00:00Z"), cierra_en: d("2026-12-15T00:00:00Z") },
        { fase: "comite", abre_en: d("2026-12-02T00:00:00Z"), cierra_en: d("2026-12-09T00:00:00Z") },
      ],
      fin
    );
    expect(r.map((e) => e.fase)).toEqual(["comite", "etica"]);
  });

  it("VV-02: rechaza una fase que abre antes de cerrar la convocatoria", () => {
    expect(() =>
      validarVentanas([{ fase: "comite", abre_en: d("2026-11-30T00:00:00Z"), cierra_en: d("2026-12-05T00:00:00Z") }], fin)
    ).toThrow(VentanaInvalidaError);
  });

  it("VV-03: rechaza fases que se cruzan (la siguiente abre antes de que cierre la anterior)", () => {
    expect(() =>
      validarVentanas(
        [
          { fase: "comite", abre_en: d("2026-12-02T00:00:00Z"), cierra_en: d("2026-12-09T00:00:00Z") },
          { fase: "etica", abre_en: d("2026-12-08T00:00:00Z"), cierra_en: d("2026-12-15T00:00:00Z") },
        ],
        fin
      )
    ).toThrow(/después del cierre de Comité de Investigación/);
  });

  it("VV-04: rechaza cierre anterior a la apertura, fases repetidas y fases desconocidas", () => {
    expect(() => validarVentanas([{ fase: "comite", abre_en: d("2026-12-05T00:00:00Z"), cierra_en: d("2026-12-05T00:00:00Z") }], fin)).toThrow(
      VentanaInvalidaError
    );
    const ok = { abre_en: d("2026-12-02T00:00:00Z"), cierra_en: d("2026-12-03T00:00:00Z") };
    expect(() => validarVentanas([{ fase: "comite", ...ok }, { fase: "comite", ...ok }], fin)).toThrow(/repetida/);
    expect(() => validarVentanas([{ fase: "otra", ...ok }], fin)).toThrow(/no existe/);
  });
});

describe("estaAbierta / exigirVentanaAbierta", () => {
  const v = { abre_en: d("2026-12-02T10:00:00Z"), cierra_en: d("2026-12-03T10:00:00Z"), reabierta: false };

  beforeEach(() => ventanaFindUnique.mockReset());

  it("VV-05: abierta solo dentro del plazo, o si el Administrador la reabrió", () => {
    expect(estaAbierta(v, d("2026-12-02T12:00:00Z"))).toBe(true);
    expect(estaAbierta(v, d("2026-12-02T09:00:00Z"))).toBe(false);
    expect(estaAbierta(v, d("2026-12-04T00:00:00Z"))).toBe(false);
    expect(estaAbierta({ ...v, reabierta: true }, d("2026-12-04T00:00:00Z"))).toBe(true);
  });

  it("VV-06: sin plazo definido para la fase no restringe", async () => {
    ventanaFindUnique.mockResolvedValue(null);
    await expect(exigirVentanaAbierta(1, "comite", d("2026-12-04T00:00:00Z"))).resolves.toBeUndefined();
  });

  it("VV-07: con plazo cerrado lanza VentanaCerradaError", async () => {
    ventanaFindUnique.mockResolvedValue(v);
    await expect(exigirVentanaAbierta(1, "comite", d("2026-12-04T00:00:00Z"))).rejects.toBeInstanceOf(VentanaCerradaError);
  });

  it("VV-08: con plazo abierto deja pasar", async () => {
    ventanaFindUnique.mockResolvedValue(v);
    await expect(exigirVentanaAbierta(1, "comite", d("2026-12-02T12:00:00Z"))).resolves.toBeUndefined();
  });
});

describe("procesarAvisosVentanas", () => {
  beforeEach(() => {
    ventanaFindMany.mockReset();
    crear.mockReset();
    (prisma.convocatoriaVentana.update as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.asignacionRevision.count as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.asignacionRevision.findMany as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.usuario.findMany as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("VV-09: al cerrar avisa a los administradores cuántos proyectos quedaron sin revisar y marca el aviso", async () => {
    ventanaFindMany
      .mockResolvedValueOnce([]) // por abrir
      .mockResolvedValueOnce([{ id_convocatoria: 1, fase: "pares", convocatoria: { nombre: "Conv 2026" } }]); // por cerrar
    (prisma.asignacionRevision.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    (prisma.usuario.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([{ id_usuario: 7 }, { id_usuario: 8 }]);

    await procesarAvisosVentanas(d("2026-12-20T00:00:00Z"));

    expect(prisma.convocatoriaVentana.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { avisado_cierre: true } })
    );
    expect(crear).toHaveBeenCalledTimes(2);
    expect(crear.mock.calls[0][1].mensaje).toContain("Quedan 3 proyecto(s) sin revisar");
    expect(crear.mock.calls[0][1].rol_destino).toBe("Administrador");
  });

  it("VV-10: al abrir avisa solo a los evaluadores con revisiones abiertas en la fase", async () => {
    ventanaFindMany
      .mockResolvedValueOnce([{ id_convocatoria: 1, fase: "etica", cierra_en: d("2026-12-15T00:00:00Z"), convocatoria: { nombre: "Conv 2026" } }])
      .mockResolvedValueOnce([]);
    (prisma.asignacionRevision.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { asignado_a: 4 },
      { asignado_a: 4 },
      { asignado_a: 5 },
    ]);

    await procesarAvisosVentanas(d("2026-12-10T00:00:00Z"));

    expect(crear).toHaveBeenCalledTimes(2);
    expect(crear.mock.calls.map((c) => c[0]).sort()).toEqual([4, 5]);
  });
});
