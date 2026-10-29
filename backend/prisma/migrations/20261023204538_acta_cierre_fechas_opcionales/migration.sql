-- AlterTable
ALTER TABLE "acta_cierre" ALTER COLUMN "fecha_inicio_real" DROP NOT NULL,
ALTER COLUMN "fecha_finalizacion_real" DROP NOT NULL,
ALTER COLUMN "duracion_real_meses" DROP NOT NULL,
ALTER COLUMN "fecha_acta" DROP NOT NULL;
