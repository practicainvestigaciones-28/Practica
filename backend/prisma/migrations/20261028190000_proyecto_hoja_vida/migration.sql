-- Hojas de vida de co-investigadores (UNICESMAG y externos) diligenciadas en el proyecto.
CREATE TABLE "proyecto_hoja_vida" (
    "id_proyecto_hoja_vida" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "rol" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "datos" JSONB NOT NULL,

    CONSTRAINT "proyecto_hoja_vida_pkey" PRIMARY KEY ("id_proyecto_hoja_vida")
);

ALTER TABLE "proyecto_hoja_vida" ADD CONSTRAINT "proyecto_hoja_vida_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;
