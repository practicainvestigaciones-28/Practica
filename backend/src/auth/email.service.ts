import path from "node:path";
import nodemailer from "nodemailer";
import { env } from "../config/env";

/**
 * Transporte SMTP compartido por todos los correos del sistema (bienvenida,
 * recuperación...). Si no hay SMTP_HOST configurado en .env, se deja en
 * null a propósito: cada función de envío cae en un console.log con el
 * contenido, para poder probar el flujo end-to-end sin credenciales reales.
 */
const transportador = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

// Los logos van como adjuntos con Content-ID (cid) y no como <img src="http...">:
// el correo lo abre el destinatario en su propio equipo, no en localhost, así
// que una URL de este proyecto en desarrollo no le cargaría la imagen. Con
// cid, el logo viaja embebido en el correo y se ve igual sin depender de que
// el frontend esté desplegado en una URL pública.
const RUTA_ASSETS = path.join(process.cwd(), "assets", "email");
const CID_SELLO = "sello-cesmag";
const CID_LOGO = "sgp-logo";
// contentDisposition: "inline" es necesario además del cid — sin él, nodemailer
// sigue marcando el MIME part como "attachment" y varios clientes de correo
// (Gmail incluido) muestran el logo embebido TAMBIÉN como un adjunto
// descargable aparte, aunque ya se vea inline en el cuerpo del correo.
const ADJUNTOS_LOGOS = [
  { filename: "sello-cesmag.png", path: path.join(RUTA_ASSETS, "sello-cesmag.png"), cid: CID_SELLO, contentDisposition: "inline" as const },
  { filename: "sgp-logo.png", path: path.join(RUTA_ASSETS, "sgp-logo.png"), cid: CID_LOGO, contentDisposition: "inline" as const },
];

const AZUL_INSTITUCIONAL = "#13335c";

/** "Investigador" | "Investigador y Par Evaluador" | "Investigador, Par Evaluador y Líder de investigación" */
function formatearListaRoles(roles: string[]): string {
  if (roles.length <= 1) return roles[0] ?? "";
  return `${roles.slice(0, -1).join(", ")} y ${roles[roles.length - 1]}`;
}

/**
 * Envuelve el contenido propio de cada correo (recibido ya armado) con el
 * mismo encabezado/pie institucional, para que todos los correos del
 * sistema se vean como parte de una sola identidad (SGP-VIE / Universidad
 * CESMAG), en vez de cada uno con su propio formato suelto.
 */
