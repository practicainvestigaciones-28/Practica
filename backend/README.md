# Backend - Sistema de Gestión de Proyectos de Investigación

Vicerrectoría de Investigación - Universidad CESMAG

Stack: **Node.js + TypeScript + Express 5 + PostgreSQL + Prisma 7** (generador `prisma-client` con adapter-pg).

## ⚠️ Reorganización de estructura (feature folders)

El código se reorganizó de una estructura **por capa** (`src/controllers/`, `src/services/`) a una estructura **por funcionalidad**, siguiendo el patrón que pidió tu profesor/rúbrica (cada módulo tiene su propio `controller` + `service` en la misma carpeta, como en el proyecto de referencia RUAH):

```
src/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── email.service.ts       (helper exclusivo de auth)
├── proyectos/
│   ├── proyectos.controller.ts
│   └── proyectos.service.ts
├── participantes/
├── proyecto-asociaciones/
├── objetivos/
├── cronograma/
├── productos/
├── documentos/
├── convocatorias/
├── dashboard/
├── catalogos/
├── grupos/
├── hoja-vida/
├── tipos-documento/
├── routes/          (se mantiene centralizada, igual que en RUAH)
├── config/
├── middlewares/
├── types/
└── utils/
```

**Nada de la lógica cambió** — es un movimiento mecánico de archivos + actualización de imports. Verifiqué que los 98 imports relativos del proyecto resuelven correctamente, y que compila limpio con `tsc` (usando un cliente Prisma y tipos de `multer`/`jsonwebtoken` simulados, ya que aquí no tengo tu base de datos real para generar el cliente de verdad).

**Lo único que tienes que hacer tú:** correr `npx prisma generate` de nuevo (por si acaso, aunque el schema no cambió en este paso) y `npm run dev` — no hace falta ninguna migración nueva, la base de datos no se tocó, solo el código.

## Qué cambié en tu proyecto (histórico, entregas anteriores)

1. **`prisma/schema.prisma`**: agregué el modelo `Proyecto` (todos los campos de tu diccionario de datos) con FKs a `Convocatoria`, `ModalidadProyecto`, `TipoProyecto` y `Usuario`.
   - `estado_actual` quedó como `String` (no FK), igual que ya manejas `convocatoria.estado`, para no romper tu convención.
2. **Moví la salida del cliente generado** de `generated/prisma` a `src/generated/prisma`. Tu `rootDir: "src"` del `tsconfig.json` no permite compilar archivos fuera de `src/`, y el nuevo generador de Prisma 7 saca el cliente como `.ts` (no como `.d.ts` + `.js`), así que quedaba fuera de ese límite. Ya actualicé los imports en `prisma/seed.ts` y en todo lo nuevo de `src/`.
3. Borré la carpeta vieja `generated/` (ya no se usa) — al correr `prisma generate` se creará en la ruta nueva.
4. Agregué a tu `.env` (sin tocar tu `DATABASE_URL`): `PORT`, `JWT_SECRET` (generado aleatoriamente, ya listo para usar), `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `BCRYPT_SALT_ROUNDS`. También dejé un `.env.example` con placeholders por si necesitas recrearlo.
5. Agregué a `package.json`: scripts `dev` (`tsx watch`), `build`, `start`, `prisma:generate`, `prisma:migrate`, `prisma:studio`, y `@types/jsonwebtoken` como devDependency (te faltaba, si no lo agregas `tsc` marca error de tipos en `jsonwebtoken`).
6. Construí toda la capa de autenticación y de proyectos en `src/`, ver detalle abajo.

## 1. Instalar lo nuevo

```bash
cd backend
npm install
```

(Esto instalará `@types/jsonwebtoken`, que agregué al `package.json` pero no pude descargar aquí.)

## 2. Generar el cliente Prisma con el modelo `Proyecto`

```bash
npx prisma generate
```

Esto crea `src/generated/prisma/` con el modelo `Proyecto` incluido. Antes de esto, `tsc` te va a marcar error en `src/services/proyectos.service.ts` (`Property 'proyecto' does not exist...`) — es esperado, porque el cliente que tenías generado es de antes de este cambio.

## 3. Ejecutar la migración

```bash
npx prisma migrate dev --name agregar_proyectos
```

Esto crea la tabla `proyectos` en tu base de datos y actualiza `prisma/migrations/`.

## 4. Verificar

```bash
npx prisma studio
```

Confirma que la tabla `proyectos` se creó con todas las columnas.

## 5. Levantar el servidor

```bash
npm run dev
```

## Módulo de autenticación implementado

- `src/utils/password.ts` → hash y verificación con **bcryptjs**
- `src/utils/jwt.ts` → generación y verificación de **JWT**
- `src/services/auth.service.ts` → lógica de login (RQF01): valida credenciales, identifica roles, bloquea accesos inválidos
- `src/controllers/auth.controller.ts` + `src/routes/auth.routes.ts` → expone `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/perfil`
- `src/middlewares/auth.middleware.ts` → valida el JWT en cada request protegido, deja el usuario en `req.usuario`
- `src/middlewares/authorize.middleware.ts` → RBAC: `autorizar("Administrador")`, `autorizar("Investigador", "Administrador")`, etc.
- `src/middlewares/error.middleware.ts` → maneja errores de Prisma (duplicados, no encontrado) y errores genéricos

Nota: tu modelo `Usuario` actual no tiene columna `activo`. Si más adelante la agregas (para RQF05, activar/desactivar cuentas), el lugar exacto para validarla ya está señalado con un comentario en `auth.service.ts`.

### Probar el login

Con el usuario de tu `seed.ts`:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@unicesmag.edu.co","contraseña":"Admin123*"}'
```

