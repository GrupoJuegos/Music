# Conectar un teléfono

En el equipo que reproduce, elige **Salida**. Escanea el QR con la cámara del
teléfono y abre el enlace. Ambos dispositivos deben estar en la misma red
Wi-Fi. Cuando se abre el canal WebRTC, el QR desaparece y ambos dispositivos
muestran el reproductor. Se puede abrir el reproductor local con **Ir al
reproductor** o terminar una conexión desde **Dispositivos**.

El QR contiene un enlace corto con un identificador aleatorio. La API
`/api/pair` intercambia la oferta y la respuesta WebRTC en Redis con caducidad
de cinco minutos por registro. La primera respuesta queda asociada a la
invitación. Comparte el enlace únicamente con el teléfono que va a controlar
la reproducción. Los comandos y el estado del reproductor viajan directamente
entre los dispositivos.

## Entornos

- `npm run dev` usa almacenamiento temporal en memoria si no hay credenciales
  de Redis en el entorno del proceso.
- En Vercel, la integración de Redis proporciona `KV_REST_API_URL` y
  `KV_REST_API_TOKEN`. Si conectas Upstash manualmente, también puedes usar
  `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. La función requiere
  Redis para compartir la sesión entre invocaciones.
