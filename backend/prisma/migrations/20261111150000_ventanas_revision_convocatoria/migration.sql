-- Plazos de revisión por convocatoria (comité, ética, pares, reclamaciones), definidos por el Administrador.
CREATE TABLE "convocatoria_ventana" (
    "id_convocatoria" INTEGER NOT NULL,
    "fase" TEXT NOT NULL,
    "abre_en" TIMESTAMP(3) NOT NULL,
    "cierra_en" TIMESTAMP(3) NOT NULL,
    "reabierta" BOOLEAN NOT NULL DEFAULT false,
    "avisado_apertura" BOOLEAN NOT NULL DEFAULT false,
    "avisado_cierre" BOOLEAN NOT NULL DEFAULT false,
    "definido_por" INTEGER NOT NULL,
    "fecha_definicion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convocatoria_ventana_pkey" PRIMARY KEY ("id_convocatoria","fase")
);

ALTER TABLE "convocatoria_ventana" ADD CONSTRAINT "convocatoria_ventana_id_convocatoria_fkey" FOREIGN KEY ("id_convocatoria") REFERENCES "convocatoria"("id_convocatoria") ON DELETE CASCADE ON UPDATE CASCADE;
