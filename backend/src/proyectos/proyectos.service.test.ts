import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/prisma", () => ({
  prisma: {
    proyecto: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    convocatoria: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../config/prisma";
import {
  crearProyecto,
  actualizarProyecto,
  listarProyectos,
  obtenerProyecto,
  CamposIncompletosError,
  ConvocatoriaNoEncontradaError,
  ConvocatoriaCerradaError,
  ProyectoNoEncontradoError,
  NoAutorizadoError,
  type DatosProyecto,
} from "./proyectos.service";

const proyecto = prisma.proyecto as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
};
const convocatoria = prisma.convocatoria as unknown as { findUnique: ReturnType<typeof vi.fn> };

function datosCompletos(overrides: Partial<DatosProyecto> = {}): DatosProyecto {
  return {
    id_convocatoria: 1,
    id_modalidad_proyecto: 1,
    id_tipo_proyecto: 1,
    titulo: "Estudio de caso",
    ciudad: "Pasto",
    departamento: "Nariño",
    resumen: "Resumen del proyecto",
    planteamiento_problema: "Planteamiento",
    pregunta_investigacion: "¿Pregunta?",
    justificacion: "Justificación",
    marco_teorico: "Marco teórico",
    metodologia_preliminar: "Metodología",
    componente_etico: "Componente ético",
    funciones_estudiante_auxiliar: "Funciones",
    duracion_periodos: 2,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("crearProyecto (RQF13)", () => {
  it("CP-01: rechaza cuando falta un campo de texto obligatorio (título vacío)", async () => {
    const datos = datosCompletos({ titulo: "" });

    await expect(crearProyecto(datos, 1)).rejects.toBeInstanceOf(CamposIncompletosError);
    expect(convocatoria.findUnique).not.toHaveBeenCalled();
  });

  it("CP-02: rechaza cuando duracion_periodos es undefined", async () => {
    const datos = datosCompletos();
    // @ts-expect-error prueba de valor límite: campo numérico ausente
    delete datos.duracion_periodos;

    const error = await crearProyecto(datos, 1).catch((e) => e);
    expect(error).toBeInstanceOf(CamposIncompletosError);
    expect((error as InstanceType<typeof CamposIncompletosError>).faltantes).toContain("duracion_periodos");
  });

  it("CP-02b [regresión BB-21]: rechaza duracion_periodos con tipo inválido (string) en vez de dejarlo llegar a Prisma", async () => {
    const datos = datosCompletos({ duracion_periodos: "dos" as unknown as number });

    const error = await crearProyecto(datos, 1).catch((e) => e);
    expect(error).toBeInstanceOf(CamposIncompletosError);
    expect((error as InstanceType<typeof CamposIncompletosError>).faltantes).toContain("duracion_periodos");
    expect(convocatoria.findUnique).not.toHaveBeenCalled();
  });

  it("CP-02c [regresión BB-22]: rechaza duracion_periodos negativa o cero (valor límite de negocio)", async () => {
    const errorNegativo = await crearProyecto(datosCompletos({ duracion_periodos: -5 }), 1).catch((e) => e);
    expect(errorNegativo).toBeInstanceOf(CamposIncompletosError);

    const errorCero = await crearProyecto(datosCompletos({ duracion_periodos: 0 }), 1).catch((e) => e);
    expect(errorCero).toBeInstanceOf(CamposIncompletosError);
  });

  it("CP-02d: acepta duracion_periodos = 1 (valor límite inferior válido)", async () => {
    convocatoria.findUnique.mockResolvedValue({ id_convocatoria: 1, estado: "activa" });
    proyecto.create.mockResolvedValue({ id_proyecto: 11, ...datosCompletos({ duracion_periodos: 1 }) });

    await expect(crearProyecto(datosCompletos({ duracion_periodos: 1 }), 1)).resolves.toMatchObject({
      id_proyecto: 11,
    });
  });

  it("CP-03: reporta TODOS los campos faltantes a la vez, no solo el primero", async () => {
    const datos = datosCompletos({ titulo: "", ciudad: "   ", resumen: "" });

    const error = await crearProyecto(datos, 1).catch((e) => e);
    expect(error).toBeInstanceOf(CamposIncompletosError);
    expect((error as InstanceType<typeof CamposIncompletosError>).faltantes).toEqual(
      expect.arrayContaining(["titulo", "ciudad", "resumen"])
    );
  });

  it("CP-04: rechaza si la convocatoria indicada no existe", async () => {
    convocatoria.findUnique.mockResolvedValue(null);

    await expect(crearProyecto(datosCompletos(), 1)).rejects.toBeInstanceOf(ConvocatoriaNoEncontradaError);
  });

  it("CP-05: rechaza si la convocatoria existe pero no está activa (caso límite de estado)", async () => {
    convocatoria.findUnique.mockResolvedValue({ id_convocatoria: 1, estado: "cerrada" });

    await expect(crearProyecto(datosCompletos(), 1)).rejects.toBeInstanceOf(ConvocatoriaCerradaError);
  });

  it("CP-06: crea el proyecto cuando los datos son válidos y la convocatoria está activa", async () => {
    convocatoria.findUnique.mockResolvedValue({ id_convocatoria: 1, estado: "activa" });
    proyecto.create.mockResolvedValue({ id_proyecto: 10, ...datosCompletos(), creado_por: 1 });

    const resultado = await crearProyecto(datosCompletos(), 1);

    expect(resultado).toMatchObject({ id_proyecto: 10, creado_por: 1 });
    expect(proyecto.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ creado_por: 1 }) })
    );
  });
});

