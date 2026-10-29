-- "Investigadores del proyecto" de cada grupo (pestaña Grupos): ya no se guardan como participantes del proyecto.
CREATE TABLE "proyecto_grupo_investigador" (
    "id_investigador_grupo" SERIAL NOT NULL,
    "id_proyecto_grupo" INTEGER NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "horas_semanales" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "proyecto_grupo_investigador_pkey" PRIMARY KEY ("id_investigador_grupo")
);

ALTER TABLE "proyecto_grupo_investigador" ADD CONSTRAINT "proyecto_grupo_investigador_id_proyecto_grupo_fkey" FOREIGN KEY ("id_proyecto_grupo") REFERENCES "proyecto_grupo"("id_proyecto_grupo") ON DELETE CASCADE ON UPDATE CASCADE;