function plantillaCorreo(contenidoHtml: string): string {
  return `
  <div style="background:#eef1f5; padding:24px 0; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="500" cellPadding="0" cellSpacing="0" style="width:500px; max-width:92%; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:${AZUL_INSTITUCIONAL}; padding:14px 20px;">
                <img src="cid:${CID_SELLO}" alt="Universidad CESMAG" width="46" height="46" style="display:block; border-radius:50%;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px 36px 28px;">
                <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:22px;">
                      <img src="cid:${CID_LOGO}" alt="SGP-VIE" width="200" style="display:block; margin:0 auto;" />
                    </td>
                  </tr>
                </table>
                ${contenidoHtml}
              </td>
            </tr>
            <tr>
              <td style="background:${AZUL_INSTITUCIONAL}; padding:14px 20px; text-align:center;">
                <span style="color:#ffffff; font-size:11.5px;">Sistema de Gestión de Proyectos de Investigación — Universidad CESMAG</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

interface ArchivoAdjunto {
  filename: string;
  path: string;
}

async function enviarCrudo(
  destinatario: string,
  asunto: string,
  html: string,
  textoPlano: string,
  adjuntos: ArchivoAdjunto[]
): Promise<void> {
  if (!transportador) {
    console.log("──────────────────────────────────────────────");
    console.log(`[email] (SMTP no configurado) Para: ${destinatario}`);
    console.log(`[email] Asunto: ${asunto}`);
    console.log(textoPlano);
    if (adjuntos.length > 0) console.log(`[email] Adjuntos: ${adjuntos.map((a) => a.filename).join(", ")}`);
    console.log("──────────────────────────────────────────────");
    return;
  }

  await transportador.sendMail({
    from: env.SMTP_FROM,
    to: destinatario,
    subject: asunto,
    html,
    text: textoPlano,
    attachments: adjuntos,
  });
}

/** Correos "de marca" del sistema (bienvenida, recuperación, agradecimiento): van con el encabezado/pie de SGP-VIE. */
async function enviar(
  destinatario: string,
  asunto: string,
  contenidoHtml: string,
  textoPlano: string,
  adjuntosExtra: ArchivoAdjunto[] = []
): Promise<void> {
  await enviarCrudo(destinatario, asunto, plantillaCorreo(contenidoHtml), textoPlano, [...ADJUNTOS_LOGOS, ...adjuntosExtra]);
}

/** RQF03 - Enlace para restablecer la contraseña (token de un solo uso). */
export async function enviarCorreoRecuperacion(correo: string, enlace: string): Promise<void> {
  await enviar(
    correo,
    "Recuperación de contraseña — SGP-VIE",
    `<p style="font-size:14px; color:#333; line-height:1.5; text-align:center;">
       Para restablecer tu contraseña en el <strong>Sistema SGP-VIE</strong>, haz clic en el siguiente botón:
     </p>
     <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
       <tr>
         <td align="center" style="padding:20px 0 6px;">
           <a href="${enlace}" style="background:${AZUL_INSTITUCIONAL}; color:#ffffff; text-decoration:none; font-size:14px; font-weight:bold; padding:12px 28px; border-radius:6px; display:inline-block;">
             Restablecer contraseña
           </a>
         </td>
       </tr>
     </table>
     <p style="font-size:12px; color:#888; text-align:center; margin-top:18px;">
       Si no solicitaste este cambio, puedes ignorar este correo.
     </p>`,
    `Para restablecer tu contraseña en el Sistema SGP-VIE, entra a: ${enlace}`
  );
}

/**
 * Se envía cuando el Administrador crea una cuenta nueva (ver crearUsuario en
 * usuarios.service.ts) — pensado sobre todo para un Par Evaluador externo a
 * la universidad, que nunca pasa en persona por el Administrador para que le
 * "pasen" la contraseña a mano. El backend genera la contraseña temporal,
 * nunca el frontend, así que este correo es la única forma en que la
 * persona se entera de su contraseña inicial. En el primer login queda
 * obligada a cambiarla (ver debe_cambiar_contrasena / ProtectedRoute.tsx).
 */
export async function enviarCorreoBienvenida(
  correo: string,
  nombreCompleto: string,
  contraseñaTemporal: string,
  roles: string[]
): Promise<void> {
  const etiquetaRoles = roles.length > 1 ? "Roles asignados" : "Rol asignado";
  const textoRoles = formatearListaRoles(roles);

  await enviar(
    correo,
    "Tu cuenta en el Sistema SGP-VIE fue creada",
    `<p style="font-size:14px; color:#333; text-align:center; line-height:1.5;">
       HOLA, <strong>${nombreCompleto.toUpperCase()}</strong>
     </p>
     <p style="font-size:13.5px; color:#555; text-align:center; line-height:1.6;">
       Bienvenido(a) al Sistema de Gestión de Proyectos de Investigación (SGP-VIE) de la Universidad CESMAG.
       Se te registró con ${roles.length > 1 ? "los roles" : "el rol"} de <strong>${textoRoles}</strong> — para ingresar
       por primera vez, usa la contraseña temporal que se te asignó a continuación.
     </p>

     <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="margin:22px 0;">
       <tr>
         <td align="center">
           <p style="font-size:12.5px; color:#777; margin:0 0 6px;">Correo de acceso</p>
           <p style="font-size:14px; color:#222; margin:0 0 18px;">${correo}</p>
           <p style="font-size:12.5px; color:#777; margin:0 0 6px;">${etiquetaRoles}</p>
           <p style="font-size:14px; color:#222; margin:0 0 18px;">${textoRoles}</p>
           <p style="font-size:12.5px; color:#777; margin:0 0 6px;">Contraseña temporal</p>
           <div style="display:inline-block; background:#f2f4f9; border:1px solid #d7dce6; border-radius:8px; padding:10px 24px;">
             <span style="font-size:22px; font-weight:bold; letter-spacing:1px; color:${AZUL_INSTITUCIONAL};">${contraseñaTemporal}</span>
           </div>
         </td>
       </tr>
     </table>

     <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
       <tr>
         <td align="center" style="padding:4px 0 18px;">
           <a href="${env.FRONTEND_LOGIN_URL}" style="background:${AZUL_INSTITUCIONAL}; color:#ffffff; text-decoration:none; font-size:14px; font-weight:bold; padding:12px 28px; border-radius:6px; display:inline-block;">
             Ingresar al sistema
           </a>
         </td>
       </tr>
     </table>

     <p style="font-size:12px; color:#888; text-align:center; line-height:1.5;">
       Por seguridad, al iniciar sesión por primera vez el sistema te pedirá cambiar esta contraseña por una de tu elección.
     </p>`,
    `Hola ${nombreCompleto},\n\nBienvenido(a) al Sistema SGP-VIE de la Universidad CESMAG — fuiste registrado(a) con ${roles.length > 1 ? "los roles" : "el rol"} de ${textoRoles}.\nCorreo de acceso: ${correo}\n${etiquetaRoles}: ${textoRoles}\nContraseña temporal: ${contraseñaTemporal}\n\nIngresa desde: ${env.FRONTEND_LOGIN_URL}\n\nAl iniciar sesión por primera vez deberás cambiar esta contraseña.`
  );
}

/**
 * Carta de agradecimiento al Par Evaluador, una vez registrado su pago, con
 * el certificado de participación (PDF subido por el Administrador)
 * adjunto. Mantiene el texto institucional formal de la Vicerrectoría de
 * Investigación y Extensión (firma, redes y aviso de tratamiento de datos
 * personales — Ley 1581 de 2012 y Decreto 1074 de 2015), pero con el mismo
 * encabezado/pie de marca SGP-VIE que los demás correos del sistema
 * (bienvenida, recuperación), para que se vea como parte de una sola
 * identidad en vez de una carta suelta sin relación visual con el resto.
 */
export async function enviarCorreoAgradecimientoPar(
  correo: string,
  nombreConvocatoria: string,
  rutaCertificadoEnDisco: string
): Promise<void> {
  const parrafo1 =
    `Tenemos el honor de dirigirnos a usted, con el fin de expresar nuestro sincero agradecimiento por su valiosa ` +
    `colaboración como Par Evaluador de los proyectos de investigación presentados en la Convocatoria Anual para ` +
    `elegir Proyectos de Investigación Científica, Desarrollo Tecnológico, Innovación, Creación Artística y Cultural ` +
    `UNICESMAG ${nombreConvocatoria}.`;
  const parrafo2 =
    `En cumplimiento de los compromisos adquiridos, se remite el certificado de Par Evaluador y, de igual manera, ` +
    `se informa que el pago de la bonificación correspondiente a su colaboración fue realizado de manera satisfactoria.`;
  const parrafo3 = `Agradecemos confirmar si la consignación fue recibida correctamente en su cuenta bancaria.`;
  const firma =
    `Oficina de Vicerrectoría de Investigación y Extensión\n` +
    `Universidad CESMAG\n` +
    `Cra. 20A No. 14 54 Centro, San Juan de Pasto - Colombia\n` +
    `www.unicesmag.edu.co\n` +
    `Tel. (602) 7216535 - 7244434  Ext. 1218 - 1221`;
  const redes =
    `Síguenos en Nuestras Plataformas Sociales\n` +
    `Facebook: @unicesmagoficial\n` +
    `Instagram: @unicesmagoficial\n` +
    `LinkedIn: Universidad Cesmag\n` +
    `Twitter: @unicesmag\n` +
    `#SomosUnicesmag`;
  const avisoDatos =
    `En la Universidad CESMAG, tratamos sus datos personales conforme a la Ley 1581 de 2012 y el Decreto 1074 de ` +
    `2015. El tratamiento de sus datos incluye la recolección, almacenamiento, uso, circulación y supresión de la ` +
    `información. La finalidad de este tratamiento comprende, pero no se limita a gestión de procesos académicos, ` +
    `financieros, administrativos, de investigación, proyección social y de recursos humanos, desarrollo de ` +
    `programas de bienestar y desarrollo estudiantil, seguridad y control de acceso, cumplimiento de obligaciones ` +
    `legales. En algunos casos, podríamos solicitar datos personales sensibles. Usted tiene derecho a conocer, ` +
    `actualizar, rectificar y suprimir sus datos personales, así como a revocar la autorización otorgada para su ` +
    `tratamiento en los términos de la normativa vigente. Para más información sobre nuestras políticas de ` +
    `tratamiento de datos personales y sus cambios sustanciales, visite el siguiente link: ` +
    `https://www.unicesmag.edu.co/UNICESMAG.pdf Para ejercer estos derechos o si tiene alguna pregunta sobre este ` +
    `aviso de privacidad o sobre el tratamiento de sus datos personales, por favor contáctenos a través del correo ` +
    `correspondencia@unicesmag.edu.co, o presencialmente en las instalaciones de la UNIVERSIDAD CESMAG (Campus ` +
    `Centro) ubicada en la Carrera 20 A No. 14-54 de la ciudad de Pasto.`;

  const contenidoHtml = `
     <p style="font-size:14px; color:#333; text-align:center; line-height:1.5;">
       <strong>AGRADECIMIENTO Y CERTIFICADO DE PARTICIPACIÓN</strong>
     </p>
     <p style="font-size:13.5px; color:#555; line-height:1.6;">
       Saludo de paz y bien.
     </p>
     <p style="font-size:13.5px; color:#555; line-height:1.6;">${parrafo1}</p>
     <p style="font-size:13.5px; color:#555; line-height:1.6;">${parrafo2}</p>
     <p style="font-size:13.5px; color:#555; line-height:1.6;">${parrafo3}</p>

     <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="margin:22px 0;">
       <tr>
         <td align="center">
           <div style="display:inline-block; background:#f2f4f9; border:1px solid #d7dce6; border-radius:8px; padding:12px 24px;">
             <span style="font-size:13px; font-weight:bold; color:${AZUL_INSTITUCIONAL};">📎 Certificado_Par_Evaluador.pdf adjunto</span>
           </div>
         </td>
       </tr>
     </table>

     <p style="font-size:13.5px; color:#555; line-height:1.6;">Cordialmente,</p>
     <p style="white-space:pre-line; font-size:12px; color:#777; line-height:1.5;">${firma}</p>

     <hr style="border:none; border-top:1px solid #e5e5e5; margin:20px 0;" />
     <p style="white-space:pre-line; font-size:11.5px; color:#888; line-height:1.5;">${redes}</p>

     <hr style="border:none; border-top:1px solid #e5e5e5; margin:20px 0;" />
     <p style="font-size:10px; color:#999; line-height:1.4;">${avisoDatos}</p>`;

  const textoPlano =
    `Saludo de paz y bien.\n\n${parrafo1}\n\n${parrafo2}\n\n${parrafo3}\n\nCordialmente,\n\n--\n${firma}\n\n${redes}\n\n` +
    `-------------------------------------------------\n${avisoDatos}`;

  await enviar(
    correo,
    "Agradecimiento y certificado de participación — Par Evaluador UNICESMAG",
    contenidoHtml,
    textoPlano,
    [{ filename: "Certificado_Par_Evaluador.pdf", path: rutaCertificadoEnDisco }]
  );
}
