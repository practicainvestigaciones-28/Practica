import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/prisma", () => ({
  prisma: {
    tipoDocumento: { findUnique: vi.fn() },
    proyectoDocumento: { create: vi.fn() },
  },
}));
vi.mock("../utils/permisosProyecto", () => ({
  verificarPermisoProyecto: vi.fn(),
  NoAutorizadoProyectoError: class extends Error {},
  ProyectoNoEncontradoError: class extends Error {},
}));
vi.mock("../config/upload", () => ({ CARPETA_UPLOADS: "uploads-de-prueba" }));
vi.mock("node:fs", () => ({ default: { unlink: vi.fn(), existsSync: vi.fn(() => false) } }));

import { prisma } from "../config/prisma";
import { cargarDocumento, FormatoDocumentoInvalidoError, NOMBRE_TIPO_PRESUPUESTO } from "./documentos.service";

const tipoDocumento = prisma.tipoDocumento as unknown as { findUnique: ReturnType<typeof vi.fn> };
const proyectoDocumento = prisma.proyectoDocumento as unknown as { create: ReturnType<typeof vi.fn> };
const admin = { id_usuario: 1, roles: ["Administrador"] };

describe("cargarDocumento: formato del Presupuesto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    proyectoDocumento.create.mockResolvedValue({ id_proyecto_documento: 1 });
  });

  it("acepta el Presupuesto en .xlsx", async () => {
    tipoDocumento.findUnique.mockResolvedValue({ id_tipo_documento: 5, nombre: NOMBRE_TIPO_PRESUPUESTO, activo: true });
    await expect(cargarDocumento(1, 5, "123-abc.xlsx", admin)).resolves.toBeTruthy();
    expect(proyectoDocumento.create).toHaveBeenCalled();
  });

  it.each(["123-abc.pdf", "123-abc.xls", "123-abc.docx", "123-abc"])("rechaza el Presupuesto en %s", async (archivo) => {
    tipoDocumento.findUnique.mockResolvedValue({ id_tipo_documento: 5, nombre: NOMBRE_TIPO_PRESUPUESTO, activo: true });
    await expect(cargarDocumento(1, 5, archivo, admin)).rejects.toBeInstanceOf(FormatoDocumentoInvalidoError);
    expect(proyectoDocumento.create).not.toHaveBeenCalled();
  });

  it("no restringe el formato de los demás documentos", async () => {
    tipoDocumento.findUnique.mockResolvedValue({ id_tipo_documento: 6, nombre: "Aval del líder", activo: true });
    await expect(cargarDocumento(1, 6, "123-abc.pdf", admin)).resolves.toBeTruthy();
  });
});
