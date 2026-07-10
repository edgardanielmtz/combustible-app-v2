const express = require('express');
const fileUpload = require('express-fileupload');
const { google } = require('googleapis');
const vision = require('@google-cloud/vision');
const { parsearTicket, parsearOdometro } = require('./parser');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

const SHEET_ID = '1a_ozNMWUNkZG65YnzLnygS7ccUW5h3qAOpn2A-rDRzY';

function getCredentials() {
  return JSON.parse(process.env.GOOGLE_CREDENTIALS);
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

function getVisionClient() {
  return new vision.ImageAnnotatorClient({ credentials: getCredentials() });
}

async function leerRango(rango) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: rango });
  return res.data.values || [];
}

async function escribirFila(nombreHoja, valores) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const datos = await leerRango(`${nombreHoja}!B:B`);
  const filaVacia = datos.length + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${nombreHoja}!B${filaVacia}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [valores] }
  });
  return filaVacia;
}

// ------------------------------------------------------------------
// OCR: analiza una imagen y regresa texto + confianza promedio
// ------------------------------------------------------------------
async function leerImagen(buffer) {
  const client = getVisionClient();
  const [result] = await client.textDetection({ image: { content: buffer } });
  const texto = result.fullTextAnnotation ? result.fullTextAnnotation.text : '';

  // confianza: promedio de los "pages" del documento (Vision la da por pagina/bloque)
  let confianza = 0;
  if (result.fullTextAnnotation && result.fullTextAnnotation.pages) {
    const confs = result.fullTextAnnotation.pages.map(p => p.confidence || 0);
    confianza = confs.length ? confs.reduce((a,b) => a+b, 0) / confs.length : 0;
  }
  return { texto, confianza };
}

const UMBRAL_CONFIANZA = 0.65; // ajustar segun pruebas reales

