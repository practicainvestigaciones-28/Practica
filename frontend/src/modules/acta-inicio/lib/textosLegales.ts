import type { TipoClausula } from '../api/actaInicio'

// Textos tomados literalmente del formato INV-IC-FR-017 v5 (13/MAR/2026).
// Si la VIE publica una versión nueva del formato, se actualizan estos textos
// y VERSION_TEXTOS: la aceptación queda guardada con la versión que se leyó (RQF90).
export const VERSION_TEXTOS = 'INV-IC-FR-017 v5'

export const CLAUSULAS: { tipo: TipoClausula; titulo: string; parrafos: string[] }[] = [
  {
    tipo: 'compromisos',
    titulo: '5. Compromisos de los participantes',
    parrafos: [
      'Los compromisos de los participantes serán los plasmados en las condiciones y términos previstos en el Acuerdo No. 026 de 2025 por el cual se reglamenta la Convocatoria Anual para elegir proyectos de Investigación Científica, Desarrollo Tecnológico, Innovación, Creación Artística y Cultural UNICESMAG 2026 para ser financiados por la Universidad CESMAG.',
      'Nota 1: La construcción y entrega de los productos resultados del proceso de investigación que se encuentran estipulados en el Acuerdo 026 de 2025, son responsabilidad conjunta del Investigador Principal y el Co-Investigador.',
      'Nota 2: Los productos a entregar deben ser resultado del proyecto de investigación, por lo tanto, no se aceptarán productos con fecha de creación o publicación anterior a la fecha de inicio del proyecto.',
      'Nota 3: Un producto no podrá reportarse como resultado de dos o más proyectos de investigación, aunque los autores del producto se encuentren en diferentes proyectos.',
      'De igual manera serán obligaciones de los participantes del proyecto, las siguientes:',
      'a. Informar de manera oportuna e inmediata cualquier situación de orden contractual o extraordinaria que afecte el desarrollo normal del proyecto de investigación o de aula mediante oficio dirigido al Vicerrector de Investigación y Extensión.',
      'b. Cumplir con los compromisos académicos, administrativos y éticos necesarios para la correcta ejecución del proyecto de investigación. En tal sentido, el (la) Investigador(a) Principal y el (la) Coinvestigador(a) deben ajustarse a la normativa institucional, al uso adecuado de los recursos asignados y a la entrega oportuna de los productos resultados de la investigación.',
      'c. Salvaguardar la dignidad, los derechos, la seguridad y el bienestar de las personas que se constituyen en sujeto de investigación.',
      'd. Salvaguardar, los derechos, la seguridad y el bienestar de otros seres vivos que se involucren en los procesos investigativos.',
    ],
  },
  {
    tipo: 'derechos de autor',
    titulo: '7. Derechos de autor',
    parrafos: [
      'Sin perjuicio de los derechos morales de autor reconocidos y protegidos por las Leyes 23 de 1982 modificada por la Ley 1915 del 2018, Ley 44 de 1994 y Ley 1450 de 2011, que por su naturaleza están y estarán radicados en cabeza del autor, los derechos patrimoniales de autor (que a título enunciativo y no excluyente son: el de reproducción en todas sus modalidades, transformación o adaptación, edición, comunicación pública, traducción, distribución y en general, cualquier tipo de explotación o usufructo que de la obra se pueda realizar por cualquier medio conocido o por conocer) sobre los resultados que arroje el desarrollo del proyecto realizados por los investigadores, pertenecen a la UNICESMAG a perpetuidad y sin límite de territorio, quedando expresamente convenido que el docente investigador no recibirá ningún tipo de compensación, bonificación o pago de ninguna naturaleza diferente a su salario convenido en el contrato de trabajo suscrito con la Universidad CESMAG, ante lo cual acepta que no existe ninguna expectativa sobre los eventuales efectos económicos que puedan derivarse de la divulgación de resultados o de las obras creadas en virtud del proyecto de investigación.',
      'En consecuencia, en el evento en que el Investigador Principal y/o Coinvestigador renuncie al proyecto de investigación o se produzca la terminación de su vínculo laboral con la Universidad CESMAG, se entenderá que los derechos patrimoniales de autor sobre los aportes, avances, resultados parciales o finales, productos y obras generados en el marco del proyecto permanecen a nombre de UNICESMAG, sin que dicha circunstancia afecte la titularidad, continuidad, culminación, divulgación, explotación o uso de los resultados del proyecto por parte de la Institución, manteniéndose incólume la cesión aquí establecida, sin lugar a compensación económica adicional distinta a la ya pactada contractualmente, de acuerdo al Reglamento de Propiedad Intelectual establecido por la Universidad CESMAG.',
    ],
  },
  {
    tipo: 'confidencialidad',
    titulo: '8. Compromiso de confidencialidad',
    parrafos: [
      'Los investigadores, con la firma de este documento nos comprometemos a mantener la confidencialidad de toda la información y datos proporcionados por la UNICESMAG en el marco de este proyecto. Así como a no divulgar, compartir o utilizar dicha información para fines ajenos al proyecto, sin el consentimiento expreso y por escrito de la Universidad.',
      'De igual manera, los investigadores nos comprometemos a mantener la reserva de la información y de los documentos, expedientes, reportes, estudios, actas, resoluciones, oficios, correspondencia, acuerdos, contratos, convenios, archivos físicos y/o electrónicos de información recabada, estadísticas o bien, cualquier otro registro o información que obtengamos en desarrollo del proyecto de investigación, así como a no difundir, distribuir o comercializar con los datos personales contenidos en los sistemas de información desarrollados en la ejecución del mismo.',
      'Asimismo, nos comprometemos a tomar todas las medidas necesarias para proteger la información, incluyendo, pero no limitándose, a la adopción de medidas de seguridad físicas, electrónicas y administrativas adecuadas para prevenir el acceso no autorizado, la divulgación o el uso indebido de dicha información.',
    ],
  },
  {
    tipo: 'tratamiento de datos',
    titulo: '9. Tratamiento de datos personales',
    parrafos: [
      'Los investigadores nos obligamos a asegurar que los datos personales a los cuales tengamos acceso en desarrollo del proyecto de investigación, serán tratados de conformidad con lo previsto en la Ley 1581 de 2012, el Decreto 1377 de 2013 o las normas que los adicionen, sustituyan, modifiquen o deroguen y las políticas de manejo de datos personales de la Universidad.',
      'En el supuesto que se produzca: (i) pérdida o uso indebido de datos personales, (ii) el tratamiento, divulgación, acceso, alteración, corrupción, transferencia, venta, alquiler, destrucción o uso involuntario, no autorizado o ilegal de datos personales o, (iii) cualquier otro acto u omisión que comprometa o pueda comprometer la seguridad, confidencialidad o integridad de los datos personales, los investigadores nos comprometemos a notificar a la Vicerrectoría de Investigación y Extensión así como al Oficial de Protección de Datos Personales de la UNICESMAG, dentro de las veinticuatro (24) horas siguientes a haber tenido constancia del incidente de seguridad. Si la notificación no tiene lugar en el mencionado plazo, cuando ésta se realice deberá ir acompañada de una explicación de los motivos de la dilación.',
      'Adicionalmente, los investigadores nos comprometemos a colaborar con la UNICESMAG en la gestión de los incidentes de seguridad que pudieran producirse y a asumir los compromisos y responsabilidades que se deriven.',
    ],
  },
]

