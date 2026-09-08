-- AlterTable
ALTER TABLE "cronograma_actividad" ADD COLUMN     "id_meta" INTEGER,
ADD COLUMN     "id_objetivo" INTEGER;

-- AlterTable
ALTER TABLE "financiacion" ADD COLUMN     "valor_ejecutado" DECIMAL(14,2) DEFAULT 0;

-- AlterTable
ALTER TABLE "notificaciones" ADD COLUMN     "fecha_programada" TIMESTAMP(3),
ADD COLUMN     "programada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo_evento" TEXT;

-- AlterTable
ALTER TABLE "proyecto_producto" ADD COLUMN     "es_obligatorio" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "proyectos" ADD COLUMN     "centro_costos" TEXT,
ADD COLUMN     "duracion_meses" INTEGER,
ADD COLUMN     "fecha_fin_real" TIMESTAMP(3),
ADD COLUMN     "fecha_inicio_real" TIMESTAMP(3),
ADD COLUMN     "id_tipo_articulacion" INTEGER;

-- AlterTable
ALTER TABLE "usuario_proyecto" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "codigo_estudiantil" TEXT,
ADD COLUMN     "fecha_desvinculacion" TIMESTAMP(3),
ADD COLUMN     "fecha_vinculacion" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id_linea_investigacion" INTEGER;

-- CreateTable
CREATE TABLE "tipo_articulacion" (
    "id_tipo_articulacion" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipo_articulacion_pkey" PRIMARY KEY ("id_tipo_articulacion")
);

-- CreateTable
CREATE TABLE "acta_inicio" (
    "id_acta_inicio" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "numero_acta_aprobacion" TEXT NOT NULL,
    "fecha_acta_aprobacion" TIMESTAMP(3) NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "duracion_meses" INTEGER NOT NULL,
    "fecha_fin_estimada" TIMESTAMP(3) NOT NULL,
    "archivo_generado" TEXT,
    "archivo_firmado" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'en elaboracion',
    "generada_por" INTEGER NOT NULL,
    "fecha_generacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_legalizacion" TIMESTAMP(3),

    CONSTRAINT "acta_inicio_pkey" PRIMARY KEY ("id_acta_inicio")
);

-- CreateTable
CREATE TABLE "compromiso_aceptacion" (
    "id_aceptacion" SERIAL NOT NULL,
    "id_acta_inicio" INTEGER NOT NULL,
    "id_usuarioproyecto" INTEGER NOT NULL,
    "tipo_clausula" TEXT NOT NULL,
    "version_texto" TEXT,
    "aceptado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_aceptacion" TIMESTAMP(3),

    CONSTRAINT "compromiso_aceptacion_pkey" PRIMARY KEY ("id_aceptacion")
);

-- CreateTable
CREATE TABLE "firma_documento" (
    "id_firma" SERIAL NOT NULL,
    "tipo_documento_firmado" TEXT NOT NULL,
    "id_referencia" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "rol_firmante" TEXT NOT NULL,
    "orden_firma" INTEGER,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_firma" TIMESTAMP(3),
    "archivo_firma" TEXT,

    CONSTRAINT "firma_documento_pkey" PRIMARY KEY ("id_firma")
);

-- CreateTable
CREATE TABLE "financiacion_vigencia" (
    "id_financiacion_vigencia" SERIAL NOT NULL,
    "id_financiacion" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "valor_asignado" DECIMAL(14,2) NOT NULL,
    "valor_ejecutado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valor_disponible" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "financiacion_vigencia_pkey" PRIMARY KEY ("id_financiacion_vigencia")
);

-- CreateTable
CREATE TABLE "concepto_rubro" (
    "id_concepto_rubro" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "antelacion_valor" INTEGER,
    "antelacion_unidad" TEXT,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "concepto_rubro_pkey" PRIMARY KEY ("id_concepto_rubro")
);

