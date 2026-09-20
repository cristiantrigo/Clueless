/* Banco de pruebas de sentido común: pares que cualquiera diría que están
 * relacionados. Mide la posición media y cuántos caen fuera del top 100.
 * Uso:  node test/banco.mjs [factorPrototipo]
 */
import { rankingDe, existe, TOTAL_PALABRAS } from '../server/similarity.js';

const PARES = [
  // el todo y sus partes
  ['ventana', 'casa'], ['casa', 'ventana'], ['casa', 'cocina'], ['casa', 'puerta'],
  ['coche', 'rueda'], ['coche', 'motor'], ['arbol', 'hoja'], ['arbol', 'rama'],
  ['flor', 'petalo'], ['libro', 'pagina'], ['camisa', 'manga'], ['mano', 'dedo'],
  // género y especie
  ['animal', 'perro'], ['animal', 'leon'], ['comida', 'pan'], ['fruta', 'manzana'],
  ['mueble', 'silla'], ['color', 'azul'], ['deporte', 'futbol'], ['instrumento', 'guitarra'],
  ['ave', 'paloma'], ['pez', 'salmon'], ['flor', 'rosa'], ['arbol', 'pino'],
  // mismo campo
  ['cocina', 'nevera'], ['playa', 'arena'], ['medico', 'hospital'], ['profesor', 'escuela'],
  ['invierno', 'nieve'], ['mar', 'barco'], ['lluvia', 'paraguas'], ['cama', 'dormir'],
  ['zapato', 'pie'], ['leche', 'vaca'], ['miel', 'abeja'], ['fuego', 'humo'],
  ['reloj', 'hora'], ['dinero', 'banco'], ['llave', 'puerta'], ['musica', 'cancion'],
  ['cuchillo', 'cortar'], ['sol', 'calor'], ['noche', 'luna'], ['bebe', 'madre'],
];

const disponibles = PARES.filter(([a, b]) => existe(a) && existe(b));
const faltan = PARES.filter(([a, b]) => !existe(a) || !existe(b));

const posiciones = disponibles.map(([a, b]) => {
  const p = rankingDe(a).posiciones.get(b);
  return { a, b, p };
});
posiciones.sort((x, y) => y.p - x.p);

const media = Math.round(posiciones.reduce((s, x) => s + x.p, 0) / posiciones.length);
const mediana = posiciones[Math.floor(posiciones.length / 2)].p;

// La posición bruta no se puede comparar entre vocabularios de distinto
// tamaño: el puesto 50 entre 23 000 palabras es mucho mejor que entre 2 200.
// El percentil sí es comparable, y es lo que de verdad mide la calidad.
const percentil = (p) => (p / TOTAL_PALABRAS) * 100;
const mediaPct = percentil(media);
const fuera = posiciones.filter((x) => percentil(x.p) > 2);

console.log(`Vocabulario: ${TOTAL_PALABRAS} palabras · pares medidos: ${posiciones.length}`);
if (faltan.length) console.log('Sin medir (falta la palabra):', faltan.map(([a, b]) => `${a}/${b}`).join(', '));
console.log(`\nPosición media: ${media} (percentil ${mediaPct.toFixed(2)} %) · mediana: ${mediana}`);
console.log(`Pares que se van del 2 % superior: ${fuera.length}`);
console.log('\nLos 12 peores:');
for (const { a, b, p } of posiciones.slice(0, 12)) {
  console.log(`  ${(a + ' → ' + b).padEnd(24)} #${String(p).padStart(6)}  (${percentil(p).toFixed(2)} %)`);
}