describe("listarProyectos (RQF15/RQF75)", () => {
  it("LP-01: arma el filtro 'where' solo con los criterios provistos (sin filtros)", async () => {
    proyecto.count.mockResolvedValue(0);
    proyecto.findMany.mockResolvedValue([]);

    await listarProyectos({}, { skip: 0, limit: 10, page: 1 } as any);

    expect(proyecto.count).toHaveBeenCalledWith({ where: {} });
  });

  it("LP-02: aplica búsqueda insensible a mayúsculas por título (q)", async () => {
    proyecto.count.mockResolvedValue(1);
    proyecto.findMany.mockResolvedValue([{ id_proyecto: 1 }]);

    await listarProyectos({ q: "Salud" }, { skip: 0, limit: 10, page: 1 } as any);

    expect(proyecto.count).toHaveBeenCalledWith({
      where: { titulo: { contains: "Salud", mode: "insensitive" } },
    });
  });

  it("LP-03: combina estado + id_convocatoria cuando ambos están presentes", async () => {
    proyecto.count.mockResolvedValue(0);
    proyecto.findMany.mockResolvedValue([]);

    await listarProyectos({ estado: "en_revision", id_convocatoria: 3 }, { skip: 0, limit: 10, page: 1 } as any);

    expect(proyecto.count).toHaveBeenCalledWith({
      where: { estado_actual: "en_revision", id_convocatoria: 3 },
    });
  });
});

describe("obtenerProyecto (RQF15)", () => {
  it("OP-01: lanza ProyectoNoEncontradoError si el id no existe", async () => {
    proyecto.findUnique.mockResolvedValue(null);
    await expect(obtenerProyecto(999)).rejects.toBeInstanceOf(ProyectoNoEncontradoError);
  });

  it("OP-02: retorna el proyecto cuando existe", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, titulo: "X" });
    await expect(obtenerProyecto(1)).resolves.toMatchObject({ id_proyecto: 1 });
  });
});

describe("actualizarProyecto (RQF14)", () => {
  it("AP-01: lanza ProyectoNoEncontradoError si el proyecto no existe", async () => {
    proyecto.findUnique.mockResolvedValue(null);

    await expect(
      actualizarProyecto(999, datosCompletos(), { id_usuario: 1, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(ProyectoNoEncontradoError);
  });

  it("AP-02: lanza NoAutorizadoError si quien edita no es el dueño ni Administrador", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });

    await expect(
      actualizarProyecto(1, datosCompletos(), { id_usuario: 99, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(NoAutorizadoError);
    expect(proyecto.update).not.toHaveBeenCalled();
  });

  it("AP-03: permite editar al dueño del proyecto", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });
    proyecto.update.mockResolvedValue({ id_proyecto: 1, ...datosCompletos() });

    await expect(
      actualizarProyecto(1, datosCompletos(), { id_usuario: 5, roles: ["Investigador"] })
    ).resolves.toMatchObject({ id_proyecto: 1 });
  });

  it("AP-04: permite editar a un Administrador que no es el dueño", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });
    proyecto.update.mockResolvedValue({ id_proyecto: 1, ...datosCompletos() });

    await expect(
      actualizarProyecto(1, datosCompletos(), { id_usuario: 99, roles: ["Administrador"] })
    ).resolves.toMatchObject({ id_proyecto: 1 });
  });

  it("AP-05: rechaza la edición si el dueño envía el formulario con campos vacíos", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });

    await expect(
      actualizarProyecto(1, datosCompletos({ justificacion: "" }), {
        id_usuario: 5,
        roles: ["Investigador"],
      })
    ).rejects.toBeInstanceOf(CamposIncompletosError);
    expect(proyecto.update).not.toHaveBeenCalled();
  });
});
