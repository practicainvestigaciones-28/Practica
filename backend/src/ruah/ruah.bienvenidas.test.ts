import { describe, it, expect, vi, beforeEach } from "vitest";

const envMock = vi.hoisted(() => ({ RUAH_ENVIAR_CORREOS: true, RUAH_DATABASE_URL: "" }));
vi.mock("../config/env", () => ({ env: envMock }));
vi.mock("../config/prisma", () => ({
  prisma: { usuario: { findMany: vi.fn(), update: vi.fn() } },
}));
vi.mock("../auth/email.service", () => ({ enviarCorreoBienvenida: vi.fn() }));
vi.mock("../utils/password", () => ({
  contraseñaInicialPorCedula: (c: string) => `P.2027#${c}`,
  hashearContraseña: vi.fn(),
  // El "hash" de prueba es la propia contraseña: compara por igualdad.
  compararContraseña: async (plano: string, hash: string) => plano === hash,
}));

import { prisma } from "../config/prisma";
import { enviarCorreoBienvenida } from "../auth/email.service";
import { BienvenidasDesactivadasError, contarBienvenidasPendientes, enviarBienvenidasPendientes } from "./ruah.service";

const fn = (x: unknown) => x as ReturnType<typeof vi.fn>;

const cuenta = (id: number, cedula: string, hash: string) => ({
  id_usuario: id,
  correo: `u${id}@x.co`,
  nombre: "Ana",
  apellido: `N${id}`,
  cedula,
  contraseña: hash,
  roles: [{ rol: { nombre: "Investigador" } }],
});

describe("bienvenidas de Ruah", () => {
  beforeEach(() => {
    envMock.RUAH_ENVIAR_CORREOS = true;
    fn(prisma.usuario.findMany).mockReset();
    fn(prisma.usuario.update).mockReset();
    fn(enviarCorreoBienvenida).mockReset();
  });

  it("RB-01: solo cuenta las cuentas cuya contraseña sigue siendo la inicial (no las creadas a mano)", async () => {
    fn(prisma.usuario.findMany).mockResolvedValue([
      cuenta(1, "111", "P.2027#111"), // contraseña inicial de la sincronización
      cuenta(2, "222", "OtraClave.9"), // cuenta creada a mano con otra contraseña temporal
    ]);

    const r = await contarBienvenidasPendientes();

    expect(r.pendientes).toBe(1);
    expect(r.correos_activos).toBe(true);
  });

  it("RB-02: la búsqueda excluye a quien ya recibió el correo o ya cambió su contraseña", async () => {
    fn(prisma.usuario.findMany).mockResolvedValue([]);
    await contarBienvenidasPendientes();
    expect(fn(prisma.usuario.findMany).mock.calls[0][0].where).toMatchObject({
      activo: true,
      debe_cambiar_contrasena: true,
      bienvenida_enviada_en: null,
    });
  });

  it("RB-03: con el interruptor apagado no envía nada", async () => {
    envMock.RUAH_ENVIAR_CORREOS = false;
    await expect(enviarBienvenidasPendientes()).rejects.toBeInstanceOf(BienvenidasDesactivadasError);
    expect(enviarCorreoBienvenida).not.toHaveBeenCalled();
  });

  it("RB-04: envía a las pendientes con su contraseña inicial y las marca como enviadas", async () => {
    vi.useFakeTimers();
    fn(prisma.usuario.findMany).mockResolvedValue([cuenta(1, "111", "P.2027#111")]);
    fn(enviarCorreoBienvenida).mockResolvedValue(undefined);
    fn(prisma.usuario.update).mockResolvedValue({});

    const r = await enviarBienvenidasPendientes();
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(r.programados).toBe(1);
    expect(enviarCorreoBienvenida).toHaveBeenCalledWith("u1@x.co", "Ana N1", "P.2027#111", ["Investigador"]);
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_usuario: 1 }, data: { bienvenida_enviada_en: expect.any(Date) } })
    );
  });

  it("RB-05: si un correo falla, esa cuenta no se marca y las demás sí", async () => {
    vi.useFakeTimers();
    fn(prisma.usuario.findMany).mockResolvedValue([cuenta(1, "111", "P.2027#111"), cuenta(2, "222", "P.2027#222")]);
    fn(enviarCorreoBienvenida).mockRejectedValueOnce(new Error("SMTP")).mockResolvedValueOnce(undefined);
    fn(prisma.usuario.update).mockResolvedValue({});
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await enviarBienvenidasPendientes();
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(prisma.usuario.update).toHaveBeenCalledTimes(1);
    expect(fn(prisma.usuario.update).mock.calls[0][0].where).toEqual({ id_usuario: 2 });
  });
});
