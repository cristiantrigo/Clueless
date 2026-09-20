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
const fuera = posiciones.filter((x) => x.p > 100);

console.log(`Léxico: ${TOTAL_PALABRAS} palabras · pares medidos: ${posiciones.length}`);
if (faltan.length) console.log('Sin medir (falta la palabra):', faltan.map(([a, b]) => `${a}/${b}`).join(', '));
console.log(`\nPosición media: ${media} · mediana: ${mediana} · fuera del top 100: ${fuera.length}`);
console.log('\nLos 12 peores:');
for (const { a, b, p } of posiciones.slice(0, 12)) {
  console.log(`  ${(a + ' → ' + b).padEnd(24)} #${p}`);
}
