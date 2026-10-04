/*
  Warnings:

  - Added the required column `etapa_rechazo` to the `reclamaciones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_proyecto` to the `reclamaciones` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "reclamaciones" ADD COLUMN     "etapa_rechazo" TEXT NOT NULL,
ADD COLUMN     "id_proyecto" INTEGER NOT NULL,
ALTER COLUMN "id_evaluacion" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "reclamaciones" ADD CONSTRAINT "reclamaciones_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;
