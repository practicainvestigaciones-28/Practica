-- DropForeignKey
ALTER TABLE "usuario_proyecto" DROP CONSTRAINT "usuario_proyecto_participante_fkey";

-- AlterTable
ALTER TABLE "usuario_proyecto" ADD COLUMN     "apellido_manual" TEXT,
ADD COLUMN     "correo_manual" TEXT,
ADD COLUMN     "nombre_manual" TEXT,
ALTER COLUMN "participante" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "usuario_proyecto" ADD CONSTRAINT "usuario_proyecto_participante_fkey" FOREIGN KEY ("participante") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
