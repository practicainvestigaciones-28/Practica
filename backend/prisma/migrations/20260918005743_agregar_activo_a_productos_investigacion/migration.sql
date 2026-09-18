-- AlterTable
ALTER TABLE "categoria_producto" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "subcategoria_producto" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tipo_producto" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;
