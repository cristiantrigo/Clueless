/**
 * Motor de cercanía semántica.
 *
 * Construye un vector disperso de etiquetas por palabra a partir del léxico y
 * mide la cercanía con coseno ponderado por IDF: las etiquetas raras
 * ("felino", "postre") aportan mucho más que las genéricas ("servivo").
 *
 * Para una palabra secreta se ordena TODO el léxico por cercanía; la posición
 * resultante (1 = la palabra secreta) es lo que ve el jugador, igual que en
 * Clueless / Contexto.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GROUPS, NO_SECRETO, TAGS_FACIL, TAGS_DIFICIL } from './lexicon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Normalización de texto ──────────────────────────────────────────────────

/** Pasa a minúsculas y quita tildes, diéresis y todo lo que no sea a-z/ñ. */
// Todo diacrítico salvo U+0303 (la tilde de la ñ), que sí distingue letra.
const DIACRITICOS = new RegExp('[\\u0300-\\u0302\\u0304-\\u036f]', 'g');

export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .normalize('NFC')
    .replace(/[^a-zñ]/g, '')
    .trim();
}

// ─── Índice del léxico ───────────────────────────────────────────────────────

/** @type {Map<string, Set<string>>} palabra -> etiquetas */
const etiquetasPorPalabra = new Map();
/** @type {Map<string, number>} etiqueta -> nº de palabras que la tienen */
const frecuenciaEtiqueta = new Map();

for (const [tagsRaw, palabrasRaw] of GROUPS) {
  const tags = tagsRaw.split(/\s+/).filter(Boolean);
  const palabras = palabrasRaw.split(/\s+/).filter(Boolean).map(normalizar);

  for (const palabra of palabras) {
    if (!palabra) continue;
    let set = etiquetasPorPalabra.get(palabra);
    if (!set) {
      set = new Set();
      etiquetasPorPalabra.set(palabra, set);
    }
    for (const tag of tags) set.add(tag);
  }
}

// Una palabra que además da nombre a un campo pertenece a ese campo. Sin esto,
// «casa» (la palabra) no tenía nada que ver con «ventana», «cocina» ni «pared»,
// porque sólo llevaba las etiquetas de los grupos donde aparecía como palabra:
// era el todo desconectado de sus partes, y el género de sus especies.
const NOMBRES_DE_CAMPO = new Set(GROUPS.flatMap(([tagsRaw]) => tagsRaw.split(/\s+/)));
for (const [palabra, tags] of etiquetasPorPalabra) {
  if (NOMBRES_DE_CAMPO.has(palabra)) tags.add(palabra);
}

for (const tags of etiquetasPorPalabra.values()) {
  for (const tag of tags) {
    frecuenciaEtiqueta.set(tag, (frecuenciaEtiqueta.get(tag) ?? 0) + 1);
  }
}

/**
 * Las palabras del léxico escrito a mano: las únicas que llevan etiquetas y,
 * por tanto, las únicas que aportan taxonomía y pueden salir como secretas.
 */
export const PALABRAS_LEXICO = [...etiquetasPorPalabra.keys()].sort();

const N = PALABRAS_LEXICO.length;
const pesoEtiqueta = new Map();
for (const [tag, df] of frecuenciaEtiqueta) {
  pesoEtiqueta.set(tag, Math.log(1 + N / df));
}

/**
 * Cuánto pesa de más la etiqueta que da nombre al propio campo de la palabra.
 * El nombre de una categoría es su prototipo: «casa» no es un miembro más del
 * campo de la casa, es de lo que va el campo entero, y debe quedar cerca de
 * todas sus partes y habitaciones.
 */
const PESO_PROTOTIPO = Number(process.env.PESO_PROTOTIPO ?? 2.6);

