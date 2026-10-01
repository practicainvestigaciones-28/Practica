-- AlterTable
ALTER TABLE "datos_bancarios_par" ADD COLUMN     "cedula_path" TEXT,
ADD COLUMN     "certificacion_bancaria_path" TEXT,
ADD COLUMN     "rut_path" TEXT,
ALTER COLUMN "banco" DROP NOT NULL,
ALTER COLUMN "tipo_cuenta" DROP NOT NULL,
ALTER COLUMN "numero_cuenta" DROP NOT NULL,
ALTER COLUMN "titular" DROP NOT NULL,
ALTER COLUMN "documento_titular" DROP NOT NULL;
