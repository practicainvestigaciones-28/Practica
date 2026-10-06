/*
  Warnings:

  - You are about to drop the column `id_ods` on the `proyecto_grupo` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "proyecto_grupo" DROP CONSTRAINT "proyecto_grupo_id_ods_fkey";

-- AlterTable
ALTER TABLE "proyecto_grupo" DROP COLUMN "id_ods";

-- AlterTable
ALTER TABLE "usuario_proyecto" ADD COLUMN     "horas_semanales" INTEGER;

-- CreateTable
CREATE TABLE "proyecto_grupo_ods" (
    "id_proyecto_grupo_ods" SERIAL NOT NULL,
    "id_proyecto_grupo" INTEGER NOT NULL,
    "id_ods" INTEGER NOT NULL,

    CONSTRAINT "proyecto_grupo_ods_pkey" PRIMARY KEY ("id_proyecto_grupo_ods")
);

-- CreateIndex
CREATE UNIQUE INDEX "proyecto_grupo_ods_id_proyecto_grupo_id_ods_key" ON "proyecto_grupo_ods"("id_proyecto_grupo", "id_ods");

-- AddForeignKey
ALTER TABLE "proyecto_grupo_ods" ADD CONSTRAINT "proyecto_grupo_ods_id_proyecto_grupo_fkey" FOREIGN KEY ("id_proyecto_grupo") REFERENCES "proyecto_grupo"("id_proyecto_grupo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_grupo_ods" ADD CONSTRAINT "proyecto_grupo_ods_id_ods_fkey" FOREIGN KEY ("id_ods") REFERENCES "ods"("id_ods") ON DELETE RESTRICT ON UPDATE CASCADE;
