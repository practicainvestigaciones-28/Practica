import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/prisma", () => ({
  prisma: {
    proyecto: { findUnique: vi.fn() },
    usuario: { findUnique: vi.fn() },
    dedicacion: { findUnique: vi.fn() },
    rolProyecto: { findUnique: vi.fn() },
    rolEstudiante: { findUnique: vi.fn() },
    usuarioProyecto: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

import { prisma } from "../config/prisma";
import {
  agregarParticipante,
  actualizarParticipante,
  quitarParticipante,
  listarParticipantes,
  UsuarioNoEncontradoError,
  CatalogoInvalidoError,
  RolEstudianteNoAplicaError,
  ParticipanteDuplicadoError,
  ParticipacionNoEncontradaError,
} from "./participantes.service";
import { NoAutorizadoError, ProyectoNoEncontradoError } from "../participantes/participantes.service";

const proyecto = prisma.proyecto as unknown as { findUnique: ReturnType<typeof vi.fn> };
const usuario = prisma.usuario as unknown as { findUnique: ReturnType<typeof vi.fn> };
const dedicacion = prisma.dedicacion as unknown as { findUnique: ReturnType<typeof vi.fn> };
const rolProyecto = prisma.rolProyecto as unknown as { findUnique: ReturnType<typeof vi.fn> };
const rolEstudiante = prisma.rolEstudiante as unknown as { findUnique: ReturnType<typeof vi.fn> };
const usuarioProyecto = prisma.usuarioProyecto as unknown as {
  create: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  findUniqueOrThrow: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const EDITOR_DUENO = { id_usuario: 5, roles: ["Investigador"] };

function mockProyectoDeDueno() {
  proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("agregarParticipante (RQF17)", () => {
  it("PT-01: rechaza si quien agrega no es dueño del proyecto ni Administrador", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });

    await expect(
      agregarParticipante(
        1,
        { participante: 2, id_dedicacion: 1, id_rol_pro: 1 },
        { id_usuario: 999, roles: ["Investigador"] }
      )
    ).rejects.toBeInstanceOf(NoAutorizadoError);
  });

  it("PT-02: rechaza si el proyecto no existe", async () => {
    proyecto.findUnique.mockResolvedValue(null);

    await expect(
      agregarParticipante(1, { participante: 2, id_dedicacion: 1, id_rol_pro: 1 }, EDITOR_DUENO)
    ).rejects.toBeInstanceOf(ProyectoNoEncontradoError);
  });

  it("PT-03: rechaza si el usuario participante no existe", async () => {
    mockProyectoDeDueno();
    usuario.findUnique.mockResolvedValue(null);
    dedicacion.findUnique.mockResolvedValue({ id_dedicacion: 1 });
    rolProyecto.findUnique.mockResolvedValue({ id_rol_pro: 1, nombre: "Docente" });

    await expect(
      agregarParticipante(1, { participante: 999, id_dedicacion: 1, id_rol_pro: 1 }, EDITOR_DUENO)
    ).rejects.toBeInstanceOf(UsuarioNoEncontradoError);
  });

  it("PT-04: rechaza si la dedicación indicada no existe en el catálogo", async () => {
    mockProyectoDeDueno();
    usuario.findUnique.mockResolvedValue({ id_usuario: 2 });
    dedicacion.findUnique.mockResolvedValue(null);
    rolProyecto.findUnique.mockResolvedValue({ id_rol_pro: 1, nombre: "Docente" });

    const error = await agregarParticipante(
      1,
      { participante: 2, id_dedicacion: 999, id_rol_pro: 1 },
      EDITOR_DUENO
    ).catch((e) => e);

    expect(error).toBeInstanceOf(CatalogoInvalidoError);
    expect(error.message).toContain("id_dedicacion");
  });

  it("PT-05: rechaza si el rol de proyecto indicado no existe en el catálogo", async () => {
    mockProyectoDeDueno();
    usuario.findUnique.mockResolvedValue({ id_usuario: 2 });
    dedicacion.findUnique.mockResolvedValue({ id_dedicacion: 1 });
    rolProyecto.findUnique.mockResolvedValue(null);

    await expect(
      agregarParticipante(1, { participante: 2, id_dedicacion: 1, id_rol_pro: 999 }, EDITOR_DUENO)
    ).rejects.toBeInstanceOf(CatalogoInvalidoError);
  });

  it("PT-06: rechaza id_rol_estudiante cuando el rol de proyecto NO es de estudiante", async () => {
    mockProyectoDeDueno();
    usuario.findUnique.mockResolvedValue({ id_usuario: 2 });
    dedicacion.findUnique.mockResolvedValue({ id_dedicacion: 1 });
    rolProyecto.findUnique.mockResolvedValue({ id_rol_pro: 1, nombre: "Docente" });

    await expect(
      agregarParticipante(
        1,
        { participante: 2, id_dedicacion: 1, id_rol_pro: 1, id_rol_estudiante: 3 },
        EDITOR_DUENO
      )
    ).rejects.toBeInstanceOf(RolEstudianteNoAplicaError);
  });

  it("PT-07: rechaza id_rol_estudiante inexistente cuando el rol SÍ es de estudiante", async () => {
    mockProyectoDeDueno();
    usuario.findUnique.mockResolvedValue({ id_usuario: 2 });
    dedicacion.findUnique.mockResolvedValue({ id_dedicacion: 1 });
    rolProyecto.findUnique.mockResolvedValue({ id_rol_pro: 2, nombre: "Estudiante Investigador(a)" });
    rolEstudiante.findUnique.mockResolvedValue(null);

    await expect(
      agregarParticipante(
        1,
        { participante: 2, id_dedicacion: 1, id_rol_pro: 2, id_rol_estudiante: 999 },
        EDITOR_DUENO
      )
    ).rejects.toBeInstanceOf(CatalogoInvalidoError);
  });

  it("PT-08: registra correctamente un participante válido (camino feliz)", async () => {
    mockProyectoDeDueno();
    usuario.findUnique.mockResolvedValue({ id_usuario: 2 });
    dedicacion.findUnique.mockResolvedValue({ id_dedicacion: 1 });
    rolProyecto.findUnique.mockResolvedValue({ id_rol_pro: 1, nombre: "Docente" });
    usuarioProyecto.create.mockResolvedValue({ id_usuarioproyecto: 100 });
    usuarioProyecto.findUniqueOrThrow.mockResolvedValue({ id_usuarioproyecto: 100 });

    const resultado = await agregarParticipante(
      1,
      { participante: 2, id_dedicacion: 1, id_rol_pro: 1 },
      EDITOR_DUENO
    );

    expect(resultado).toMatchObject({ id_usuarioproyecto: 100 });
  });

  it("PT-09: convierte la violación de índice único (P2002) en ParticipanteDuplicadoError", async () => {
    mockProyectoDeDueno();
    usuario.findUnique.mockResolvedValue({ id_usuario: 2 });
    dedicacion.findUnique.mockResolvedValue({ id_dedicacion: 1 });
    rolProyecto.findUnique.mockResolvedValue({ id_rol_pro: 1, nombre: "Docente" });
    usuarioProyecto.create.mockRejectedValue({ code: "P2002" });

    await expect(
      agregarParticipante(1, { participante: 2, id_dedicacion: 1, id_rol_pro: 1 }, EDITOR_DUENO)
    ).rejects.toBeInstanceOf(ParticipanteDuplicadoError);
  });

  it("PT-10: propaga sin envolver cualquier otro error inesperado de la base de datos", async () => {
    mockProyectoDeDueno();
    usuario.findUnique.mockResolvedValue({ id_usuario: 2 });
    dedicacion.findUnique.mockResolvedValue({ id_dedicacion: 1 });
    rolProyecto.findUnique.mockResolvedValue({ id_rol_pro: 1, nombre: "Docente" });
    usuarioProyecto.create.mockRejectedValue(new Error("Conexión perdida"));

    await expect(
      agregarParticipante(1, { participante: 2, id_dedicacion: 1, id_rol_pro: 1 }, EDITOR_DUENO)
    ).rejects.toThrow("Conexión perdida");
  });
});