-- CreateTable
CREATE TABLE "solicitud_rubro" (
    "id_solicitud_rubro" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_concepto_rubro" INTEGER NOT NULL,
    "id_financiacion_vigencia" INTEGER NOT NULL,
    "solicitado_por" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "valor_solicitado" DECIMAL(14,2) NOT NULL,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_requerida" TIMESTAMP(3) NOT NULL,
    "cumple_antelacion" BOOLEAN NOT NULL DEFAULT true,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "decidido_por" INTEGER,
    "fecha_decision" TIMESTAMP(3),
    "observacion_decision" TEXT,

    CONSTRAINT "solicitud_rubro_pkey" PRIMARY KEY ("id_solicitud_rubro")
);

-- CreateTable
CREATE TABLE "ejecucion_presupuestal" (
    "id_ejecucion" SERIAL NOT NULL,
    "id_solicitud_rubro" INTEGER NOT NULL,
    "id_financiacion_vigencia" INTEGER NOT NULL,
    "valor_ejecutado" DECIMAL(14,2) NOT NULL,
    "fecha_ejecucion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soporte" TEXT,
    "registrado_por" INTEGER NOT NULL,
    "observacion" TEXT,

    CONSTRAINT "ejecucion_presupuestal_pkey" PRIMARY KEY ("id_ejecucion")
);

-- CreateTable
CREATE TABLE "meta_objetivo" (
    "id_meta" SERIAL NOT NULL,
    "id_objetivo" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "indicador" TEXT,
    "orden" INTEGER,

    CONSTRAINT "meta_objetivo_pkey" PRIMARY KEY ("id_meta")
);

-- CreateTable
CREATE TABLE "periodo_informe" (
    "id_periodo_informe" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "numero_periodo" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "fecha_apertura" TIMESTAMP(3) NOT NULL,
    "fecha_limite" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'programado',

    CONSTRAINT "periodo_informe_pkey" PRIMARY KEY ("id_periodo_informe")
);

-- CreateTable
CREATE TABLE "informe_avance" (
    "id_informe_avance" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_periodo_informe" INTEGER NOT NULL,
    "radicado_por" INTEGER NOT NULL,
    "fecha_radicacion" TIMESTAMP(3),
    "porcentaje_avance" DECIMAL(5,2),
    "observaciones_generales" TEXT,
    "archivo_generado" TEXT,
    "archivo_firmado" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "revisado_por" INTEGER,
    "fecha_revision" TIMESTAMP(3),
    "observacion_revision" TEXT,

    CONSTRAINT "informe_avance_pkey" PRIMARY KEY ("id_informe_avance")
);

-- CreateTable
CREATE TABLE "informe_avance_actividad" (
    "id_informe_actividad" SERIAL NOT NULL,
    "id_informe_avance" INTEGER NOT NULL,
    "id_actividad" INTEGER NOT NULL,
    "id_meta" INTEGER,
    "responsable" INTEGER NOT NULL,
    "estado_actividad" TEXT NOT NULL,
    "porcentaje_cumplimiento" INTEGER NOT NULL DEFAULT 0,
    "observacion" TEXT,

    CONSTRAINT "informe_avance_actividad_pkey" PRIMARY KEY ("id_informe_actividad")
);

-- CreateTable
CREATE TABLE "evidencia_avance" (
    "id_evidencia" SERIAL NOT NULL,
    "id_informe_actividad" INTEGER NOT NULL,
    "tipo_evidencia" TEXT NOT NULL,
    "archivo" TEXT,
    "enlace" TEXT,
    "descripcion" TEXT,
    "cargado_por" INTEGER NOT NULL,
    "fecha_carga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencia_avance_pkey" PRIMARY KEY ("id_evidencia")
);

-- CreateTable
CREATE TABLE "seguimiento_etico" (
    "id_seguimiento_etico" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "requiere_seguimiento" BOOLEAN NOT NULL DEFAULT false,
    "justificacion" TEXT,
    "periodicidad_meses" INTEGER,
    "definido_por" INTEGER NOT NULL,
    "fecha_definicion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'activo',

    CONSTRAINT "seguimiento_etico_pkey" PRIMARY KEY ("id_seguimiento_etico")
);

