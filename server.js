const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SHEET_ID = '1a_ozNMWUNkZG65YnzLnygS7ccUW5h3qAOpn2A-rDRzY';

// Autenticacion via Service Account (credentials.json)
function getAuth() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return auth;
}

async function leerRango(rango) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: rango
  });
  return res.data.values || [];
}

async function escribirFila(nombreHoja, valores) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  // encontrar primera fila vacia (columna B)
  const datos = await leerRango(`${nombreHoja}!B:B`);
  const filaVacia = datos.length + 1;
  const rango = `${nombreHoja}!B${filaVacia}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: rango,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [valores] }
  });
  return filaVacia;
}

async function actualizarCelda(nombreHoja, fila, col, valor) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${nombreHoja}!${col}${fila}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[valor]] }
  });
}

// ------------------------------------------------------------------
// RUTAS
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
  <a href="/carga" class="c1">📝 Registrar carga</a>
  <a href="/viaje" class="c2">🚛 Cerrar viaje</a>
</body></html>`);
});

// ------------------------------------------------------------------
// FORMULARIO REGISTRAR CARGA (GET = muestra, POST = guarda)
// ------------------------------------------------------------------
app.get('/carga', async (req, res) => {
  const [unidades, proveedores, gasolineras, viajes] = await Promise.all([
    leerRango('DIM_UNIDADES!A2:A50'),
    leerRango('DIM_PROVEEDORES!A2:A10'),
    leerRango('DIM_GASOLINERAS!A2:A50'),
    leerRango('FACT_VIAJES!A2:A300')
  ]);

  const opts = (arr, optional) => {
    let html = optional ? '<option value="">(opcional)</option>' : '';
    arr.forEach(r => { if(r[0]) html += `<option>${r[0]}</option>`; });
    return html;
  };

  const now = new Date();
  const fecha = now.toISOString().split('T')[0];
  const hora = now.toTimeString().slice(0,5);

  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Registrar carga</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial;font-size:17px;padding:16px;max-width:480px;margin:0 auto;background:#f0f2f5}
  h2{color:#1F4E5F;text-align:center}
  label{display:block;margin-top:16px;font-weight:bold;color:#333;font-size:15px}
  input,select,textarea{width:100%;padding:14px;margin-top:6px;border:1px solid #ccc;border-radius:8px;font-size:17px;background:white}
  .fila{display:flex;gap:10px}
  .fila>div{flex:1}
  button{margin-top:24px;width:100%;padding:18px;background:#1F4E5F;color:white;border:none;border-radius:10px;font-size:19px;font-weight:bold}
  a.v{display:block;margin-bottom:10px;color:#1F4E5F;text-decoration:none}
</style></head>
<body>
  <a class="v" href="/">← Menú</a>
  <h2>📝 Registrar carga</h2>
  <form method="POST" action="/carga">
    <label>Unidad *</label>
    <select name="unidad" required>${opts(unidades)}</select>

    <div class="fila">
      <div><label>Fecha</label><input type="date" name="fecha" value="${fecha}"></div>
      <div><label>Hora</label><input type="time" name="hora" value="${hora}"></div>
    </div>

    <label>Proveedor *</label>
    <select name="proveedor" required>${opts(proveedores)}</select>

    <label>Gasolinera</label>
    <select name="gasolinera">${opts(gasolineras, true)}</select>

    <label>Viaje</label>
    <select name="viaje">${opts(viajes, true)}</select>

    <div class="fila">
      <div><label>Litros *</label><input type="number" step="0.001" name="litros" inputmode="decimal" required></div>
      <div><label>Precio/litro *</label><input type="number" step="0.01" name="precio" inputmode="decimal" required></div>
    </div>

    <label>Kilometraje (si lo tienes)</label>
    <input type="number" name="kilometraje" inputmode="numeric">

    <label>Forma de pago</label>
    <select name="formaPago">
      <option>Credito Paran</option>
      <option>TAG EOX</option>
      <option>Descuento de ingreso</option>
    </select>

    <label>Num. ticket</label>
    <input type="text" name="numTicket">

    <label>Observaciones</label>
    <textarea name="observaciones" rows="2"></textarea>

    <button type="submit">Guardar carga</button>
  </form>
</body></html>`);
});

app.post('/carga', async (req, res) => {
  const d = req.body;
  const valores = [
    d.fecha, d.hora, d.unidad, 'ALBERTO ISAAC GARCIA ',
    d.proveedor, d.gasolinera || '', d.viaje || '',
    d.kilometraje || '', d.litros, d.precio, '',
    d.formaPago || '', '', d.numTicket || '', '', d.observaciones || ''
  ];
  const fila = await escribirFila('FACT_CARGAS', valores);
  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Arial;padding:24px;text-align:center;max-width:480px;margin:0 auto}
.ok{color:#0b8a3e;background:#e6f4ea;padding:20px;border-radius:10px;font-size:18px;margin:20px 0}
a{display:block;padding:16px;border-radius:10px;color:white;text-decoration:none;font-size:17px;margin:10px 0}
.c1{background:#1F4E5F}.c2{background:#2A78D6}</style></head>
<body>
  <div class="ok">✅ Carga registrada correctamente</div>
  <a href="/carga" class="c1">📝 Registrar otra carga</a>
  <a href="/" class="c2">← Menú principal</a>
</body></html>`);
});

// ------------------------------------------------------------------
// FORMULARIO CERRAR VIAJE
// ------------------------------------------------------------------
app.get('/viaje', async (req, res) => {
  const viajesData = await leerRango('FACT_VIAJES!A2:H300');
  let optsViajes = '<option value="">-- Selecciona --</option>';
  viajesData.forEach(r => {
    if (r[0] && r[1] && !r[2]) { // tiene id, fecha inicio, NO tiene fecha fin
      optsViajes += `<option value="${r[0]}">${r[0]} | ${r[3] || ''} | ${r[6] || ''}</option>`;
    }
  });

  const hoy = new Date().toISOString().split('T')[0];

  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cerrar viaje</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial;font-size:17px;padding:16px;max-width:480px;margin:0 auto;background:#f0f2f5}
  h2{color:#2A78D6;text-align:center}
  label{display:block;margin-top:16px;font-weight:bold;color:#333;font-size:15px}
  input,select{width:100%;padding:14px;margin-top:6px;border:1px solid #ccc;border-radius:8px;font-size:17px;background:white}
  button{margin-top:24px;width:100%;padding:18px;background:#2A78D6;color:white;border:none;border-radius:10px;font-size:19px;font-weight:bold}
  a.v{display:block;margin-bottom:10px;color:#2A78D6;text-decoration:none}
</style></head>
<body>
  <a class="v" href="/">← Menú</a>
  <h2>🚛 Cerrar viaje</h2>
  <form method="POST" action="/viaje">
    <label>Viaje a cerrar *</label>
    <select name="idViaje" required>${optsViajes}</select>

    <label>Fecha de cierre</label>
    <input type="date" name="fechaFin" value="${hoy}">

    <label>Kilometraje real recorrido *</label>
    <input type="number" name="kilometraje" inputmode="numeric" placeholder="Ej. 3604" required>

    <label>Carga transportada (opcional)</label>
    <input type="text" name="cargaTransportada" placeholder="Ej. 28 toneladas">

    <button type="submit">Cerrar viaje</button>
  </form>
</body></html>`);
});

app.post('/viaje', async (req, res) => {
  const d = req.body;
  const viajesData = await leerRango('FACT_VIAJES!A2:A300');
  let fila = -1;
  viajesData.forEach((r, i) => {
    if (r[0] === d.idViaje) fila = i + 2;
  });
  if (fila < 0) {
    return res.send('<h2>Error: no se encontró el viaje</h2><a href="/viaje">Volver</a>');
  }
  await actualizarCelda('FACT_VIAJES', fila, 'C', d.fechaFin);
  await actualizarCelda('FACT_VIAJES', fila, 'H', d.kilometraje);
  if (d.cargaTransportada) {
    await actualizarCelda('FACT_VIAJES', fila, 'I', d.cargaTransportada);
  }
  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Arial;padding:24px;text-align:center;max-width:480px;margin:0 auto}
.ok{color:#0b8a3e;background:#e6f4ea;padding:20px;border-radius:10px;font-size:18px;margin:20px 0}
a{display:block;padding:16px;border-radius:10px;color:white;text-decoration:none;font-size:17px;margin:10px 0}
.c1{background:#1F4E5F}.c2{background:#2A78D6}</style></head>
<body>
  <div class="ok">✅ Viaje ${d.idViaje} cerrado correctamente</div>
  <a href="/viaje" class="c2">🚛 Cerrar otro viaje</a>
  <a href="/" class="c1">← Menú principal</a>
</body></html>`);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
