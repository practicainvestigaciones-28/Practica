-- Evidencias de archivo del seguimiento: además de la ruta, el nombre original, el tamaño y el tipo para poder mostrarlas y descargarlas.
ALTER TABLE "evidencia_avance" ADD COLUMN "nombre_original" TEXT, ADD COLUMN "tamano" INTEGER, ADD COLUMN "mime" TEXT;
ALTER TABLE "evidencia_resultado_producto" ADD COLUMN "nombre_original" TEXT, ADD COLUMN "tamano" INTEGER, ADD COLUMN "mime" TEXT;
