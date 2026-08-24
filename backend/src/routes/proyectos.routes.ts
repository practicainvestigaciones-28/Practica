import { Router } from "express";
import {
  crearProyecto,
  listarProyectos,
  obtenerProyecto,
  actualizarProyecto,
} from "../proyectos/proyectos.controller";
import {
  agregarParticipante,
  listarParticipantes,
  actualizarParticipante,
  quitarParticipante,
  registrarEgresado,
  obtenerEgresado,
} from "../participantes/participantes.controller";
import * as asociaciones from "../proyecto-asociaciones/proyecto-asociaciones.controller";
import * as objetivos from "../objetivos/objetivos.controller";
import * as cronograma from "../cronograma/cronograma.controller";
import * as productosProyecto from "../productos/productos.controller";
import * as documentos from "../documentos/documentos.controller";
import { uploadDocumento } from "../config/upload";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";

export const proyectosRoutes = Router();

// Todas las rutas de proyectos requieren sesión activa
proyectosRoutes.use(autenticar);

proyectosRoutes.get("/", listarProyectos);
proyectosRoutes.get("/:id", obtenerProyecto);

// Solo investigadores y administradores pueden registrar proyectos (RQF13)
proyectosRoutes.post("/", autorizar("Investigador", "Administrador"), crearProyecto);

proyectosRoutes.put("/:id", actualizarProyecto);

// Participantes del proyecto (RQF17). La autorización fina (dueño del
// proyecto o Administrador) se valida dentro del servicio, porque depende
// de a quién pertenece CADA proyecto, no de un rol fijo.
proyectosRoutes.get("/:id/participantes", listarParticipantes);
proyectosRoutes.post("/:id/participantes", agregarParticipante);
proyectosRoutes.put("/:id/participantes/:idParticipante", actualizarParticipante);
proyectosRoutes.delete("/:id/participantes/:idParticipante", quitarParticipante);

// Información de egresado (RQF24)
proyectosRoutes.get("/:id/participantes/:idParticipante/egresado", obtenerEgresado);
proyectosRoutes.put("/:id/participantes/:idParticipante/egresado", registrarEgresado);

// Área de conocimiento del proyecto (RQF19)
proyectosRoutes.get("/:id/areas", asociaciones.listarAreas);
proyectosRoutes.post("/:id/areas", asociaciones.agregarArea);
proyectosRoutes.delete("/:id/areas/:idArea", asociaciones.quitarArea);

// Programas académicos asociados al proyecto (RQF20)
proyectosRoutes.get("/:id/programas", asociaciones.listarProgramas);
proyectosRoutes.post("/:id/programas", asociaciones.agregarPrograma);
proyectosRoutes.delete("/:id/programas/:idPrograma", asociaciones.quitarPrograma);

// Financiación del proyecto (RQF22) — relación 1 a 1
proyectosRoutes.get("/:id/financiacion", asociaciones.obtenerFinanciacion);
proyectosRoutes.put("/:id/financiacion", asociaciones.registrarFinanciacion);

// Grupos de investigación, línea y ODS del proyecto (RQF23, RQF25)
proyectosRoutes.get("/:id/grupos", asociaciones.listarGruposDelProyecto);
proyectosRoutes.post("/:id/grupos", asociaciones.agregarGrupo);
proyectosRoutes.delete("/:id/grupos/:idGrupo", asociaciones.quitarGrupo);

// Objetivos del proyecto (RQF27)
proyectosRoutes.get("/:id/objetivos", objetivos.listarObjetivos);
proyectosRoutes.post("/:id/objetivos", objetivos.agregarObjetivo);
proyectosRoutes.put("/:id/objetivos/:idObjetivo", objetivos.actualizarObjetivo);
proyectosRoutes.delete("/:id/objetivos/:idObjetivo", objetivos.quitarObjetivo);

// Impactos asociados a un objetivo específico (RQF28)
proyectosRoutes.get("/:id/objetivos/:idObjetivo/impactos", objetivos.listarImpactos);
proyectosRoutes.post("/:id/objetivos/:idObjetivo/impactos", objetivos.agregarImpacto);
proyectosRoutes.delete("/:id/objetivos/:idObjetivo/impactos/:idImpacto", objetivos.quitarImpacto);

// Antecedentes del proyecto (RQF27)
proyectosRoutes.get("/:id/antecedentes", objetivos.listarAntecedentes);
proyectosRoutes.post("/:id/antecedentes", objetivos.agregarAntecedente);
proyectosRoutes.delete("/:id/antecedentes/:idAntecedente", objetivos.quitarAntecedente);

// Cronograma de actividades (RQF29)
proyectosRoutes.get("/:id/cronograma", cronograma.listarActividades);
proyectosRoutes.post("/:id/cronograma", cronograma.agregarActividad);
proyectosRoutes.delete("/:id/cronograma/:idActividad", cronograma.quitarActividad);
proyectosRoutes.post("/:id/cronograma/:idActividad/periodos", cronograma.programarActividad);

// Productos de investigación del proyecto (RQF30, RQF31)
proyectosRoutes.get("/:id/productos", productosProyecto.listarProductos);
proyectosRoutes.post("/:id/productos", productosProyecto.agregarProducto);
proyectosRoutes.delete("/:id/productos/:idProducto", productosProyecto.quitarProducto);
proyectosRoutes.get("/:id/productos/validacion", productosProyecto.validarProductosObligatorios);

// Documentos del proyecto (RQF37-39). uploadDocumento.single("archivo")
// procesa el multipart/form-data ANTES de llegar al controlador.
proyectosRoutes.get("/:id/documentos", documentos.listarDocumentos);
proyectosRoutes.post("/:id/documentos", uploadDocumento.single("archivo"), documentos.cargarDocumento);
proyectosRoutes.get("/:id/documentos/:idDocumento", documentos.obtenerDocumento);
proyectosRoutes.get("/:id/documentos/:idDocumento/descarga", documentos.descargarDocumento);
proyectosRoutes.delete("/:id/documentos/:idDocumento", documentos.eliminarDocumento);

// RQF39 - Validación documental: solo Administrador (doble comprobación:
// aquí por rol fijo, y dentro del servicio por si se llama desde otro lado).
proyectosRoutes.patch(
  "/:id/documentos/:idDocumento/validacion",
  autorizar("Administrador"),
  documentos.validarDocumento
);
