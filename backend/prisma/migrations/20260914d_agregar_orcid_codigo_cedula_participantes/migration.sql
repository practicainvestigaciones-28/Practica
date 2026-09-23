-- Agregar orcid, google_academico y codigo_estudiantil a usuario_proyecto,
-- y cedula a informacion_egresado. Se usa IF NOT EXISTS porque esta base de
-- desarrollo ya tiene "codigo_estudiantil" aplicado por otra rama
-- (etapa-seguimiento-v2) fuera del historial de migraciones de esta rama.

ALTER TABLE "usuario_proyecto" ADD COLUMN IF NOT EXISTS "orcid" TEXT;
ALTER TABLE "usuario_proyecto" ADD COLUMN IF NOT EXISTS "google_academico" TEXT;
ALTER TABLE "usuario_proyecto" ADD COLUMN IF NOT EXISTS "codigo_estudiantil" TEXT;

ALTER TABLE "informacion_egresado" ADD COLUMN IF NOT EXISTS "cedula" TEXT;
