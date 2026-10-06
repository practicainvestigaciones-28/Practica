-- AlterTable
ALTER TABLE "lineas_investigacion" ADD COLUMN     "id_grupo" INTEGER;

-- AddForeignKey
ALTER TABLE "lineas_investigacion" ADD CONSTRAINT "lineas_investigacion_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo_investigacion"("id_grupo") ON DELETE SET NULL ON UPDATE CASCADE;
