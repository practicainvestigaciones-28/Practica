-- Código de verificación en las firmas de comités: la verificación queda marcada para que la firma la consuma.
-- (Las columnas de código de firma_proyecto las crea 20261028120000_firma_proyecto_codigo_verificacion.)
ALTER TABLE "codigo_verificacion_firma" ADD COLUMN "verificado_en" TIMESTAMP(3);
