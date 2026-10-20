-- CreateTable
CREATE TABLE "firma_proyecto" (
    "id_firma" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_usuarioproyecto" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT,
    "rol_firmante" TEXT NOT NULL,
    "obligatoria" BOOLEAN NOT NULL DEFAULT false,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_firma" TIMESTAMP(3),
    "token_hash" TEXT,
    "token_expira" TIMESTAMP(3),
    "fecha_envio" TIMESTAMP(3),

    CONSTRAINT "firma_proyecto_pkey" PRIMARY KEY ("id_firma")
);

-- CreateIndex
CREATE UNIQUE INDEX "firma_proyecto_id_usuarioproyecto_key" ON "firma_proyecto"("id_usuarioproyecto");

-- CreateIndex
CREATE UNIQUE INDEX "firma_proyecto_token_hash_key" ON "firma_proyecto"("token_hash");

-- AddForeignKey
ALTER TABLE "firma_proyecto" ADD CONSTRAINT "firma_proyecto_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firma_proyecto" ADD CONSTRAINT "firma_proyecto_id_usuarioproyecto_fkey" FOREIGN KEY ("id_usuarioproyecto") REFERENCES "usuario_proyecto"("id_usuarioproyecto") ON DELETE CASCADE ON UPDATE CASCADE;
