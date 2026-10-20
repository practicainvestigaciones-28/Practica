-- DropForeignKey
ALTER TABLE "firma_proyecto" DROP CONSTRAINT "firma_proyecto_id_usuarioproyecto_fkey";

-- AlterTable
ALTER TABLE "firma_proyecto" ALTER COLUMN "id_usuarioproyecto" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "firma_proyecto" ADD CONSTRAINT "firma_proyecto_id_usuarioproyecto_fkey" FOREIGN KEY ("id_usuarioproyecto") REFERENCES "usuario_proyecto"("id_usuarioproyecto") ON DELETE SET NULL ON UPDATE CASCADE;
