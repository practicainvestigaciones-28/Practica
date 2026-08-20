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