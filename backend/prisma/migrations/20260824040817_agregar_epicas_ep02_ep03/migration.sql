-- CreateTable
CREATE TABLE "token_recuperacion" (
    "id_token" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_recuperacion_pkey" PRIMARY KEY ("id_token")
);

-- CreateTable
CREATE TABLE "dedicacion" (
    "id_dedicacion" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "dedicacion_pkey" PRIMARY KEY ("id_dedicacion")
);

-- CreateTable
CREATE TABLE "rol_proyecto" (
    "id_rol_pro" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "rol_proyecto_pkey" PRIMARY KEY ("id_rol_pro")
);

-- CreateTable
CREATE TABLE "rol_estudiante" (
    "id_rolestudiante" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "rol_estudiante_pkey" PRIMARY KEY ("id_rolestudiante")
);

-- CreateTable
CREATE TABLE "usuario_proyecto" (
    "id_usuarioproyecto" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "participante" INTEGER NOT NULL,
    "id_dedicacion" INTEGER NOT NULL,
    "id_rol_pro" INTEGER NOT NULL,
    "id_rol_estudiante" INTEGER,

    CONSTRAINT "usuario_proyecto_pkey" PRIMARY KEY ("id_usuarioproyecto")
);

-- CreateTable
CREATE TABLE "proyecto_area" (
    "id_proyecto_area" SERIAL NOT NULL,
    "id_proyectos" INTEGER NOT NULL,
    "id_area_conocimiento" INTEGER NOT NULL,

    CONSTRAINT "proyecto_area_pkey" PRIMARY KEY ("id_proyecto_area")
);

-- CreateTable
CREATE TABLE "facultad" (
    "id_facultad" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "facultad_pkey" PRIMARY KEY ("id_facultad")
);

-- CreateTable
CREATE TABLE "tipo_programa" (
    "id_tipo_programa" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "tipo_programa_pkey" PRIMARY KEY ("id_tipo_programa")
);

-- CreateTable
CREATE TABLE "programas" (
    "id_programa" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_facultad" INTEGER NOT NULL,
    "id_tipo_programa" INTEGER NOT NULL,

    CONSTRAINT "programas_pkey" PRIMARY KEY ("id_programa")
);

-- CreateTable
CREATE TABLE "proyecto_programa" (
    "id_proyecto_programas" SERIAL NOT NULL,
    "id_proyectos" INTEGER NOT NULL,
    "id_programa" INTEGER,
    "programa_otro" TEXT,

    CONSTRAINT "proyecto_programa_pkey" PRIMARY KEY ("id_proyecto_programas")
);

-- CreateTable
CREATE TABLE "financiacion" (
    "id_financiacion" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "valor_solicitado_unicesmag" DECIMAL(14,2) NOT NULL,
    "valor_contrapartida" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valor_total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "financiacion_pkey" PRIMARY KEY ("id_financiacion")
);

-- CreateTable
CREATE TABLE "tipo_grupo" (
    "id_tipo_grupo" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "tipo_grupo_pkey" PRIMARY KEY ("id_tipo_grupo")
);

-- CreateTable
CREATE TABLE "lineas_investigacion" (
    "id_linea" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "lineas_investigacion_pkey" PRIMARY KEY ("id_linea")
);

-- CreateTable
CREATE TABLE "ods" (
    "id_ods" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "ods_pkey" PRIMARY KEY ("id_ods")
);

-- CreateTable
CREATE TABLE "grupo_investigacion" (
    "id_grupo" SERIAL NOT NULL,
    "id_facultad" INTEGER,
    "id_programa" INTEGER,
    "id_dedicacion" INTEGER,
    "id_tipo_grupo" INTEGER NOT NULL,
    "facultad_otra" TEXT,
    "programa_otro" TEXT,
    "nombre" TEXT NOT NULL,
    "lider_grupo" TEXT,
    "cod_gruplac" TEXT,
    "reconocido_minciencias" BOOLEAN NOT NULL DEFAULT false,
    "categoria" TEXT,
    "acuerdo_institucional" TEXT,
    "linea_medular" TEXT,

    CONSTRAINT "grupo_investigacion_pkey" PRIMARY KEY ("id_grupo")
);

-- CreateTable
CREATE TABLE "proyecto_grupo" (
    "id_proyecto_grupo" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "id_linea_investigacion" INTEGER,
    "id_ods" INTEGER,

    CONSTRAINT "proyecto_grupo_pkey" PRIMARY KEY ("id_proyecto_grupo")
);

-- CreateTable
CREATE TABLE "informacion_egresado" (
    "id_egresado" SERIAL NOT NULL,
    "id_usuarioproyecto" INTEGER NOT NULL,
    "facultad" TEXT,
    "programa_academico" TEXT,
    "empresa_entidad" TEXT,
    "dedicacion_horas_semanales" INTEGER,

    CONSTRAINT "informacion_egresado_pkey" PRIMARY KEY ("id_egresado")
);

