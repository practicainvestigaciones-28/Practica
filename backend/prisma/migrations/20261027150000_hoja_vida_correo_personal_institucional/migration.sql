-- Hoja de vida: correo institucional y correo personal de quien firma.
ALTER TABLE "hoja_vida"
ADD COLUMN "correo_institucional" TEXT,
ADD COLUMN "correo_personal" TEXT;

-- El correo que ya tenían las hojas de vida pasa a ser el institucional.
UPDATE "hoja_vida" SET "correo_institucional" = "correo" WHERE "correo" IS NOT NULL;
