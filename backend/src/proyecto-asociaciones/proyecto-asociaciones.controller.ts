import type { Request, Response, NextFunction } from "express";
import * as asociaciones from "./proyecto-asociaciones.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof asociaciones.ProyectoNoEncontradoError ||
    error instanceof asociaciones.AsociacionNoEncontradaError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof asociaciones.NoAutorizadoProyectoError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (error instanceof asociaciones.RegistroDuplicadoError) {
    res.status(409).json({ error: "Duplicado", mensaje: error.message });
    return;
  }
  next(error);
}

function usuarioReq(req: Request) {
  return { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles };
}

// RQF19 - Áreas de conocimiento
export async function agregarArea(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_area_conocimiento } = req.body;
    if (!id_area_conocimiento) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_area_conocimiento es obligatorio" });
      return;
    }
    const registro = await asociaciones.agregarArea(Number(req.params.id), id_area_conocimiento, usuarioReq(req));
    res.status(201).json({ mensaje: "Área asociada correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function listarAreas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await asociaciones.listarAreas(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarArea(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await asociaciones.quitarArea(Number(req.params.id), Number(req.params.idArea), usuarioReq(req));
    res.status(200).json({ mensaje: "Área removida correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}

// RQF20 - Programas académicos
export async function agregarPrograma(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_programa, programa_otro } = req.body;
    if (!id_programa && !programa_otro) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "Envía id_programa (catálogo) o programa_otro (texto libre)",
      });
      return;
    }
    const registro = await asociaciones.agregarPrograma(
      Number(req.params.id),
      { id_programa, programa_otro },
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "Programa asociado correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function listarProgramas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await asociaciones.listarProgramas(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarPrograma(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await asociaciones.quitarPrograma(Number(req.params.id), Number(req.params.idPrograma), usuarioReq(req));
    res.status(200).json({ mensaje: "Programa removido correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}

// RQF22 - Financiación
export async function registrarFinanciacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { valor_solicitado_unicesmag, valor_contrapartida } = req.body;
    if (valor_solicitado_unicesmag === undefined) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "valor_solicitado_unicesmag es obligatorio",
      });
      return;
    }
    const registro = await asociaciones.registrarFinanciacion(
      Number(req.params.id),
      { valor_solicitado_unicesmag, valor_contrapartida },
      usuarioReq(req)
    );
    res.status(200).json({ mensaje: "Financiación registrada correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function obtenerFinanciacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const registro = await asociaciones.obtenerFinanciacion(Number(req.params.id));
    if (!registro) {
      res.status(404).json({ error: "No encontrado", mensaje: "Este proyecto aún no tiene financiación registrada" });
      return;
    }
    res.status(200).json(registro);
  } catch (error) {
    manejarError(error, res, next);
  }
}

// RQF23 / RQF25 - Grupos de investigación, línea y ODS
export async function agregarGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_grupo, orden } = req.body;
    if (!id_grupo) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_grupo es obligatorio" });
      return;
    }
    const registro = await asociaciones.agregarGrupo(
      Number(req.params.id),
      { id_grupo, ...(Number.isInteger(orden) ? { orden: Number(orden) } : {}) },
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "Grupo asociado correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function listarGruposDelProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await asociaciones.listarGruposDelProyecto(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function agregarInvestigadorGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre_completo, horas_semanales } = req.body as { nombre_completo?: unknown; horas_semanales?: unknown };
    if (typeof nombre_completo !== "string" || !nombre_completo.trim()) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "nombre_completo es obligatorio" });
      return;
    }
    const horas = horas_semanales === undefined || horas_semanales === null || horas_semanales === "" ? null : Number(horas_semanales);
    if (horas !== null && (!Number.isInteger(horas) || horas < 0)) {
      res.status(400).json({ error: "Datos inválidos", mensaje: "horas_semanales debe ser un número entero no negativo" });
      return;
    }
    const registro = await asociaciones.agregarInvestigadorGrupo(
      Number(req.params.id),
      Number(req.params.idProyectoGrupo),
      { nombre_completo, horas_semanales: horas },
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "Investigador agregado al grupo", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await asociaciones.quitarGrupo(Number(req.params.id), Number(req.params.idGrupo), usuarioReq(req));
    res.status(200).json({ mensaje: "Grupo removido correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function agregarOdsGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_ods } = req.body;
    if (!id_ods) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_ods es obligatorio" });
      return;
    }
    const registro = await asociaciones.agregarOdsGrupo(
      Number(req.params.id),
      Number(req.params.idProyectoGrupo),
      id_ods,
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "ODS asociado correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarOdsGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await asociaciones.quitarOdsGrupo(
      Number(req.params.id),
      Number(req.params.idProyectoGrupo),
      Number(req.params.idOds),
      usuarioReq(req)
    );
    res.status(200).json({ mensaje: "ODS removido correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function agregarLineaGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_linea_investigacion } = req.body;
    if (!id_linea_investigacion) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_linea_investigacion es obligatorio" });
      return;
    }
    const registro = await asociaciones.agregarLineaGrupo(
      Number(req.params.id),
      Number(req.params.idProyectoGrupo),
      id_linea_investigacion,
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "Línea de investigación asociada correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarLineaGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await asociaciones.quitarLineaGrupo(
      Number(req.params.id),
      Number(req.params.idProyectoGrupo),
      Number(req.params.idLinea),
      usuarioReq(req)
    );
    res.status(200).json({ mensaje: "Línea de investigación removida correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /proyectos/:id/egresados-info */
export async function obtenerEgresadosInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await asociaciones.obtenerEgresadosInfo(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /proyectos/:id/egresados-info  { id_facultad, id_programa, empresa_entidad, integrantes: [{ nombre_completo, horas_semanales }] } */
export async function guardarEgresadosInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const entero = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
    const integrantesCrudos = Array.isArray(body.integrantes) ? body.integrantes : [];
    const integrantes = integrantesCrudos.map((i) => {
      const fila = (i ?? {}) as Record<string, unknown>;
      return {
        nombre_completo: typeof fila.nombre_completo === "string" ? fila.nombre_completo : "",
        horas_semanales: entero(fila.horas_semanales),
      };
    });
    const numeros = [entero(body.id_facultad), entero(body.id_programa), ...integrantes.map((i) => i.horas_semanales)];
    if (numeros.some((n) => n !== null && (!Number.isInteger(n) || n < 0))) {
      res.status(400).json({ error: "Datos inválidos", mensaje: "id_facultad, id_programa y horas_semanales deben ser enteros no negativos" });
      return;
    }
    const registro = await asociaciones.guardarEgresadosInfo(
      Number(req.params.id),
      {
        id_facultad: entero(body.id_facultad),
        id_programa: entero(body.id_programa),
        empresa_entidad: typeof body.empresa_entidad === "string" ? body.empresa_entidad : null,
        integrantes,
      },
      usuarioReq(req)
    );
    res.status(200).json({ mensaje: "Información de egresados guardada", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /proyectos/:id/hojas-vida */
export async function listarHojasVidaProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await asociaciones.listarHojasVidaProyecto(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /proyectos/:id/hojas-vida  { hojas: [{ rol: "coinvestigador" | "externo", datos: {...} }] } */
export async function guardarHojasVidaProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const hojas = (req.body as { hojas?: unknown }).hojas;
    if (!Array.isArray(hojas)) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "hojas debe ser un arreglo" });
      return;
    }
    const registro = await asociaciones.guardarHojasVidaProyecto(
      Number(req.params.id),
      hojas.map((h) => {
        const fila = (h ?? {}) as { rol?: unknown; datos?: unknown };
        return {
          rol: typeof fila.rol === "string" ? fila.rol : "",
          datos: fila.datos && typeof fila.datos === "object" ? (fila.datos as Record<string, unknown>) : {},
        };
      }),
      usuarioReq(req)
    );
    res.status(200).json({ mensaje: "Hojas de vida guardadas", registro });
  } catch (error) {
    if (error instanceof asociaciones.HojaVidaInvalidaError) {
      res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
      return;
    }
    manejarError(error, res, next);
  }
}

/** PUT /proyectos/:id/grupos-externos/:idGrupo — actualiza el grupo externo que ya tenía el proyecto. */
export async function actualizarGrupoExternoProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const registro = await asociaciones.actualizarGrupoExternoProyecto(
      Number(req.params.id),
      Number(req.params.idGrupo),
      (req.body ?? {}) as Record<string, unknown>,
      usuarioReq(req)
    );
    res.status(200).json({ mensaje: "Grupo externo actualizado", grupo: registro });
  } catch (error) {
    if (error instanceof asociaciones.GrupoExternoNoEditableError) {
      res.status(409).json({ error: "No permitido", mensaje: error.message });
      return;
    }
    manejarError(error, res, next);
  }
}
