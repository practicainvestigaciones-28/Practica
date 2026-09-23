-- Agregar campo activo a periodo, para poder activar/desactivar sin borrar
-- (hay cronogramas que ya lo referencian)

ALTER TABLE "periodo" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;
