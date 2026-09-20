/**
 * Construye el vocabulario y los vectores semánticos del juego.
 *
 *   node scripts/construir-vectores.mjs
 *
 * Junta dos fuentes:
 *
 *   1. ConceptNet Numberbatch — vectores de significado, 300 dimensiones.
 *   2. Una lista de frecuencia del español — qué palabras escribiría alguien.
 *
 * El vocabulario en bruto no sirve: un tercio son flexiones que compiten con su
 * propia palabra (con «ventana» secreta, «ventanas» saldría en el puesto 1) o
 * extranjerismos colados en la lista. La curación de aquí abajo es la parte que
 * de verdad hace jugable un vocabulario grande.
 *
 * Escribe `data/vectores.bin`. El fichero se versiona, así que esto sólo hace
 * falta ejecutarlo al cambiar el léxico o los filtros.
 *
 * Numberbatch es CC BY-SA 4.0 (ver data/LEEME-vectores.md).
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import { PALABRAS_LEXICO, normalizar, DIMENSIONES } from '../server/similarity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const DATOS = path.join(RAIZ, 'data');

const NUMBERBATCH = 'https://conceptnet.s3.amazonaws.com/downloads/2019/numberbatch/numberbatch-19.08.txt.gz';
const FRECUENCIA = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt';

const CACHE_VECTORES = path.join(DATOS, 'numberbatch-es.txt');
const CACHE_FRECUENCIA = path.join(DATOS, 'frecuencia-es.txt');
const DESTINO = path.join(DATOS, 'vectores.bin');

// ─── Curación ────────────────────────────────────────────────────────────────

/**
 * Ortografía que en español no es propia: descarta «windows», «okay», «shopping»
 * y las terminaciones en consonantes que el español no usa. Es una heurística,
 * y se lleva por delante algún préstamo legítimo («kilómetro», «chalet»); por eso
 * las palabras del léxico escrito a mano entran sin pasar por aquí.
 */
const ORTOGRAFIA_AJENA = /[kw]|sh|ck|ph|th|oo|ee|[^aeiounslrdzjxy]$/;

/**
 * Formas verbales conjugadas. Una lista de sufijos sueltos no basta: con
 * «quemar» de secreta salían «queman, quemaran, quemare, quemaria, quemarlo,
 * quemarte, quemo, quemandose» como las ocho palabras más cercanas, que es
 * regalar la ronda.
 *
 * Aquí se ancla en el infinitivo: una palabra es conjugación si se construye
 * sobre un infinitivo que está en el vocabulario. Y como muchos sustantivos
 * coinciden con una forma verbal («casa» de «casar», «juego» de «jugar»), hace
 * falta además que el vector confirme que son la misma cosa.
 */
const TERMINACIONES = [
  // Sobre la raíz (quemar → quem-)
  'ando', 'iendo', 'andose', 'iendose',
  'o', 'as', 'a', 'amos', 'ais', 'an',
  'es', 'e', 'emos', 'eis', 'en',
  'aba', 'abas', 'abamos', 'abais', 'aban',
  'ia', 'ias', 'iamos', 'iais', 'ian',
  'aste', 'asteis', 'aron', 'iste', 'isteis', 'ieron',
  'ara', 'aras', 'aramos', 'aran', 'ase', 'ases', 'asen',
  'iera', 'ieras', 'ieran', 'iese', 'iesen',
  'io', 'ire', 'iras', 'ira', 'iremos', 'iran', 'iria', 'irias', 'irian',
  'ere', 'eras', 'era', 'eremos', 'eran', 'eria', 'erias', 'erian',
];

/** Pronombres pegados al verbo: quemarlo, quemarte, quemándose. */
const ENCLITICOS = ['lo', 'la', 'le', 'los', 'las', 'les', 'me', 'te', 'se', 'nos'];

/** Lo que se le puede añadir a un infinitivo entero: quemar + ia/an/e/lo… */
const TRAS_INFINITIVO = ['e', 'es', 'emos', 'eis', 'en', 'a', 'as', 'an', 'amos',
  'ia', 'ias', 'iamos', 'ian', ...ENCLITICOS];

/**
 * Devuelve el infinitivo del que procede `palabra`, si lo hay en `vocabulario`.
 * Los participios (-ado, -ido, -ada, -ida) se dejan fuera a propósito: dan
 * sustantivos de pleno derecho como «entrada», «salida» o «vestido».
 */