describe("listarParticipantes", () => {
  it("LT-01: rechaza si el proyecto no existe", async () => {
    proyecto.findUnique.mockResolvedValue(null);
    await expect(listarParticipantes(999)).rejects.toBeInstanceOf(ProyectoNoEncontradoError);
  });

  it("LT-02: retorna la lista de participantes cuando el proyecto existe", async () => {
    mockProyectoDeDueno();
    usuarioProyecto.findMany.mockResolvedValue([{ id_usuarioproyecto: 1 }]);

    await expect(listarParticipantes(1)).resolves.toEqual([{ id_usuarioproyecto: 1 }]);
  });
});

describe("actualizarParticipante", () => {
  it("AC-01: rechaza si quien edita no es dueño ni Administrador", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });

    await expect(
      actualizarParticipante(1, 10, { id_dedicacion: 2 }, { id_usuario: 999, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(NoAutorizadoError);
  });

  it("AC-02: rechaza si la participación no existe en ese proyecto", async () => {
    mockProyectoDeDueno();
    usuarioProyecto.findUnique.mockResolvedValue(null);

    await expect(
      actualizarParticipante(1, 999, { id_dedicacion: 2 }, EDITOR_DUENO)
    ).rejects.toBeInstanceOf(ParticipacionNoEncontradaError);
  });

  it("AC-03: rechaza si la participación pertenece a OTRO proyecto (id_proyecto no coincide)", async () => {
    mockProyectoDeDueno();
    usuarioProyecto.findUnique.mockResolvedValue({ id_usuarioproyecto: 10, id_proyecto: 2, id_rol_pro: 1 });

    await expect(
      actualizarParticipante(1, 10, { id_dedicacion: 2 }, EDITOR_DUENO)
    ).rejects.toBeInstanceOf(ParticipacionNoEncontradaError);
  });

  it("AC-04: rechaza id_dedicacion inexistente al editar", async () => {
    mockProyectoDeDueno();
    usuarioProyecto.findUnique.mockResolvedValue({ id_usuarioproyecto: 10, id_proyecto: 1, id_rol_pro: 1 });
    dedicacion.findUnique.mockResolvedValue(null);

    await expect(
      actualizarParticipante(1, 10, { id_dedicacion: 999 }, EDITOR_DUENO)
    ).rejects.toBeInstanceOf(CatalogoInvalidoError);
  });

  it("AC-05: rechaza id_rol_estudiante si el rol de proyecto (existente o nuevo) no es de estudiante", async () => {
    mockProyectoDeDueno();
    usuarioProyecto.findUnique.mockResolvedValue({ id_usuarioproyecto: 10, id_proyecto: 1, id_rol_pro: 1 });
    rolProyecto.findUnique.mockResolvedValue({ id_rol_pro: 1, nombre: "Docente" });

    await expect(
      actualizarParticipante(1, 10, { id_rol_estudiante: 3 }, EDITOR_DUENO)
    ).rejects.toBeInstanceOf(RolEstudianteNoAplicaError);
  });

  it("AC-06: edita correctamente cuando los datos son válidos (camino feliz)", async () => {
    mockProyectoDeDueno();
    usuarioProyecto.findUnique.mockResolvedValue({ id_usuarioproyecto: 10, id_proyecto: 1, id_rol_pro: 1 });
    dedicacion.findUnique.mockResolvedValue({ id_dedicacion: 2 });
    usuarioProyecto.update.mockResolvedValue({ id_usuarioproyecto: 10, id_dedicacion: 2 });

    await expect(
      actualizarParticipante(1, 10, { id_dedicacion: 2 }, EDITOR_DUENO)
    ).resolves.toMatchObject({ id_usuarioproyecto: 10 });
  });
});

describe("quitarParticipante", () => {
  it("QT-01: rechaza si quien elimina no es dueño ni Administrador", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });

    await expect(
      quitarParticipante(1, 10, { id_usuario: 999, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(NoAutorizadoError);
  });

  it("QT-02: rechaza si la participación no existe o pertenece a otro proyecto", async () => {
    mockProyectoDeDueno();
    usuarioProyecto.findUnique.mockResolvedValue({ id_usuarioproyecto: 10, id_proyecto: 2 });

    await expect(quitarParticipante(1, 10, EDITOR_DUENO)).rejects.toBeInstanceOf(
      ParticipacionNoEncontradaError
    );
  });

  it("QT-03: elimina correctamente al participante cuando pertenece al proyecto", async () => {
    mockProyectoDeDueno();
    usuarioProyecto.findUnique.mockResolvedValue({ id_usuarioproyecto: 10, id_proyecto: 1 });
    usuarioProyecto.delete.mockResolvedValue({});

    await quitarParticipante(1, 10, EDITOR_DUENO);

    expect(usuarioProyecto.delete).toHaveBeenCalledWith({ where: { id_usuarioproyecto: 10 } });
  });
});
