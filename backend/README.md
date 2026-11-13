# Backend — SGP-VIE (Sistema de Gestión de Proyectos de Investigación)

Vicerrectoría de Investigación — Universidad CESMAG.

API REST + tiempo real del sistema que lleva un proyecto de investigación desde su registro hasta su cierre: firmas, revisión por el líder y los comités, evaluación por pares, acta de inicio, seguimiento (informes de avance, informe final y acta de cierre) y pagos a los pares evaluadores.

**Stack:** Node.js · TypeScript · Express 5 · PostgreSQL · Prisma 7 (adapter `pg`) · Socket.IO · Multer · Nodemailer · jsPDF / docx · Vitest.

---

## 1. Puesta en marcha

Requisitos: Node 20+ y una base PostgreSQL vacía.

```bash
cd backend
npm install
cp .env.example .env        # y completa los valores (ver sección 2)
npx prisma migrate deploy   # aplica TODAS las migraciones de prisma/migrations
npx prisma generate         # genera el cliente en src/generated/prisma
npx prisma db seed          # (opcional, primera vez) roles, catálogos y usuario administrador
npm run dev                 # tsx watch → http://localhost:3000
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática (`tsx watch`). |
| `npm run build` / `npm start` | Compila a `dist/` y lo ejecuta con Node. |
| `npm test` | Pruebas unitarias con Vitest (12 archivos, 124 pruebas). |
| `npm run prisma:migrate` | `prisma migrate dev` (crea una migración nueva al cambiar el schema). |
| `npm run prisma:studio` | Visor de la base de datos. |

> Las migraciones **no se aplican solas**. Después de bajar cambios de git corre `npx prisma migrate deploy` y `npx prisma generate`; si no, el código y la base quedan desincronizados.

Comprobación rápida: `GET http://localhost:3000/` responde `{ "message": "API del Sistema de Gestión de Proyectos" }`; todo lo demás cuelga de `/api`.

## 2. Variables de entorno (`.env`)

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (obligatoria). | — |
| `JWT_SECRET` | Firma de los tokens (obligatoria; usa un valor largo y aleatorio). | — |
| `JWT_EXPIRES_IN` | Vida máxima del token. | `8h` |
| `PORT` | Puerto del servidor. | `3000` |
| `CORS_ORIGIN` | Origen permitido (URL del frontend). También lo usa Socket.IO. | `http://localhost:5173` |
| `BCRYPT_SALT_ROUNDS` | Rondas de bcrypt. | `10` |
| `INACTIVIDAD_TIMEOUT_MIN` | Minutos sin actividad antes de cerrar la sesión. | `10` |
| `RESET_TOKEN_EXPIRES_MIN`, `FRONTEND_RESET_URL` | Recuperación de contraseña. | `60`, `…/restablecer-contrasena` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envío de correo. **Si `SMTP_HOST` está vacío no se envía nada real: el contenido de cada correo (códigos y enlaces incluidos) se imprime en la consola del backend.** | vacío |
| `FRONTEND_LOGIN_URL`, `FRONTEND_FIRMA_ACTA_URL`, `FRONTEND_FIRMA_PROYECTO_URL` | Enlaces que van dentro de los correos. | `http://localhost:5173/…` |
| `ACTA_FIRMA_VIGENCIA_DIAS` | Días de vigencia del enlace de firma del acta. | `7` |
| `RUAH_DATABASE_URL` | Conexión de **solo lectura** a la base de Ruah (esquema `view_report`). | vacío |
| `RUAH_ENVIAR_CORREOS` | Permite enviar los correos de bienvenida de las cuentas creadas desde Ruah. Dejar en `false` hasta producción. | `false` |
| `CORREOS_AVISOS_ACTIVOS` | Correos de los plazos de revisión (apertura, recordatorios y cierre). Dejar en `false` hasta producción. | `false` |

Nunca subas `.env` a git.

---

## 3. Cómo funciona el backend

### 3.1 Recorrido de una petición

```
Cliente ──► Express (cors + express.json)
              └─► /api  (routes/index.ts)
                    └─► routes/private/*.routes.ts
                          ├─ autenticar        (middlewares/auth.middleware.ts)
                          ├─ autorizar("Rol")  (middlewares/authorize.middleware.ts)
                          └─► controller  ──►  service  ──►  Prisma  ──►  PostgreSQL
              └─► manejadorErrores (middlewares/error.middleware.ts)
```