-- CreateTable
CREATE TABLE "objetivos" (
    "id_objetivo" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "tipo_objetivo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "objetivos_pkey" PRIMARY KEY ("id_objetivo")
);

-- CreateTable
CREATE TABLE "antecedentes" (
    "id_antecedente" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_publicacion" TIMESTAMP(3),
    "autor" TEXT,
    "fuente" TEXT,

    CONSTRAINT "antecedentes_pkey" PRIMARY KEY ("id_antecedente")
);

-- CreateTable
CREATE TABLE "impacto" (
    "id_impacto" SERIAL NOT NULL,
    "id_objetivo" INTEGER NOT NULL,
    "impacto_esperado" TEXT NOT NULL,
    "beneficiario_potencial" TEXT,
    "indicador_verificable" TEXT,

    CONSTRAINT "impacto_pkey" PRIMARY KEY ("id_impacto")
);

-- CreateTable
CREATE TABLE "periodo" (
    "id_periodo" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "periodo_pkey" PRIMARY KEY ("id_periodo")
);

-- CreateTable
CREATE TABLE "cronograma_actividad" (
    "id_actividad" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "responsable" INTEGER NOT NULL,
    "actividad" TEXT NOT NULL,
    "resultado" TEXT,

    CONSTRAINT "cronograma_actividad_pkey" PRIMARY KEY ("id_actividad")
);

-- CreateTable
CREATE TABLE "cronograma_periodo_mes" (
    "id_cronograma_periodo_mes" SERIAL NOT NULL,
    "id_actividad" INTEGER NOT NULL,
    "id_periodo" INTEGER NOT NULL,
    "año" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,

    CONSTRAINT "cronograma_periodo_mes_pkey" PRIMARY KEY ("id_cronograma_periodo_mes")
);

-- CreateTable
CREATE TABLE "categoria_producto" (
    "id_categoria" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "categoria_producto_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "subcategoria_producto" (
    "id_subcategoria" SERIAL NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "subcategoria_producto_pkey" PRIMARY KEY ("id_subcategoria")
);

-- CreateTable
CREATE TABLE "tipo_producto" (
    "id_tipo_producto" SERIAL NOT NULL,
    "id_subcategoria" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tipo_producto_pkey" PRIMARY KEY ("id_tipo_producto")
);

-- CreateTable
CREATE TABLE "proyecto_producto" (
    "id_proyecto_producto" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_tipo_producto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "proyecto_producto_pkey" PRIMARY KEY ("id_proyecto_producto")
);

