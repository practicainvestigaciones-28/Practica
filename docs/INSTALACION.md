# Instalación de SGP-VIE con Docker (Ubuntu Server)

Guía paso a paso para instalar el sistema completo —base de datos, backend y frontend— en un servidor Ubuntu Server usando contenedores.

> **Estado:** primera versión, pensada para el ensayo en una máquina virtual y luego en el servidor de la universidad. Si algún paso falla, anota el comando y el mensaje de error: así se corrige la guía.

## 0. Qué se instala

```
   Red (puerto 80)
        │
   ┌────▼─────┐  /api, /socket.io  ┌──────────┐        ┌──────────────┐
   │ frontend │───────────────────►│ backend  │───────►│ PostgreSQL 18│
   │ (nginx)  │                    │ (Node)   │        │ volumen pgdata│
   └──────────┘                    └────┬─────┘        └──────────────┘
                                        └─ volumen uploads (documentos y evidencias)
```

- Solo el **frontend** abre un puerto hacia la red. Backend y base de datos quedan internos.
- Los datos viven en dos volúmenes de Docker: `pgdata` (base de datos) y `uploads` (archivos subidos).

## 1. Requisitos del servidor

| Recurso | Mínimo |
|---|---|
| Sistema | Ubuntu Server (LTS reciente) |
| CPU / RAM | 2 CPU / 4 GB (la compilación del frontend necesita memoria) |
| Disco | 20 GB libres |
| Red | IP fija o reservada, y salida a internet (para bajar imágenes y dependencias) |
| Usuario | Con permisos de `sudo` |

Si es una máquina virtual, usa red en **modo puente (bridge)** para que tenga su propia IP en tu red y puedas abrir el sistema desde tu navegador.

Averigua la IP del servidor (la necesitarás en el paso 5):

```bash
ip -4 addr show | grep inet
```

## 2. Instalar Docker

Sigue la guía oficial de Docker Engine para Ubuntu (https://docs.docker.com/engine/install/ubuntu/). En resumen:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
# ...agregar el repositorio oficial de Docker y instalar:
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

> **Ubuntu muy reciente:** si el repositorio oficial de Docker todavía no publica paquetes para tu versión, alternativas: usar el repositorio de la versión LTS anterior, o el paquete de Ubuntu (`sudo apt install -y docker.io docker-compose-v2`). Anota cuál funcionó.

Permitir usar Docker sin `sudo` (cierra la sesión y vuelve a entrar después):

```bash
sudo usermod -aG docker $USER
```

Comprobar:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

## 3. Firewall

Si el servidor tiene `ufw` activo, abre solo el puerto del sistema (y SSH). **No** abras 3000 ni 5432.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw status
```

## 4. Obtener el código

```bash
git clone https://github.com/practicainvestigaciones-28/Practica.git sgp-vie
cd sgp-vie
git checkout master        # o la rama que se vaya a probar
```

(Si el servidor no sale a GitHub, copia la carpeta del proyecto con `scp` o una USB y entra a ella.)

## 5. Configurar

```bash
cp .env.example .env
nano .env
```

Valores que **sí o sí** hay que cambiar:

| Variable | Qué poner |
|---|---|
| `PUBLIC_URL` | `http://IP-DEL-SERVIDOR` (la IP del paso 1, sin barra al final). De aquí salen el CORS y los enlaces de los correos. |
| `DB_PASSWORD` | Contraseña de la base de datos: `openssl rand -hex 24` |
| `JWT_SECRET` | Secreto de los tokens: `openssl rand -hex 48` |

El resto puede quedar como está para pruebas: con `SMTP_HOST` vacío **no se envía ningún correo real** (los códigos de firma y enlaces aparecen en el log del backend), y Ruah y los avisos masivos vienen apagados.

> `.env` contiene contraseñas: no lo subas a git ni lo compartas.

## 6. Construir y arrancar

```bash
docker compose up -d --build
```

La primera vez tarda varios minutos (descarga imágenes y compila el frontend y el backend). Revisa el estado:

```bash
docker compose ps
```

Los tres servicios (`db`, `backend`, `frontend`) deben quedar en `running`; `db` y `backend` en `healthy`.

## 7. Crear las tablas y los datos iniciales

Las migraciones **no se aplican solas**:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed      # SOLO la primera vez (roles, catálogos, administrador)
```

El seed crea el usuario administrador inicial (credenciales en `backend/prisma/seed.ts`): **cámbiale la contraseña apenas entres**.

## 8. Probar

Desde un equipo de la misma red abre `http://IP-DEL-SERVIDOR`.

- [ ] Carga el login.
- [ ] Entra con el administrador del seed y cambia la contraseña.
- [ ] Crea un usuario y una convocatoria.
- [ ] Registra un proyecto y adjunta un documento; se ve desde el visor.
- [ ] `docker compose restart` y comprueba que los datos y los archivos siguen ahí.
- [ ] Abre el sistema en dos navegadores y cambia algo en uno: el otro se actualiza solo (WebSocket).
- [ ] Pide un código de firma: aparece en `docker compose logs backend` (o llega al correo si configuraste SMTP).

## 9. Operación diaria

```bash
docker compose ps                      # estado
docker compose logs -f backend         # ver el log del backend (Ctrl+C para salir)
docker compose logs --tail=100 db      # últimas líneas de la base de datos
docker compose restart backend         # reiniciar un servicio
docker compose down                    # detener todo (los datos se conservan en los volúmenes)
```

> `docker compose down -v` **borra los volúmenes** (base de datos y archivos). No lo uses salvo que quieras empezar de cero.

### Actualizar el sistema

```bash
cd sgp-vie
git pull
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
```

### Respaldos

```bash
# Base de datos
docker compose exec -T db pg_dump -U sgpvie sgpvie > respaldo_$(date +%F).sql
# Archivos subidos
docker compose cp backend:/app/uploads ./respaldo_uploads_$(date +%F)
```

Guarda los respaldos **fuera del servidor**. Para restaurar la base en una instalación vacía:

```bash
docker compose exec -T db psql -U sgpvie sgpvie < respaldo_AAAA-MM-DD.sql
```

## 10. Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| `Falta PUBLIC_URL / DB_PASSWORD / JWT_SECRET en el .env` | Se te olvidó completar esa variable en `.env`. |
| El navegador no abre la IP | ¿Firewall (paso 3)? ¿La máquina virtual está en modo puente? ¿`docker compose ps` muestra el frontend arriba? |
| El login responde error de red o 502 | El backend no está sano: `docker compose logs backend`. |
| Error de CORS en el navegador | `PUBLIC_URL` no coincide con la dirección con la que abres el sistema (incluido el puerto). Corrígelo y `docker compose up -d`. |
| `prisma migrate deploy` no conecta | La base no terminó de arrancar: espera a que `db` esté `healthy` y repite. |
| La pantalla no se actualiza sola | Falla el WebSocket: revisa que nginx reenvíe `/socket.io` (ya viene configurado) y que no haya un proxy intermedio que lo bloquee. |
| Los enlaces de los correos apuntan a otra dirección | `PUBLIC_URL` cambió después de arrancar: edita `.env` y corre `docker compose up -d`. |

## 11. Más adelante (cuando haya dominio)

- Cambia `PUBLIC_URL` por la dirección con el dominio (`https://...`).
- Agrega un certificado HTTPS (por ejemplo con un proxy como Caddy o nginx con Let's Encrypt) y publica el puerto 443.
- Sin HTTPS, contraseñas y tokens viajan sin cifrar: solo para pruebas internas con datos de prueba.
