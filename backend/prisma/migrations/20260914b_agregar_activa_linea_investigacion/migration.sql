-- Agregar campo activa a lineas_investigacion, para poder activar/desactivar
-- sin borrar (hay grupos y proyectos que ya la referencian)

ALTER TABLE "lineas_investigacion" ADD COLUMN "activa" BOOLEAN NOT NULL DEFAULT true;
