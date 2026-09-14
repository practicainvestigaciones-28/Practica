-- Agregar campo activo a programas, para poder activar/desactivar
-- sin borrar (hay proyectos y grupos que ya lo referencian)

ALTER TABLE "programas" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