Responde con `token` (JWT) y los datos del usuario con sus `roles`.

## Endpoints de proyectos

| Método | Ruta                | Protección                              | Requisito |
|--------|---------------------|------------------------------------------|-----------|
| POST   | `/api/proyectos`     | Autenticado + rol Investigador/Admin      | RQF13     |
| GET    | `/api/proyectos`     | Autenticado (cualquier rol)               | RQF15     |
| GET    | `/api/proyectos/:id` | Autenticado (cualquier rol)               | RQF15     |
| PUT    | `/api/proyectos/:id` | Autenticado + dueño del proyecto o Admin  | RQF14     |

`POST /api/proyectos` valida que la convocatoria exista y esté `activa` antes de aceptar el registro (RQF11).

Ejemplo:

```bash
curl -X POST http://localhost:3000/api/proyectos \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id_convocatoria": 1,
    "id_modalidad_proyecto": 1,
    "id_tipo_proyecto": 1,
    "titulo": "Mi proyecto de investigación"
  }'
```

(Necesitas tener al menos una convocatoria con `estado: "activa"`, una modalidad y un tipo de proyecto creados — todavía no hay endpoints para esos catálogos, son buen siguiente paso.)

## RQF03: recuperación y cambio de contraseña

Agregué el modelo `TokenRecuperacion` al schema (guarda solo el **hash** del token, nunca el token en texto plano). Después de correr `prisma generate` y `prisma migrate dev` (mismos comandos de arriba, que ya crean esta tabla también), tienes:

| Método | Ruta                              | Protección   | Descripción                                                    |
|--------|-------------------------------------|--------------|------------------------------------------------------------------|
| POST   | `/api/auth/recuperar-contrasena`    | Pública      | Recibe `{ correo }`, genera un token de recuperación (1h de validez) y lo "envía" (por ahora solo se loguea en consola — ver `src/services/email.service.ts`) |
| POST   | `/api/auth/restablecer-contrasena`  | Pública      | Recibe `{ token, nuevaContraseña }`, valida el token y actualiza la contraseña |
| PATCH  | `/api/auth/cambiar-contrasena`      | Autenticado  | Recibe `{ contraseñaActual, contraseñaNueva }`, valida la actual y actualiza |

**No hay proveedor de correo configurado todavía** (no hay `nodemailer` ni similar en tus dependencias). `src/services/email.service.ts` es un stub que imprime el enlace de recuperación en la consola del servidor — así puedes probar el flujo completo ahora mismo sin bandeja de correo real. Cuando tengan SMTP institucional, esa es la única función que hay que reemplazar.

