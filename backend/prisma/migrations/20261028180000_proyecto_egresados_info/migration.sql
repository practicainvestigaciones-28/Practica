-- Sección "Información general de egresados" de la pestaña Grupos: se guarda tal cual (no crea participantes).
CREATE TABLE "proyecto_egresados_info" (
    "id_egresados_info" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_facultad" INTEGER,
    "id_programa" INTEGER,
    "empresa_entidad" TEXT,

    CONSTRAINT "proyecto_egresados_info_pkey" PRIMARY KEY ("id_egresados_info")
);

CREATE TABLE "proyecto_egresado_integrante" (
    "id_integrante" SERIAL NOT NULL,
    "id_egresados_info" INTEGER NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "horas_semanales" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "proyecto_egresado_integrante_pkey" PRIMARY KEY ("id_integrante")
);

CREATE UNIQUE INDEX "proyecto_egresados_info_id_proyecto_key" ON "proyecto_egresados_info"("id_proyecto");

ALTER TABLE "proyecto_egresados_info" ADD CONSTRAINT "proyecto_egresados_info_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "proyecto_egresado_integrante" ADD CONSTRAINT "proyecto_egresado_integrante_id_egresados_info_fkey" FOREIGN KEY ("id_egresados_info") REFERENCES "proyecto_egresados_info"("id_egresados_info") ON DELETE CASCADE ON UPDATE CASCADE;
