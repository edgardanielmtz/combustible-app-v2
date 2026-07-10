# Combustible App v2 - Captura por foto (Fase 1)

## Que hace esta version

1. El chofer elige operador y unidad.
2. Toma foto del ticket (1 o 2, si hubo division por limite de bomba).
3. Toma foto del odometro/tablero.
4. El sistema lee automaticamente los datos (OCR) y los muestra SIN posibilidad
   de editarlos - el operador solo puede confirmar o volver a tomar las fotos.
5. Si la foto sale borrosa o no se puede leer bien un dato, se rechaza
   automaticamente y se pide repetir - nunca se deja escribir a mano.
6. Al confirmar, se guarda en FACT_CARGAS. Las fotos nunca se almacenan.

## Que falta para la Fase 2 (todavia no programado)

- Validacion de rangos logicos (kilometraje ascendente, litros/precio normales).
- Escalacion automatica a Edgar cuando el OCR falla repetidamente (guardado
  temporal de foto + notificacion + revision manual).

## Instalacion

### 1. Habilitar la API de Vision (ademas de la de Sheets que ya tenias)

1. Ve a https://console.cloud.google.com
2. Selecciona el mismo proyecto que ya usaste antes.
3. Busca "Cloud Vision API" en el buscador de arriba.
4. Clic en "Habilitar".

La misma cuenta de servicio y el mismo credentials.json que ya tienes
funcionan para esto - no necesitas crear nada nuevo, solo habilitar la API.

### 2. Variables de entorno en Railway

Igual que la vez pasada: agrega GOOGLE_CREDENTIALS con el contenido completo
de tu credentials.json.

### 3. Deploy

Sube estos archivos (server.js, parser.js, package.json, Dockerfile) a un
repo de GitHub nuevo, conectalo a un proyecto de Railway, agrega la variable,
y dale deploy - exactamente igual que la primera vez.

## Notas importantes

- El umbral de confianza del OCR (UMBRAL_CONFIANZA en server.js, actualmente
  0.65) puede necesitar ajuste despues de probarlo con tickets reales -
  si rechaza fotos que se ven bien, hay que bajarlo un poco; si acepta fotos
  malas, hay que subirlo.
- Los formatos de ticket reconocidos son EOX (GOSMO) y PARAN (Pemex
  Megaservicios), basados en los ejemplos que compartiste. Si algun ticket
  cambia de formato, el parser.js necesitaria ajustarse.