-- CreateTable
CREATE TABLE "reporte_seguimiento_etico" (
    "id_reporte_etico" SERIAL NOT NULL,
    "id_seguimiento_etico" INTEGER NOT NULL,
    "numero_reporte" INTEGER NOT NULL,
    "fecha_limite" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "novedades_eticas" TEXT,
    "evidencia" TEXT,
    "radicado_por" INTEGER,
    "fecha_radicacion" TIMESTAMP(3),
    "concepto" TEXT,
    "observacion_comite" TEXT,
    "conceptuado_por" INTEGER,
    "fecha_concepto" TIMESTAMP(3),

    CONSTRAINT "reporte_seguimiento_etico_pkey" PRIMARY KEY ("id_reporte_etico")
);

-- CreateTable
CREATE TABLE "tipo_novedad" (
    "id_tipo_novedad" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "afecta_fechas" BOOLEAN NOT NULL DEFAULT false,
    "afecta_participantes" BOOLEAN NOT NULL DEFAULT false,
    "afecta_productos" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipo_novedad_pkey" PRIMARY KEY ("id_tipo_novedad")
);

-- CreateTable
CREATE TABLE "novedad_proyecto" (
    "id_novedad" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_tipo_novedad" INTEGER NOT NULL,
    "solicitada_por" INTEGER NOT NULL,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "soporte" TEXT,
    "nueva_fecha_fin" TIMESTAMP(3),
    "tiempo_prorroga_meses" INTEGER,
    "acto_administrativo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "decidido_por" INTEGER,
    "fecha_decision" TIMESTAMP(3),
    "observacion_decision" TEXT,

    CONSTRAINT "novedad_proyecto_pkey" PRIMARY KEY ("id_novedad")
);

-- CreateTable
CREATE TABLE "novedad_participante" (
    "id_novedad_participante" SERIAL NOT NULL,
    "id_novedad" INTEGER NOT NULL,
    "id_usuarioproyecto_saliente" INTEGER NOT NULL,
    "id_usuarioproyecto_entrante" INTEGER,
    "motivo" TEXT,
    "fecha_efectiva" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "novedad_participante_pkey" PRIMARY KEY ("id_novedad_participante")
);

-- CreateTable
CREATE TABLE "informe_final" (
    "id_informe_final" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "resumen_ejecucion" TEXT,
    "observaciones_objetivos" TEXT,
    "actividades_estudiantes" TEXT,
    "evidencias_estudiantes" TEXT,
    "porcentaje_cumplimiento" DECIMAL(5,2),
    "radicado_por" INTEGER NOT NULL,
    "fecha_radicacion" TIMESTAMP(3),
    "archivo_generado" TEXT,
    "archivo_firmado" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "revisado_por" INTEGER,
    "fecha_revision" TIMESTAMP(3),
    "observacion_revision" TEXT,

    CONSTRAINT "informe_final_pkey" PRIMARY KEY ("id_informe_final")
);

-- CreateTable
CREATE TABLE "cumplimiento_objetivo" (
    "id_cumplimiento" SERIAL NOT NULL,
    "id_informe_final" INTEGER NOT NULL,
    "id_objetivo" INTEGER NOT NULL,
    "descripcion_cumplimiento" TEXT NOT NULL,
    "cumplido" BOOLEAN NOT NULL DEFAULT false,
    "observacion" TEXT,

    CONSTRAINT "cumplimiento_objetivo_pkey" PRIMARY KEY ("id_cumplimiento")
);

-- CreateTable
CREATE TABLE "resultado_producto" (
    "id_resultado_producto" SERIAL NOT NULL,
    "id_proyecto_producto" INTEGER NOT NULL,
    "id_informe_final" INTEGER NOT NULL,
    "cantidad_proyectada" INTEGER NOT NULL,
    "cantidad_obtenida" INTEGER NOT NULL,
    "soporte_link" TEXT,
    "observaciones" TEXT,
    "reportado_en_cierre" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "resultado_producto_pkey" PRIMARY KEY ("id_resultado_producto")
);

