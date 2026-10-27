-- Código de verificación para las firmas de Seguimiento (informes y acta de cierre).
CREATE TABLE "codigo_verificacion_firma" (
    "id_codigo" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "codigo_expira" TIMESTAMP(3) NOT NULL,
    "codigo_enviado" TIMESTAMP(3) NOT NULL,
    "codigo_intentos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "codigo_verificacion_firma_pkey" PRIMARY KEY ("id_codigo")
);

-- CreateIndex
CREATE UNIQUE INDEX "codigo_verificacion_firma_id_usuario_id_proyecto_key" ON "codigo_verificacion_firma"("id_usuario", "id_proyecto");
