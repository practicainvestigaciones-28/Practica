/*
  Warnings:

  - You are about to drop the column `equipos` on the `informe_final` table. All the data in the column will be lost.
  - You are about to drop the column `materiales` on the `informe_final` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "informe_final" DROP COLUMN "equipos",
DROP COLUMN "materiales";
