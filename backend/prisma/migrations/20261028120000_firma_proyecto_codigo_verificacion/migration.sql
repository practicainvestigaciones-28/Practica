-- Firma del registro de proyecto (Principal y Co-investigador) con código de verificación de 6 dígitos.
ALTER TABLE "firma_proyecto"
ADD COLUMN "codigo_hash" TEXT,
ADD COLUMN "codigo_expira" TIMESTAMP(3),
ADD COLUMN "codigo_enviado" TIMESTAMP(3),
ADD COLUMN "codigo_intentos" INTEGER NOT NULL DEFAULT 0;