/** Vectores de etiquetas normalizados: palabra -> Map(etiqueta -> peso unitario). */
const vectores = new Map();
for (const [palabra, tags] of etiquetasPorPalabra) {
  const vec = new Map();
  let norma = 0;
  for (const tag of tags) {
    const peso = pesoEtiqueta.get(tag) * (tag === palabra ? PESO_PROTOTIPO : 1);
    vec.set(tag, peso);
    norma += peso * peso;
  }
  norma = Math.sqrt(norma) || 1;
  for (const [tag, peso] of vec) vec.set(tag, peso / norma);
  vectores.set(palabra, vec);
}

// ─── Cercanía ────────────────────────────────────────────────────────────────

/** Hash determinista de un par de palabras, para romper empates sin aleatoriedad. */
function ruidoEstable(a, b) {
  const s = a < b ? a + ' ' + b : b + ' ' + a;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967296) * 0.004; // < 0.4 %, sólo desempata
}

/** Trigramas compartidos: capta parentescos morfológicos (sol/solar, pan/panadero). */
function parecidoOrtografico(a, b) {
  if (a === b) return 1;
  const tri = (w) => {
    const p = `  ${w} `;
    const out = new Set();
    for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
    return out;
  };
  const A = tri(a);
  const B = tri(b);
  let comunes = 0;
  for (const t of A) if (B.has(t)) comunes++;
  return (2 * comunes) / (A.size + B.size);
}

// ─── Vectores semánticos de ConceptNet Numberbatch ───────────────────────────

/** Dimensiones de los vectores de Numberbatch. */
export const DIMENSIONES = 300;

/**
 * Cuánto pesa el léxico propio frente a los vectores descargados.
 *
 * Cada uno sabe algo que al otro se le escapa. El léxico escrito a mano domina
 * la taxonomía —el todo y sus partes, el género y sus especies— y es inmune al
 * parecido ortográfico. Los vectores traen la asociación del mundo real, que a
 * un léxico a mano no le cabe: que la miel va con la abeja, o el invierno con
 * la nieve. Medido sobre el banco de pares evidentes, mezclarlos al 50 % deja
 * la posición media en 12, frente a 20 usando sólo el léxico y 26 usando sólo
 * los vectores.
 */
const PESO_LEXICO = Number(process.env.PESO_LEXICO ?? 0.5);

/**
 * Lo que se recorta cuando dos palabras no comparten NADA de significado en el
 * léxico y además se escriben parecido. Los vectores arrastran el parecido de
 * forma —para ellos «rato» está cerquísima de «gato»— y ésta es la guarda que
 * lo impide sin tocar al resto.
 */
const RECORTE_IMPOSTORA = 0.1;

/** @type {Map<string, Int8Array>} */
const vectoresNB = new Map();

(function cargarVectores() {
  const fichero = path.join(__dirname, '..', 'data', 'vectores.bin');
  if (!fs.existsSync(fichero)) return; // el juego funciona igual, sólo con el léxico
  try {
    const bruto = fs.readFileSync(fichero);
    const finCabecera = bruto.indexOf(0x0a);
    const { dims, palabras } = JSON.parse(bruto.subarray(0, finCabecera).toString('utf8'));
    const datos = bruto.subarray(finCabecera + 1);
    palabras.forEach((p, i) => {
      vectoresNB.set(p, new Int8Array(datos.buffer, datos.byteOffset + i * dims, dims));
    });
  } catch (err) {
    console.warn('No se pudieron cargar los vectores, se usa sólo el léxico:', err.message);
    vectoresNB.clear();
  }
})();

export const CON_VECTORES = vectoresNB.size > 0;

/**
 * Vocabulario jugable: todo lo que el jugador puede escribir y sobre lo que se
 * ordena el ranking. Sale del fichero de vectores, que ya viene curado (sin
 * flexiones ni extranjerismos), más lo que sólo esté en el léxico a mano.
 *
 * El léxico aporta las relaciones de taxonomía; el resto del vocabulario juega
 * únicamente con su vector, que para palabras corrientes basta de sobra.
 */
