import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/prisma", () => ({
  prisma: {
    proyecto: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../config/prisma";
import {
  verificarPermisoProyecto,
  ProyectoNoEncontradoError,
  NoAutorizadoProyectoError,
  ProyectoNoEditableError,
  ESTADOS_EDITABLES_POR_EL_DUENO,
} from "./permisosProyecto";

const proyectoFindUnique = prisma.proyecto.findUnique as unknown as ReturnType<typeof vi.fn>;

describe("verificarPermisoProyecto", () => {
  beforeEach(() => {
    proyectoFindUnique.mockReset();
  });

  it("PU-01: lanza ProyectoNoEncontradoError si el proyecto no existe", async () => {
    proyectoFindUnique.mockResolvedValue(null);

    await expect(
      verificarPermisoProyecto(999, { id_usuario: 1, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(ProyectoNoEncontradoError);
  });

  it("PU-02: lanza NoAutorizadoProyectoError si el usuario no es dueño ni Administrador", async () => {
    proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5, estado_actual: "pendiente_firmas" });

    await expect(
      verificarPermisoProyecto(1, { id_usuario: 99, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(NoAutorizadoProyectoError);
  });

  it("PU-03: permite el acceso cuando el usuario es el creador del proyecto", async () => {
    proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5, estado_actual: "pendiente_firmas" });

    await expect(
      verificarPermisoProyecto(1, { id_usuario: 5, roles: ["Investigador"] })
    ).resolves.toBeUndefined();
  });

  it("PU-04: permite el acceso a un Administrador aunque no sea el creador", async () => {
    proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5, estado_actual: "pendiente_firmas" });

    await expect(
      verificarPermisoProyecto(1, { id_usuario: 99, roles: ["Administrador"] })
    ).resolves.toBeUndefined();
  });

  it("PU-05: usuario sin ningún rol asignado (roles vacío) y sin ser dueño queda denegado", async () => {
    proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5, estado_actual: "pendiente_firmas" });

    await expect(
      verificarPermisoProyecto(1, { id_usuario: 99, roles: [] })
    ).rejects.toBeInstanceOf(NoAutorizadoProyectoError);
  });

  describe("estado del proyecto (el dueño solo edita antes del visto bueno del líder o al corregir)", () => {
    const dueno = { id_usuario: 5, roles: ["Investigador"] };
    const admin = { id_usuario: 1, roles: ["Administrador"] };

    it.each(ESTADOS_EDITABLES_POR_EL_DUENO)("PU-06: el dueño puede editar en %s", async (estado) => {
      proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5, estado_actual: estado });
      await expect(verificarPermisoProyecto(1, dueno)).resolves.toBeUndefined();
    });

    it.each(["pendiente", "revision", "aprobado", "pares_pendiente_envio"])("PU-07: el dueño NO puede editar en %s", async (estado) => {
      proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5, estado_actual: estado });
      const intento = verificarPermisoProyecto(1, dueno);
      await expect(intento).rejects.toBeInstanceOf(ProyectoNoEditableError);
      // Es un NoAutorizadoProyectoError: los controladores que ya lo manejan lo responden como 403.
      await expect(intento).rejects.toBeInstanceOf(NoAutorizadoProyectoError);
    });

    it("PU-08: el Administrador puede editar en cualquier estado", async () => {
      proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5, estado_actual: "aprobado" });
      await expect(verificarPermisoProyecto(1, admin)).resolves.toBeUndefined();
    });
  });
});