- **Rutas** (`src/routes`): todas centralizadas. `routes/public/*` no pide sesión (login, recuperar contraseña, firmar por enlace); `routes/private/*` empieza con `autenticar`.
- **Controller** (`*.controller.ts`): lee `req`, valida lo mínimo, llama al servicio y traduce el resultado (o el error) a HTTP. No toca la base.
- **Service** (`*.service.ts`): toda la lógica de negocio y el acceso a datos con Prisma. Aquí viven las reglas (quién puede hacer qué, en qué estado, qué falta).
- **Errores tipados**: los servicios lanzan clases propias (`ProyectoNoEncontradoError`, `ValidacionSeguimientoError`…). El controller las convierte en 400/403/404/409/422 con `{ error, mensaje }`. Lo que no se reconoce llega a `manejadorErrores`, que convierte los errores de Prisma (duplicado, no encontrado) y responde 500 genérico para el resto.
- **Un módulo = una carpeta** por funcionalidad (`src/<modulo>/`), con su controller, su service y sus pruebas (`*.test.ts`).

### 3.2 Autenticación, sesiones y roles

- `POST /api/auth/login` valida credenciales y devuelve un **JWT** con `id_usuario`, `correo`, `roles` e `id_sesion`.
- Cada token está respaldado por una fila en `sesiones_usuario`: `autenticar` la valida y refresca su `ultima_actividad` en cada petición; si pasan `INACTIVIDAD_TIMEOUT_MIN` minutos sin actividad (o se cerró la sesión) responde 401 con un código estable (`SIN_TOKEN`, `TOKEN_EXPIRADO`, `TOKEN_INVALIDO`, `SESION_CERRADA`, `SESION_INACTIVA`) y el frontend decide qué mostrar.
- **Roles del sistema:** Administrador · Investigador · Líder de investigación · Comité de Investigación · Comité de Ética · Par Evaluador · Vicerrector. Una cuenta puede tener varios; el frontend elige con cuál actúa.
- `autorizar("Administrador", …)` es el control por rol; hay reglas más finas dentro de los servicios (por ejemplo, solo el dueño del proyecto o un Administrador lo edita: `utils/permisosProyecto.ts`; solo el par con la revisión abierta califica).
- Cuentas: `activo` bloquea el login; `debe_cambiar_contrasena` obliga a cambiar la contraseña temporal; el Par Evaluador debe aceptar el tratamiento de datos antes de usar el sistema.
- Recuperación de contraseña: token de un solo uso guardado **solo como hash** (`tokens_recuperacion`).

### 3.3 Base de datos (Prisma 7)

