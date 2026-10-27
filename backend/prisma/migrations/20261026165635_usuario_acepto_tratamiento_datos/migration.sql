-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "acepto_tratamiento_datos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fecha_aceptacion_tratamiento_datos" TIMESTAMP(3);
