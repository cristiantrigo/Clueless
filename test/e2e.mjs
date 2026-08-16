/* Partida real de extremo a extremo: anfitrión + 20 jugadores por Socket.IO. */
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const PUERTO = 3999;
const URL = `http://localhost:${PUERTO}`;

const servidor = spawn('node', ['server/index.js'], {
  env: { ...process.env, PORT: String(PUERTO) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
servidor.stdout.on('data', (d) => process.stdout.write('  [srv] ' + d));
servidor.stderr.on('data', (d) => process.stdout.write('  [ERR] ' + d));

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const pedir = (sock, ev, datos) => new Promise((r) => sock.emit(ev, datos, r));

let fallos = 0;
function comprobar(cond, texto) {
  console.log(`${cond ? '  ✓' : '  ✗ FALLO:'} ${texto}`);
  if (!cond) fallos++;
}

await esperar(1200);

// ── Anfitrión ────────────────────────────────────────────────────────────────
const host = io(URL, { transports: ['websocket'] });
await new Promise((r) => host.on('connect', r));
const sala = await pedir(host, 'crear_sala', {
  nombre: 'Cristian',
  config: { rondas: 2, segundos: 60, anfitrionJuega: false },
});
comprobar(sala.ok && /^\d{6}$/.test(sala.codigo), `sala creada con código ${sala.codigo}`);

// ── 20 jugadores ─────────────────────────────────────────────────────────────
const nombres = ['Ana', 'Luis', 'Marta', 'Pau', 'Iker', 'Nuria', 'Diego', 'Elena', 'Hugo', 'Sara',
  'Jorge', 'Lucia', 'Marc', 'Irene', 'Raul', 'Alba', 'Nico', 'Carmen', 'Bruno', 'Vega'];

const jugadores = [];
async function entrar(nombre) {
  const sock = io(URL, { transports: ['websocket'] });
  await new Promise((r) => sock.on('connect', r));
  const alta = await pedir(sock, 'unirse', { codigo: sala.codigo, nombre });
  if (!alta.ok) return { sock, alta };
  jugadores.push({ nombre, sock, token: alta.token, vista: alta.vista });
  sock.on('estado', (v) => { jugadores.find((j) => j.sock === sock).vista = v; });
  return { sock, alta };
}

for (const nombre of nombres.slice(0, 19)) {
  const { alta } = await entrar(nombre);
  if (!alta.ok) comprobar(false, `${nombre}: ${alta.error}`);
}

// Con sitio libre, un nombre repetido se rechaza por ser repetido.
const dupe = await entrar('ana');
comprobar(!dupe.alta.ok && /cogido/i.test(dupe.alta.error), `nombre repetido rechazado: "${dupe.alta.error}"`);
dupe.sock.close();

await entrar(nombres[19]);
comprobar(jugadores.length === 20, `${jugadores.length} jugadores dentro de la sala`);

// Ya con la sala llena, el jugador 21 rebota (el máximo por defecto es 20).
const extra = await entrar('Intruso');
comprobar(!extra.alta.ok && /llena/i.test(extra.alta.error), `el jugador 21 rebota: "${extra.alta.error}"`);
extra.sock.close();

await esperar(300);
comprobar(jugadores[0].vista.jugadores.length === 20, 'todos ven la lista completa de jugadores');

// ── Ronda 1 ──────────────────────────────────────────────────────────────────
let secretaVista = null;
host.on('estado', (v) => { if (v.ronda?.secreta) secretaVista = v.ronda.secreta; });

const aciertosEmitidos = [];
jugadores[0].sock.on('acierto', (a) => aciertosEmitidos.push(a));

const arranque = await pedir(host, 'empezar_ronda', {});
comprobar(arranque.ok, 'la ronda arranca');
await esperar(300);
comprobar(Boolean(secretaVista), `el anfitrión ve la palabra secreta: «${secretaVista}»`);
comprobar(jugadores[0].vista.ronda.secreta === null, 'los jugadores NO reciben la palabra secreta');

// Cada jugador prueba palabras al azar; los tres primeros acaban acertando.
const { rankingDe } = await import('../server/similarity.js');
const orden = rankingDe(secretaVista).orden;

for (const [i, j] of jugadores.entries()) {
  const eleccion = orden[Math.min(orden.length - 1, 5 + i * 37)];
  const r = await pedir(j.sock, 'intentar', { palabra: eleccion });
  if (!r.ok) comprobar(false, `${j.nombre} no pudo probar «${eleccion}»: ${r.error}`);
}

const desconocida = await pedir(jugadores[0].sock, 'intentar', { palabra: 'zzzqqq' });
comprobar(!desconocida.ok && /No conozco/.test(desconocida.error), 'las palabras inventadas se rechazan');

await esperar(300);
const ranking = jugadores[0].vista.ranking;
comprobar(ranking.length === 20, 'el ranking en vivo lista a los 20');
const ordenado = ranking.every((f, i, a) => i === 0 || a[i - 1].mejor <= f.mejor);
comprobar(ordenado, 'el ranking está ordenado por cercanía (mejor posición primero)');
console.log(`     top 5: ${ranking.slice(0, 5).map((f) => `${f.puesto}. ${f.nombre} #${f.mejor}`).join(' | ')}`);

// Tres jugadores aciertan, en orden.
const finRonda = new Promise((r) => host.once('ronda_fin', r));
for (const j of [jugadores[7], jugadores[3], jugadores[15]]) {
  const r = await pedir(j.sock, 'intentar', { palabra: secretaVista });
  comprobar(r.ok && r.acierto, `${j.nombre} acierta la palabra`);
  await esperar(120);
}
comprobar(aciertosEmitidos.length === 3 && aciertosEmitidos[0].primero, 'se anuncia el acierto y quién fue primero');

const yaAcerto = await pedir(jugadores[7].sock, 'intentar', { palabra: orden[10] });
comprobar(!yaAcerto.ok, 'quien ya acertó no puede seguir probando');

// Pista manual del anfitrión
const pista = await pedir(host, 'pista', {});
comprobar(pista.ok && typeof pista.pista === 'string', `pista del anfitrión: "${pista.pista}"`);

// Terminar la ronda
await pedir(host, 'terminar_ronda', {});
const resumen = await finRonda;
comprobar(resumen.secreta === secretaVista, 'al cerrar se revela la palabra');
comprobar(resumen.podio.length === 3, 'el podio recoge a los tres que acertaron');
comprobar(resumen.podio[0].puntos === 1000 && resumen.podio[1].puntos === 800, 'puntos decrecientes por orden de llegada');
console.log(`     podio: ${resumen.podio.map((p, i) => `${i + 1}º ${p.nombre} (${p.segundos}s, ${p.puntos}pts)`).join(' | ')}`);

await esperar(200);
const clasif = jugadores[0].vista.clasificacion;
comprobar(clasif[0].puntos >= clasif[1].puntos, 'clasificación general ordenada por puntos');
comprobar(clasif.every((c) => c.puntos > 0), 'quien no acertó también puntúa por cercanía');

// ── Reconexión ───────────────────────────────────────────────────────────────
const ana = jugadores[0];
const puntosAntes = ana.vista.yo.puntos;
ana.sock.close();
await esperar(300);
const revuelta = io(URL, { transports: ['websocket'] });
await new Promise((r) => revuelta.on('connect', r));
const recuperada = await pedir(revuelta, 'unirse', { codigo: sala.codigo, token: ana.token });
comprobar(recuperada.ok && recuperada.vista.yo.puntos === puntosAntes,
  `Ana vuelve con sus ${puntosAntes} puntos intactos`);

// ── Ronda 2 y final ──────────────────────────────────────────────────────────
const finPartida = new Promise((r) => host.once('ronda_fin', r));
const r2 = await pedir(host, 'empezar_ronda', {});
comprobar(r2.ok, 'arranca la segunda ronda');
await esperar(200);
comprobar(secretaVista !== resumen.secreta, `nueva palabra secreta distinta: «${secretaVista}»`);
await pedir(host, 'terminar_ronda', {});
const fin = await finPartida;
comprobar(fin.esFinal, 'la partida termina al agotar las rondas');

const masRondas = await pedir(host, 'empezar_ronda', {});
comprobar(!masRondas.ok, 'no se pueden empezar más rondas');

// Sólo el anfitrión manda
const intruso = await pedir(jugadores[1].sock, 'empezar_ronda', {});
comprobar(!intruso.ok && /anfitrión/i.test(intruso.error), 'un jugador normal no puede controlar la partida');

const reinicio = await pedir(host, 'reiniciar', {});
comprobar(reinicio.ok, 'el anfitrión puede volver a empezar');
await esperar(200);
comprobar(jugadores[1].vista.estado === 'lobby' && jugadores[1].vista.yo.puntos === 0,
  'al reiniciar todos vuelven al lobby con el marcador a cero');

// ── El anfitrión jugando ─────────────────────────────────────────────────────
const anfi = io(URL, { transports: ['websocket'] });
await new Promise((r) => anfi.on('connect', r));
const sala2 = await pedir(anfi, 'crear_sala', { nombre: 'Cris', config: { rondas: 1, segundos: 60 } });
comprobar(sala2.vista.yo.juega === true, 'el anfitrión juega por defecto');

let vistaAnfi = sala2.vista;
anfi.on('estado', (v) => { vistaAnfi = v; });

const invitado = io(URL, { transports: ['websocket'] });
await new Promise((r) => invitado.on('connect', r));
await pedir(invitado, 'unirse', { codigo: sala2.codigo, nombre: 'Ana' });
await esperar(200);
comprobar(vistaAnfi.jugadores.some((j) => j.esHost), 'el anfitrión sale en la lista de jugadores');

const finSolo = new Promise((r) => anfi.once('ronda_fin', r));
comprobar((await pedir(anfi, 'empezar_ronda', {})).ok, 'arranca la ronda con el anfitrión dentro');
await esperar(300);
comprobar(vistaAnfi.ronda.secreta === null, 'jugando, el anfitrión tampoco ve la palabra secreta');

const suyo = await pedir(anfi, 'intentar', { palabra: 'montaña' });
comprobar(suyo.ok, `el anfitrión puede probar palabras: ${suyo.ok ? '#' + suyo.intento.posicion : suyo.error}`);
await esperar(250);
comprobar(vistaAnfi.ranking.length === 2, 'el anfitrión aparece en el ranking en vivo');

await pedir(anfi, 'terminar_ronda', {});
const finalSolo = await finSolo;
comprobar(typeof finalSolo.secreta === 'string', `al cerrar se revela la palabra: «${finalSolo.secreta}»`);
await esperar(250);
comprobar(vistaAnfi.yo.puntos > 0, `el anfitrión puntúa por cercanía: ${vistaAnfi.yo.puntos} pts`);
comprobar(vistaAnfi.clasificacion.some((c) => c.esHost), 'y sale en la clasificación general');

// Y se puede volver al modo marcador.
await pedir(anfi, 'configurar', { config: { anfitrionJuega: false } });
await esperar(250);
comprobar(vistaAnfi.yo.juega === false, 'el anfitrión puede volver al modo marcador');
anfi.close(); invitado.close();

// ── Cierre ───────────────────────────────────────────────────────────────────
[host, revuelta, ...jugadores.map((j) => j.sock)].forEach((s) => s.close());
servidor.kill();
await esperar(200);

console.log(`\n${fallos === 0 ? '✅ TODO CORRECTO' : `❌ ${fallos} FALLOS`}\n`);
process.exit(fallos === 0 ? 0 : 1);