- El esquema está en `prisma/schema.prisma`; el historial, en `prisma/migrations/` (migraciones manuales, una carpeta por cambio).
- El cliente se genera en `src/generated/prisma` (no se sube) y se crea así: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` (ver `src/config/prisma.ts`).
- `estado_actual` del proyecto es un `String` controlado por los servicios, no una tabla.
- Ojo con las llaves foráneas: algunas tablas de seguimiento no tienen borrado en cascada, así que borrar a mano un proyecto que ya llegó al informe final falla.
- `prisma/seed.ts` siembra roles, catálogos y el usuario administrador inicial.

### 3.4 Archivos (uploads)

- Se guardan en `backend/uploads/` (no se sirve como carpeta pública). Cada descarga pasa por un endpoint **autenticado** que valida permisos y usa `res.download`.
- `src/config/upload.ts` define los cargadores de Multer: documentos del proyecto (`uploads/proyectos`, PDF/Word/Excel/imagen, 5 MB), PDF de proyectos históricos, fotos de perfil y **evidencias de seguimiento** (`uploads/evidencias-seguimiento`, 10 MB; solo el Administrador y el Vicerrector las abren).
- En base de datos se guarda solo el nombre generado del archivo (más nombre original, tamaño y tipo cuando hace falta), nunca la ruta absoluta.

### 3.5 Tiempo real

`src/ws/socket.ts` levanta Socket.IO sobre el mismo servidor HTTP, autenticado con el mismo JWT. Los controladores llaman `emitirCambio("recurso", { id_proyecto })` después de escribir; **el evento no lleva datos**, solo avisa que algo cambió para que cada pantalla vuelva a pedir lo suyo por REST (respetando los permisos de siempre).

### 3.6 Correos

`auth/email.service.ts` centraliza todos los correos (plantilla institucional con logos embebidos). Con `SMTP_HOST` vacío se imprimen en consola: sirve para probar flujos completos de firma sin enviar nada. Los avisos masivos (bienvenidas de Ruah y plazos de revisión) tienen sus propios interruptores para que no salgan antes de producción.

### 3.7 Notificaciones

`notificaciones.service.ts` crea notificaciones internas (`crearNotificacion`) con `tipo_evento`, `id_proyecto` y `rol_destino` (solo se ven con ese rol activo). Cuando la acción pendiente se resuelve, `resolverNotificaciones(...)` las borra, y así la campanita solo muestra lo que sigue pendiente. El mensaje se guarda como texto; el frontend lo da formato.

### 3.8 Firmas electrónicas

Hay tres mecanismos, todos con evidencia verificable:

1. **Código al correo personal** (6 dígitos, vigencia de 10 minutos, máximo 5 intentos, 30 s entre envíos; solo se guarda su hash). Se usa para: firmar el registro del proyecto, la calificación del par y los informes/acta de cierre de seguimiento (`firmas-codigo`).
2. **Enlace personal por correo** (token de un solo uso, solo su hash en base de datos) para quien no tiene sesión: co-investigadores del registro (`/api/firmar-proyecto/:token`) y firmantes del acta de inicio (`/api/firma-acta/:token`).
3. **Sello**: cada firma guarda `id_transaccion` y `hash_firma` (SHA-256 de lo firmado), más IP y agente cuando aplica. El Administrador "elabora" y firma con su sesión, sin código.

### 3.9 Tareas programadas

Al arrancar, `iniciarProgramadorVentanas()` (convocatorias) revisa los **plazos de revisión** por convocatoria: abre/cierra las ventanas de cada etapa y manda los avisos (si `CORREOS_AVISOS_ACTIVOS=true`).

---

## 4. Mapa de módulos

| Ruta (`/api/…`) | Carpeta | Qué hace |
|---|---|---|
| `auth` | `auth/` | Login, logout, perfil, recuperar/restablecer contraseña, cambio de contraseña. |
| `usuarios`, `roles`, `permisos` | `usuarios/`, `roles/`, `permisos/` | Cuentas, roles, permisos por rol, foto de perfil, hoja de vida del usuario. |
| `catalogos` | `catalogos/` | Facultades, programas, áreas, modalidades, tipos, ODS, líneas, dedicaciones… |
| `convocatorias` | `convocatorias/` | Convocatorias, opciones y **plazos de revisión** por etapa. |
| `grupos-investigacion` | `grupos/` | Grupos, su líder, líneas y datos institucionales. |
| `proyectos` | `proyectos/`, `participantes/`, `proyecto-asociaciones/`, `objetivos/`, `cronograma/`, `productos/`, `documentos/`, `firmas-proyecto/`, `observaciones/`, `historicos/` | Registro del proyecto y todas sus partes, firmas del registro, documentos, observaciones, proyectos históricos. |
| `lider` | `lider/` | Visto bueno / rechazo del líder y seguimiento del grupo. |
| `evaluaciones` | `evaluaciones/` | Etapas, asignaciones, evaluaciones de comités y pares, firma del par, resultado de pares. |
| `reclamaciones` | `reclamaciones/` | Reclamaciones del investigador sobre una evaluación y su respuesta. |
| `acta-inicio` | `acta-inicio/` | Acta de inicio: datos, generación, compromisos y firmas. |
| `seguimiento` | `seguimiento/` | Periodos, informes de avance, novedades, informe final, acta de cierre, evidencias. |
| `pagos`, `pagos-admin` | `pagos/` | Datos bancarios y documentos del par, pagos, certificado y agradecimiento. |
| `notificaciones` | `notificaciones/` | Bandeja de notificaciones. |
| `dashboard` | `dashboard/` | Estadísticas por rol. |
| `productos` | `productos/` | Catálogo de productos esperados. |
| `tipos-documento` | `tipos-documento/` | Documentos requeridos por etapa. |
| `ruah` | `ruah/` | Sincronización de docentes y estudiantes con Ruah. |
| `firmar-proyecto`, `firma-acta` | públicas | Firma por enlace (sin sesión). |

---

## 5. El recorrido de un proyecto

```
Registro (Investigador)  ──►  pendiente_firmas
   principal firma con código · co-investigador firma por enlace + código
        │  finalizar firmas
        ▼
pendiente_lider  ──(visto bueno del líder del grupo)──►  pendiente
        │                                                     │  Administrador valida documentos
        │ (rechazo)                                           ▼
        ▼                                          Comité de Investigación  (etapa 2)
     rechazado                                                │ aprobado → avanza solo
                                                              ▼
                                                    Comité de Ética  (etapa 3)
                                                              │ aprobado → avanza solo
                                                              ▼
                                         Pares Evaluadores — 2 (etapa 4) ──► pares_pendiente_envio
                                                              │  el Administrador revisa y envía el resultado
                                                              ▼
                                                           aprobado
                                                              ▼
                  Acta de inicio ► Seguimiento (periodos / informes de avance) ► Informe final ► Acta de cierre ► finalizado
