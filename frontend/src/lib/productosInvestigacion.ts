import type { CategoriaProductoItem } from '../api/productos'

// ⚠️ MODO PRUEBA — la pestaña "Resultados esperados" de Crear proyecto
// depende de GET /productos/categorias, y ese catálogo del backend hoy
// solo tiene sembrada una categoría con un tipo ("Artículos" → "Artículo
// publicado en revista indexada"). A diferencia de otros catálogos
// (modalidades, áreas, periodos, líneas, ODS, grupos), este NO tiene
// ningún endpoint de creación (ni siquiera uno solo-Administrador) — no
// hay forma de registrar nada nuevo desde el front.
//
// Esta lista reconstruye en local la estructura completa que pide la
// hoja física "Presentación de Proyectos de Investigación" (INV-IC-FR,
// versión 7, sección 4.10), armada a partir de dos fotos de la hoja —
// puede tener algún nombre o agrupación distinto al texto exacto de la
// hoja en los casos menos legibles de la foto; conviene revisarla contra
// el papel antes de que el backend la siembre.
//
// combinarConBackend() empareja cada tipo por nombre con el catálogo
// real: si el backend ya tiene ese tipo, usa su id_tipo_producto real
// (idReal) y sí se puede guardar; si no, se sigue mostrando en el
// formulario (para que ya se vea completo) pero no se puede guardar
// todavía — eso lo resuelve tu compañero sembrando el resto en el
// backend, y en cuanto los nombres coincidan, se emparejará solo.

export interface TipoProductoLocal {
  id: number
  nombre: string
  /** id_tipo_producto real del backend, o null si esa fila todavía no
   * existe allá — sin esto no se puede guardar la cantidad. */
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
    nombre: 'Formación de Recurso Humano en CTeI',
    subtitulo: '(Selección obligatoria)',
    subcategorias: [
      { id: idAuto(), nombre: 'Dirección Tesis de doctorado', tipos: [{ id: idAuto(), nombre: 'Dirección Tesis de doctorado', idReal: null }] },
      { id: idAuto(), nombre: 'Dirección Trabajo de Grado de maestría', tipos: [{ id: idAuto(), nombre: 'Dirección Trabajo de Grado de maestría', idReal: null }] },
      { id: idAuto(), nombre: 'Dirección Trabajo de Grado de pregrado', tipos: [{ id: idAuto(), nombre: 'Dirección Trabajo de Grado de pregrado', idReal: null }] },
      {
        id: idAuto(),
        nombre: 'Proyecto investigación y desarrollo, Investigación-creación, Desarrollo e Innovación I+D+i',
        nota: 'Con acto administrativo en el cual se asigna recurso externo.',
        tipos: [{ id: idAuto(), nombre: 'Proyecto investigación y desarrollo, Investigación-creación, Desarrollo e Innovación I+D+i', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Proyecto de extensión y responsabilidad social en CTI',
        nota: 'Que involucre soluciones.',
        tipos: [{ id: idAuto(), nombre: 'Proyecto de extensión y responsabilidad social en CTI', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Apoyo a programas y cursos de formación de investigadores',
        nota: 'Acto administrativo.',
        tipos: [{ id: idAuto(), nombre: 'Apoyo a programas y cursos de formación de investigadores', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Acompañamiento y asesoría de línea temática del programa Ondas',
        nota: 'Aval del programa Ondas.',
        tipos: [{ id: idAuto(), nombre: 'Acompañamiento y asesoría de línea temática del programa Ondas', idReal: null }],
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
          { id: idAuto(), nombre: 'Esquema de circuito integrado', idReal: null },
          { id: idAuto(), nombre: 'Software', idReal: null },
          { id: idAuto(), nombre: 'Planta piloto', idReal: null },
          { id: idAuto(), nombre: 'Prototipo industrial', idReal: null },
          { id: idAuto(), nombre: 'Diseño industrial', idReal: null },
          { id: idAuto(), nombre: 'Signos distintivos', idReal: null },
          { id: idAuto(), nombre: 'Secreto empresarial', idReal: null },
          { id: idAuto(), nombre: 'Empresas de base tecnológica', idReal: null },
          { id: idAuto(), nombre: 'Empresas creativas y culturales', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Productos empresariales',
        tipos: [{ id: idAuto(), nombre: 'Productos empresariales', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Productos o procesos tecnológicos usualmente no patentables o registrables',
        tipos: [
          { id: idAuto(), nombre: 'Productos o procesos tecnológicos usualmente no patentables o registrables', idReal: null },
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
        nombre: 'Regulaciones, normas, reglamentos o legislaciones',
        tipos: [
          { id: idAuto(), nombre: 'Norma técnica', idReal: null },
          { id: idAuto(), nombre: 'Reglamento técnico', idReal: null },
        ],
      },
      {
        id: idAuto(),
        nombre: 'Innovaciones en procedimientos y servicios',
        tipos: [{ id: idAuto(), nombre: 'Innovaciones en procedimientos y servicios', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Innovación generada en gestión empresarial',
        tipos: [{ id: idAuto(), nombre: 'Innovación generada en gestión empresarial', idReal: null }],
      },
    ],
  },
  {
    id: idAuto(),
    nombre: 'Obras o productos de investigación-creación en artes, arquitectura y diseño',
    subcategorias: [
      {
        id: idAuto(),
        nombre: 'Obra o creación efímera',
        nota: 'Vitrinismo, producto gráfico.',
        tipos: [{ id: idAuto(), nombre: 'Obra o creación efímera', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Obra o creación permanente',
        nota: 'Producto gráfico, fotografía, cómic, video y diseño de personaje.',
        tipos: [{ id: idAuto(), nombre: 'Obra o creación permanente', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Obra o creación procesual',
        nota: 'Programas o proyección de innovación social, story board, método pedagógico, direcciones y consultorías de proyectos.',
        tipos: [{ id: idAuto(), nombre: 'Obra o creación procesual', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Guía de práctica clínica',
        tipos: [{ id: idAuto(), nombre: 'Guía de práctica clínica', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Proyecto de ley',
        tipos: [{ id: idAuto(), nombre: 'Proyecto de ley', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Consultoría en arte, arquitectura y diseño',
        tipos: [{ id: idAuto(), nombre: 'Consultoría en arte, arquitectura y diseño', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Consultorías científico-técnicas',
        tipos: [{ id: idAuto(), nombre: 'Consultorías científico-técnicas', idReal: null }],
      },
      {
        id: idAuto(),
        nombre: 'Consultorías, informes técnicos e finales',
        tipos: [{ id: idAuto(), nombre: 'Consultorías, informes técnicos e finales', idReal: null }],
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
]

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Combina la semilla local con lo que de verdad tenga el backend: empareja
 * por nombre (categoría → subcategoría → tipo) y asigna el id_tipo_producto
 * real donde haya coincidencia; además importa cualquier categoría real que
 * no esté en la semilla, para no ocultar nunca lo que el backend ya tenga.
 * No persiste nada — se recalcula cada vez con la respuesta fresca del
 * backend, ya que aquí no hay ninguna pantalla de administrador que edite
 * esta lista en local (a diferencia de modalidades, áreas, periodos, etc.).
 */
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
