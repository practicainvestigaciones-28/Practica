/**
 * Las notificaciones llegan como una sola línea ("… el proyecto "Título" — queda pendiente de …"). Para leerlas mejor, el detalle las
 * separa en: una introducción, el proyecto (o la convocatoria) en su propia línea y lo que sigue (qué se puede o se debe hacer, o el
 * resultado) en un recuadro de color. Cada regla reconoce uno de los mensajes que genera el sistema; los que no se reconocen se
 * muestran tal cual, como antes. Sirve también para las notificaciones ya guardadas.
 */

export type TonoCuadro = 'verde' | 'ambar' | 'azul' | 'rojo'

export interface CuadroNotificacion {
  tono: TonoCuadro
  titulo?: string
  texto: string
}

export interface FormatoNotificacion {
  /** Primera línea, que termina anunciando lo que sigue ("… aprobó el siguiente proyecto:"). */
  intro: string
  /** El proyecto (o la convocatoria), entre comillas, en su propia línea. */
  proyecto: string | null
  /** Datos sueltos (convocatoria, investigador...) como "Etiqueta: valor". */
  detalles: [string, string][]
  cuadros: CuadroNotificacion[]
}

const mayuscula = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)
const conPunto = (t: string) => (/[.:!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)
const GUION = '\\s*[—-]\\s*'

interface Regla {
  patron: RegExp
  armar: (m: RegExpExecArray) => FormatoNotificacion
}

const cuadro = (tono: TonoCuadro, texto: string, titulo?: string): CuadroNotificacion => ({ tono, texto: conPunto(mayuscula(texto)), titulo })

const REGLAS: Regla[] = [
  {
    // Administrador: un comité aprobó el proyecto.
    patron: new RegExp(`^(.+?) aprobó el proyecto "([\\s\\S]+)"${GUION}(ya puedes asignarlo a la siguiente etapa)\\.?$`, 'i'),
    armar: (m) => ({ intro: `${m[1].trim()} aprobó el siguiente proyecto:`, proyecto: m[2].trim(), detalles: [], cuadros: [cuadro('verde', m[3])] }),
  },
  {
    // Administrador: un comité pidió correcciones.
    patron: new RegExp(`^(.+?) pidió correcciones al proyecto "([\\s\\S]+)"${GUION}(queda pendiente de que el investigador lo corrija y lo reenvíe)\\.?$`, 'i'),
    armar: (m) => ({ intro: `${m[1].trim()} pidió correcciones al siguiente proyecto:`, proyecto: m[2].trim(), detalles: [], cuadros: [cuadro('ambar', m[3])] }),
  },
  {
    // Investigador: su proyecto necesita correcciones.
    patron: /^(.+?) evaluó tu proyecto "([\s\S]+)" y pidió correcciones\.\s*([\s\S]+)$/i,
    armar: (m) => ({ intro: `${m[1].trim()} evaluó tu proyecto y pidió correcciones:`, proyecto: m[2].trim(), detalles: [], cuadros: [cuadro('ambar', m[3])] }),
  },
  {
    // Investigador: sus correcciones fueron validadas.
    patron: /^(.+?) validó tus correcciones y tu proyecto "([\s\S]+)" quedó definitivamente aprobado\.?$/i,
    armar: (m) => ({ intro: `${m[1].trim()} validó tus correcciones:`, proyecto: m[2].trim(), detalles: [], cuadros: [cuadro('verde', 'Tu proyecto quedó definitivamente aprobado')] }),
  },
  {
    // Administrador: el investigador reenvió el proyecto corregido (tras la evaluación de un comité).
    patron: new RegExp(`^El investigador reenvió el proyecto "([\\s\\S]+)" ya corregido${GUION}(queda pendiente de asignar a [\\s\\S]+?)\\.?$`, 'i'),
    armar: (m) => ({ intro: 'El investigador reenvió ya corregido el siguiente proyecto:', proyecto: m[1].trim(), detalles: [], cuadros: [cuadro('azul', m[2])] }),
  },
  {
    // Investigador principal: un proyecto registrado a su nombre espera su firma.
    patron: new RegExp(`^El Administrador registró a tu nombre el proyecto "([\\s\\S]+)"${GUION}(queda pendiente de tu firma[\\s\\S]*?)\\.?$`, 'i'),
    armar: (m) => ({ intro: 'El Administrador registró a tu nombre el siguiente proyecto:', proyecto: m[1].trim(), detalles: [], cuadros: [cuadro('ambar', m[2])] }),
  },
  {
    // Líder: un proyecto de su grupo espera su visto bueno.
    patron: new RegExp(`^(.+?) registró el proyecto "([\\s\\S]+)" de tu grupo de investigación(.*?)${GUION}(queda pendiente de tu visto bueno)\\.?$`, 'i'),
    armar: (m) => ({
      intro: `${m[1].trim()} registró el siguiente proyecto de tu grupo de investigación${m[3].trim() ? ` ${m[3].trim()}` : ''}:`,
      proyecto: m[2].trim(),
      detalles: [],
      cuadros: [cuadro('ambar', m[4])],
    }),
  },
  {
    // Administrador: el líder dio su visto bueno.
    patron: new RegExp(`^(.+?) dio el visto bueno al proyecto "([\\s\\S]+)"${GUION}(queda pendiente de revisión en Proyectos Postulados)\\.?$`, 'i'),
    armar: (m) => ({ intro: `${m[1].trim()} dio el visto bueno al siguiente proyecto:`, proyecto: m[2].trim(), detalles: [], cuadros: [cuadro('azul', m[3])] }),
  },
  {
    // Administrador: el investigador corrigió un proyecto rechazado y lo reenvió.
    patron: new RegExp(`^El investigador corrigió el proyecto "([\\s\\S]+)" \\(antes rechazado\\) y lo reenvió${GUION}(queda pendiente de revisión en Proyectos Postulados)\\.?$`, 'i'),
    armar: (m) => ({ intro: 'El investigador corrigió y reenvió el siguiente proyecto (antes rechazado):', proyecto: m[1].trim(), detalles: [], cuadros: [cuadro('azul', m[2])] }),
  },
  {
    // Administrador: nueva reclamación.
    patron: /^(.+?) presentó una reclamación sobre el proyecto "([\s\S]+)" \((.+)\)\.?$/i,
    armar: (m) => ({ intro: `${m[1].trim()} presentó una reclamación sobre el siguiente proyecto:`, proyecto: m[2].trim(), detalles: [['Etapa de la reclamación', m[3].trim()]], cuadros: [] }),
  },
  {
    // Investigador: respuesta a su reclamación.
    patron: /^Tu reclamación sobre el proyecto "([\s\S]+)" fue respondida: ([\s\S]+)$/i,
    armar: (m) => ({ intro: 'Tu reclamación sobre el siguiente proyecto fue respondida:', proyecto: m[1].trim(), detalles: [], cuadros: [{ tono: 'azul', titulo: 'Respuesta', texto: m[2].trim() }] }),
  },
  {
    // Investigadores: el acta de inicio está lista para aceptar y firmar.
    patron: /^El acta de inicio del proyecto "([\s\S]+)" ya fue generada\.\s*([\s\S]+)$/i,
    armar: (m) => ({ intro: 'El acta de inicio del siguiente proyecto ya fue generada:', proyecto: m[1].trim(), detalles: [], cuadros: [cuadro('azul', m[2])] }),
  },
  {
    // Investigadores: el Administrador solicitó un informe.
    patron: /^El Administrador te solicitó el (.+?) del proyecto "([\s\S]+)"\.\s*(Ya puedes[\s\S]+)$/i,
    armar: (m) => ({ intro: `El Administrador te solicitó el ${m[1].trim()} del siguiente proyecto:`, proyecto: m[2].trim(), detalles: [], cuadros: [cuadro('verde', m[3])] }),
  },
  {
    // Evaluadores y comités: se les asignó un proyecto para revisar.
    patron: /^Se te asignó el proyecto "([\s\S]+)" para su revisión como (.+?)\.\s*Convocatoria: (.+?)\.\s*(?:Investigador\(a\): (.+?)\.\s*)?(Lo encuentras[\s\S]+)$/i,
    armar: (m) => ({
      intro: `Se te asignó el siguiente proyecto para su revisión como ${m[2].trim()}:`,
      proyecto: m[1].trim(),
      detalles: [['Convocatoria', m[3].trim()], ...(m[4] ? ([['Investigador(a)', m[4].trim()]] as [string, string][]) : [])],
      cuadros: [cuadro('azul', m[5])],
    }),
  },
  {
    // Investigador: resultado de la evaluación por pares.
    patron: /^Tu proyecto "([\s\S]+)" fue evaluado por los pares(?:\s+y|:)\s+([\s\S]+)$/i,
    armar: (m) => {
      const resultado = m[2].trim()
      const tono: TonoCuadro = /aprobado sin necesidad/i.test(resultado) ? 'verde' : /ajustes/i.test(resultado) ? 'ambar' : 'rojo'
      return { intro: 'Tu proyecto fue evaluado por los pares:', proyecto: m[1].trim(), detalles: [], cuadros: [cuadro(tono, resultado)] }
    },
  },
  {
    // Investigador: su proyecto fue rechazado (el motivo, si lo hay, ya viene separado en su propio recuadro).
    patron: /^Tu proyecto "([\s\S]+)" (fue rechazado[^.]*)\.?$/i,
    armar: (m) => ({ intro: `Tu proyecto ${m[2].trim()}:`, proyecto: m[1].trim(), detalles: [], cuadros: [] }),
  },
  {
    // Administrador: se abrió el plazo de una fase de revisión.
    patron: /^En la convocatoria "([\s\S]+)", (.+? está habilitado hasta el .+?)\.?$/i,
    armar: (m) => ({ intro: 'En la convocatoria:', proyecto: m[1].trim(), detalles: [], cuadros: [cuadro('verde', m[2])] }),
  },
  {
    // Administrador: cerró el plazo de una fase de revisión.
    patron: /^Convocatoria "([\s\S]+)": ([\s\S]+?)\s+(Puedes reabrir el plazo desde la convocatoria\.?)$/i,
    armar: (m) => ({ intro: 'Cerró un plazo en la convocatoria:', proyecto: m[1].trim(), detalles: [], cuadros: [cuadro('ambar', m[2]), cuadro('azul', m[3])] }),
  },
]

/** Las tres (o más) partes del mensaje, o null si no es de los que se reconocen (se muestra como una sola línea). */
export function formatearNotificacion(mensaje: string): FormatoNotificacion | null {
  const limpio = mensaje.trim()
  for (const regla of REGLAS) {
    const m = regla.patron.exec(limpio)
    if (m) return regla.armar(m)
  }
  return null
}