-- CreateTable
CREATE TABLE "hoja_vida" (
    "id_hoja_vida" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "lugar_nacimiento" TEXT,
    "fecha_nacimiento" TIMESTAMP(3),
    "nacionalidad" TEXT,
    "tipo_documento" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "celular" TEXT,
    "cargo_actual" TEXT,
    "cargos_desempenados" TEXT,
    "titulos_academicos" TEXT,
    "produccion_cientifica" TEXT,

    CONSTRAINT "hoja_vida_pkey" PRIMARY KEY ("id_hoja_vida")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_recuperacion_tokenHash_key" ON "token_recuperacion"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "dedicacion_nombre_key" ON "dedicacion"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "rol_proyecto_nombre_key" ON "rol_proyecto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "rol_estudiante_nombre_key" ON "rol_estudiante"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_proyecto_id_proyecto_participante_key" ON "usuario_proyecto"("id_proyecto", "participante");

-- CreateIndex
CREATE UNIQUE INDEX "proyecto_area_id_proyectos_id_area_conocimiento_key" ON "proyecto_area"("id_proyectos", "id_area_conocimiento");

-- CreateIndex
CREATE UNIQUE INDEX "facultad_nombre_key" ON "facultad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_programa_nombre_key" ON "tipo_programa"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "financiacion_id_proyecto_key" ON "financiacion"("id_proyecto");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_grupo_nombre_key" ON "tipo_grupo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "lineas_investigacion_nombre_key" ON "lineas_investigacion"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ods_nombre_key" ON "ods"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "proyecto_grupo_id_proyecto_id_grupo_key" ON "proyecto_grupo"("id_proyecto", "id_grupo");

-- CreateIndex
CREATE UNIQUE INDEX "informacion_egresado_id_usuarioproyecto_key" ON "informacion_egresado"("id_usuarioproyecto");

-- CreateIndex
CREATE UNIQUE INDEX "periodo_nombre_key" ON "periodo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_producto_nombre_key" ON "categoria_producto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "proyecto_producto_id_proyecto_id_tipo_producto_key" ON "proyecto_producto"("id_proyecto", "id_tipo_producto");

-- CreateIndex
CREATE UNIQUE INDEX "hoja_vida_id_usuario_key" ON "hoja_vida"("id_usuario");

-- AddForeignKey
ALTER TABLE "token_recuperacion" ADD CONSTRAINT "token_recuperacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_proyecto" ADD CONSTRAINT "usuario_proyecto_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_proyecto" ADD CONSTRAINT "usuario_proyecto_participante_fkey" FOREIGN KEY ("participante") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_proyecto" ADD CONSTRAINT "usuario_proyecto_id_dedicacion_fkey" FOREIGN KEY ("id_dedicacion") REFERENCES "dedicacion"("id_dedicacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_proyecto" ADD CONSTRAINT "usuario_proyecto_id_rol_pro_fkey" FOREIGN KEY ("id_rol_pro") REFERENCES "rol_proyecto"("id_rol_pro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_proyecto" ADD CONSTRAINT "usuario_proyecto_id_rol_estudiante_fkey" FOREIGN KEY ("id_rol_estudiante") REFERENCES "rol_estudiante"("id_rolestudiante") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_area" ADD CONSTRAINT "proyecto_area_id_proyectos_fkey" FOREIGN KEY ("id_proyectos") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_area" ADD CONSTRAINT "proyecto_area_id_area_conocimiento_fkey" FOREIGN KEY ("id_area_conocimiento") REFERENCES "area_conocimiento"("id_area_conocimiento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programas" ADD CONSTRAINT "programas_id_facultad_fkey" FOREIGN KEY ("id_facultad") REFERENCES "facultad"("id_facultad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programas" ADD CONSTRAINT "programas_id_tipo_programa_fkey" FOREIGN KEY ("id_tipo_programa") REFERENCES "tipo_programa"("id_tipo_programa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_programa" ADD CONSTRAINT "proyecto_programa_id_proyectos_fkey" FOREIGN KEY ("id_proyectos") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_programa" ADD CONSTRAINT "proyecto_programa_id_programa_fkey" FOREIGN KEY ("id_programa") REFERENCES "programas"("id_programa") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financiacion" ADD CONSTRAINT "financiacion_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_investigacion" ADD CONSTRAINT "grupo_investigacion_id_facultad_fkey" FOREIGN KEY ("id_facultad") REFERENCES "facultad"("id_facultad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_investigacion" ADD CONSTRAINT "grupo_investigacion_id_programa_fkey" FOREIGN KEY ("id_programa") REFERENCES "programas"("id_programa") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_investigacion" ADD CONSTRAINT "grupo_investigacion_id_dedicacion_fkey" FOREIGN KEY ("id_dedicacion") REFERENCES "dedicacion"("id_dedicacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_investigacion" ADD CONSTRAINT "grupo_investigacion_id_tipo_grupo_fkey" FOREIGN KEY ("id_tipo_grupo") REFERENCES "tipo_grupo"("id_tipo_grupo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_grupo" ADD CONSTRAINT "proyecto_grupo_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_grupo" ADD CONSTRAINT "proyecto_grupo_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo_investigacion"("id_grupo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_grupo" ADD CONSTRAINT "proyecto_grupo_id_linea_investigacion_fkey" FOREIGN KEY ("id_linea_investigacion") REFERENCES "lineas_investigacion"("id_linea") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_grupo" ADD CONSTRAINT "proyecto_grupo_id_ods_fkey" FOREIGN KEY ("id_ods") REFERENCES "ods"("id_ods") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informacion_egresado" ADD CONSTRAINT "informacion_egresado_id_usuarioproyecto_fkey" FOREIGN KEY ("id_usuarioproyecto") REFERENCES "usuario_proyecto"("id_usuarioproyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivos" ADD CONSTRAINT "objetivos_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "antecedentes" ADD CONSTRAINT "antecedentes_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impacto" ADD CONSTRAINT "impacto_id_objetivo_fkey" FOREIGN KEY ("id_objetivo") REFERENCES "objetivos"("id_objetivo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_actividad" ADD CONSTRAINT "cronograma_actividad_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_actividad" ADD CONSTRAINT "cronograma_actividad_responsable_fkey" FOREIGN KEY ("responsable") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_periodo_mes" ADD CONSTRAINT "cronograma_periodo_mes_id_actividad_fkey" FOREIGN KEY ("id_actividad") REFERENCES "cronograma_actividad"("id_actividad") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_periodo_mes" ADD CONSTRAINT "cronograma_periodo_mes_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodo"("id_periodo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategoria_producto" ADD CONSTRAINT "subcategoria_producto_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria_producto"("id_categoria") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipo_producto" ADD CONSTRAINT "tipo_producto_id_subcategoria_fkey" FOREIGN KEY ("id_subcategoria") REFERENCES "subcategoria_producto"("id_subcategoria") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_producto" ADD CONSTRAINT "proyecto_producto_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyectos"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_producto" ADD CONSTRAINT "proyecto_producto_id_tipo_producto_fkey" FOREIGN KEY ("id_tipo_producto") REFERENCES "tipo_producto"("id_tipo_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hoja_vida" ADD CONSTRAINT "hoja_vida_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
