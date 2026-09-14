-- Agregar campos faltantes a hoja_vida:
-- nombres, apellidos, correo, orcid, google_academico

ALTER TABLE "hoja_vida" ADD COLUMN "nombres" TEXT;
ALTER TABLE "hoja_vida" ADD COLUMN "apellidos" TEXT;
ALTER TABLE "hoja_vida" ADD COLUMN "correo" TEXT;
ALTER TABLE "hoja_vida" ADD COLUMN "orcid" TEXT;
ALTER TABLE "hoja_vida" ADD COLUMN "google_academico" TEXT;