-- CreateTable
CREATE TABLE "equipo_adquirido" (
    "id_equipo" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "denominacion" TEXT NOT NULL,
    "fecha_adquisicion" TIMESTAMP(3),
    "estado" TEXT,
    "codigo_inventario" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "equipo_adquirido_pkey" PRIMARY KEY ("id_equipo")
);

-- CreateTable
CREATE TABLE "material_bibliografico" (
    "id_material" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "nombre_material" TEXT NOT NULL,
    "fecha_adquisicion" TIMESTAMP(3),
    "isbn_issn" TEXT,
    "codigo_inventario" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "material_bibliografico_pkey" PRIMARY KEY ("id_material")
);

-- CreateTable
CREATE TABLE "participacion_estudiante" (
    "id_participacion" SERIAL NOT NULL,
    "id_informe_final" INTEGER NOT NULL,
    "id_usuarioproyecto" INTEGER NOT NULL,
    "codigo_estudiantil" TEXT,
    "rol_estudiante" TEXT,
    "actividades_desarrolladas" TEXT,
    "evidencias" TEXT,

    CONSTRAINT "participacion_estudiante_pkey" PRIMARY KEY ("id_participacion")
);

-- CreateTable
CREATE TABLE "acta_cierre" (
    "id_acta_cierre" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_informe_final" INTEGER NOT NULL,
    "fecha_inicio_real" TIMESTAMP(3) NOT NULL,
    "fecha_finalizacion_real" TIMESTAMP(3) NOT NULL,
    "duracion_real_meses" INTEGER NOT NULL,
    "paz_y_salvo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "ciudad_firma" TEXT,
    "fecha_acta" TIMESTAMP(3) NOT NULL,
    "archivo_generado" TEXT,
    "archivo_firmado" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'en elaboracion',
    "generada_por" INTEGER NOT NULL,
    "fecha_generacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acta_cierre_pkey" PRIMARY KEY ("id_acta_cierre")
);

