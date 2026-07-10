/**
 * Extrae los datos relevantes del texto crudo (OCR) de un ticket,
 * detectando automaticamente si es formato EOX (GOSMO) o PARAN (Pemex).
 */

function limpiarNumero(str) {
  if (!str) return null;
  return parseFloat(str.replace(/[^0-9.]/g, ''));
}

function detectarProveedor(texto) {
  if (/GOSMO/i.test(texto)) return 'EOX';
  if (/PARAN\s+MEGASERVICIOS/i.test(texto)) return 'PAR';
  return null;
}

function parsearEOX(texto) {
  const resultado = { proveedor: 'EOX', campos: {}, confianzaBaja: [] };

  // Gasolinera: primera linea normalmente tipo "BPM802 Las Brisas" o "TURISMO CAMPECHE..."
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  resultado.campos.gasolinera = lineas[0] || null;
  if (!resultado.campos.gasolinera) resultado.confianzaBaja.push('gasolinera');

  // Folio / Nota
  const nota = texto.match(/NOTA\s*#?\s*(\d+)/i);
  resultado.campos.folio = nota ? nota[1] : null;
  if (!nota) resultado.confianzaBaja.push('folio');

  // Fecha y hora
  const fecha = texto.match(/FECHA\s*:?\s*(\d{2}\/\d{2}\/\d{4}),?\s*(\d{2}:\d{2})/i);
  resultado.campos.fecha = fecha ? fecha[1] : null;
  resultado.campos.hora = fecha ? fecha[2] : null;
  if (!fecha) resultado.confianzaBaja.push('fecha_hora');

  // Litros y precio (linea de producto, ej: "BP DIESEL   300.000 LTR   27.00   8100.00")
  const producto = texto.match(/(\d{1,4}\.\d{3})\s*LTR\s*(\d{1,3}\.\d{2,3})\s*([\d,]+\.\d{2})/i);
  resultado.campos.litros = producto ? limpiarNumero(producto[1]) : null;
  resultado.campos.precio = producto ? limpiarNumero(producto[2]) : null;
  resultado.campos.importe = producto ? limpiarNumero(producto[3]) : null;
  if (!producto) resultado.confianzaBaja.push('litros_precio_importe');

  // Total (como respaldo/validacion cruzada del importe)
  const total = texto.match(/TOTAL\s*:?\s*\$?\s*([\d,]+\.\d{2})/i);
  resultado.campos.total = total ? limpiarNumero(total[1]) : null;

  return resultado;
}

function parsearPAR(texto) {
  const resultado = { proveedor: 'PAR', campos: {}, confianzaBaja: [] };

  // Gasolinera: siempre "PARAN MEGASERVICIOS" + linea de "Pemex ES XXXX"
  const estacion = texto.match(/Pemex\s+ES\s*(\d+)/i);
  resultado.campos.gasolinera = estacion ? ('PARAN ES' + estacion[1]) : 'PARANTULA';

  // Transaccion (usamos esto como folio/num_ticket)
  const transaccion = texto.match(/Transacci[oó]n\s*:?\s*(\d+)/i);
  resultado.campos.folio = transaccion ? transaccion[1] : null;
  if (!transaccion) resultado.confianzaBaja.push('folio');

  // Fecha y hora
  const fecha = texto.match(/Fecha\s+Venta\s*:?\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}:\d{2})/i);
  if (fecha) {
    resultado.campos.fecha = `${fecha[3]}/${fecha[2]}/${fecha[1]}`;
    resultado.campos.hora = fecha[4];
  } else {
    resultado.campos.fecha = null;
    resultado.campos.hora = null;
    resultado.confianzaBaja.push('fecha_hora');
  }

  // Litros y precio (ej: "DIESEL  371.514  LTR  $ 26.89  $ 9,990.00")
  const producto = texto.match(/DIESEL\s*(\d{1,4}\.\d{3})\s*LTR\s*\$?\s*(\d{1,3}\.\d{2})/i);
  resultado.campos.litros = producto ? limpiarNumero(producto[1]) : null;
  resultado.campos.precio = producto ? limpiarNumero(producto[2]) : null;
  if (!producto) resultado.confianzaBaja.push('litros_precio');

  const total = texto.match(/TOTAL\s*\$?\s*([\d,]+\.\d{2})/i);
  resultado.campos.importe = total ? limpiarNumero(total[1]) : null;
  resultado.campos.total = resultado.campos.importe;
  if (!total) resultado.confianzaBaja.push('importe');

  return resultado;
}

function parsearTicket(texto) {
  const proveedor = detectarProveedor(texto);
  if (proveedor === 'EOX') return parsearEOX(texto);
  if (proveedor === 'PAR') return parsearPAR(texto);
  return { proveedor: null, campos: {}, confianzaBaja: ['proveedor_no_detectado'] };
}

function parsearOdometro(texto) {
  // Busca la secuencia numerica mas larga y razonable (5-7 digitos, tipico de odometro)
  const candidatos = texto.match(/\b\d{5,7}\b/g) || [];
  if (candidatos.length === 0) {
    return { odometro: null, confianzaBaja: ['odometro_no_legible'] };
  }
  // Preferir el candidato mas largo (mas digitos = mas probable que sea el odometro completo)
  candidatos.sort((a, b) => b.length - a.length);
  return { odometro: parseInt(candidatos[0], 10), confianzaBaja: [] };
}

module.exports = { parsearTicket, parsearOdometro, detectarProveedor };