export const PALABRAS = [...new Set([...vectoresNB.keys(), ...PALABRAS_LEXICO])].sort();
export const TOTAL_PALABRAS = PALABRAS.length;

/** Coseno entre dos vectores cuantizados, recortado a [0, 1]. */
function cercaniaVectorial(a, b) {
  const va = vectoresNB.get(a);
  const vb = vectoresNB.get(b);
  if (!va || !vb) return null;
  let producto = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < va.length; i++) {
    producto += va[i] * vb[i];
    na += va[i] * va[i];
    nb += vb[i] * vb[i];
  }
  const norma = Math.sqrt(na) * Math.sqrt(nb);
  return norma === 0 ? 0 : Math.max(0, producto / norma);
}

/** Cercanía que sale sólo del léxico escrito a mano. */
function cercaniaLexica(a, b) {
  const va = vectores.get(a);
  const vb = vectores.get(b);
  if (!va || !vb) return 0;

  // Coseno sobre el vector más corto.
  const [corto, largo] = va.size <= vb.size ? [va, vb] : [vb, va];
  let coseno = 0;
  for (const [tag, peso] of corto) {
    const otro = largo.get(tag);
    if (otro) coseno += peso * otro;
  }

  // Sin nada en común de significado, el parecido de las letras no cuenta:
  // «roto» no se acerca a «rojo» por escribirse parecido.
  if (coseno <= 0) return 0;

  // Ya emparentadas, un poco de parecido de forma ayuda a juntar la familia
  // de una misma raíz (pan/panadería, flor/floristería).
  return Math.min(0.999, coseno * 0.94 + parecidoOrtografico(a, b) * 0.05);
}

/** Cercanía semántica entre dos palabras del léxico, en [0, 1]. */
/**
 * ¿Se parecen sólo en las letras?
 *
 * Los vectores arrastran el parecido de forma, así que para ellos «rato» está
 * cerquísima de «gato» y «pito» de «pino». Hay dos maneras de demostrar que la
 * cercanía es real y no ortográfica: que el léxico las relacione, o que el
 * coseno sea lo bastante alto. Medido, los parientes morfológicos de verdad
 * —ventana/ventanilla, vidrio/vidriera, pan/panadería— pasan de 0,58, y las
 * impostoras no llegan a 0,11.
 */
function esImpostora(a, b, lexica, vectorial) {
  if (lexica > 0) return false;
  if (vectorial !== null && vectorial >= 0.35) return false;
  return parecidoOrtografico(a, b) > 0.33;
}

/** Cercanía semántica entre dos palabras del vocabulario, en [0, 1]. */
export function cercania(a, b) {
  if (a === b) return 1;
  const vectorial = cercaniaVectorial(a, b);
  const ruido = ruidoEstable(a, b);

  // Si alguna de las dos no está en el léxico a mano no hay etiquetas que
  // mezclar, y promediar contra cero hundiría a todo el vocabulario nuevo
  // frente al curado. Ahí manda el vector, que para palabras corrientes basta.
  const soloVector = !vectores.has(a) || !vectores.has(b);
  const lexica = soloVector ? 0 : cercaniaLexica(a, b);

  let valor;
  if (soloVector) valor = vectorial ?? 0;
  else if (vectorial === null) valor = lexica;
  else valor = PESO_LEXICO * lexica + (1 - PESO_LEXICO) * vectorial;

  if (valor === 0) return ruido;
  if (esImpostora(a, b, lexica, vectorial)) valor *= RECORTE_IMPOSTORA;
  return Math.min(0.999, valor + ruido);
}

// ─── Ranking por palabra secreta ─────────────────────────────────────────────

/**
 * Rankings ya calculados, con tope.
 *
 * Cada entrada ocupa ~1 MB con el vocabulario actual, y antes el caché no se
 * vaciaba nunca: en una instancia pequeña acababa agotando la memoria y
 * provocando un reinicio, que es justo lo que se lleva por delante todas las
 * salas en juego. Calcular un ranking cuesta unos 50 ms, así que descartar el
 * más antiguo sale mucho más barato que quedarse sin memoria.
 */
