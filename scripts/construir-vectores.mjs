/**
 * Construye el fichero de vectores semánticos del juego a partir de
 * ConceptNet Numberbatch.
 *
 *   node scripts/construir-vectores.mjs
 *
 * Descarga los vectores multilingües (3 GB comprimidos), se queda con las
 * palabras españolas que están en el léxico del juego, las cuantiza a un byte
 * por dimensión y escribe `data/vectores.bin`, de menos de 1 MB. El fichero
 * generado se versiona en el repositorio, así que esto sólo hace falta
 * ejecutarlo al ampliar el léxico.
 *
 * Numberbatch es CC BY-SA 4.0 (ver data/LEEME-vectores.md).
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import { PALABRAS, normalizar, DIMENSIONES } from '../server/similarity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const ORIGEN = 'https://conceptnet.s3.amazonaws.com/downloads/2019/numberbatch/numberbatch-19.08.txt.gz';
const CACHE = path.join(RAIZ, 'data', 'numberbatch-es.txt');
const DESTINO = path.join(RAIZ, 'data', 'vectores.bin');

/** Descarga y deja sólo las filas del español de una sola palabra. */
async function descargarEspañol() {
  if (fs.existsSync(CACHE)) {
    console.log(`Reutilizando ${path.relative(RAIZ, CACHE)}`);
    return;
  }
  console.log('Descargando Numberbatch (3 GB, tarda unos minutos)…');
  const respuesta = await fetch(ORIGEN);
  if (!respuesta.ok) throw new Error(`No se pudo descargar: ${respuesta.status}`);

  const salida = fs.createWriteStream(CACHE);
  const descomprimido = zlib.createGunzip();
  const lector = readline.createInterface({ input: descomprimido, crlfDelay: Infinity });

  let filas = 0;
  lector.on('line', (linea) => {
    if (!linea.startsWith('/c/es/')) return;
    const palabra = linea.slice(6, linea.indexOf(' '));
    if (palabra.includes('_')) return; // expresiones de varias palabras
    salida.write(linea.slice(6) + '\n');
    if (++filas % 100000 === 0) console.log(`  ${filas} filas…`);
  });

  await pipeline(respuesta.body, descomprimido);
  await new Promise((r) => salida.end(r));
  console.log(`Español extraído: ${filas} filas`);
}

/** Cuantiza a un byte por dimensión: el vector va normalizado, así que cabe. */
function construir() {
  const buscadas = new Set(PALABRAS);
  const encontrados = new Map();

  const lineas = readline.createInterface({
    input: fs.createReadStream(CACHE),
    crlfDelay: Infinity,
  });

  return new Promise((resolver) => {
    lineas.on('line', (linea) => {
      const corte = linea.indexOf(' ');
      if (corte < 1) return;
      // ConceptNet conserva las tildes y el juego no: se normaliza igual que
      // lo que escribe el jugador, o se perderían «árbol», «canción»…
      const clave = normalizar(linea.slice(0, corte));
      if (!buscadas.has(clave) || encontrados.has(clave)) return;

      const crudo = linea.slice(corte + 1).split(' ').map(Number);
      if (crudo.length !== DIMENSIONES) return;
      let norma = 0;
      for (const x of crudo) norma += x * x;
      norma = Math.sqrt(norma) || 1;
      encontrados.set(clave, crudo.map((x) => Math.max(-127, Math.min(127, Math.round((x / norma) * 127)))));
    });

    lineas.on('close', () => {
      const palabras = PALABRAS.filter((p) => encontrados.has(p));
      const datos = Buffer.alloc(palabras.length * DIMENSIONES);
      palabras.forEach((p, i) => {
        const v = encontrados.get(p);
        for (let d = 0; d < DIMENSIONES; d++) datos[i * DIMENSIONES + d] = v[d] & 0xff;
      });

      const cabecera = Buffer.from(
        JSON.stringify({ dims: DIMENSIONES, palabras }) + '\n',
        'utf8',
      );
      fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
      fs.writeFileSync(DESTINO, Buffer.concat([cabecera, datos]));

      const cobertura = Math.round((palabras.length / PALABRAS.length) * 100);
      console.log(
        `\n${path.relative(RAIZ, DESTINO)}: ${palabras.length} de ${PALABRAS.length} palabras ` +
        `(${cobertura} %), ${(fs.statSync(DESTINO).size / 1024).toFixed(0)} KB`,
      );
      const sinVector = PALABRAS.filter((p) => !encontrados.has(p));
      if (sinVector.length) console.log(`Sin vector (usan sólo el léxico): ${sinVector.slice(0, 20).join(', ')}…`);
      resolver();
    });
  });
}

await descargarEspañol();
await construir();
