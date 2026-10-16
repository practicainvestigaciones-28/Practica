-- Acta de inicio en el backend: datos de los numerales 2 a 4 y firma individual por correo.

-- AlterTable: los datos del acta se completan después de crearla.
ALTER TABLE "acta_inicio" ALTER COLUMN "numero_acta_aprobacion" DROP NOT NULL,
ALTER COLUMN "fecha_acta_aprobacion" DROP NOT NULL,
ALTER COLUMN "fecha_inicio" DROP NOT NULL,
ALTER COLUMN "duracion_meses" DROP NOT NULL,
ALTER COLUMN "fecha_fin_estimada" DROP NOT NULL,
ADD COLUMN "tipo_proyecto" TEXT,
ADD COLUMN "centro_costos" TEXT,
ADD COLUMN "vigencias" JSONB,
ADD COLUMN "contactos" JSONB;

-- CreateIndex: un acta por proyecto.
CREATE UNIQUE INDEX "acta_inicio_id_proyecto_key" ON "acta_inicio"("id_proyecto");

-- CreateTable
CREATE TABLE "acta_inicio_firma" (
    "id_firma" SERIAL NOT NULL,
    "id_acta_inicio" INTEGER NOT NULL,
    "id_usuario" INTEGER,
    "nombre" TEXT NOT NULL,
    "correo" TEXT,
    "rol_firmante" TEXT NOT NULL,
    "orden_firma" INTEGER NOT NULL,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_firma" TIMESTAMP(3),
    "token_hash" TEXT,
    "token_expira" TIMESTAMP(3),
    "fecha_envio" TIMESTAMP(3),

    CONSTRAINT "acta_inicio_firma_pkey" PRIMARY KEY ("id_firma")
);

-- CreateIndex
CREATE UNIQUE INDEX "acta_inicio_firma_token_hash_key" ON "acta_inicio_firma"("token_hash");

-- AddForeignKey
ALTER TABLE "acta_inicio_firma" ADD CONSTRAINT "acta_inicio_firma_id_acta_inicio_fkey" FOREIGN KEY ("id_acta_inicio") REFERENCES "acta_inicio"("id_acta_inicio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acta_inicio_firma" ADD CONSTRAINT "acta_inicio_firma_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