const TOPE_CACHE = Number(process.env.TOPE_CACHE_RANKING ?? 50);
const cacheRanking = new Map();

/** Cuántos rankings hay cacheados ahora mismo. Para pruebas y diagnóstico. */
export function tamañoCacheRanking() {
  return cacheRanking.size;
}

/**
 * Devuelve, para una palabra secreta, el mapa palabra -> posición (1 = secreta)
 * y la lista ordenada de todo el vocabulario de más a menos cercano.
 */
export function rankingDe(secreta) {
  const cacheada = cacheRanking.get(secreta);
  if (cacheada) {
    // Reinsertar la marca como la usada más recientemente: Map conserva el
    // orden de inserción, y de ahí sale el descarte.
    cacheRanking.delete(secreta);
    cacheRanking.set(secreta, cacheada);
    return cacheada;
  }

  const puntuadas = PALABRAS.map((p) => [p, cercania(secreta, p)]);
  puntuadas.sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));

  const posiciones = new Map();
  const orden = [];
  puntuadas.forEach(([palabra], i) => {
    posiciones.set(palabra, i + 1);
    orden.push(palabra);
  });

  const resultado = { posiciones, orden };
  cacheRanking.set(secreta, resultado);
  while (cacheRanking.size > TOPE_CACHE) {
    cacheRanking.delete(cacheRanking.keys().next().value);
  }
  return resultado;
}

/**
 * Convierte una posición en un porcentaje de "calor" para la barra de progreso.
 * Escala logarítmica: los últimos puestos se notan mucho más que los primeros.
 */
export function calor(posicion) {
  if (posicion <= 1) return 100;
  const p = 1 - Math.log(posicion) / Math.log(TOTAL_PALABRAS);
  return Math.max(0, Math.min(99.9, Math.round(p * 1000) / 10));
}

/**
 * Umbrales de los niveles, escalados con el tamaño del vocabulario.
 *
 * Estaban afinados para 2249 palabras. Con un vocabulario mayor, una misma
 * posición vale más —el puesto 100 entre 25 000 es mucho mejor que entre
 * 2249—, pero no proporcionalmente: lo que el jugador tiene en la cabeza es el
 * número, no el percentil. La raíz cuadrada es el término medio que mantiene
 * «ardiendo» como algo excepcional sin volverlo inalcanzable.
 */
const ESCALA_NIVEL = Math.sqrt(TOTAL_PALABRAS / 2249);
const UMBRAL = {
  ardiendo: Math.round(10 * ESCALA_NIVEL),
  caliente: Math.round(50 * ESCALA_NIVEL),
  templado: Math.round(200 * ESCALA_NIVEL),
  fresco: Math.round(600 * ESCALA_NIVEL),
};

/** Etiqueta visual asociada a una posición. */
export function nivel(posicion) {
  if (posicion === 1) return { clase: 'acierto', texto: '¡ES ESA!', emoji: '🎯' };
  if (posicion <= UMBRAL.ardiendo) return { clase: 'ardiendo', texto: 'ardiendo', emoji: '🔥' };
  if (posicion <= UMBRAL.caliente) return { clase: 'caliente', texto: 'caliente', emoji: '🌶️' };
  if (posicion <= UMBRAL.templado) return { clase: 'templado', texto: 'templado', emoji: '🙂' };
  if (posicion <= UMBRAL.fresco) return { clase: 'fresco', texto: 'fresco', emoji: '💨' };
  return { clase: 'frio', texto: 'frío', emoji: '🧊' };
}

// ─── Resolución de lo que escribe el jugador ─────────────────────────────────

/**
 * Intenta encontrar en el léxico lo que ha escrito el jugador, tolerando
 * plurales, género y algún fallo de tecleo evidente.
 * @returns {string|null} palabra canónica del léxico, o null si no se conoce
 */
