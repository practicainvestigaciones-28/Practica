-- Correos ya enviados por los plazos de revisión (uno por usuario, fase y tipo), para no repetirlos.
CREATE TABLE "aviso_correo_ventana" (
    "id_convocatoria" INTEGER NOT NULL,
    "fase" TEXT NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "enviado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_correo_ventana_pkey" PRIMARY KEY ("id_convocatoria","fase","id_usuario","tipo")
);

ALTER TABLE "aviso_correo_ventana" ADD CONSTRAINT "aviso_correo_ventana_id_convocatoria_fkey" FOREIGN KEY ("id_convocatoria") REFERENCES "convocatoria"("id_convocatoria") ON DELETE CASCADE ON UPDATE CASCADE;
