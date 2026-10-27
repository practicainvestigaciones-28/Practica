-- Firma del acta de inicio con código de verificación enviado al correo personal del investigador.
ALTER TABLE "acta_inicio_firma"
ADD COLUMN "correo_personal" TEXT,
ADD COLUMN "codigo_hash" TEXT,
ADD COLUMN "codigo_expira" TIMESTAMP(3),
ADD COLUMN "codigo_enviado" TIMESTAMP(3),
ADD COLUMN "codigo_intentos" INTEGER NOT NULL DEFAULT 0;
