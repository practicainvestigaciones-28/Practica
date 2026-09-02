/*
  Warnings:

  - A unique constraint covering the columns `[nombre]` on the table `area_conocimiento` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "etapas" (
    "id_etapa" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "etapas_pkey" PRIMARY KEY ("id_etapa")
);

-- CreateTable
CREATE TABLE "tipo_documento" (
    "id_tipo_documento" SERIAL NOT NULL,
    "id_etapa" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "archivo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipo_documento_pkey" PRIMARY KEY ("id_tipo_documento")
);

-- CreateTable
CREATE TABLE "proyecto_documento" (
    "id_proyecto_documento" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_tipo_documento" INTEGER NOT NULL,
    "cargado_por" INTEGER NOT NULL,
    "archivo" TEXT NOT NULL,
    "fecha_carga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobado_rechazado" BOOLEAN,

    CONSTRAINT "proyecto_documento_pkey" PRIMARY KEY ("id_proyecto_documento")
);

-- CreateIndex
CREATE UNIQUE INDEX "etapas_nombre_key" ON "etapas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "area_conocimiento_nombre_key" ON "area_conocimiento"("nombre");

-- AddForeignKey
ALTER TABLE "tipo_documento" ADD CONSTRAINT "tipo_documento_id_etapa_fkey" FOREIGN KEY ("id_etapa") REFERENCES "etapas"("id_etapa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_documento" ADD CONSTRAINT "proyecto_documento_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_documento" ADD CONSTRAINT "proyecto_documento_id_tipo_documento_fkey" FOREIGN KEY ("id_tipo_documento") REFERENCES "tipo_documento"("id_tipo_documento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_documento" ADD CONSTRAINT "proyecto_documento_cargado_por_fkey" FOREIGN KEY ("cargado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
