-- CreateTable
CREATE TABLE "convocatoria_opcion" (
    "id_convocatoria" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "id_item" INTEGER NOT NULL,

    CONSTRAINT "convocatoria_opcion_pkey" PRIMARY KEY ("id_convocatoria","tipo","id_item")
);

-- CreateTable
CREATE TABLE "convocatoria_limite_texto" (
    "id_convocatoria" INTEGER NOT NULL,
    "clave" TEXT NOT NULL,
    "max_caracteres" INTEGER NOT NULL,

    CONSTRAINT "convocatoria_limite_texto_pkey" PRIMARY KEY ("id_convocatoria","clave")
);

-- AddForeignKey
ALTER TABLE "convocatoria_opcion" ADD CONSTRAINT "convocatoria_opcion_id_convocatoria_fkey" FOREIGN KEY ("id_convocatoria") REFERENCES "convocatoria"("id_convocatoria") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convocatoria_limite_texto" ADD CONSTRAINT "convocatoria_limite_texto_id_convocatoria_fkey" FOREIGN KEY ("id_convocatoria") REFERENCES "convocatoria"("id_convocatoria") ON DELETE CASCADE ON UPDATE CASCADE;