// ------------------------------------------------------------------
// PAGINA PRINCIPAL
// ------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>⛽ Combustible</title>
<style>
  body{font-family:Arial;padding:24px;text-align:center;background:#f0f2f5;max-width:480px;margin:0 auto}
  h2{color:#1F4E5F;font-size:24px}
  a{display:block;margin:20px 0;padding:22px;border-radius:12px;font-size:20px;font-weight:bold;color:white;text-decoration:none}
  .c1{background:#1F4E5F}
  .c2{background:#2A78D6}
</style></head>
<body>
  <h2>⛽ Sistema de Combustible</h2>
  <a href="/carga" class="c1">📝 Registrar carga (con foto)</a>
  <a href="/viaje" class="c2">🚛 Cerrar viaje</a>
</body></html>`);
});

// ------------------------------------------------------------------
// PASO 1: identificacion (operador + unidad)
// ------------------------------------------------------------------
app.get('/carga', async (req, res) => {
  const unidades = await leerRango('DIM_UNIDADES!A2:A50');
  const operadores = await leerRango('DIM_OPERADORES!A2:A50');

  const opts = arr => arr.map(r => r[0] ? `<option>${r[0]}</option>` : '').join('');

  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box}
  body{font-family:Arial;font-size:17px;padding:16px;max-width:480px;margin:0 auto;background:#f0f2f5}
  h2{color:#1F4E5F;text-align:center}
  label{display:block;margin-top:16px;font-weight:bold;font-size:15px}
  select{width:100%;padding:14px;margin-top:6px;border:1px solid #ccc;border-radius:8px;font-size:17px;background:white}
  button{margin-top:24px;width:100%;padding:18px;background:#1F4E5F;color:white;border:none;border-radius:10px;font-size:19px;font-weight:bold}
</style></head>
<body>
  <h2>📝 Registrar carga</h2>
  <form method="GET" action="/carga/foto">
    <label>¿Quién eres? *</label>
    <select name="operador" required>${opts(operadores)}</select>
    <label>¿Qué unidad? *</label>
    <select name="unidad" required>${opts(unidades)}</select>
    <button type="submit">Siguiente → Tomar foto del ticket</button>
  </form>
</body></html>`);
});

// ------------------------------------------------------------------
// PASO 2: foto del ticket (1 o 2)
// ------------------------------------------------------------------
app.get('/carga/foto', (req, res) => {
  const { operador, unidad } = req.query;
  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box}
  body{font-family:Arial;font-size:17px;padding:16px;max-width:480px;margin:0 auto;background:#f0f2f5}
  h2{color:#1F4E5F;text-align:center}
  label{display:block;margin-top:16px;font-weight:bold;font-size:15px}
  input{width:100%;padding:14px;margin-top:6px;border:1px solid #ccc;border-radius:8px;font-size:17px;background:white}
  button{margin-top:24px;width:100%;padding:18px;background:#1F4E5F;color:white;border:none;border-radius:10px;font-size:19px;font-weight:bold}
  .info{font-size:14px;color:#555;background:#eef2f5;padding:10px;border-radius:8px;margin-top:10px}
  .check{margin-top:16px;display:flex;align-items:center;gap:10px}
</style></head>
<body>
  <h2>📸 Foto del ticket</h2>
  <div class="info">Operador: <b>${operador}</b> | Unidad: <b>${unidad}</b></div>
  <form method="POST" action="/carga/procesar" enctype="multipart/form-data">
    <input type="hidden" name="operador" value="${operador}">
    <input type="hidden" name="unidad" value="${unidad}">

    <label>Foto del ticket #1 *</label>
    <input type="file" name="ticket1" accept="image/*" capture="environment" required>

    <div class="check">
      <input type="checkbox" id="tieneTicket2" name="tieneTicket2" value="si" onchange="document.getElementById('bloqueTicket2').style.display=this.checked?'block':'none'">
      <label for="tieneTicket2" style="margin:0">¿Hubo un segundo ticket de esta misma carga?</label>
    </div>
    <div id="bloqueTicket2" style="display:none">
      <label>Foto del ticket #2</label>
      <input type="file" name="ticket2" accept="image/*" capture="environment">
    </div>

    <label>Foto del odómetro / tablero *</label>
    <input type="file" name="odometro" accept="image/*" capture="environment" required>

    <button type="submit">Leer datos →</button>
  </form>
</body></html>`);
});

// ------------------------------------------------------------------
// PASO 3: procesar OCR y mostrar confirmacion (SIN edicion)
// ------------------------------------------------------------------
app.post('/carga/procesar', async (req, res) => {
  const { operador, unidad, tieneTicket2 } = req.body;

  if (!req.files || !req.files.ticket1 || !req.files.odometro) {
    return res.send(renderError('Faltan fotos obligatorias. Intenta de nuevo.', operador, unidad));
  }

  try {
    // --- Ticket 1 ---
    const ocr1 = await leerImagen(req.files.ticket1.data);
    if (ocr1.confianza < UMBRAL_CONFIANZA) {
      return res.send(renderRepetir('La foto del ticket #1 no se pudo leer bien (borrosa o mal iluminada). Vuelve a tomarla.', operador, unidad));
    }
    const datos1 = parsearTicket(ocr1.texto);
    if (!datos1.proveedor || datos1.confianzaBaja.length > 0) {
      return res.send(renderRepetir('No se pudieron leer todos los datos del ticket #1. Vuelve a tomar la foto, asegurando que se vea completo y sin sombras.', operador, unidad));
    }

    // --- Ticket 2 (opcional) ---
    let datos2 = null;
    if (tieneTicket2 === 'si' && req.files.ticket2) {
      const ocr2 = await leerImagen(req.files.ticket2.data);
      if (ocr2.confianza < UMBRAL_CONFIANZA) {
        return res.send(renderRepetir('La foto del ticket #2 no se pudo leer bien. Vuelve a tomarla.', operador, unidad));
      }
      datos2 = parsearTicket(ocr2.texto);
      if (!datos2.proveedor || datos2.confianzaBaja.length > 0) {
        return res.send(renderRepetir('No se pudieron leer todos los datos del ticket #2. Vuelve a tomar la foto.', operador, unidad));
      }
    }

    // --- Odometro ---
    const ocrOdo = await leerImagen(req.files.odometro.data);
    if (ocrOdo.confianza < UMBRAL_CONFIANZA) {
      return res.send(renderRepetir('La foto del odómetro no se pudo leer bien. Vuelve a tomarla, de frente y con buena luz.', operador, unidad));
    }
    const datosOdo = parsearOdometro(ocrOdo.texto);
    if (!datosOdo.odometro) {
      return res.send(renderRepetir('No se pudo identificar el número de kilometraje en la foto. Vuelve a tomarla.', operador, unidad));
    }

    // --- Mostrar confirmacion (no editable) ---
    res.send(renderConfirmacion(operador, unidad, datos1, datos2, datosOdo.odometro));

  } catch (err) {
    res.send(renderError('Error al procesar las fotos: ' + err.message, operador, unidad));
  }
});

function renderRepetir(mensaje, operador, unidad) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:Arial;padding:24px;text-align:center;max-width:480px;margin:0 auto;background:#f0f2f5}
  .warn{background:#fff3cd;color:#856404;padding:20px;border-radius:10px;font-size:17px;margin:20px 0}
  a{display:block;padding:16px;border-radius:10px;color:white;text-decoration:none;font-size:17px;margin:10px 0;background:#1F4E5F}</style></head>
  <body><div class="warn">⚠️ ${mensaje}</div>
  <a href="/carga/foto?operador=${encodeURIComponent(operador)}&unidad=${encodeURIComponent(unidad)}">📸 Volver a tomar fotos</a>
  </body></html>`;
}

function renderError(mensaje, operador, unidad) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:Arial;padding:24px;text-align:center;max-width:480px;margin:0 auto;background:#f0f2f5}
  .err{background:#fce8e6;color:#c0392b;padding:20px;border-radius:10px;font-size:17px;margin:20px 0}
  a{display:block;padding:16px;border-radius:10px;color:white;text-decoration:none;font-size:17px;margin:10px 0;background:#1F4E5F}</style></head>
  <body><div class="err">❌ ${mensaje}</div>
  <a href="/carga/foto?operador=${encodeURIComponent(operador)}&unidad=${encodeURIComponent(unidad)}">📸 Intentar de nuevo</a>
  </body></html>`;
}

function renderConfirmacion(operador, unidad, datos1, datos2, odometro) {
  const filaHtml = (d, n) => `
    <div class="tarjeta">
      <b>Ticket ${n} (${d.proveedor})</b><br>
      Gasolinera: ${d.campos.gasolinera}<br>
      Folio: ${d.campos.folio}<br>
      Fecha: ${d.campos.fecha} ${d.campos.hora}<br>
      Litros: ${d.campos.litros}<br>
      Precio/L: $${d.campos.precio}<br>
      Importe: $${d.campos.importe}
    </div>`;

  // empaquetamos los datos en un form oculto para el guardado final
  const payload = encodeURIComponent(JSON.stringify({ operador, unidad, datos1, datos2, odometro }));

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:Arial;padding:16px;max-width:480px;margin:0 auto;background:#f0f2f5}
    h2{color:#1F4E5F;text-align:center}
    .tarjeta{background:white;border-radius:10px;padding:16px;margin:14px 0;font-size:15px;line-height:1.6}
    .odo{background:#eef7ee;border-radius:10px;padding:16px;margin:14px 0;font-size:16px;font-weight:bold;text-align:center}
    .aviso{font-size:13px;color:#777;text-align:center;margin-top:10px}
    button,a.btn{display:block;width:100%;padding:18px;border:none;border-radius:10px;font-size:18px;font-weight:bold;margin-top:14px;text-align:center;text-decoration:none;color:white;box-sizing:border-box}
    .ok{background:#0b8a3e}
    .no{background:#999}
  </style></head>
  <body>
    <h2>Confirma estos datos</h2>
    ${filaHtml(datos1, 1)}
    ${datos2 ? filaHtml(datos2, 2) : ''}
    <div class="odo">🚛 Kilometraje real: ${odometro} km</div>
    <p class="aviso">Estos datos se leyeron automáticamente de tus fotos y no se pueden editar. Si algo está mal, vuelve a tomar las fotos.</p>
    <form method="POST" action="/carga/guardar">
      <input type="hidden" name="payload" value="${payload}">
      <button type="submit" class="ok">✅ Confirmar y guardar</button>
    </form>
    <a href="/carga/foto?operador=${encodeURIComponent(operador)}&unidad=${encodeURIComponent(unidad)}" class="btn no">↺ No, volver a tomar fotos</a>
  </body></html>`;
}

// ------------------------------------------------------------------
// PASO 4: guardado final
// ------------------------------------------------------------------
app.post('/carga/guardar', async (req, res) => {
  const { operador, unidad, datos1, datos2, odometro } = JSON.parse(decodeURIComponent(req.body.payload));

  async function guardarCarga(d, esSegundo) {
    const [fecha, hora] = [d.campos.fecha, d.campos.hora];
    const valores = [
      fecha, hora, unidad, operador, d.proveedor, d.campos.gasolinera, '',
      esSegundo ? '' : odometro, // el kilometraje solo se pone en la primera fila para no duplicar el km recorrido
      d.campos.litros, d.campos.precio, '', 'Foto automatica', '',
      d.campos.folio, '', `Registrado por foto${esSegundo ? ' (ticket 2 de la misma carga)' : ''}`
    ];
    await escribirFila('FACT_CARGAS', valores);
  }

  await guardarCarga(datos1, false);
  if (datos2) await guardarCarga(datos2, true);

  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:Arial;padding:24px;text-align:center;max-width:480px;margin:0 auto;background:#f0f2f5}
  .ok{background:#e6f4ea;color:#0b8a3e;padding:20px;border-radius:10px;font-size:18px;margin:20px 0}
  a{display:block;padding:16px;border-radius:10px;color:white;text-decoration:none;font-size:17px;margin:10px 0;background:#1F4E5F}</style></head>
  <body><div class="ok">✅ Carga${datos2 ? 's' : ''} registrada${datos2 ? 's' : ''} correctamente</div>
  <a href="/carga">📝 Registrar otra carga</a>
  <a href="/" style="background:#2A78D6">← Menú principal</a>
  </body></html>`);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
