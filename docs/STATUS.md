# Estado de desarrollo

Primera implementación funcional en código, aún sin certificación de producción. React/TypeScript/Vite. No hay servidor, base de datos ni persistencia de sesión. La PWA almacena únicamente recursos estáticos.

## Probar
npm install; npm test; npm run build; npm run dev. Cámara y WebRTC requieren HTTPS o localhost. Prueba dos dispositivos en la misma red, intercambia oferta y respuesta, autoriza en Salida. Si QR excede capacidad, copia el código. No se usa STUN/TURN externo. Redes aisladas o mDNS incompatible pueden impedir la conexión.

## Fuentes
Audius e Internet Archive consultan endpoints públicos; acceso efectivo y CORS pendientes de prueba real. Archive filtra licencias declaradas, lo cual no garantiza titularidad. YouTube y Jamendo requieren identificadores públicos configurados en memoria; no introducir secretos. YouTube utiliza IFrame visible y no extrae audio. No se promete autoplay ni reproducción en segundo plano. Las alternativas solo se agrupan por identidad normalizada exacta; no se garantiza cobertura universal.

## Pendientes de verificación
Compilación, pruebas de navegador, conexión física iOS/Android/Windows, permisos, expiración, integraciones con credenciales y despliegue. No presentar como producto final hasta validar. La-vuelta es ajeno a este proyecto.
