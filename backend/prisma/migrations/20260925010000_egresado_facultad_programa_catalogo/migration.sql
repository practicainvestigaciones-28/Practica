-- AlterTable
ALTER TABLE "informacion_egresado" ADD COLUMN IF NOT EXISTS "id_facultad" INTEGER,
ADD COLUMN IF NOT EXISTS "id_programa" INTEGER;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'informacion_egresado_id_facultad_fkey') THEN
    ALTER TABLE "informacion_egresado" ADD CONSTRAINT "informacion_egresado_id_facultad_fkey" FOREIGN KEY ("id_facultad") REFERENCES "facultad"("id_facultad") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'informacion_egresado_id_programa_fkey') THEN
    ALTER TABLE "informacion_egresado" ADD CONSTRAINT "informacion_egresado_id_programa_fkey" FOREIGN KEY ("id_programa") REFERENCES "programas"("id_programa") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
