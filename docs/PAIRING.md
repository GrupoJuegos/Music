# Conectar un teléfono

En el equipo que reproduce, elige **Salida**. Escanea el QR con la cámara del
teléfono y abre el enlace. Al conectar, el QR desaparece y ambos equipos
muestran el reproductor. Puedes abrirlo sin teléfono con **Ir al reproductor**
o terminar la conexión desde **Dispositivos**.

El QR contiene un identificador aleatorio. La API HTTPS `/api/pair`
sincroniza los comandos y el estado del reproductor. El audio se reproduce
en Salida. La invitación admite un solo teléfono y caduca a los cinco minutos.
Redis conserva la sesión unos segundos después de dejar de recibir actividad.

## Entornos

- `npm run dev` usa memoria temporal cuando no hay credenciales de Redis.
- En Vercel, la integración de Redis proporciona `KV_REST_API_URL` y
  `KV_REST_API_TOKEN`. Una configuración manual de Upstash también puede usar
  `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