Probar el flujo completo:

```bash
# 1. Solicitar recuperación
curl -X POST http://localhost:3000/api/auth/recuperar-contrasena \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@unicesmag.edu.co"}'

# 2. Copia el token que aparece en la consola del servidor (parte del enlace, después de ?token=)

# 3. Restablecer con ese token
curl -X POST http://localhost:3000/api/auth/restablecer-contrasena \
  -H "Content-Type: application/json" \
  -d '{"token":"EL_TOKEN_DE_LA_CONSOLA","nuevaContraseña":"NuevaClave123*"}'
```

## RQF36-39: Gestión documental del proyecto

Cierra EP-03. Agregué la tabla `Etapa` (que faltaba — la referencian `Tipo_documento` y, más adelante, el flujo de evaluación), `TipoDocumento` y `ProyectoDocumento`, y agregué **carga real de archivos** con `multer` (nueva dependencia — `npm install` la trae).

| Método | Ruta                                                            | Protección                    | Requisito |
|--------|--------------------------------------------------------------------|----------------------------------|-----------|
| GET/POST | `/api/tipos-documento/etapas`                                     | Consulta: cualquiera · Crear: Admin | (catálogo base) |
| GET/POST/PUT | `/api/tipos-documento`                                        | Consulta: cualquiera · Crear/editar: Admin | RQF36 |
| POST   | `/api/proyectos/:id/documentos` (multipart/form-data)               | Dueño del proyecto o Admin        | RQF37     |
| GET    | `/api/proyectos/:id/documentos`                                     | Autenticado                       | RQF38     |
| GET    | `/api/proyectos/:id/documentos/:idDocumento`                        | Autenticado                       | RQF38     |
| GET    | `/api/proyectos/:id/documentos/:idDocumento/descarga`               | Autenticado                       | RQF38     |
| PATCH  | `/api/proyectos/:id/documentos/:idDocumento/validacion`             | Solo Administrador                | RQF39     |
| DELETE | `/api/proyectos/:id/documentos/:idDocumento`                        | Dueño del proyecto o Admin        | —         |

Notas de diseño:
- Los archivos se guardan en `backend/uploads/proyectos/` (ya la agregué al `.gitignore` — no se sube a git ni se incluye en los zips que te doy). Se crea sola la primera vez que arranca el servidor.
- Extensiones permitidas: `.pdf .doc .docx .xls .xlsx .jpg .jpeg .png`, máximo 10 MB por archivo — configurable en `src/config/upload.ts`. Si subes algo no permitido o muy pesado, el backend responde `400` con un mensaje claro (no un error genérico).
- `aprobado_rechazado` es `null` mientras el documento no ha sido revisado, `true` si se aprueba, `false` si se rechaza (RQF39) — **solo un Administrador puede validar**, con doble comprobación (middleware de ruta + validación dentro del servicio).
- La descarga (`GET .../descarga`) no expone la carpeta de uploads como estática; pasa por el backend, así que solo alguien autenticado puede bajar el archivo — no un link público directo.
- El seed ya crea las 4 etapas (`General/Inicial`, `Comite_Investigacion`, `Etica`, `Pares`) y un tipo de documento de ejemplo ("Carta de aval del grupo de investigación") para que puedas probar la carga de inmediato.

Ejemplo de carga con curl (PowerShell — usa `Invoke-RestMethod` si `curl.exe -F` te da problemas de comillas):

```bash
curl.exe -X POST http://localhost:3000/api/proyectos/1/documentos ^
  -H "Authorization: Bearer TOKEN" ^
  -F "id_tipo_documento=1" ^
  -F "archivo=@C:\ruta\a\tu\archivo.pdf"
```

**Con esto, EP-03 queda 100% completa (RQF13-39).** RQF40 en adelante (observaciones sobre documentos, generación automática de formatos, aval del líder de grupo, actas) pertenece a otra épica de gestión documental más amplia — quedó fuera de este bloque a propósito.

