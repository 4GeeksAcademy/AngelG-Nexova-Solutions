# Despliegue en DigitalOcean

El workflow [deploy.yml](../.github/workflows/deploy.yml) construye imágenes Docker, las publica en GitHub Container Registry (GHCR) y las despliega por SSH al actualizar `main`. El Compose de producción es independiente del Compose local de desarrollo.

## Servicios y direcciones

- Sitio web y formulario: `http://<IP_DEL_VPS>/` y `http://<IP_DEL_VPS>/application.html`.
- Talent Pipeline Tracker: `http://<IP_DEL_VPS>:3000/`.
- API principal y PostgreSQL: red interna de Compose; no publican puertos en el VPS.
- API de análisis de incidencias: `127.0.0.1:8001` en el VPS. Para probarla desde tu ordenador, abre un túnel SSH y visita `http://localhost:8001/docs`:

```sh
VPS_IP="203.0.113.10" # Sustituye por la IP pública real del Droplet.
ssh -N -L 8001:127.0.0.1:8001 "deploy@$VPS_IP"
```

El acceso por IP usa HTTP sin cifrado. Úsalo solo para pruebas, no introduzcas contraseñas ni datos reales y no abras puertos `5432`, `8000` ni `8001` en el firewall de DigitalOcean. Antes de usar datos reales, configura un dominio y HTTPS.

## 1. Preparar el Droplet

Conéctate como administrador e instala Docker Engine y Compose en Ubuntu 24.04:

```sh
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
docker compose version
```

Crea un usuario de despliegue. Pertenecer al grupo `docker` equivale en la práctica a tener permisos de administrador, así que usa una cuenta dedicada:

```sh
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -o deploy -g deploy /opt/nexova/infra
```

En el firewall de DigitalOcean permite SSH (TCP 22), HTTP (TCP 80) y el puerto del tracker (TCP 3000). No abras PostgreSQL ni las APIs internas.

## 2. Crear la llave SSH para Actions

Sí, necesitas configurar una llave SSH, pero **no** añadirla a las llaves SSH de tu cuenta de GitHub. Crea una llave dedicada en tu ordenador; la pública autoriza al usuario `deploy` en el VPS y la privada se guarda como secreto del repositorio:

```sh
VPS_IP="203.0.113.10" # Sustituye por la IP pública real del Droplet.
VPS_ADMIN_USER="tu_usuario_administrador"
ssh-keygen -t ed25519 -C "github-actions-nexova-deploy" -f ~/.ssh/nexova_deploy -N ""
scp -P 22 ~/.ssh/nexova_deploy.pub "$VPS_ADMIN_USER@$VPS_IP:/tmp/nexova_deploy.pub"
ssh -t "$VPS_ADMIN_USER@$VPS_IP" 'sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh && sudo install -o deploy -g deploy -m 600 /tmp/nexova_deploy.pub /home/deploy/.ssh/authorized_keys && sudo rm -f /tmp/nexova_deploy.pub'
ssh -i ~/.ssh/nexova_deploy "deploy@$VPS_IP"
```

Comprueba la huella del host para evitar confiar en una clave SSH suplantada. Compara la huella obtenida por un canal confiable, por ejemplo la consola de DigitalOcean:

```sh
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

En tu ordenador, prepara el contenido de `known_hosts` para Actions y verifica que su huella coincida:

```sh
VPS_IP="203.0.113.10" # Sustituye por la IP pública real del Droplet.
ssh-keyscan -H -t ed25519 -p 22 "$VPS_IP" > ~/nexova_known_hosts
ssh-keygen -lf ~/nexova_known_hosts
```

En GitHub, abre **Settings → Secrets and variables → Actions** y configura:

- Variables: `VPS_HOST` (IP del Droplet), `VPS_USER` (`deploy`) y `VPS_SSH_PORT` (`22`).
- Secrets: `VPS_SSH_PRIVATE_KEY` (contenido de `~/.ssh/nexova_deploy`) y `VPS_KNOWN_HOSTS` (contenido de `~/nexova_known_hosts`).

No compartas ni subas la llave privada al repositorio. El workflow exige verificación de host (`StrictHostKeyChecking=yes`).

## 3. Configurar el entorno del VPS

Desde la raíz del repositorio, copia el ejemplo al Droplet y edítalo allí:

```sh
VPS_IP="203.0.113.10" # Sustituye por la IP pública real del Droplet.
scp -P 22 infra/production.env.example "deploy@$VPS_IP:/opt/nexova/infra/.env.production"
ssh "deploy@$VPS_IP"
nano /opt/nexova/infra/.env.production
```

En ese archivo, sustituye `GHCR_OWNER` por el propietario de GitHub en minúsculas y `FRONTEND_URL` por `http://<IP_DEL_VPS>:3000`. Genera valores distintos para `POSTGRES_PASSWORD` y `JWT_SECRET` con `openssl rand -hex 32`; no uses los valores de ejemplo. Protege el archivo:

```sh
chmod 600 /opt/nexova/infra/.env.production
```

El archivo real `.env.production` está ignorado por Git. No lo copies al repositorio ni lo incluyas en capturas o logs. El workflow usa el `GITHUB_TOKEN` temporal para descargar las imágenes de GHCR y cierra sesión al terminar; no hace falta crear un token GHCR permanente.

## 4. Primer despliegue y actualizaciones

Cuando estén configuradas las variables y secrets y los archivos estén en `main`, el workflow se ejecutará automáticamente en cada push a `main`. También puedes iniciarlo desde **Actions → Deploy to DigitalOcean → Run workflow**.

El despliegue publica imágenes etiquetadas con el commit y envía al VPS el Compose y el script actualizados. Para revisar el estado en el VPS:

```sh
cd /opt/nexova
docker compose --env-file infra/.env.production -f infra/compose.production.yml ps
docker compose --env-file infra/.env.production -f infra/compose.production.yml logs --tail=100
```

Para volver a una versión anterior, vuelve a ejecutar el workflow exitoso correspondiente al commit deseado desde la página **Actions**. Las imágenes se etiquetan por commit para que esa versión pueda descargarse de nuevo.

## Datos y limitaciones actuales

- PostgreSQL y TinyDB usan volúmenes persistentes. Un volumen no sustituye una copia de seguridad; prepara backups fuera del Droplet y prueba la restauración antes de guardar datos importantes.
- El resultado más reciente del analizador de incidencias vive en memoria y se pierde al reiniciar ese contenedor.
- La página del directorio de proveedores no está presente en el árbol actual, y su router no está registrado en la API principal. Además, sus operaciones actuales no tienen autenticación; no se publica en esta configuración.
- El acceso por HTTP y el uso de la IP son únicamente temporales. No uses datos reales hasta disponer de HTTPS y revisar la autenticación de las rutas que se publiquen.

### Respaldo de datos

En el VPS, guarda copias de PostgreSQL y TinyDB. El segundo comando detiene y empaqueta solo una copia del volumen; no elimina el volumen original:

```sh
cd /opt/nexova
mkdir -p /opt/nexova/backups
docker compose --env-file infra/.env.production -f infra/compose.production.yml exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "/opt/nexova/backups/postgres-$(date +%F-%H%M).sql"
docker run --rm -v nexova_backend_data:/data:ro -v /opt/nexova/backups:/backup alpine tar -czf "/backup/tinydb-$(date +%F-%H%M).tar.gz" -C /data .
```

Copia los archivos de `/opt/nexova/backups` a almacenamiento fuera del Droplet. Ensaya la restauración en una instancia de prueba; no restaures sobre la base activa ni elimines volúmenes como parte de una actualización normal.
