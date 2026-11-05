-- Evidencia de la firma electrónica de actas e informes: ID de transacción y huella SHA-256 de lo firmado.
ALTER TABLE "acta_inicio_firma" ADD COLUMN "id_transaccion" TEXT, ADD COLUMN "hash_firma" TEXT;
ALTER TABLE "firma_documento" ADD COLUMN "id_transaccion" TEXT, ADD COLUMN "hash_firma" TEXT;
CREATE UNIQUE INDEX "acta_inicio_firma_id_transaccion_key" ON "acta_inicio_firma"("id_transaccion");
CREATE UNIQUE INDEX "firma_documento_id_transaccion_key" ON "firma_documento"("id_transaccion");