## RQF27-35: Objetivos, antecedentes, impactos, cronograma, productos, hoja de vida

RQF33 (componente ético) y RQF34 (funciones del estudiante auxiliar) ya estaban cubiertos desde RQF13 — son campos de `proyectos`. RQF36 en adelante pertenece a otra épica (gestión documental), así que quedan fuera de este bloque.

| Método | Ruta                                                          | Protección                | Requisito |
|--------|-------------------------------------------------------------------|------------------------------|-----------|
| GET/POST | `/api/proyectos/:id/objetivos`                                  | Dueño del proyecto o Admin   | RQF27     |
| PUT/DELETE | `/api/proyectos/:id/objetivos/:idObjetivo`                    | Dueño del proyecto o Admin   | RQF27     |
| GET/POST/DELETE | `/api/proyectos/:id/antecedentes` (`/:idAntecedente`)     | Dueño del proyecto o Admin   | RQF27     |
| GET/POST/DELETE | `/api/proyectos/:id/objetivos/:idObjetivo/impactos` (`/:idImpacto`) | Dueño del proyecto o Admin | RQF28  |
| GET/POST/DELETE | `/api/proyectos/:id/cronograma` (`/:idActividad`)          | Dueño del proyecto o Admin   | RQF29     |
| POST   | `/api/proyectos/:id/cronograma/:idActividad/periodos`              | Dueño del proyecto o Admin   | RQF29     |
| GET/POST/DELETE | `/api/proyectos/:id/productos` (`/:idProducto`)            | Dueño del proyecto o Admin   | RQF30     |
| GET    | `/api/proyectos/:id/productos/validacion`                         | Dueño del proyecto o Admin   | RQF31     |
| GET/POST | `/api/productos/categorias`                                     | Consulta: cualquiera · Crear: Admin | RQF32 |
| GET/POST | `/api/productos/subcategorias`                                  | Consulta: cualquiera · Crear: Admin | RQF32 |
| GET/POST | `/api/productos/tipos`                                          | Consulta: cualquiera · Crear: Admin | RQF32 |
| GET/PUT | `/api/usuarios/:id/hoja-vida`                                     | Consulta: cualquiera · Editar: el propio usuario o Admin | RQF35 |

Notas de diseño:
- **Tipo_objetivo** solo acepta `"general"` o `"especifico"` — cualquier otro valor responde `400`.
- **Impactos** cuelgan de un objetivo específico, no directamente del proyecto (tal como lo modela tu diccionario: `Impacto.id_objetivo`).
- **Cronograma**: cada actividad tiene un responsable (usuario) y se puede "programar" en uno o varios periodos/año/mes mediante el sub-endpoint `/periodos`.
- **Validación de productos obligatorios (RQF31)**: marca `TipoProducto.obligatorio = true` en el catálogo; el endpoint `GET .../productos/validacion` compara contra lo ya registrado en el proyecto y devuelve `{ cumple, productosObligatorios, productosFaltantes }`.
- **Hoja de vida**: no duplica `nombre`, `apellido`, `cedula` ni `correo` — esos ya existen en `usuarios`. Solo guarda los campos adicionales (nacionalidad, dirección, cargos, títulos, producción científica, etc.).
- El seed ya crea 2 periodos, 1 categoría + subcategoría + un tipo de producto marcado como obligatorio, para que puedas probar `RQF31` de inmediato.

## RQF18-26: Modalidad, área, programas, ciudad, financiación, grupos, egresados

- **RQF18 (Modalidad)** y **RQF21 (Ciudad)** ya estaban cubiertos desde RQF13 (`id_modalidad_proyecto` y `ciudad` son parte de `POST /api/proyectos`).
- **RQF26 (Contenido académico)** también ya estaba cubierto: son los campos `resumen`, `planteamiento_problema`, `justificacion`, `marco_teorico`, `metodologia_preliminar` que ya existían en `proyectos` desde el principio. No hay una entidad separada para esto en el diccionario de datos.

Lo nuevo en este bloque:

