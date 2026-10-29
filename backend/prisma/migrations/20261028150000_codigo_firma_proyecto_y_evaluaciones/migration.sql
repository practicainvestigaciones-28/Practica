-- Código de verificación en todas las firmas: registro del proyecto y evaluaciones.
ALTER TABLE "codigo_verificacion_firma" ADD COLUMN "verificado_en" TIMESTAMP(3);

ALTER TABLE "firma_proyecto"
ADD COLUMN "codigo_hash" TEXT,
ADD COLUMN "codigo_expira" TIMESTAMP(3),
ADD COLUMN "codigo_enviado" TIMESTAMP(3),
ADD COLUMN "codigo_intentos" INTEGER NOT NULL DEFAULT 0;