function infinitivoDe(palabra, vocabulario, profundidad = 0) {
  // Pronombre pegado a cualquier forma, no sólo al infinitivo: «quémalo» es
  // «quema» + «lo», y «quemarlo» es el infinitivo + «lo».
  if (profundidad === 0) {
    for (const pronombre of ENCLITICOS) {
      if (!palabra.endsWith(pronombre)) continue;
      const sinPronombre = palabra.slice(0, -pronombre.length);
      if (sinPronombre.length < 4) continue;
      if (vocabulario.has(sinPronombre) && /(?:ar|er|ir)$/.test(sinPronombre)) return sinPronombre;
      const infinitivo = infinitivoDe(sinPronombre, vocabulario, 1);
      if (infinitivo) return infinitivo;
    }
  }

  // quemar + lo → quemarlo;  quemar + ian → quemarian
  for (const cola of TRAS_INFINITIVO) {
    if (!palabra.endsWith(cola)) continue;
    const base = palabra.slice(0, -cola.length);
    if (base.length >= 4 && /(?:ar|er|ir)$/.test(base) && vocabulario.has(base)) return base;
  }
  // quem + an → queman
  for (const cola of TERMINACIONES) {
    if (!palabra.endsWith(cola)) continue;
    const raiz = palabra.slice(0, -cola.length);
    if (raiz.length < 3) continue;
    for (const inf of ['ar', 'er', 'ir']) {
      if (vocabulario.has(raiz + inf)) return raiz + inf;
    }
  }
  return null;
}

/** ¿Es una flexión de otra palabra que ya está en el vocabulario? */
function esFlexion(palabra, presentes) {
  for (const sufijo of ['s', 'es']) {
    if (palabra.endsWith(sufijo) && presentes.has(palabra.slice(0, -sufijo.length))) return true;
  }
  for (const [sufijo, base] of [['ito', 'o'], ['ita', 'a'], ['itos', 'o'], ['itas', 'a'], ['mente', '']]) {
    if (palabra.endsWith(sufijo) && presentes.has(palabra.slice(0, -sufijo.length) + base)) return true;
  }
  return false;
}

// ─── Descargas ───────────────────────────────────────────────────────────────

async function descargarFrecuencia() {
  if (fs.existsSync(CACHE_FRECUENCIA)) return;
  console.log('Descargando la lista de frecuencia del español…');
  const respuesta = await fetch(FRECUENCIA);
  if (!respuesta.ok) throw new Error(`Lista de frecuencia: ${respuesta.status}`);
  fs.writeFileSync(CACHE_FRECUENCIA, await respuesta.text());
}

async function descargarVectores() {
  if (fs.existsSync(CACHE_VECTORES)) {
    console.log(`Reutilizando ${path.relative(RAIZ, CACHE_VECTORES)}`);
    return;
  }
  console.log('Descargando Numberbatch (3 GB, tarda unos minutos)…');
  const respuesta = await fetch(NUMBERBATCH);
  if (!respuesta.ok) throw new Error(`Numberbatch: ${respuesta.status}`);

  const salida = fs.createWriteStream(CACHE_VECTORES);
  const descomprimido = zlib.createGunzip();
  const lineas = readline.createInterface({ input: descomprimido, crlfDelay: Infinity });

  let filas = 0;
  lineas.on('line', (linea) => {
    if (!linea.startsWith('/c/es/')) return;
    const fin = linea.indexOf(' ');
    if (linea.slice(6, fin).includes('_')) return; // expresiones de varias palabras
    salida.write(linea.slice(6) + '\n');
    if (++filas % 100000 === 0) console.log(`  ${filas} filas…`);
  });

  await pipeline(respuesta.body, descomprimido);
  await new Promise((r) => salida.end(r));
  console.log(`Español extraído: ${filas} filas`);
}

// ─── Construcción ────────────────────────────────────────────────────────────