```

**Etapas** (tabla `etapas`): General/Inicial · Comité de Investigación · Ética · Pares. El Administrador asigna el proyecto a una etapa (`POST /proyectos/:id/asignaciones`) y luego elige al integrante que lo revisa (`PATCH /proyectos/:id/etapas/:idEtapa/responsable`); cuando la etapa se aprueba, el proyecto **avanza solo** a la siguiente y queda "pendiente de asignar integrante". Cada paso queda en `historial_etapa_estado`.

**Evaluación de comités:** el integrante responde con un resultado (`aprobado`, `aprobado_con_correcciones`, `rechazado`) y sus comentarios (el frontend guarda la lista de chequeo diligenciada dentro del texto). Si pide correcciones, el investigador reenvía y **el mismo integrante** las valida.

**Pares:** dos evaluadores calificado con la rúbrica (máximo 90 puntos), cada uno firma su calificación con código. Cuando los dos terminan, el proyecto queda en `pares_pendiente_envio`; el Administrador revisa y envía el resultado: promedio ≥ 80 → aprobado; 70–79 → aprobado con correcciones; menos de 70 → rechazado. Los pares son anónimos para todos menos para el Administrador.

**Acta de inicio:** el Administrador completa los datos (tipo, número y fecha del acta de aprobación, centro de costos, inicio, duración, vigencias), la genera (cada investigador recibe de una vez su enlace de firma; los numerales 5 a 10 los escribe el Administrador y no hay una aceptación aparte) y firman en orden: investigador principal → co-investigadores → Vicerrector → Administrador. Al firmarse, queda **legalizada** y el proyecto entra a seguimiento. Los datos del acta se arman a partir del proyecto (título, objetivos, actividades, participantes, programa del grupo).

**Seguimiento:** el Administrador pulsa "Regenerar periodos" (uno por semestre desde la fecha de inicio) y solicita cada informe de avance en orden: cada periodo se desbloquea al aprobarse el anterior. El investigador reporta porcentaje por actividad, semanas trabajadas y evidencias (archivo o enlace), firman principal y co-investigadores, radica, y el Administrador aprueba o devuelve. Con todos los avances aprobados se solicita el **informe final** (firman principal, co-investigadores y líder) y luego el **acta de cierre** (además Vicerrector y Administrador), que al completarse permite finalizar el proyecto. También se registran **novedades** (prórrogas, cambios de equipo…) que el Administrador decide.

**Proyectos históricos:** el Administrador carga proyectos anteriores al sistema (leídos de sus PDF en el frontend) ya terminados; no pasan por firmas, comités ni pares y se muestran con la insignia "Histórico".

### Pagos a pares

Cada par registra sus datos y sube **cuatro documentos tributarios** (RUT, certificación bancaria, cédula y Carta Retefuente). Con los cuatro completos el Administrador registra el valor de cada proyecto evaluado. Los proyectos se agrupan **por convocatoria** y el **certificado de participación es uno solo por par y convocatoria**: al subirlo queda para todos sus proyectos de esa convocatoria, y el correo de agradecimiento sale una sola vez (cuando todos tienen su pago registrado) y marca los pagos como pagados.

### Integración con Ruah

`ruah/` lee (solo lectura) la base de Ruah para crear o actualizar cuentas de docentes y estudiantes y buscar estudiantes al registrar participantes. La sincronización no envía correos: las bienvenidas se mandan aparte, con el botón "Enviar bienvenidas" y solo si `RUAH_ENVIAR_CORREOS=true`.

---

## 6. Pruebas

`npm test` ejecuta Vitest sobre las reglas que no necesitan base de datos (acta de inicio, plazos de revisión, Ruah, permisos de proyecto, contraseñas, correos). Antes de subir cambios: `npx tsc --noEmit -p tsconfig.json` y `npm test`.

## 7. Cómo agregar un módulo

1. Crea `src/<modulo>/<modulo>.service.ts` (lógica + Prisma + errores tipados) y `<modulo>.controller.ts` (HTTP).
2. Crea `src/routes/private/<modulo>.routes.ts` con `autenticar` y, si aplica, `autorizar(...)`, y móntalo en `src/routes/index.ts`.
3. Si cambias el esquema: edita `schema.prisma`, `npm run prisma:migrate`, y recuerda avisar para correr `migrate deploy` y `generate` en los demás entornos.
4. Después de escribir datos, llama `emitirCambio(...)` para refrescar las pantallas abiertas.
