/* Comprueba que una partida en curso sobrevive a un reinicio del servidor.
 * Arranca, juega, manda SIGTERM, vuelve a arrancar y comprueba que todo sigue.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { io } from 'socket.io-client';

const PUERTO = Number(process.env.P ?? 4700);
const URL = `http://localhost:${PUERTO}`;
const ESTADO = '/tmp/salas-reinicio.json';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const pedir = (s, ev, d) => new Promise((r) => s.emit(ev, d, r));
let fallos = 0;
const ok = (c, t) => { console.log(`${c ? '  ✓' : '  ✗ FALLO:'} ${t}`); if (!c) fallos++; };

function arrancar() {
  const p = spawn('node', ['server/index.js'], {
    env: { ...process.env, PORT: String(PUERTO), RUTA_ESTADO: ESTADO, GUARDAR_CADA_MS: '1000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  p.stdout.on('data', (d) => { const s = String(d); if (/recuperadas|Guardadas/.test(s)) process.stdout.write('    [srv] ' + s); });
  return p;
}
const conectar = async () => {
  const s = io(URL, { transports: ['websocket'] });
  await new Promise((r) => s.on('connect', r));
  return s;
};

fs.rmSync(ESTADO, { force: true });
let servidor = arrancar();
await esperar(1500);

// ── Partida en marcha ────────────────────────────────────────────────────────
const host = await conectar();
const sala = await pedir(host, 'crear_sala', { nombre: 'Cris', config: { rondas: 3, segundos: 600 } });
const ana = await conectar();
const altaAna = await pedir(ana, 'unirse', { codigo: sala.codigo, nombre: 'Ana' });
await pedir(host, 'empezar_ronda', {});
await esperar(300);

for (const palabra of ['montaña', 'guitarra', 'tomate', 'perro']) await pedir(ana, 'intentar', { palabra });
// Volver a entrar con el token devuelve la vista al día, sin depender de que
// haya llegado ya la difusión de estado.
const antes = (await pedir(ana, 'unirse', { codigo: sala.codigo, token: altaAna.token })).vista;
ok(antes.misIntentos.length === 4, `Ana lleva ${antes.misIntentos.length} intentos antes del reinicio`);
const puntosAntes = antes.yo.puntos;
const rondaAntes = antes.numeroRonda;
await esperar(1400); // que dé tiempo a un volcado

// ── Reinicio brusco ──────────────────────────────────────────────────────────
console.log('\n  ⟳ reiniciando el servidor…');
servidor.kill('SIGTERM');
await new Promise((r) => servidor.once('exit', r));
host.close(); ana.close();
ok(fs.existsSync(ESTADO), 'el estado quedó guardado en disco');

servidor = arrancar();
await esperar(1800);

// ── Vuelven los jugadores ────────────────────────────────────────────────────
const ana2 = await conectar();
const vuelta = await pedir(ana2, 'unirse', { codigo: sala.codigo, token: altaAna.token });
ok(vuelta.ok, `Ana vuelve a la sala ${sala.codigo}: ${vuelta.ok ? 'sí' : vuelta.error}`);
if (vuelta.ok) {
  ok(vuelta.vista.numeroRonda === rondaAntes, `sigue en la ronda ${vuelta.vista.numeroRonda}`);
  ok(vuelta.vista.misIntentos.length === 4, `conserva sus ${vuelta.vista.misIntentos.length} intentos`);
  ok(vuelta.vista.yo.puntos === puntosAntes, 'conserva sus puntos');
  ok(vuelta.vista.ronda.secreta === null, 'la palabra secreta sigue oculta');
  const nuevo = await pedir(ana2, 'intentar', { palabra: 'cuchara' });
  ok(nuevo.ok, 'puede seguir jugando la misma ronda');
}

const host2 = await conectar();
const vueltaHost = await pedir(host2, 'unirse', { codigo: sala.codigo, token: sala.token });
ok(vueltaHost.ok && vueltaHost.vista.yo.esHost, 'el anfitrión vuelve siéndolo y puede seguir mandando');

host2.close(); ana2.close();
servidor.kill();
fs.rmSync(ESTADO, { force: true });
console.log(fallos ? `\n❌ ${fallos} fallos` : '\n✅ LA PARTIDA SOBREVIVE AL REINICIO');
process.exit(fallos ? 1 : 0);
