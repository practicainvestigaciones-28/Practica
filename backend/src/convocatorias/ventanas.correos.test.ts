import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/env", () => ({ env: { CORREOS_AVISOS_ACTIVOS: true, FRONTEND_LOGIN_URL: "http://localhost:5173/" } }));
vi.mock("../config/prisma", () => ({
  prisma: {
    convocatoriaVentana: { findMany: vi.fn() },
    avisoCorreoVentana: { createMany: vi.fn(), count: vi.fn() },
    asignacionRevision: { findMany: vi.fn() },
    proyecto: { findMany: vi.fn() },
    usuario: { findMany: vi.fn() },
  },
}));
vi.mock("../auth/email.service", () => ({ enviarAvisoSeguimiento: vi.fn() }));
vi.mock("../notificaciones/notificaciones.service", () => ({ ROL_ADMINISTRADOR: "Administrador" }));

import { prisma } from "../config/prisma";
import { enviarAvisoSeguimiento } from "../auth/email.service";
import { hitoVigente, procesarCorreosVentanas } from "./ventanas.correos";

const fn = (x: unknown) => x as ReturnType<typeof vi.fn>;
const H = 60 * 60 * 1000;
const ahora = new Date("2026-12-10T12:00:00Z");

describe("hitoVigente", () => {
  it("VC-01: elige el recordatorio más urgente que ya corresponde", () => {
    expect(hitoVigente(5 * 24 * H)).toBeNull();
    expect(hitoVigente(60 * H)?.tipo).toBe("recordatorio_3d");
    expect(hitoVigente(20 * H)?.tipo).toBe("recordatorio_1d");
    expect(hitoVigente(3 * H)?.tipo).toBe("recordatorio_4h");
  });
});

describe("procesarCorreosVentanas", () => {
  beforeEach(() => {
    Object.values(prisma).forEach((m) => Object.values(m).forEach((f) => fn(f).mockReset()));
    fn(enviarAvisoSeguimiento).mockReset();
    fn(prisma.avisoCorreoVentana.count).mockResolvedValue(0);
    fn(prisma.avisoCorreoVentana.createMany).mockResolvedValue({ count: 1 });
    fn(prisma.usuario.findMany).mockResolvedValue([{ id_usuario: 4, nombre: "Ana", apellido: "Pérez", correo: "ana@x.co", hojaVida: null }]);
  });

  it("VC-02: manda un solo correo por persona aunque tenga varios proyectos pendientes", async () => {
    fn(prisma.convocatoriaVentana.findMany)
      .mockResolvedValueOnce([{ id_convocatoria: 1, fase: "etica", cierra_en: new Date(ahora.getTime() + 10 * 24 * H), convocatoria: { nombre: "C1" } }])
      .mockResolvedValueOnce([]);
    fn(prisma.asignacionRevision.findMany).mockResolvedValue([
      { asignado_a: 4, proyecto: { titulo: "P1" } },
      { asignado_a: 4, proyecto: { titulo: "P2" } },
    ]);

    await procesarCorreosVentanas(ahora);

    expect(enviarAvisoSeguimiento).toHaveBeenCalledTimes(1);
    expect(fn(enviarAvisoSeguimiento).mock.calls[0][4]).toContainEqual(["Proyectos", "P1; P2"]);
    expect(prisma.avisoCorreoVentana.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ id_convocatoria: 1, fase: "etica", id_usuario: 4, tipo: "apertura" }] })
    );
  });

  it("VC-03: no repite un correo ya enviado", async () => {
    fn(prisma.convocatoriaVentana.findMany)
      .mockResolvedValueOnce([{ id_convocatoria: 1, fase: "etica", cierra_en: new Date(ahora.getTime() + 10 * 24 * H), convocatoria: { nombre: "C1" } }])
      .mockResolvedValueOnce([]);
    fn(prisma.asignacionRevision.findMany).mockResolvedValue([{ asignado_a: 4, proyecto: { titulo: "P1" } }]);
    fn(prisma.avisoCorreoVentana.count).mockResolvedValue(1);

    await procesarCorreosVentanas(ahora);

    expect(enviarAvisoSeguimiento).not.toHaveBeenCalled();
  });

  it("VC-04: cerca del cierre manda el recordatorio y no la apertura", async () => {
    fn(prisma.convocatoriaVentana.findMany)
      .mockResolvedValueOnce([{ id_convocatoria: 1, fase: "pares", cierra_en: new Date(ahora.getTime() + 20 * H), convocatoria: { nombre: "C1" } }])
      .mockResolvedValueOnce([]);
    fn(prisma.asignacionRevision.findMany).mockResolvedValue([{ asignado_a: 4, proyecto: { titulo: "P1" } }]);

    await procesarCorreosVentanas(ahora);

    expect(enviarAvisoSeguimiento).toHaveBeenCalledTimes(1);
    expect(fn(prisma.avisoCorreoVentana.createMany).mock.calls[0][0].data.map((d: { tipo: string }) => d.tipo)).toEqual(["recordatorio_1d", "apertura"]);
  });

  it("VC-05: al cerrar avisa solo a los administradores, con lo pendiente", async () => {
    fn(prisma.convocatoriaVentana.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id_convocatoria: 1, fase: "pares", cierra_en: new Date(ahora.getTime() - H), convocatoria: { nombre: "C1" } }]);
    fn(prisma.asignacionRevision.findMany).mockResolvedValue([{ asignado_a: 9, proyecto: { titulo: "P9" } }]);
    fn(prisma.usuario.findMany)
      .mockResolvedValueOnce([{ id_usuario: 4 }]) // administradores
      .mockResolvedValueOnce([{ id_usuario: 4, nombre: "Ana", apellido: "Pérez", correo: "ana@x.co", hojaVida: null }]);

    await procesarCorreosVentanas(ahora);

    expect(enviarAvisoSeguimiento).toHaveBeenCalledTimes(1);
    expect(fn(enviarAvisoSeguimiento).mock.calls[0][3]).toContain("requiere tu atención");
    expect(fn(enviarAvisoSeguimiento).mock.calls[0][4][0][1]).toContain("Quedan 1 sin atender");
  });
});
