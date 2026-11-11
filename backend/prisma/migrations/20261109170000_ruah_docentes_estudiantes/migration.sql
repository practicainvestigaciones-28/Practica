-- Programa académico del docente (viene de Ruah) y catálogo de estudiantes de Ruah.
ALTER TABLE "usuarios" ADD COLUMN "id_programa" INTEGER;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_programa_fkey" FOREIGN KEY ("id_programa") REFERENCES "programas"("id_programa") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "estudiante_ruah" (
    "id_estudiante_ruah" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "documento" TEXT,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "correo_institucional" TEXT,
    "correo_personal" TEXT,
    "telefono" TEXT,
    "id_programa" INTEGER,
    "matriculado" BOOLEAN NOT NULL DEFAULT true,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudiante_ruah_pkey" PRIMARY KEY ("id_estudiante_ruah")
);

CREATE UNIQUE INDEX "estudiante_ruah_codigo_key" ON "estudiante_ruah"("codigo");
CREATE INDEX "estudiante_ruah_documento_idx" ON "estudiante_ruah"("documento");
ALTER TABLE "estudiante_ruah" ADD CONSTRAINT "estudiante_ruah_id_programa_fkey" FOREIGN KEY ("id_programa") REFERENCES "programas"("id_programa") ON DELETE SET NULL ON UPDATE CASCADE;
