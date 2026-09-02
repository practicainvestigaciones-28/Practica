import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // ========================================
  // ROLES
  // ========================================

  const rolAdministrador = await prisma.rol.upsert({
    where: {
      nombre: "Administrador",
    },
    update: {},
    create: {
      nombre: "Administrador",
      descripcion: "Administrador del sistema",
      estado: true,
    },
  });

  const rolInvestigador = await prisma.rol.upsert({
    where: {
      nombre: "Investigador",
    },
    update: {},
    create: {
      nombre: "Investigador",
      descripcion: "Usuario investigador",
      estado: true,
    },
  });

  // ========================================
  // USUARIO ADMINISTRADOR
  // ========================================

  const contraseñaHash = await bcrypt.hash("Admin123*", 10);

  const administrador = await prisma.usuario.upsert({
    where: {
      correo: "admin@unicesmag.edu.co",
    },
    update: {},
    create: {
      nombre: "Administrador",
      apellido: "Sistema",
      correo: "admin@unicesmag.edu.co",
      contraseña: contraseñaHash,
      codigo: "ADMIN001",
      cedula: "0000000000",
    },
  });

  // ========================================
  // ASIGNAR ROL ADMINISTRADOR
  // ========================================

  await prisma.rolesUsuario.upsert({
    where: {
      id_usuario_id_rol: {
        id_usuario: administrador.id_usuario,
        id_rol: rolAdministrador.id_rol,
      },
    },
    update: {},
    create: {
      id_usuario: administrador.id_usuario,
      id_rol: rolAdministrador.id_rol,
    },
  });

  // ========================================
  // USUARIO INVESTIGADOR
  // ========================================

  const contraseñaInvestigadorHash = await bcrypt.hash(
    "Investigador123*",
    10
  );

  const investigador = await prisma.usuario.upsert({
    where: {
      correo: "investigador@unicesmag.edu.co",
    },
    update: {},
    create: {
      nombre: "Carlos",
      apellido: "Pérez",
      correo: "investigador@unicesmag.edu.co",
      contraseña: contraseñaInvestigadorHash,
      codigo: "INV001",
      cedula: "0000000001",
    },
  });

  // ========================================
  // ASIGNAR ROL INVESTIGADOR
  // ========================================

  await prisma.rolesUsuario.upsert({
    where: {
      id_usuario_id_rol: {
        id_usuario: investigador.id_usuario,
        id_rol: rolInvestigador.id_rol,
      },
    },
    update: {},
    create: {
      id_usuario: investigador.id_usuario,
      id_rol: rolInvestigador.id_rol,
    },
  });

  // ========================================
  // CATALOGOS DE PARTICIPANTES DEL PROYECTO (RQF17)
  // ========================================

  await prisma.dedicacion.upsert({
    where: { nombre: "TC" },
    update: {},
    create: { nombre: "TC", descripcion: "Tiempo completo" },
  });
  await prisma.dedicacion.upsert({
    where: { nombre: "MT" },
    update: {},
    create: { nombre: "MT", descripcion: "Medio tiempo" },
  });
  await prisma.dedicacion.upsert({
    where: { nombre: "HC" },
    update: {},
    create: { nombre: "HC", descripcion: "Horas cátedra" },
  });

  const rolesProyecto = [
    "Investigador(a) Principal UNICESMAG",
    "Co investigador(a) UNICESMAG",
    "Co investigador(a) Externo(a)",
    "Co investigador(a) Egresado(a) UNICESMAG",
    "Estudiante Investigador(a)",
  ];
  for (const nombre of rolesProyecto) {
    await prisma.rolProyecto.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  const rolesEstudiante = ["asistente", "auxiliar"];
  for (const nombre of rolesEstudiante) {
    await prisma.rolEstudiante.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // ========================================
  // CATALOGOS RQF18-25 (area, facultad, tipo_programa, tipo_grupo, linea, ods)
  // ========================================

  const areas = ["Ciencias Sociales", "Ingeniería y Tecnología", "Ciencias de la Salud"];
  for (const nombre of areas) {
    await prisma.areaConocimiento.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  const facultad = await prisma.facultad.upsert({
    where: { nombre: "Facultad de Ingeniería" },
    update: {},
    create: { nombre: "Facultad de Ingeniería" },
  });

  const tipoProgramaPregrado = await prisma.tipoPrograma.upsert({
    where: { nombre: "pregrado" },
    update: {},
    create: { nombre: "pregrado" },
  });
  await prisma.tipoPrograma.upsert({
    where: { nombre: "posgrado" },
    update: {},
    create: { nombre: "posgrado" },
  });

  const programaExistente = await prisma.programa.findFirst({
    where: { nombre: "Ingeniería de Sistemas", id_facultad: facultad.id_facultad },
  });
  if (!programaExistente) {
    await prisma.programa.create({
      data: {
        nombre: "Ingeniería de Sistemas",
        id_facultad: facultad.id_facultad,
        id_tipo_programa: tipoProgramaPregrado.id_tipo_programa,
      },
    });
  }

  const tiposGrupo = ["interno", "externo"];
  for (const nombre of tiposGrupo) {
    await prisma.tipoGrupo.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  await prisma.lineaInvestigacion.upsert({
    where: { nombre: "Software y Tecnologías Emergentes" },
    update: {},
    create: { nombre: "Software y Tecnologías Emergentes" },
  });

  const odsEjemplo = [
    "ODS 4: Educación de calidad",
    "ODS 9: Industria, innovación e infraestructura",
  ];
  for (const nombre of odsEjemplo) {
    await prisma.ods.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // ========================================
  // CATALOGOS RQF29-32 (periodo, categorias/subcategorias/tipos de producto)
  // ========================================

  const periodos = ["Periodo I", "Periodo II"];
  for (const nombre of periodos) {
    await prisma.periodo.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  const categoriaProductos = await prisma.categoriaProducto.upsert({
    where: { nombre: "Productos de generación de nuevo conocimiento" },
    update: {},
    create: { nombre: "Productos de generación de nuevo conocimiento" },
  });

  let subcategoriaArticulos = await prisma.subcategoriaProducto.findFirst({
    where: { nombre: "Artículos", id_categoria: categoriaProductos.id_categoria },
  });
  if (!subcategoriaArticulos) {
    subcategoriaArticulos = await prisma.subcategoriaProducto.create({
      data: { nombre: "Artículos", id_categoria: categoriaProductos.id_categoria },
    });
  }

  const tipoArticuloExistente = await prisma.tipoProducto.findFirst({
    where: { nombre: "Artículo publicado en revista indexada", id_subcategoria: subcategoriaArticulos.id_subcategoria },
  });
  if (!tipoArticuloExistente) {
    await prisma.tipoProducto.create({
      data: {
        nombre: "Artículo publicado en revista indexada",
        id_subcategoria: subcategoriaArticulos.id_subcategoria,
        obligatorio: true,
      },
    });
  }

  // ========================================
  // CATALOGOS RQF36-39 (etapas y tipos de documento)
  // ========================================

  const etapasNombres = ["General/Inicial", "Comite_Investigacion", "Etica", "Pares"];
  const etapasCreadas: Record<string, { id_etapa: number }> = {};
  for (const nombre of etapasNombres) {
    etapasCreadas[nombre] = await prisma.etapa.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  const tipoDocExistente = await prisma.tipoDocumento.findFirst({
    where: { nombre: "Carta de aval del grupo de investigación", id_etapa: etapasCreadas["General/Inicial"].id_etapa },
  });
  if (!tipoDocExistente) {
    await prisma.tipoDocumento.create({
      data: {
        nombre: "Carta de aval del grupo de investigación",
        descripcion: "Documento firmado por el líder del grupo avalando el proyecto",
        id_etapa: etapasCreadas["General/Inicial"].id_etapa,
        activo: true,
      },
    });
  }
  const tiposDocumentoFirmas = [
    { nombre: "Formato de proyecto firmado", descripcion: "Formato del proyecto firmado por los investigadores" },
    { nombre: "Formato de ética", descripcion: "Formato de componente ético firmado" },
  ];
  for (const t of tiposDocumentoFirmas) {
    const existente = await prisma.tipoDocumento.findFirst({
      where: { nombre: t.nombre, id_etapa: etapasCreadas["General/Inicial"].id_etapa },
    });
    if (!existente) {
      await prisma.tipoDocumento.create({
        data: { ...t, id_etapa: etapasCreadas["General/Inicial"].id_etapa, activo: true },
      });
    }
  }
  const modalidadesProyecto = [
    "Investigación Científica",
    "Desarrollo Tecnológico",
    "Innovación",
    "Creación Artística y Cultural",
  ];
  for (const nombre of modalidadesProyecto) {
    const existente = await prisma.modalidadProyecto.findFirst({ where: { nombre } });
    if (!existente) await prisma.modalidadProyecto.create({ data: { nombre } });
  }

  const tiposProyecto = ["Investigación Básica", "Investigación Aplicada"];
  for (const nombre of tiposProyecto) {
    const existente = await prisma.tipoProyecto.findFirst({ where: { nombre } });
    if (!existente) await prisma.tipoProyecto.create({ data: { nombre } });
  }

  // ========================================
  // TAXONOMÍA COMPLETA DE PRODUCTOS DE INVESTIGACIÓN (RQF30-32)
  // Extraída 1:1 de la tabla "Resultados esperados" del frontend, para que
  // cada fila que ya diseñó el compañero tenga su id_tipo_producto real.
  // ========================================

  const taxonomiaProductos: {
    categoria: string;
    subcategorias: { nombre: string; tipos: string[] }[];
  }[] = [
      {
        categoria: "Generación de nuevo conocimiento",
        subcategorias: [
          { nombre: "Artículos de investigación", tipos: ["A1", "A2", "B"] },
          { nombre: "Productos tecnológicos patentados o en proceso de concesión de la patente", tipos: ["Patente de invención", "Patente de modelo de utilidad"] },
          { nombre: "Variedad vegetal", tipos: ["Variedad vegetal"] },
          { nombre: "Nueva raza animal", tipos: ["Nueva raza animal"] },
          { nombre: "Obras o productos de investigación-creación en artes, arquitectura y diseño", tipos: ["Obra o creación efímera (vitrinismo, producto gráfico)", "Obra o creación permanente (producto gráfico, fotografía, cómic, video y diseño de personaje)", "Obra o creación procesal (programas de proyección o innovación social, story board, método pedagógico, direcciones y consultorías de proyectos)"] },
        ],
      },
      {
        categoria: "Formación de Recurso Humano en CTeI",
        subcategorias: [
          { nombre: "Dirección Tesis de doctorado", tipos: ["Dirección Tesis de doctorado"] },
          { nombre: "Dirección Trabajo de Grado de maestría", tipos: ["Dirección Trabajo de Grado de maestría"] },
          { nombre: "Dirección Trabajo de Grado de pregrado", tipos: ["Dirección Trabajo de Grado de pregrado"] },
          { nombre: "Proyecto investigación y desarrollo, Investigación-creación, Desarrollo e Innovación I+D+I (con acto administrativo en el cual se asigna recurso externo)", tipos: ["Proyecto investigación y desarrollo, Investigación-creación, Desarrollo e Innovación I+D+I (con acto administrativo en el cual se asigna recurso externo)"] },
          { nombre: "Proyecto de extensión y responsabilidad social en CTI (que involucre soluciones)", tipos: ["Proyecto de extensión y responsabilidad social en CTI (que involucre soluciones)"] },
          { nombre: "Apoyo a programas y cursos de formación de investigadores (Acto administrativo)", tipos: ["Apoyo a programas y cursos de formación de investigadores (Acto administrativo)"] },
          { nombre: "Acompañamiento y asesoría de línea temática del programa Ondas (Aval del programa Ondas)", tipos: ["Acompañamiento y asesoría de línea temática del programa Ondas (Aval del programa Ondas)"] },
        ],
      },
      {
        categoria: "Desarrollo tecnológico e innovación",
        subcategorias: [
          { nombre: "Productos tecnológicos certificados o validados", tipos: ["Diseño Industrial", "Esquema de Circuito integrado", "Software", "Planta piloto", "Prototipo industrial", "Signos distintivos", "Patente de invención", "Patente de modelo de utilidad"] },
          { nombre: "Productos empresariales", tipos: ["Secreto empresarial", "Empresas de base tecnológica", "Productos o procesos tecnológicos usualmente no patentables o registrables", "Innovación generada en gestión empresarial", "Innovaciones en procedimientos y servicios"] },
          { nombre: "Regulaciones, normas, reglamentos o legislaciones", tipos: ["Norma técnica", "Reglamento técnico", "Guía de práctica clínica", "Proyecto de ley"] },
          { nombre: "Consultorías e informes técnicos finales", tipos: ["Consultorías científico-tecnológicas", "Consultoría en arte, arquitectura y diseño"] },
          { nombre: "Acuerdos de licencia para la explotación de obras protegidas por derecho de autor", tipos: ["Acuerdos de licencia para la explotación de obras protegidas por derecho de autor"] },
        ],
      },
      {
        categoria: "Apropiación social del conocimiento",
        subcategorias: [
          { nombre: "Comunicación con enfoque en las relaciones entre ciencia, tecnología y sociedad", tipos: ["Estrategias de comunicación de conocimiento (certificación)", "Generación de contenidos impresos, radiales, audiovisuales, multimedia, virtuales y creative commons", "Edición de revista o libro de divulgación científica (certificación)"] },
          { nombre: "Estrategia pedagógica para el fomento de la CTeI", tipos: ["Programa/ estrategia pedagógica para el fomento de la CTeI (certificación)", "Alianzas con centros dedicados a la apropiación social del conocimiento"] },
          { nombre: "Participación ciudadana en CTeI", tipos: ["Participación ciudadana en CTeI (constancia de participación)", "Espacio de participación ciudadana en CTeI (constancia de participación)"] },
          { nombre: "Circulación de conocimiento especializado", tipos: ["Evento científico con componente de apropiación (certificación)", "Participación en red de conocimiento (certificación)", "Talleres de creación (certificación)", "Eventos artísticos de arquitectura o de diseño con componentes de apropiación (certificación)", "Documentos de trabajo", "Boletín divulgativo de resultados de investigación"] },
          { nombre: "Reconocimientos nacionales o internacionales por procesos de apropiación social del conocimiento", tipos: ["Premios o distinciones (certificación)"] },
        ],
      },
    ];

  for (const cat of taxonomiaProductos) {
    let categoriaDb = await prisma.categoriaProducto.findFirst({ where: { nombre: cat.categoria } });
    if (!categoriaDb) {
      categoriaDb = await prisma.categoriaProducto.create({ data: { nombre: cat.categoria } });
    }
    for (const sub of cat.subcategorias) {
      let subDb = await prisma.subcategoriaProducto.findFirst({
        where: { nombre: sub.nombre, id_categoria: categoriaDb.id_categoria },
      });
      if (!subDb) {
        subDb = await prisma.subcategoriaProducto.create({
          data: { nombre: sub.nombre, id_categoria: categoriaDb.id_categoria },
        });
      }
      for (const tipoNombre of sub.tipos) {
        const tipoExistente = await prisma.tipoProducto.findFirst({
          where: { nombre: tipoNombre, id_subcategoria: subDb.id_subcategoria },
        });
        if (!tipoExistente) {
          await prisma.tipoProducto.create({
            data: { nombre: tipoNombre, id_subcategoria: subDb.id_subcategoria, obligatorio: false },
          });
        }
      }
    }
  }
  console.log(`Taxonomía de productos sembrada: ${taxonomiaProductos.length} categorías.`);
  // ========================================
  // USUARIOS DE PRUEBA PARA EL BUSCADOR DE PARTICIPANTES
  // (12 cuentas: 3 pensadas como internos, 3 externos, 3 egresados, 3
  // estudiantes — el "tipo" es solo el nombre para que los reconozcas en
  // el buscador; el rol real que cumplen en cada proyecto se elige al
  // agregarlos como participante, no en la cuenta en sí).
  // ========================================

  const usuariosDePrueba = [
    { nombre: "Interno", apellido: "Uno", correo: "interno1@unicesmag.edu.co", codigo: "INT001" },
    { nombre: "Interno", apellido: "Dos", correo: "interno2@unicesmag.edu.co", codigo: "INT002" },
    { nombre: "Interno", apellido: "Tres", correo: "interno3@unicesmag.edu.co", codigo: "INT003" },
    { nombre: "Externo", apellido: "Uno", correo: "externo1@unicesmag.edu.co", codigo: "EXT001" },
    { nombre: "Externo", apellido: "Dos", correo: "externo2@unicesmag.edu.co", codigo: "EXT002" },
    { nombre: "Externo", apellido: "Tres", correo: "externo3@unicesmag.edu.co", codigo: "EXT003" },
    { nombre: "Egresado", apellido: "Uno", correo: "egresado1@unicesmag.edu.co", codigo: "EGR001" },
    { nombre: "Egresado", apellido: "Dos", correo: "egresado2@unicesmag.edu.co", codigo: "EGR002" },
    { nombre: "Egresado", apellido: "Tres", correo: "egresado3@unicesmag.edu.co", codigo: "EGR003" },
    { nombre: "Estudiante", apellido: "Uno", correo: "estudiante1@unicesmag.edu.co", codigo: "EST001" },
    { nombre: "Estudiante", apellido: "Dos", correo: "estudiante2@unicesmag.edu.co", codigo: "EST002" },
    { nombre: "Estudiante", apellido: "Tres", correo: "estudiante3@unicesmag.edu.co", codigo: "EST003" },
  ];

  const contraseñaPruebaHash = await bcrypt.hash("Prueba123*", 10);

  for (const u of usuariosDePrueba) {
    const creado = await prisma.usuario.upsert({
      where: { correo: u.correo },
      update: {},
      create: {
        nombre: u.nombre,
        apellido: u.apellido,
        correo: u.correo,
        contraseña: contraseñaPruebaHash,
        codigo: u.codigo,
        cedula: "0".repeat(9) + u.codigo.slice(-1),
      },
    });

    await prisma.rolesUsuario.upsert({
      where: { id_usuario_id_rol: { id_usuario: creado.id_usuario, id_rol: rolInvestigador.id_rol } },
      update: {},
      create: { id_usuario: creado.id_usuario, id_rol: rolInvestigador.id_rol },
    });
  }

  console.log(`${usuariosDePrueba.length} usuarios de prueba creados (correo: interno1@..., externo1@..., egresado1@..., estudiante1@... — contraseña para todos: Prueba123*)`);


  console.log("Usuario investigador creado correctamente.");
  console.log(`Correo: ${investigador.correo}`);
  console.log("Contraseña: Investigador123*");

  console.log("Roles iniciales creados correctamente.");
  console.log("Usuario administrador creado correctamente.");
  console.log(`Correo: ${administrador.correo}`);
  console.log("Contraseña: Admin123*");
}


main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });