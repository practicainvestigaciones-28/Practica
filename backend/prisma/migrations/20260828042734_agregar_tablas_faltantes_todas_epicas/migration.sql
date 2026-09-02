-- CreateTable
CREATE TABLE "estado" (
    "id_estado" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "estado_pkey" PRIMARY KEY ("id_estado")
);

-- CreateTable
CREATE TABLE "transiciones_etapa" (
    "id_transicion" SERIAL NOT NULL,
    "id_etapa_origen" INTEGER NOT NULL,
    "id_etapa_destino" INTEGER NOT NULL,

    CONSTRAINT "transiciones_etapa_pkey" PRIMARY KEY ("id_transicion")
);

-- CreateTable
CREATE TABLE "asignaciones_revision" (
    "id_asignacion" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "asignado_a" INTEGER,
    "id_etapa" INTEGER NOT NULL,
    "id_estado" INTEGER NOT NULL,
    "asignado_por" INTEGER NOT NULL,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_limite" TIMESTAMP(3),
    "fecha_finalizacion" TIMESTAMP(3),

    CONSTRAINT "asignaciones_revision_pkey" PRIMARY KEY ("id_asignacion")
);

-- CreateTable
CREATE TABLE "historial_etapa_estado_proyecto" (
    "id_historial" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_etapa" INTEGER NOT NULL,
    "id_estados" INTEGER NOT NULL,
    "cambiado_por" INTEGER NOT NULL,
    "fecha_cambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacion" TEXT,

    CONSTRAINT "historial_etapa_estado_proyecto_pkey" PRIMARY KEY ("id_historial")
);

-- CreateTable
CREATE TABLE "evaluacion_etapa" (
    "id_evaluacion" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_etapa" INTEGER NOT NULL,
    "evaluado_por" INTEGER NOT NULL,
    "resultado" INTEGER NOT NULL,
    "comentarios" TEXT,
    "puntaje" DECIMAL(5,2),
    "formato_evaluacion" TEXT,
    "fecha_evaluacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluacion_etapa_pkey" PRIMARY KEY ("id_evaluacion")
);

-- CreateTable
CREATE TABLE "referencias" (
    "id_referencia" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "referencia" TEXT NOT NULL,

    CONSTRAINT "referencias_pkey" PRIMARY KEY ("id_referencia")
);

-- CreateTable
CREATE TABLE "reclamaciones" (
    "id_reclamacion" SERIAL NOT NULL,
    "id_evaluacion" INTEGER NOT NULL,
    "id_usuario_reclamante" INTEGER NOT NULL,
    "id_usuario_respuesta" INTEGER,
    "motivo_reclamacion" TEXT NOT NULL,
    "respuesta" TEXT,
    "fecha_reclamacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_respuesta" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'pendiente',

    CONSTRAINT "reclamaciones_pkey" PRIMARY KEY ("id_reclamacion")
);

-- CreateTable
CREATE TABLE "observaciones_proyecto" (
    "id_observacion" SERIAL NOT NULL,
    "proyecto_documento" INTEGER NOT NULL,
    "id_etapa" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "observacion" TEXT NOT NULL,
    "archivo_adjunto" TEXT,
    "fecha_observacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observaciones_proyecto_pkey" PRIMARY KEY ("id_observacion")
);

-- CreateTable
CREATE TABLE "datos_bancarios_par" (
    "id_dato_bancario" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "banco" TEXT NOT NULL,
    "tipo_cuenta" TEXT NOT NULL,
    "numero_cuenta" TEXT NOT NULL,
    "titular" TEXT NOT NULL,
    "documento_titular" TEXT NOT NULL,

    CONSTRAINT "datos_bancarios_par_pkey" PRIMARY KEY ("id_dato_bancario")
);