export function resolver(entrada) {
  const base = normalizar(entrada);
  if (!base || base.length < 2) return null;
  if (enVocabulario.has(base)) return base;

  // Primero se quita el plural, luego se prueban las variantes de género sobre
  // cada forma: así "gatas" llega a "gato" pasando por "gata".
  const singulares = [base];
  if (base.endsWith('es')) singulares.push(base.slice(0, -2), base.slice(0, -2) + 'z');
  if (base.endsWith('s')) singulares.push(base.slice(0, -1));

  const candidatos = [...singulares, base + 's', base + 'es'];
  for (const forma of singulares) {
    if (forma.endsWith('a')) candidatos.push(forma.slice(0, -1) + 'o');
    if (forma.endsWith('o')) candidatos.push(forma.slice(0, -1) + 'a');
    // Diminutivos frecuentes: gatito -> gato, casita -> casa.
    if (forma.endsWith('ito') || forma.endsWith('ita')) candidatos.push(forma.slice(0, -3) + forma.slice(-1));
  }

  for (const c of candidatos) {
    if (c !== base && enVocabulario.has(c)) return c;
  }
  return null;
}

const enVocabulario = new Set(PALABRAS);

/** ¿Está esta palabra en el vocabulario tal cual? */
export function existe(palabra) {
  return enVocabulario.has(palabra);
}

/** Etiquetas de una palabra, de la más específica a la más genérica. */
export function etiquetasDe(palabra) {
  const tags = etiquetasPorPalabra.get(palabra);
  if (!tags) return [];
  return [...tags].sort(
    (a, b) => (frecuenciaEtiqueta.get(a) ?? 0) - (frecuenciaEtiqueta.get(b) ?? 0),
  );
}

// ─── Selección de palabra secreta ────────────────────────────────────────────

const facil = new Set(TAGS_FACIL);
const dificil = new Set(TAGS_DIFICIL);

/** Clasifica cada palabra del léxico en facil / normal / dificil. */
function dificultadDe(palabra) {
  const tags = etiquetasPorPalabra.get(palabra) ?? new Set();
  let esFacil = false;
  let esDificil = false;
  for (const t of tags) {
    if (facil.has(t)) esFacil = true;
    if (dificil.has(t)) esDificil = true;
  }
  if (esFacil && !esDificil) return 'facil';
  if (esDificil && !esFacil) return 'dificil';
  return 'normal';
}

/** Reservas de palabras secretas por dificultad. */
export const RESERVAS = { facil: [], normal: [], dificil: [] };

for (const palabra of PALABRAS_LEXICO) {
  if (NO_SECRETO.has(palabra)) continue;
  if (palabra.length < 4) continue;
  // Una palabra secreta necesita vecindario: si casi no tiene etiquetas, las
  // pistas de cercanía no dicen nada útil.
  if ((etiquetasPorPalabra.get(palabra)?.size ?? 0) < 4) continue;
  RESERVAS[dificultadDe(palabra)].push(palabra);
}

/**
 * Elige una palabra secreta al azar evitando las ya usadas en la partida.
 * @param {'facil'|'normal'|'dificil'|'mezcla'} dificultad
 * @param {Set<string>} usadas
 */
export function elegirSecreta(dificultad = 'mezcla', usadas = new Set()) {
  const reserva =
    dificultad === 'mezcla'
      ? [...RESERVAS.facil, ...RESERVAS.normal, ...RESERVAS.dificil]
      : RESERVAS[dificultad] ?? RESERVAS.normal;

  const libres = reserva.filter((p) => !usadas.has(p));
  const fuente = libres.length ? libres : reserva;
  return fuente[Math.floor(Math.random() * fuente.length)];
}

/** Las `n` palabras más cercanas a la secreta (sin contarla), para el reveal. */
export function vecinas(secreta, n = 10) {
  const { orden } = rankingDe(secreta);
  return orden.slice(1, n + 1);
}
