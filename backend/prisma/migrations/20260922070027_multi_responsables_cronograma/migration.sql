-- CreateTable
CREATE TABLE "cronograma_actividad_responsable" (
    "id_actividad" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,

    CONSTRAINT "cronograma_actividad_responsable_pkey" PRIMARY KEY ("id_actividad", "id_usuario")
);

-- Migrate existing single-responsable data into the new join table
INSERT INTO "cronograma_actividad_responsable" ("id_actividad", "id_usuario")
SELECT "id_actividad", "responsable" FROM "cronograma_actividad" WHERE "responsable" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "cronograma_actividad" DROP CONSTRAINT "cronograma_actividad_responsable_fkey";

-- AlterTable
ALTER TABLE "cronograma_actividad" DROP COLUMN "responsable";

-- AddForeignKey
ALTER TABLE "cronograma_actividad_responsable" ADD CONSTRAINT "cronograma_actividad_responsable_id_actividad_fkey" FOREIGN KEY ("id_actividad") REFERENCES "cronograma_actividad"("id_actividad") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_actividad_responsable" ADD CONSTRAINT "cronograma_actividad_responsable_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