-- CreateTable
CREATE TABLE "pago_par" (
    "id_pago" SERIAL NOT NULL,
    "id_evaluacion" INTEGER NOT NULL,
    "id_dato_bancario" INTEGER NOT NULL,
    "registrado_por" INTEGER NOT NULL,
    "valor_pago" DECIMAL(14,2) NOT NULL,
    "comprobante_pago" TEXT,
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pago_par_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "sesiones_usuario" (
    "id_sesion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(3),
    "ip" TEXT,
    "dispositivo" TEXT,
    "navegador" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sesiones_usuario_pkey" PRIMARY KEY ("id_sesion")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id_notificacion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fecha_notificacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enlace" TEXT,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "estado_nombre_key" ON "estado"("nombre");

-- AddForeignKey
ALTER TABLE "transiciones_etapa" ADD CONSTRAINT "transiciones_etapa_id_etapa_origen_fkey" FOREIGN KEY ("id_etapa_origen") REFERENCES "etapas"("id_etapa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transiciones_etapa" ADD CONSTRAINT "transiciones_etapa_id_etapa_destino_fkey" FOREIGN KEY ("id_etapa_destino") REFERENCES "etapas"("id_etapa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_revision" ADD CONSTRAINT "asignaciones_revision_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_revision" ADD CONSTRAINT "asignaciones_revision_asignado_a_fkey" FOREIGN KEY ("asignado_a") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_revision" ADD CONSTRAINT "asignaciones_revision_id_etapa_fkey" FOREIGN KEY ("id_etapa") REFERENCES "etapas"("id_etapa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_revision" ADD CONSTRAINT "asignaciones_revision_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_revision" ADD CONSTRAINT "asignaciones_revision_asignado_por_fkey" FOREIGN KEY ("asignado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_etapa_estado_proyecto" ADD CONSTRAINT "historial_etapa_estado_proyecto_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_etapa_estado_proyecto" ADD CONSTRAINT "historial_etapa_estado_proyecto_id_etapa_fkey" FOREIGN KEY ("id_etapa") REFERENCES "etapas"("id_etapa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_etapa_estado_proyecto" ADD CONSTRAINT "historial_etapa_estado_proyecto_id_estados_fkey" FOREIGN KEY ("id_estados") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_etapa_estado_proyecto" ADD CONSTRAINT "historial_etapa_estado_proyecto_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion_etapa" ADD CONSTRAINT "evaluacion_etapa_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion_etapa" ADD CONSTRAINT "evaluacion_etapa_id_etapa_fkey" FOREIGN KEY ("id_etapa") REFERENCES "etapas"("id_etapa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion_etapa" ADD CONSTRAINT "evaluacion_etapa_evaluado_por_fkey" FOREIGN KEY ("evaluado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion_etapa" ADD CONSTRAINT "evaluacion_etapa_resultado_fkey" FOREIGN KEY ("resultado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencias" ADD CONSTRAINT "referencias_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamaciones" ADD CONSTRAINT "reclamaciones_id_evaluacion_fkey" FOREIGN KEY ("id_evaluacion") REFERENCES "evaluacion_etapa"("id_evaluacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamaciones" ADD CONSTRAINT "reclamaciones_id_usuario_reclamante_fkey" FOREIGN KEY ("id_usuario_reclamante") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamaciones" ADD CONSTRAINT "reclamaciones_id_usuario_respuesta_fkey" FOREIGN KEY ("id_usuario_respuesta") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones_proyecto" ADD CONSTRAINT "observaciones_proyecto_proyecto_documento_fkey" FOREIGN KEY ("proyecto_documento") REFERENCES "proyecto_documento"("id_proyecto_documento") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones_proyecto" ADD CONSTRAINT "observaciones_proyecto_id_etapa_fkey" FOREIGN KEY ("id_etapa") REFERENCES "etapas"("id_etapa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones_proyecto" ADD CONSTRAINT "observaciones_proyecto_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datos_bancarios_par" ADD CONSTRAINT "datos_bancarios_par_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_par" ADD CONSTRAINT "pago_par_id_evaluacion_fkey" FOREIGN KEY ("id_evaluacion") REFERENCES "evaluacion_etapa"("id_evaluacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_par" ADD CONSTRAINT "pago_par_id_dato_bancario_fkey" FOREIGN KEY ("id_dato_bancario") REFERENCES "datos_bancarios_par"("id_dato_bancario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_par" ADD CONSTRAINT "pago_par_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_usuario" ADD CONSTRAINT "sesiones_usuario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
