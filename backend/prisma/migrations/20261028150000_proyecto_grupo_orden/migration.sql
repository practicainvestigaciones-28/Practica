-- Orden de los grupos del proyecto en el formulario: el primer grupo CESMAG es el de adscripción del proyecto.
ALTER TABLE "proyecto_grupo" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;
