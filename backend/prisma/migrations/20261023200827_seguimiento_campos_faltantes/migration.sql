-- AlterTable
ALTER TABLE "acta_cierre" ADD COLUMN     "capitulos" INTEGER,
ADD COLUMN     "capitulos_observacion" TEXT,
ADD COLUMN     "capitulos_soporte" TEXT,
ADD COLUMN     "libros" INTEGER,
ADD COLUMN     "libros_observacion" TEXT,
ADD COLUMN     "libros_soporte" TEXT,
ADD COLUMN     "linea_investigacion_co" TEXT,
ADD COLUMN     "linea_investigacion_principal" TEXT,
ADD COLUMN     "programas_estudiantes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "informe_avance_actividad" ADD COLUMN     "semanas_trabajadas" BOOLEAN[] DEFAULT ARRAY[]::BOOLEAN[];

-- AlterTable
ALTER TABLE "informe_final" ADD COLUMN     "area_conocimiento" TEXT,
ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "fecha_habilitacion" TIMESTAMP(3),
ADD COLUMN     "fecha_solicitud" TIMESTAMP(3),
ADD COLUMN     "financiacion_externa" TEXT,
ADD COLUMN     "observacion_solicitud" TEXT;

-- AlterTable
ALTER TABLE "novedad_proyecto" ADD COLUMN     "nombre_tipo" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "participacion_estudiante" ADD COLUMN     "correo" TEXT,
ADD COLUMN     "tipo_participacion" TEXT;

-- AlterTable
ALTER TABLE "periodo_informe" ADD COLUMN     "fecha_habilitacion" TIMESTAMP(3),
ADD COLUMN     "fecha_solicitud" TIMESTAMP(3),
ADD COLUMN     "observacion_solicitud" TEXT;

-- AlterTable
ALTER TABLE "resultado_producto" ALTER COLUMN "cantidad_obtenida" DROP NOT NULL;

-- CreateTable
CREATE TABLE "informe_final_persona" (
    "id_informe_final_persona" SERIAL NOT NULL,
    "id_informe_final" INTEGER NOT NULL,
    "rol" TEXT NOT NULL,
    "nombre" TEXT,
    "grupo" TEXT,
    "programa" TEXT,
    "correo" TEXT,
    "telefono" TEXT,

    CONSTRAINT "informe_final_persona_pkey" PRIMARY KEY ("id_informe_final_persona")
);

-- CreateTable
CREATE TABLE "evidencia_resultado_producto" (
    "id_evidencia_resultado" SERIAL NOT NULL,
    "id_resultado_producto" INTEGER NOT NULL,
    "tipo_evidencia" TEXT NOT NULL,
    "archivo" TEXT,
    "enlace" TEXT,
    "descripcion" TEXT,

    CONSTRAINT "evidencia_resultado_producto_pkey" PRIMARY KEY ("id_evidencia_resultado")
);

-- CreateIndex
CREATE UNIQUE INDEX "informe_final_persona_id_informe_final_rol_key" ON "informe_final_persona"("id_informe_final", "rol");

-- AddForeignKey
ALTER TABLE "informe_final_persona" ADD CONSTRAINT "informe_final_persona_id_informe_final_fkey" FOREIGN KEY ("id_informe_final") REFERENCES "informe_final"("id_informe_final") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia_resultado_producto" ADD CONSTRAINT "evidencia_resultado_producto_id_resultado_producto_fkey" FOREIGN KEY ("id_resultado_producto") REFERENCES "resultado_producto"("id_resultado_producto") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "proyecto_grupo_linea_id_proyecto_grupo_id_linea_investigac_key" RENAME TO "proyecto_grupo_linea_id_proyecto_grupo_id_linea_investigaci_key";