-- CreateTable
CREATE TABLE "reapertura_proyecto" (
    "id_reapertura" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_acta_cierre" INTEGER NOT NULL,
    "causal" TEXT NOT NULL,
    "autorizado_por" INTEGER NOT NULL,
    "fecha_reapertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_nuevo_cierre" TIMESTAMP(3),

    CONSTRAINT "reapertura_proyecto_pkey" PRIMARY KEY ("id_reapertura")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipo_articulacion_nombre_key" ON "tipo_articulacion"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "concepto_rubro_nombre_key" ON "concepto_rubro"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "seguimiento_etico_id_proyecto_key" ON "seguimiento_etico"("id_proyecto");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_novedad_nombre_key" ON "tipo_novedad"("nombre");

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_id_tipo_articulacion_fkey" FOREIGN KEY ("id_tipo_articulacion") REFERENCES "tipo_articulacion"("id_tipo_articulacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_proyecto" ADD CONSTRAINT "usuario_proyecto_id_linea_investigacion_fkey" FOREIGN KEY ("id_linea_investigacion") REFERENCES "lineas_investigacion"("id_linea") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_actividad" ADD CONSTRAINT "cronograma_actividad_id_objetivo_fkey" FOREIGN KEY ("id_objetivo") REFERENCES "objetivos"("id_objetivo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_actividad" ADD CONSTRAINT "cronograma_actividad_id_meta_fkey" FOREIGN KEY ("id_meta") REFERENCES "meta_objetivo"("id_meta") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acta_inicio" ADD CONSTRAINT "acta_inicio_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acta_inicio" ADD CONSTRAINT "acta_inicio_generada_por_fkey" FOREIGN KEY ("generada_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromiso_aceptacion" ADD CONSTRAINT "compromiso_aceptacion_id_acta_inicio_fkey" FOREIGN KEY ("id_acta_inicio") REFERENCES "acta_inicio"("id_acta_inicio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromiso_aceptacion" ADD CONSTRAINT "compromiso_aceptacion_id_usuarioproyecto_fkey" FOREIGN KEY ("id_usuarioproyecto") REFERENCES "usuario_proyecto"("id_usuarioproyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firma_documento" ADD CONSTRAINT "firma_documento_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financiacion_vigencia" ADD CONSTRAINT "financiacion_vigencia_id_financiacion_fkey" FOREIGN KEY ("id_financiacion") REFERENCES "financiacion"("id_financiacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_rubro" ADD CONSTRAINT "solicitud_rubro_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_rubro" ADD CONSTRAINT "solicitud_rubro_id_concepto_rubro_fkey" FOREIGN KEY ("id_concepto_rubro") REFERENCES "concepto_rubro"("id_concepto_rubro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_rubro" ADD CONSTRAINT "solicitud_rubro_id_financiacion_vigencia_fkey" FOREIGN KEY ("id_financiacion_vigencia") REFERENCES "financiacion_vigencia"("id_financiacion_vigencia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_rubro" ADD CONSTRAINT "solicitud_rubro_solicitado_por_fkey" FOREIGN KEY ("solicitado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_rubro" ADD CONSTRAINT "solicitud_rubro_decidido_por_fkey" FOREIGN KEY ("decidido_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecucion_presupuestal" ADD CONSTRAINT "ejecucion_presupuestal_id_solicitud_rubro_fkey" FOREIGN KEY ("id_solicitud_rubro") REFERENCES "solicitud_rubro"("id_solicitud_rubro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecucion_presupuestal" ADD CONSTRAINT "ejecucion_presupuestal_id_financiacion_vigencia_fkey" FOREIGN KEY ("id_financiacion_vigencia") REFERENCES "financiacion_vigencia"("id_financiacion_vigencia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecucion_presupuestal" ADD CONSTRAINT "ejecucion_presupuestal_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_objetivo" ADD CONSTRAINT "meta_objetivo_id_objetivo_fkey" FOREIGN KEY ("id_objetivo") REFERENCES "objetivos"("id_objetivo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodo_informe" ADD CONSTRAINT "periodo_informe_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_avance" ADD CONSTRAINT "informe_avance_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_avance" ADD CONSTRAINT "informe_avance_id_periodo_informe_fkey" FOREIGN KEY ("id_periodo_informe") REFERENCES "periodo_informe"("id_periodo_informe") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_avance" ADD CONSTRAINT "informe_avance_radicado_por_fkey" FOREIGN KEY ("radicado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_avance" ADD CONSTRAINT "informe_avance_revisado_por_fkey" FOREIGN KEY ("revisado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_avance_actividad" ADD CONSTRAINT "informe_avance_actividad_id_informe_avance_fkey" FOREIGN KEY ("id_informe_avance") REFERENCES "informe_avance"("id_informe_avance") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_avance_actividad" ADD CONSTRAINT "informe_avance_actividad_id_actividad_fkey" FOREIGN KEY ("id_actividad") REFERENCES "cronograma_actividad"("id_actividad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_avance_actividad" ADD CONSTRAINT "informe_avance_actividad_id_meta_fkey" FOREIGN KEY ("id_meta") REFERENCES "meta_objetivo"("id_meta") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_avance_actividad" ADD CONSTRAINT "informe_avance_actividad_responsable_fkey" FOREIGN KEY ("responsable") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia_avance" ADD CONSTRAINT "evidencia_avance_id_informe_actividad_fkey" FOREIGN KEY ("id_informe_actividad") REFERENCES "informe_avance_actividad"("id_informe_actividad") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia_avance" ADD CONSTRAINT "evidencia_avance_cargado_por_fkey" FOREIGN KEY ("cargado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_etico" ADD CONSTRAINT "seguimiento_etico_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_etico" ADD CONSTRAINT "seguimiento_etico_definido_por_fkey" FOREIGN KEY ("definido_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_seguimiento_etico" ADD CONSTRAINT "reporte_seguimiento_etico_id_seguimiento_etico_fkey" FOREIGN KEY ("id_seguimiento_etico") REFERENCES "seguimiento_etico"("id_seguimiento_etico") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_seguimiento_etico" ADD CONSTRAINT "reporte_seguimiento_etico_radicado_por_fkey" FOREIGN KEY ("radicado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_seguimiento_etico" ADD CONSTRAINT "reporte_seguimiento_etico_conceptuado_por_fkey" FOREIGN KEY ("conceptuado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedad_proyecto" ADD CONSTRAINT "novedad_proyecto_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedad_proyecto" ADD CONSTRAINT "novedad_proyecto_id_tipo_novedad_fkey" FOREIGN KEY ("id_tipo_novedad") REFERENCES "tipo_novedad"("id_tipo_novedad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedad_proyecto" ADD CONSTRAINT "novedad_proyecto_solicitada_por_fkey" FOREIGN KEY ("solicitada_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedad_proyecto" ADD CONSTRAINT "novedad_proyecto_decidido_por_fkey" FOREIGN KEY ("decidido_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedad_participante" ADD CONSTRAINT "novedad_participante_id_novedad_fkey" FOREIGN KEY ("id_novedad") REFERENCES "novedad_proyecto"("id_novedad") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedad_participante" ADD CONSTRAINT "novedad_participante_id_usuarioproyecto_saliente_fkey" FOREIGN KEY ("id_usuarioproyecto_saliente") REFERENCES "usuario_proyecto"("id_usuarioproyecto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedad_participante" ADD CONSTRAINT "novedad_participante_id_usuarioproyecto_entrante_fkey" FOREIGN KEY ("id_usuarioproyecto_entrante") REFERENCES "usuario_proyecto"("id_usuarioproyecto") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_final" ADD CONSTRAINT "informe_final_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_final" ADD CONSTRAINT "informe_final_radicado_por_fkey" FOREIGN KEY ("radicado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_final" ADD CONSTRAINT "informe_final_revisado_por_fkey" FOREIGN KEY ("revisado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cumplimiento_objetivo" ADD CONSTRAINT "cumplimiento_objetivo_id_informe_final_fkey" FOREIGN KEY ("id_informe_final") REFERENCES "informe_final"("id_informe_final") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cumplimiento_objetivo" ADD CONSTRAINT "cumplimiento_objetivo_id_objetivo_fkey" FOREIGN KEY ("id_objetivo") REFERENCES "objetivos"("id_objetivo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_producto" ADD CONSTRAINT "resultado_producto_id_proyecto_producto_fkey" FOREIGN KEY ("id_proyecto_producto") REFERENCES "proyecto_producto"("id_proyecto_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_producto" ADD CONSTRAINT "resultado_producto_id_informe_final_fkey" FOREIGN KEY ("id_informe_final") REFERENCES "informe_final"("id_informe_final") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipo_adquirido" ADD CONSTRAINT "equipo_adquirido_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_bibliografico" ADD CONSTRAINT "material_bibliografico_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacion_estudiante" ADD CONSTRAINT "participacion_estudiante_id_informe_final_fkey" FOREIGN KEY ("id_informe_final") REFERENCES "informe_final"("id_informe_final") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacion_estudiante" ADD CONSTRAINT "participacion_estudiante_id_usuarioproyecto_fkey" FOREIGN KEY ("id_usuarioproyecto") REFERENCES "usuario_proyecto"("id_usuarioproyecto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acta_cierre" ADD CONSTRAINT "acta_cierre_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acta_cierre" ADD CONSTRAINT "acta_cierre_id_informe_final_fkey" FOREIGN KEY ("id_informe_final") REFERENCES "informe_final"("id_informe_final") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acta_cierre" ADD CONSTRAINT "acta_cierre_generada_por_fkey" FOREIGN KEY ("generada_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reapertura_proyecto" ADD CONSTRAINT "reapertura_proyecto_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reapertura_proyecto" ADD CONSTRAINT "reapertura_proyecto_id_acta_cierre_fkey" FOREIGN KEY ("id_acta_cierre") REFERENCES "acta_cierre"("id_acta_cierre") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reapertura_proyecto" ADD CONSTRAINT "reapertura_proyecto_autorizado_por_fkey" FOREIGN KEY ("autorizado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
