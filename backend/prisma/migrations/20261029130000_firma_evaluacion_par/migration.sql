-- Firma electrónica del Par Evaluador sobre su calificación (código de 6 dígitos al correo).
CREATE TABLE "firma_evaluacion_par" (
    "id_firma_par" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_etapa" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_evaluacion" INTEGER,
    "codigo_hash" TEXT,
    "codigo_expira" TIMESTAMP(3),
    "codigo_enviado" TIMESTAMP(3),
    "codigo_intentos" INTEGER NOT NULL DEFAULT 0,
    "correo_verificacion" TEXT,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_firma" TIMESTAMP(3),
    "id_transaccion" TEXT,
    "hash_firma" TEXT,
    "ip_firma" TEXT,
    "agente_firma" TEXT,
    "creado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "firma_evaluacion_par_pkey" PRIMARY KEY ("id_firma_par")
);

CREATE UNIQUE INDEX "firma_evaluacion_par_id_evaluacion_key" ON "firma_evaluacion_par"("id_evaluacion");
CREATE UNIQUE INDEX "firma_evaluacion_par_id_transaccion_key" ON "firma_evaluacion_par"("id_transaccion");
CREATE INDEX "firma_evaluacion_par_id_proyecto_id_etapa_id_usuario_idx" ON "firma_evaluacion_par"("id_proyecto", "id_etapa", "id_usuario");

ALTER TABLE "firma_evaluacion_par" ADD CONSTRAINT "firma_evaluacion_par_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "firma_evaluacion_par" ADD CONSTRAINT "firma_evaluacion_par_id_evaluacion_fkey" FOREIGN KEY ("id_evaluacion") REFERENCES "evaluacion_etapa"("id_evaluacion") ON DELETE CASCADE ON UPDATE CASCADE;
