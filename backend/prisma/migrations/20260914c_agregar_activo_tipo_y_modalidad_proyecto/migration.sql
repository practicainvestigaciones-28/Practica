-- Agregar campo activo a tipo_proyecto y modalidad_proyecto, para poder
-- activar/desactivar sin borrar (hay proyectos que ya los referencian)

ALTER TABLE "tipo_proyecto" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "modalidad_proyecto" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
