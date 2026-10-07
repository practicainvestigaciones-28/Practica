-- AlterTable
ALTER TABLE "grupo_investigacion" ADD COLUMN     "id_lider" INTEGER;

-- AddForeignKey
ALTER TABLE "grupo_investigacion" ADD CONSTRAINT "grupo_investigacion_id_lider_fkey" FOREIGN KEY ("id_lider") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
