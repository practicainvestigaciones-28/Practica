import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/prisma", () => ({
  prisma: {
    proyecto: { findUnique: vi.fn() },
    tipoProducto: { findMany: vi.fn(), findUnique: vi.fn() },
    proyectoProducto: { findMany: vi.fn(), upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { prisma } from "../config/prisma";
import {
  validarProductosObligatorios,
  agregarProducto,
  quitarProducto,
  ProductoNoEncontradoError,
  TipoProductoNoEncontradoError,
} from "./productos.service";
import { NoAutorizadoProyectoError, ProyectoNoEncontradoError } from "../utils/permisosProyecto";

const proyecto = prisma.proyecto as unknown as { findUnique: ReturnType<typeof vi.fn> };
const tipoProducto = prisma.tipoProducto as unknown as {
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
};
const proyectoProducto = prisma.proyectoProducto as unknown as {
  findMany: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validarProductosObligatorios (RQF31)", () => {
  it("VP-01: cumple = false cuando faltan productos obligatorios por registrar", async () => {
    tipoProducto.findMany.mockResolvedValue([
      { id_tipo_producto: 1, nombre: "Artículo A1" },
      { id_tipo_producto: 2, nombre: "Artículo A2" },
    ]);
    proyectoProducto.findMany.mockResolvedValue([{ id_tipo_producto: 1 }]);

    const resultado = await validarProductosObligatorios(1);

    expect(resultado.cumple).toBe(false);
    expect(resultado.productosFaltantes).toEqual([{ id_tipo_producto: 2, nombre: "Artículo A2" }]);
  });

  it("VP-02: cumple = true cuando todos los productos obligatorios están registrados", async () => {
    tipoProducto.findMany.mockResolvedValue([{ id_tipo_producto: 1, nombre: "Artículo A1" }]);
    proyectoProducto.findMany.mockResolvedValue([{ id_tipo_producto: 1 }]);

    const resultado = await validarProductosObligatorios(1);

    expect(resultado.cumple).toBe(true);
    expect(resultado.productosFaltantes).toEqual([]);
  });

  it("VP-03: caso límite — no existen productos obligatorios definidos en el catálogo", async () => {
    tipoProducto.findMany.mockResolvedValue([]);
    proyectoProducto.findMany.mockResolvedValue([]);

    const resultado = await validarProductosObligatorios(1);

    expect(resultado.cumple).toBe(true);
    expect(resultado.productosObligatorios).toEqual([]);
  });
});

describe("agregarProducto (RQF30) — control de acceso delegado a verificarPermisoProyecto", () => {
  it("AG-01: rechaza si el proyecto no existe", async () => {
    proyecto.findUnique.mockResolvedValue(null);

    await expect(
      agregarProducto(999, { id_tipo_producto: 1 }, { id_usuario: 1, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(ProyectoNoEncontradoError);
    expect(proyectoProducto.upsert).not.toHaveBeenCalled();
  });

  it("AG-02: rechaza si el usuario no es dueño del proyecto ni Administrador", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });

    await expect(
      agregarProducto(1, { id_tipo_producto: 1 }, { id_usuario: 99, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(NoAutorizadoProyectoError);
  });

  it("AG-03: usa cantidad = 1 por defecto cuando no se especifica", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });
    tipoProducto.findUnique.mockResolvedValue({ id_tipo_producto: 7 });
    proyectoProducto.upsert.mockResolvedValue({ id_proyecto_producto: 1, cantidad: 1 });

    await agregarProducto(1, { id_tipo_producto: 7 }, { id_usuario: 5, roles: ["Investigador"] });

    expect(proyectoProducto.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ cantidad: 1 }),
        update: expect.objectContaining({ cantidad: 1 }),
      })
    );
  });

  it("AG-04 [regresión BB-13b]: rechaza con TipoProductoNoEncontradoError si id_tipo_producto no existe, en vez de dejar romper la restricción de llave foránea", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });
    tipoProducto.findUnique.mockResolvedValue(null);

    await expect(
      agregarProducto(1, { id_tipo_producto: 999999 }, { id_usuario: 5, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(TipoProductoNoEncontradoError);
    expect(proyectoProducto.upsert).not.toHaveBeenCalled();
  });
});

describe("quitarProducto — pertenencia del recurso al proyecto correcto", () => {
  it("QP-01: rechaza si el producto no pertenece al proyecto indicado (id_proyecto distinto)", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });
    proyectoProducto.findUnique.mockResolvedValue({ id_proyecto_producto: 10, id_proyecto: 2 });

    await expect(
      quitarProducto(1, 10, { id_usuario: 5, roles: ["Investigador"] })
    ).rejects.toBeInstanceOf(ProductoNoEncontradoError);
    expect(proyectoProducto.delete).not.toHaveBeenCalled();
  });

  it("QP-02: elimina correctamente cuando el producto sí pertenece al proyecto", async () => {
    proyecto.findUnique.mockResolvedValue({ id_proyecto: 1, creado_por: 5 });
    proyectoProducto.findUnique.mockResolvedValue({ id_proyecto_producto: 10, id_proyecto: 1 });
    proyectoProducto.delete.mockResolvedValue({});

    await quitarProducto(1, 10, { id_usuario: 5, roles: ["Investigador"] });

    expect(proyectoProducto.delete).toHaveBeenCalledWith({ where: { id_proyecto_producto: 10 } });
  });
});
