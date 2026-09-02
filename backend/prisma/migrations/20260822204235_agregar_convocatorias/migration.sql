/*
  Warnings:

  - A unique constraint covering the columns `[nombre]` on the table `rol` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "tipo_proyecto" (
    "id_tipo_proyecto" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "tipo_proyecto_pkey" PRIMARY KEY ("id_tipo_proyecto")
);

-- CreateTable
CREATE TABLE "modalidad_proyecto" (
    "id_modalidad" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "modalidad_proyecto_pkey" PRIMARY KEY ("id_modalidad")
);

-- CreateTable
CREATE TABLE "area_conocimiento" (
    "id_area_conocimiento" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "area_conocimiento_pkey" PRIMARY KEY ("id_area_conocimiento")
);

-- CreateTable
CREATE TABLE "convocatoria" (
    "id_convocatoria" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL,
    "creado_por" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convocatoria_pkey" PRIMARY KEY ("id_convocatoria")
);

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

-- AddForeignKey
ALTER TABLE "convocatoria" ADD CONSTRAINT "convocatoria_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