| Método | Ruta                                                       | Protección                         | Requisito |
|--------|---------------------------------------------------------------|---------------------------------------|-----------|
| GET/POST | `/api/catalogos/areas-conocimiento`                        | Consulta: cualquiera · Crear: Admin   | RQF19     |
| GET/POST | `/api/catalogos/facultades`                                | Consulta: cualquiera · Crear: Admin   | RQF20     |
| GET/POST | `/api/catalogos/tipos-programa`                            | Consulta: cualquiera · Crear: Admin   | RQF20     |
| GET/POST | `/api/catalogos/programas`                                 | Consulta: cualquiera · Crear: Admin   | RQF20     |
| GET/POST | `/api/catalogos/tipos-grupo`                               | Consulta: cualquiera · Crear: Admin   | RQF23     |
| GET/POST | `/api/catalogos/lineas-investigacion`                      | Consulta: cualquiera · Crear: Admin   | RQF25     |
| GET/POST | `/api/catalogos/ods`                                       | Consulta: cualquiera · Crear: Admin   | RQF25     |
| GET/POST | `/api/grupos-investigacion`                                | Consulta: cualquiera · Crear: Admin   | RQF23     |
| GET/POST/DELETE | `/api/proyectos/:id/areas` (`/:idArea` para borrar)  | Dueño del proyecto o Admin            | RQF19     |
| GET/POST/DELETE | `/api/proyectos/:id/programas` (`/:idPrograma`)      | Dueño del proyecto o Admin            | RQF20     |
| GET/PUT | `/api/proyectos/:id/financiacion`                           | Dueño del proyecto o Admin            | RQF22     |
| GET/POST/DELETE | `/api/proyectos/:id/grupos` (`/:idGrupo`)            | Dueño del proyecto o Admin            | RQF23/RQF25 |
| GET/PUT | `/api/proyectos/:id/participantes/:idParticipante/egresado` | Dueño del proyecto o Admin        | RQF24     |

Notas de diseño:
- **Financiación** es una relación 1 a 1: `PUT` hace upsert (crea si no existe, actualiza si ya existe) y calcula `valor_total = valor_solicitado_unicesmag + valor_contrapartida` automáticamente — no lo envíes tú, el backend lo calcula.
- **Grupos de investigación** combinan grupo + línea de investigación + ODS en un solo registro (`proyecto_grupo`), tal como lo modela tu diccionario de datos.
- **Programas** admite `id_programa` (del catálogo) o `programa_otro` (texto libre) cuando el programa no está en el catálogo, igual que especifica el diccionario.
- El seed ya crea catálogos de ejemplo (3 áreas de conocimiento, 1 facultad + 1 programa, pregrado/posgrado, interno/externo, 1 línea de investigación, 2 ODS) para que puedas probar de inmediato sin tener que crear todo a mano.

## Participantes del proyecto (RQF17)

Agregué las tablas de catálogo `dedicacion`, `rol_proyecto`, `rol_estudiante` y la tabla puente `usuario_proyecto`. El seed ya las llena con los valores de tu diccionario de datos (TC/MT/HC, los 5 roles de proyecto, asistente/auxiliar).

| Método | Ruta                                                | Protección                     |
|--------|-------------------------------------------------------|----------------------------------|
| POST   | `/api/proyectos/:id/participantes`                     | Autenticado + dueño del proyecto o Admin |
| GET    | `/api/proyectos/:id/participantes`                     | Autenticado                      |
| PUT    | `/api/proyectos/:id/participantes/:idParticipante`      | Autenticado + dueño del proyecto o Admin |
| DELETE | `/api/proyectos/:id/participantes/:idParticipante`      | Autenticado + dueño del proyecto o Admin |

Reglas de negocio aplicadas:
- Un mismo usuario no se puede registrar dos veces en el mismo proyecto (`409` si se repite).
- `id_rol_estudiante` solo se acepta cuando el `id_rol_pro` elegido corresponde a "Estudiante Investigador(a)" — si lo envías con cualquier otro rol, responde `400`.
- Solo el creador del proyecto o un Administrador pueden agregar/editar/quitar participantes (igual que la edición del proyecto, RQF14).

