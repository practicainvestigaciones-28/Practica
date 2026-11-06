-- AlterTable
ALTER TABLE "usuario_proyecto" ADD COLUMN     "id_programa" INTEGER;

-- AddForeignKey
ALTER TABLE "usuario_proyecto" ADD CONSTRAINT "usuario_proyecto_id_programa_fkey" FOREIGN KEY ("id_programa") REFERENCES "programas"("id_programa") ON DELETE SET NULL ON UPDATE CASCADE;
