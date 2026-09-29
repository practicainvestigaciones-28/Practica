-- Columnas para la vista de seguimiento del líder VIE: lo "Obtenido" por
-- producto (proyecto_producto ya guarda lo "Proyectado" en `cantidad`), y
-- dos campos libres por proyecto (evidencias/observaciones del reporte).
ALTER TABLE "proyecto_producto" ADD COLUMN IF NOT EXISTS "cantidad_obtenida" INTEGER;

ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "evidencias_resultados" TEXT;
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "observaciones_resultados" TEXT;
