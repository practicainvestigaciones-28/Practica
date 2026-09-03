-- CreateTable
CREATE TABLE "proyectos" (
    "id_proyecto" SERIAL NOT NULL,
    "id_convocatoria" INTEGER NOT NULL,
    "id_modalidad_proyecto" INTEGER NOT NULL,
    "id_tipo_proyecto" INTEGER NOT NULL,
    "creado_por" INTEGER NOT NULL,
    "estado_actual" TEXT NOT NULL DEFAULT 'pendiente',
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "titulo" TEXT NOT NULL,
    "ciudad" TEXT,
    "departamento" TEXT,
    "resumen" TEXT,
    "planteamiento_problema" TEXT,
    "pregunta_investigacion" TEXT,
    "justificacion" TEXT,
    "marco_teorico" TEXT,
    "metodologia_preliminar" TEXT,
    "componente_etico" TEXT,
    "funciones_estudiante_auxiliar" TEXT,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id_proyecto")
);

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_id_convocatoria_fkey" FOREIGN KEY ("id_convocatoria") REFERENCES "convocatoria"("id_convocatoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_id_modalidad_proyecto_fkey" FOREIGN KEY ("id_modalidad_proyecto") REFERENCES "modalidad_proyecto"("id_modalidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_id_tipo_proyecto_fkey" FOREIGN KEY ("id_tipo_proyecto") REFERENCES "tipo_proyecto"("id_tipo_proyecto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
