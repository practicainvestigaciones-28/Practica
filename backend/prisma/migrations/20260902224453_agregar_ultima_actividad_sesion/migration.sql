-- AlterTable
ALTER TABLE "sesiones_usuario" ADD COLUMN     "ultima_actividad" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
