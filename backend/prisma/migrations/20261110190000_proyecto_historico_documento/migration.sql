-- PDF originales de los proyectos finalizados (anteriores al sistema).
CREATE TABLE "proyecto_historico_documento" (
    "id_documento_historico" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero_periodo" INTEGER,
    "archivo" TEXT NOT NULL,
    "nombre_original" TEXT NOT NULL,
    "cargado_por" INTEGER NOT NULL,
    "fecha_carga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proyecto_historico_documento_pkey" PRIMARY KEY ("id_documento_historico")
);

CREATE UNIQUE INDEX "proyecto_historico_documento_id_proyecto_tipo_numero_periodo_key" ON "proyecto_historico_documento"("id_proyecto", "tipo", "numero_periodo");
ALTER TABLE "proyecto_historico_documento" ADD CONSTRAINT "proyecto_historico_documento_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyecto_historico_documento" ADD CONSTRAINT "proyecto_historico_documento_cargado_por_fkey" FOREIGN KEY ("cargado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
