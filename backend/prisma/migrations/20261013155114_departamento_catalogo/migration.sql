-- DropForeignKey
ALTER TABLE "programas" DROP CONSTRAINT "programas_id_facultad_fkey";

-- AlterTable
ALTER TABLE "grupo_investigacion" ADD COLUMN     "id_departamento" INTEGER;

-- AlterTable
ALTER TABLE "programas" ADD COLUMN     "id_departamento" INTEGER,
ALTER COLUMN "id_facultad" DROP NOT NULL;

-- CreateTable
CREATE TABLE "departamento" (
    "id_departamento" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "departamento_pkey" PRIMARY KEY ("id_departamento")
);

-- CreateIndex
CREATE UNIQUE INDEX "departamento_nombre_key" ON "departamento"("nombre");

-- AddForeignKey
ALTER TABLE "programas" ADD CONSTRAINT "programas_id_facultad_fkey" FOREIGN KEY ("id_facultad") REFERENCES "facultad"("id_facultad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programas" ADD CONSTRAINT "programas_id_departamento_fkey" FOREIGN KEY ("id_departamento") REFERENCES "departamento"("id_departamento") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_investigacion" ADD CONSTRAINT "grupo_investigacion_id_departamento_fkey" FOREIGN KEY ("id_departamento") REFERENCES "departamento"("id_departamento") ON DELETE SET NULL ON UPDATE CASCADE;