async function construir() {
  const delLexico = new Set(PALABRAS_LEXICO);

  // Candidatas por frecuencia, en orden: las más usadas primero.
  const TOPE_FRECUENCIA = 30000;
  const frecuentes = [];
  const vistas = new Set();
  for (const linea of fs.readFileSync(CACHE_FRECUENCIA, 'utf8').split('\n')) {
    const palabra = normalizar(linea.split(' ')[0]);
    if (palabra.length < 3 || vistas.has(palabra)) continue;
    vistas.add(palabra);
    if (frecuentes.length < TOPE_FRECUENCIA) frecuentes.push(palabra);
  }

  const admitidas = new Set(delLexico);
  const descartes = { ajena: 0, flexion: 0, conjugada: 0 };
  for (const palabra of frecuentes) {
    if (admitidas.has(palabra)) continue;
    if (ORTOGRAFIA_AJENA.test(palabra)) { descartes.ajena++; continue; }
    if (esFlexion(palabra, vistas)) { descartes.flexion++; continue; }
    admitidas.add(palabra);
  }

  console.log(`\nCandidatas por frecuencia: ${frecuentes.length}`);
  console.log(`  descartadas por ortografía ajena: ${descartes.ajena}`);
  console.log(`  descartadas por ser flexión:      ${descartes.flexion}`);

  // Sólo se quedan las que además tienen vector.
  const encontrados = new Map();
  const lineas = readline.createInterface({
    input: fs.createReadStream(CACHE_VECTORES),
    crlfDelay: Infinity,
  });
  for await (const linea of lineas) {
    const corte = linea.indexOf(' ');
    if (corte < 1) continue;
    // ConceptNet conserva las tildes y el juego no: se normaliza igual que lo
    // que escribe el jugador, o se perderían «árbol» o «canción».
    const clave = normalizar(linea.slice(0, corte));
    if (!admitidas.has(clave) || encontrados.has(clave)) continue;

    const crudo = linea.slice(corte + 1).split(' ').map(Number);
    if (crudo.length !== DIMENSIONES) continue;
    let norma = 0;
    for (const x of crudo) norma += x * x;
    norma = Math.sqrt(norma) || 1;
    encontrados.set(clave, crudo.map((x) => Math.max(-127, Math.min(127, Math.round((x / norma) * 127)))));
  }

  const coseno = (x, y) => {
    let producto = 0;
    let nx = 0;
    let ny = 0;
    for (let i = 0; i < DIMENSIONES; i++) {
      producto += x[i] * y[i];
      nx += x[i] * x[i];
      ny += y[i] * y[i];
    }
    return producto / (Math.sqrt(nx) * Math.sqrt(ny) || 1);
  };

  // Conjugaciones: el patrón dice que PUEDE venir de un infinitivo, y el vector
  // confirma que es la misma palabra. Hacen falta las dos cosas, porque muchos
  // sustantivos coinciden con una forma verbal y no se pueden perder: «casa» es
  // también de «casar», «juego» de «jugar» y «cuenta» de «contar».
  const UMBRAL_MISMA = 0.68;
  for (const palabra of [...encontrados.keys()]) {
    if (delLexico.has(palabra)) continue;
    const infinitivo = infinitivoDe(palabra, encontrados);
    if (!infinitivo || infinitivo === palabra) continue;
    if (coseno(encontrados.get(palabra), encontrados.get(infinitivo)) > UMBRAL_MISMA) {
      encontrados.delete(palabra);
      descartes.conjugada++;
    }
  }
  console.log(`  descartadas por ser conjugación:  ${descartes.conjugada}`);

  // Variantes de género del mismo concepto: «gata» junto a «gato» es la misma
  // palabra dos veces, y quien escribe una u otra debería recibir lo mismo. No
  // se pueden borrar a ciegas —«casa»/«caso» o «rata»/«rato» son palabras
  // distintas—, así que lo decide el propio vector: las variantes reales rondan
  // 0,85-0,93 de coseno, y las palabras distintas no pasan de 0,2.
  const UMBRAL_VARIANTE = 0.8;
  let fusionadas = 0;
  for (const palabra of [...encontrados.keys()]) {
    if (!palabra.endsWith('a') || delLexico.has(palabra)) continue;
    const masculino = palabra.slice(0, -1) + 'o';
    if (!encontrados.has(masculino)) continue;
    if (coseno(encontrados.get(palabra), encontrados.get(masculino)) > UMBRAL_VARIANTE) {
      encontrados.delete(palabra);
      fusionadas++;
    }
  }
  console.log(`  variantes de género fusionadas con su masculino: ${fusionadas}`);

  const palabras = [...encontrados.keys()].sort();
  const datos = Buffer.alloc(palabras.length * DIMENSIONES);
  palabras.forEach((p, i) => {
    const v = encontrados.get(p);
    for (let d = 0; d < DIMENSIONES; d++) datos[i * DIMENSIONES + d] = v[d] & 0xff;
  });

  const cabecera = Buffer.from(JSON.stringify({ dims: DIMENSIONES, palabras }) + '\n', 'utf8');
  fs.writeFileSync(DESTINO, Buffer.concat([cabecera, datos]));

  const sinVector = [...delLexico].filter((p) => !encontrados.has(p));
  console.log(`\n${path.relative(RAIZ, DESTINO)}: ${palabras.length} palabras, ${(fs.statSync(DESTINO).size / 1048576).toFixed(1)} MB`);
  console.log(`  del léxico a mano: ${delLexico.size - sinVector.length} de ${delLexico.size} con vector`);
  if (sinVector.length) console.log(`  sin vector (siguen valiendo por sus etiquetas): ${sinVector.slice(0, 15).join(', ')}…`);
}

await descargarFrecuencia();
await descargarVectores();
await construir();
