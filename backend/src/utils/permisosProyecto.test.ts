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
    proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });

    await expect(
      verificarPermisoProyecto(1, { id_usuario: 99, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(NoAutorizadoProyectoError);
  });

  it("PU-03: permite el acceso cuando el usuario es el creador del proyecto", async () => {
    proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });

    await expect(
      verificarPermisoProyecto(1, { id_usuario: 5, roles: ["Investigador"] })
    ).resolves.toBeUndefined();
  });

  it("PU-04: permite el acceso a un Administrador aunque no sea el creador", async () => {
    proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });

    await expect(
      verificarPermisoProyecto(1, { id_usuario: 99, roles: ["Administrador"] })
    ).resolves.toBeUndefined();
  });

  it("PU-05: usuario sin ningún rol asignado (roles vacío) y sin ser dueño queda denegado", async () => {
    proyectoFindUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });

    await expect(
      verificarPermisoProyecto(1, { id_usuario: 99, roles: [] })
    ).rejects.toBeInstanceOf(NoAutorizadoProyectoError);
  });
});