/** Numeral 6: conceptos de rubro y antelación mínima con que deben solicitarse. */
export const RUBROS_ANTELACION: [concepto: string, tiempo: string][] = [
  ['Compra y suministro de elementos', '8 días de antelación'],
  ['Salidas de campo', '8 días de antelación'],
  ['Participación en eventos a nivel nacional e internacional', '2 meses de antelación'],
  ['Solicitud de contratación de servicios por honorarios', '1 mes de antelación'],
  [
    'Solicitud de espacios físicos como salas de cómputo, laboratorios, auditorios, áreas deportivas, entre otros.',
    'El investigador deberá ceñirse a lo establecido por las Oficinas de Medios Educativos y de Infraestructura Tecnológica de la Universidad.',
  ],
]

/** Numeral 10: lo que los participantes aceptan al firmar el acta. */
export const CONSIDERACIONES_FINALES: string[] = [
  'a. La propuesta de proyecto de investigación aprobada, la cual constituye, parte integral de esta acta de inicio, y serán objeto de seguimiento permanente, en concordancia con el cronograma de actividades y el plan de trabajo de cada integrante que participa en la ejecución del proyecto. De esta manera, el proyecto de investigación es insumo para la evaluación final de desempeño, en cuanto a los resultados obtenidos, logros alcanzados y productos generados.',
  'b. Permitir que la UNICESMAG pueda verificar en cualquier momento el cumplimiento de las obligaciones adquiridas en virtud del proyecto de investigación.',
  'c. Cumplir a partir de la suscripción de la presente acta, las obligaciones asumidas, las cuales permanecerán en vigor durante el periodo en que el investigador se encuentre desarrollando el proyecto, sin perjuicio de las obligaciones en materia de confidencialidad y protección de datos personales, las cuales subsistirán y se mantendrán de manera indefinida. El incumplimiento de estos compromisos podrá dar lugar a acciones legales por parte de la Universidad para proteger sus derechos e intereses.',
  'd. Mantener indemne a la Universidad CESMAG de cualquier daño o perjuicio originado en reclamaciones de terceros, que tengan como causa nuestras actuaciones hasta por el monto del daño o perjuicio causado.',
  'e. En caso que, alguno de los investigadores se encuentre desempeñando algún rol de coordinador, en el momento de iniciar y ejecutar el proyecto, el tiempo asignado será asumido desde las horas de la coordinación, por ningún motivo se asignarán horas adicionales para la ejecución del proyecto de investigación.',
]
