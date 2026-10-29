-- Evidencia de la firma electrónica del registro de proyecto (ID de transacción, hash SHA-256, correo del código, IP y navegador).
ALTER TABLE "firma_proyecto"
ADD COLUMN "correo_verificacion" TEXT,
ADD COLUMN "id_transaccion" TEXT,
ADD COLUMN "hash_firma" TEXT,
ADD COLUMN "ip_firma" TEXT,
ADD COLUMN "agente_firma" TEXT;

CREATE UNIQUE INDEX "firma_proyecto_id_transaccion_key" ON "firma_proyecto"("id_transaccion");
