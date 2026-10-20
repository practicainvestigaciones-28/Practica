-- Líneas de investigación múltiples (grupo UNICESMAG, catálogo real) y
-- línea de investigación / línea medular como texto libre y múltiple para
-- grupos externos. Migración manual (no interactiva) porque toca columnas
-- con datos: se preserva lo existente antes de borrar las columnas viejas.

-- AlterTable: grupo_investigacion.linea_medular (texto único) -> lineas_medulares (texto[])
ALTER TABLE "grupo_investigacion" ADD COLUMN "lineas_medulares" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "grupo_investigacion" ADD COLUMN "lineas_externas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "grupo_investigacion"
SET "lineas_medulares" = ARRAY["linea_medular"]
WHERE "linea_medular" IS NOT NULL AND "linea_medular" <> '';

ALTER TABLE "grupo_investigacion" DROP COLUMN "linea_medular";

-- CreateTable: proyecto_grupo_linea (línea de investigación múltiple del catálogo, solo grupos internos)
CREATE TABLE "proyecto_grupo_linea" (
    "id_proyecto_grupo_linea" SERIAL NOT NULL,
    "id_proyecto_grupo" INTEGER NOT NULL,
    "id_linea_investigacion" INTEGER NOT NULL,

    CONSTRAINT "proyecto_grupo_linea_pkey" PRIMARY KEY ("id_proyecto_grupo_linea")
);

CREATE UNIQUE INDEX "proyecto_grupo_linea_id_proyecto_grupo_id_linea_investigac_key" ON "proyecto_grupo_linea"("id_proyecto_grupo", "id_linea_investigacion");

ALTER TABLE "proyecto_grupo_linea" ADD CONSTRAINT "proyecto_grupo_linea_id_proyecto_grupo_fkey" FOREIGN KEY ("id_proyecto_grupo") REFERENCES "proyecto_grupo"("id_proyecto_grupo") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyecto_grupo_linea" ADD CONSTRAINT "proyecto_grupo_linea_id_linea_investigacion_fkey" FOREIGN KEY ("id_linea_investigacion") REFERENCES "lineas_investigacion"("id_linea") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preservar las asociaciones ya existentes (ProyectoGrupo.id_linea_investigacion) en la tabla nueva.
INSERT INTO "proyecto_grupo_linea" ("id_proyecto_grupo", "id_linea_investigacion")
SELECT "id_proyecto_grupo", "id_linea_investigacion" FROM "proyecto_grupo" WHERE "id_linea_investigacion" IS NOT NULL;

-- DropForeignKey + AlterTable: proyecto_grupo.id_linea_investigacion (FK única) ya no hace falta.
ALTER TABLE "proyecto_grupo" DROP CONSTRAINT "proyecto_grupo_id_linea_investigacion_fkey";
ALTER TABLE "proyecto_grupo" DROP COLUMN "id_linea_investigacion";
