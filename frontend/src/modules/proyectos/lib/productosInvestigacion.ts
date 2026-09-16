import type { CategoriaProductoItem } from '../api/productos'

export interface TipoProductoLocal {
  id: number
  nombre: string

  idReal: number | null
}

export interface SubcategoriaProductoLocal {
  id: number
  nombre: string
  nota?: string
  tipos: TipoProductoLocal[]
}

export interface CategoriaProductoLocal {
  id: number
  nombre: string
  subtitulo?: string
  subcategorias: SubcategoriaProductoLocal[]
}

let siguienteId = 1
const idAuto = () => siguienteId++

const catalogoSemilla: CategoriaProductoLocal[] = [
  {
    id: idAuto(),
    nombre: 'Generación de nuevo conocimiento',
    subtitulo: '(Selección obligatoria)',
    subcategorias: [
      {
        id: idAuto(),
        nombre: 'Artículos de investigación',
        nota: 'Se sugiere que la categorización de la revista esté asociada a un cuartil Q1, Q2, Q3 o Q4 de JCR o SJR.',
        tipos: [
          { id: idAuto(), nombre: 'A1', idReal: null },
          { id: idAuto(), nombre: 'A2', idReal: null },
          { id: idAuto(), nombre: 'B', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Productos tecnológicos patentados o en proceso de concesión de la patente',
        tipos: [
          { id: idAuto(), nombre: 'Patente de invención', idReal: null },
          { id: idAuto(), nombre: 'Patente de modelo de utilidad', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Variedad vegetal',
        tipos: [{ id: idAuto(), nombre: 'Variedad vegetal', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Nueva raza animal',
        tipos: [{ id: idAuto(), nombre: 'Nueva raza animal', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Obras o productos de investigación-creación en artes, arquitectura y diseño',
        tipos: [
          {
            id: idAuto(),
            nombre: 'Obra o creación efímera (vitrinismo, producto gráfico)',
            idReal: null,
          },
          {
            id: idAuto(),
            nombre: 'Obra o creación permanente (producto gráfico, fotografía, comic, video y diseño de personaje)',
            idReal: null,
          },
          {
            id: idAuto(),
            nombre:
              'Obra o creación procesual (programas de proyección o innovación social, story board, método pedagógico, direcciones y consultorías de proyectos)',
            idReal: null,
          },
        ],
      },
    ],
  },
  {
    id: idAuto(),
    nombre: 'Desarrollo tecnológico e innovación',
    subtitulo: '(Selección obligatoria)',
    subcategorias: [
      {
        id: idAuto(),
        nombre: 'Productos tecnológicos certificados o validados',
        tipos: [
          { id: idAuto(), nombre: 'Diseño Industrial', idReal: null },
          { id: idAuto(), nombre: 'Esquema de Circuito integrado', idReal: null },
          { id: idAuto(), nombre: 'Software', idReal: null },
          { id: idAuto(), nombre: 'Planta piloto', idReal: null },
          { id: idAuto(), nombre: 'Prototipo industrial', idReal: null },
          { id: idAuto(), nombre: 'Signos distintivos', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Productos empresariales',
        tipos: [
          { id: idAuto(), nombre: 'Secreto empresarial', idReal: null },
          { id: idAuto(), nombre: 'Empresas de base tecnológica', idReal: null },
          { id: idAuto(), nombre: 'Empresas creativas y culturales', idReal: null },
          { id: idAuto(), nombre: 'Productos o procesos tecnológicos usualmente no patentables o registrables', idReal: null },
          { id: idAuto(), nombre: 'Innovación generada en gestión empresarial', idReal: null },
          { id: idAuto(), nombre: 'Innovaciones en procedimientos y servicios', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Regulaciones, normas, reglamentos o legislaciones',
        tipos: [
          { id: idAuto(), nombre: 'Norma técnica', idReal: null },
          { id: idAuto(), nombre: 'Reglamento técnico', idReal: null },
          { id: idAuto(), nombre: 'Guía de práctica clínica', idReal: null },
          { id: idAuto(), nombre: 'Proyecto de ley', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Consultorías e informes técnicos finales',
        tipos: [
          { id: idAuto(), nombre: 'Consultorías científico-tecnológicas', idReal: null },
          { id: idAuto(), nombre: 'Consultoría en arte, arquitectura y diseño', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Acuerdos de licencia para la explotación de obras protegidas por derecho de autor',
        tipos: [
          {
            id: idAuto(),
            nombre: 'Acuerdos de licencia para la explotación de obras protegidas por derecho de autor',
            idReal: null,
          },
        ],
      },
    ],
  },
  {
    id: idAuto(),
    nombre: 'Formación de Recurso Humano en CTeI',
    subtitulo: '(Selección obligatoria)',
    subcategorias: [
      { id: idAuto(), nombre: 'Dirección Tesis de doctorado', tipos: [{ id: idAuto(), nombre: 'Dirección Tesis de doctorado', idReal: null }] },
      { id: idAuto(), nombre: 'Dirección Trabajo de Grado de maestría', tipos: [{ id: idAuto(), nombre: 'Dirección Trabajo de Grado de maestría', idReal: null }] },
      { id: idAuto(), nombre: 'Dirección Trabajo de Grado de pregrado', tipos: [{ id: idAuto(), nombre: 'Dirección Trabajo de Grado de pregrado', idReal: null }] },
      {
        id: idAuto(),
        nombre:
          'Proyecto investigación y desarrollo, Investigación-creación, Desarrollo e Innovación I+D+I (con acto administrativo en el cual se asigna recurso externo)',
        tipos: [
          {
            id: idAuto(),
            nombre:
              'Proyecto investigación y desarrollo, Investigación-creación, Desarrollo e Innovación I+D+I (con acto administrativo en el cual se asigna recurso externo)',
            idReal: null,
          },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Proyecto de extensión y responsabilidad social en CTI (que involucre soluciones)',
        tipos: [
          {
            id: idAuto(),
            nombre: 'Proyecto de extensión y responsabilidad social en CTI (que involucre soluciones)',
            idReal: null,
          },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Apoyo a programas y cursos de formación de investigadores (Acto administrativo)',
        tipos: [
          {
            id: idAuto(),
            nombre: 'Apoyo a programas y cursos de formación de investigadores (Acto administrativo)',
            idReal: null,
          },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Acompañamiento y asesoría de línea temática del programa Ondas (Aval del programa Ondas)',
        tipos: [
          {
            id: idAuto(),
            nombre: 'Acompañamiento y asesoría de línea temática del programa Ondas (Aval del programa Ondas)',
            idReal: null,
          },
        ],
      },
    ],
  },
  {
    id: idAuto(),
    nombre: 'Apropiación social del conocimiento y Divulgación Pública de la Ciencia',
    subtitulo: '(Selección obligatoria)',
    subcategorias: [
      {
        id: idAuto(),
        nombre: 'Comunicación con enfoque en las relaciones entre ciencia, tecnología y sociedad',
        tipos: [
          { id: idAuto(), nombre: 'Estrategias de comunicación de conocimiento (certificación)', idReal: null },
          { id: idAuto(), nombre: 'Generación de contenidos impresos, radiales, audiovisuales, multimedia, virtuales y creative commons (certificación)', idReal: null },
          { id: idAuto(), nombre: 'Edición de revista o libro de divulgación científica (certificado)', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Estrategia pedagógica para el fomento de la CTeI',
        tipos: [
          { id: idAuto(), nombre: 'Programa/estrategia pedagógica para el fomento de la CTeI (certificación)', idReal: null },
          { id: idAuto(), nombre: 'Alianzas con centros dedicados a la apropiación social del conocimiento (certificación)', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Participación ciudadana en CTeI',
        tipos: [
          { id: idAuto(), nombre: 'Participación ciudadana en CTeI (constancia de participación)', idReal: null },
          { id: idAuto(), nombre: 'Espacio de participación ciudadana en CTeI (constancia de participación)', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Circulación de conocimiento especializado',
        tipos: [
          { id: idAuto(), nombre: 'Evento científico con componente de apropiación (certificación)', idReal: null },
          { id: idAuto(), nombre: 'Participación en red de conocimiento (certificación)', idReal: null },
          { id: idAuto(), nombre: 'Talleres de creación (certificación)', idReal: null },
          { id: idAuto(), nombre: 'Eventos artísticos de arquitectura o de diseño con componentes de apropiación (certificación)', idReal: null },
          { id: idAuto(), nombre: 'Documentos de trabajo', idReal: null },
          { id: idAuto(), nombre: 'Boletín divulgativo de resultados de investigación', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Reconocimientos nacionales o internacionales por procesos de apropiación social del conocimiento',
        tipos: [{ id: idAuto(), nombre: 'Premios o distinciones (certificación)', idReal: null }],
      },
    ],
  },
]

const norm = (s: string) => s.trim().toLowerCase()

export function combinarConBackend(categoriasReales: CategoriaProductoItem[]): CategoriaProductoLocal[] {
  const resultado: CategoriaProductoLocal[] = catalogoSemilla.map((cat) => ({
    ...cat,
    subcategorias: cat.subcategorias.map((sub) => ({
      ...sub,
      tipos: sub.tipos.map((t) => ({ ...t })),
    })),
  }))

  const categoriaPorNombre = new Map(categoriasReales.map((c) => [norm(c.nombre), c]))
  for (const cat of resultado) {
    const catReal = categoriaPorNombre.get(norm(cat.nombre))
    if (!catReal) continue
    const subPorNombre = new Map(catReal.subcategorias.map((s) => [norm(s.nombre), s]))
    for (const sub of cat.subcategorias) {
      const subReal = subPorNombre.get(norm(sub.nombre))
      if (!subReal) continue
      const tipoPorNombre = new Map(subReal.tipos.map((t) => [norm(t.nombre), t]))
      for (const tipo of sub.tipos) {
        const tipoReal = tipoPorNombre.get(norm(tipo.nombre))
        if (tipoReal) tipo.idReal = tipoReal.id_tipo_producto
      }
    }
  }

  const nombresLocales = new Set(resultado.map((c) => norm(c.nombre)))
  for (const catReal of categoriasReales) {
    if (nombresLocales.has(norm(catReal.nombre))) continue
    resultado.push({
      id: idAuto(),
      nombre: catReal.nombre,
      subcategorias: catReal.subcategorias.map((s) => ({
        id: idAuto(),
        nombre: s.nombre,
        tipos: s.tipos.map((t) => ({ id: idAuto(), nombre: t.nombre, idReal: t.id_tipo_producto })),
      })),
    })
  }

  return resultado
}