Ejemplo — agregar un participante:

```bash
curl -X POST http://localhost:3000/api/proyectos/1/participantes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "participante": 2,
    "id_dedicacion": 1,
    "id_rol_pro": 5,
    "id_rol_estudiante": 2
  }'
```

(usa los IDs reales que veas en Prisma Studio para `usuarios`, `dedicacion`, `rol_proyecto` y `rol_estudiante` después de correr el seed).

## Convocatorias (RQF09-RQF12)

| Método | Ruta                          | Protección              | Requisito |
|--------|---------------------------------|--------------------------|-----------|
| POST   | `/api/convocatorias`            | Autenticado + Admin       | RQF09     |
| GET    | `/api/convocatorias`            | Autenticado (cualquiera)  | RQF12     |
| GET    | `/api/convocatorias/:id`        | Autenticado (cualquiera)  | RQF12     |
| PUT    | `/api/convocatorias/:id`        | Autenticado + Admin       | RQF10     |
| PATCH  | `/api/convocatorias/:id/estado` | Autenticado + Admin       | RQF11     |

- Al crear, la convocatoria nace en estado `activa` automáticamente.
- Valida que `fecha_fin` sea posterior a `fecha_inicio` (al crear y al editar).
- El cambio de estado (`PATCH .../estado`) solo acepta `activa`, `cerrada` o `inactiva` — cualquier otro valor responde `400`.
- La consulta/listado es abierta a cualquier rol autenticado porque un Investigador necesita ver qué convocatorias están `activa` antes de poder registrar un proyecto (recuerda que `POST /api/proyectos` ya valida esto).

Ejemplo — crear una convocatoria (necesaria para poder probar la creación de proyectos):

```bash
curl -X POST http://localhost:3000/api/convocatorias \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Convocatoria 2026-1",
    "descripcion": "Primera convocatoria del año",
    "fecha_inicio": "2026-01-01",
    "fecha_fin": "2026-06-30"
  }'
```

## Dashboard: estadísticas (RQF73, RQF74, RQF76)

| Método | Ruta                       | Protección  | Descripción |
|--------|------------------------------|-------------|-------------|
| GET    | `/api/dashboard/estadisticas` | Autenticado | Totales y datos para las tarjetas/gráfica del panel |

Respuesta:

```json
{
  "totalProyectos": 12,
  "proyectosPorEstado": [
    { "estado": "pendiente", "cantidad": 7 },
    { "estado": "aprobado", "cantidad": 5 }
  ],
  "totalConvocatorias": 3,
  "convocatoriasActivas": 1,
  "totalUsuarios": 8,
  "proyectosRecientes": [
    {
      "id_proyecto": 12,
      "titulo": "Mi proyecto",
      "estado_actual": "pendiente",
      "fecha_registro": "2026-08-19T00:00:00.000Z",
      "convocatoria": "Convocatoria 2026-1",
      "creador": "Carlos Pérez"
    }
  ]
}
```

**Según rol (RQF76):** si el usuario autenticado es `Administrador`, ve el panorama institucional completo (todos los proyectos, todas las convocatorias, total de usuarios). Cualquier otro rol (por ahora, `Investigador`) ve únicamente sus propios proyectos — `totalConvocatorias`, `convocatoriasActivas` y `totalUsuarios` vienen en `0` porque son datos institucionales que no le corresponden; el frontend puede simplemente no mostrar esas tarjetas para ese rol.

También agregué búsqueda por texto a `GET /api/proyectos` (RQF75): `?q=texto` filtra por título (insensible a mayúsculas), se puede combinar con `?estado=` y `?id_convocatoria=`.

## Siguientes pasos sugeridos

- EP-02: endpoints de convocatorias (crear, activar/cerrar, listar) — ya existe el modelo, falta la capa de API
- RQF05-RQF08: gestión de usuarios, roles y permisos vía API, con la misma arquitectura controller → service → prisma
- Conectar un proveedor de correo real (nodemailer, SES, Resend) en `src/services/email.service.ts` para RQF03
