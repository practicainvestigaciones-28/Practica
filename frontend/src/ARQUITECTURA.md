# Arquitectura del frontend

El código de `src/` está organizado por **módulo funcional**, no por tipo de
archivo. Cada módulo agrupa todo lo que necesita para su propia
funcionalidad:

```
src/
  modules/
    <nombre-del-modulo>/
      pages/        componentes de pantalla completa (una ruta de React Router)
      components/   piezas de UI propias del módulo, usadas por sus páginas
      api/          acceso a datos: llamadas HTTP al backend (fetch/apiFetch)
      lib/          lógica de negocio y estado local (catálogos en modo
                     prueba, reglas de validación, helpers específicos)
      context/      solo si el módulo necesita su propio React Context
  shared/
    api/            cliente HTTP compartido (client.ts) usado por todos los módulos
    lib/            lógica/datos transversales a varios módulos (estado.ts,
                     notificaciones.ts)
    components/
      common/        piezas de UI genéricas y sin lógica de negocio
                      (ConfirmModal, DonutChart, DateRangeCalendar)
      layout/         el armazón visual de las pantallas autenticadas
                      (Navbar, Sidebar, DashboardLayout)
    theme/          paleta de colores y tokens de diseño compartidos
                     (theme.ts para usar en JS/inline styles, theme.css
                     con las mismas variables como custom properties)
  App.tsx           declara las rutas, importando páginas de cada módulo
  main.tsx          punto de entrada de Vite
```

## Módulos actuales

| Módulo          | Qué cubre                                                        |
| ---------------- | ----------------------------------------------------------------- |
| `auth`            | Login, recuperar contraseña, sesión (`AuthContext`), guards de ruta |
| `proyectos`       | Crear/ver/listar proyectos, observaciones, notificaciones          |
| `convocatorias`   | Convocatorias, áreas de conocimiento, programas, líneas, modalidad/tipo |
| `evaluaciones`    | Bandeja y formulario de calificación del par evaluador             |
| `comite-etica`    | Panel del comité de ética y asignaciones                           |
| `usuarios`        | Usuarios, perfil, roles                                            |
| `catalogos`       | Formatos de evaluación, reclamaciones                              |
| `dashboard`       | Panel principal / inicio                                           |

## Regla para código nuevo

- Si un archivo (página, componente, servicio) **pertenece a un solo
  módulo**, va dentro de `modules/<ese-módulo>/`, en la subcarpeta que le
  corresponda (`pages`, `components`, `api` o `lib`).
- Si lo usan **dos o más módulos**, va en `shared/`.
- La presentación (`pages`/`components`), el acceso a datos (`api`) y la
  lógica de negocio (`lib`) se mantienen en archivos separados dentro del
  módulo — evitar mezclarlos en un mismo archivo.
- Los guards de autenticación/autorización (`ProtectedRoute`,
  `RequireRole`) viven en `modules/auth/` y se usan desde `App.tsx` — no se
  duplica esa lógica en cada módulo.

## Pendiente (no incluido en esta reorganización)

- Migrar los estilos existentes para usar las variables de
  `shared/theme/theme.css` en vez de colores sueltos — por ahora el tema
  centralizado queda listo para usarse en código nuevo, pero los ~40
  archivos `.css` existentes no se reescribieron (cambio grande y de
  riesgo visual, mejor como tarea aparte).
- El proyecto no usa Material UI; si se decide adoptarlo, `shared/theme/`
  es el lugar natural para el `ThemeProvider`/`createTheme`.
