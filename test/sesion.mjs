/* Comprobación en navegador de la sesión: recarga, reconexión y salida.
 * Requiere playwright:  npx playwright install chromium
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const P=Number(process.env.P||4410), URL=`http://localhost:${P}`;
const srv=spawn('node',['server/index.js'],{env:{...process.env,PORT:String(P)},stdio:'ignore'});
const w=(ms)=>new Promise(r=>setTimeout(r,ms)); await w(1200);
const nav=await chromium.launch({executablePath: process.env.CHROMIUM || undefined});
const err=[]; let fallos=0;
const ok=(c,t)=>{ console.log(`${c?'  ✓':'  ✗ FALLO:'} ${t}`); if(!c) fallos++; };
// Un contexto por jugador: en el mismo se comparte localStorage y no simula
// dos móviles distintos.
const abrir=async()=>{const c=await nav.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  const p=await c.newPage(); p.on('pageerror',e=>err.push(e.message));
  p.on('console',m=>{if(m.type()==='error')err.push(m.text());}); return p;};
const enInicio=(p)=>p.isVisible('#p-inicio.activa');
const enSala=(p)=>p.isVisible('#p-sala.activa');

// Anfitrión crea la sala; un jugador entra por el enlace.
const host=await abrir(); await host.goto(URL); await host.fill('#in-nombre','Cris'); await host.click('#btn-crear');
await host.waitForSelector('#v-lobby.activa'); const cod=(await host.textContent('#ui-codigo-grande')).trim();

const ana=await abrir(); await ana.goto(`${URL}?sala=${cod}`);
ok(await enInicio(ana), 'con ?sala= pero sin sesión previa, el invitado ve el inicio con el código puesto');
ok((await ana.inputValue('#in-codigo'))===cod, 'el código viene relleno del enlace');
await ana.fill('#in-nombre','Ana'); await ana.click('#form-unirse button'); await ana.waitForSelector('#v-lobby.activa');
await w(300);

// 1) Recargar con ?sala= (caso de quedarse sin cobertura): debe volver a la sala.
ok(ana.url().includes(`sala=${cod}`), 'al entrar, la URL pasa a incluir ?sala=');
await ana.reload(); await w(900);
ok(await enSala(ana), 'recargar con ?sala= devuelve a la sala (reconexión)');

// 2) Abrir la URL limpia: debe llevar al inicio, no colarte en la sala.
await ana.goto(URL); await w(900);
ok(await enInicio(ana), 'abrir la URL limpia lleva al INICIO, no a la sala');
ok((await ana.inputValue('#in-nombre'))==='Ana', 'pero recuerda tu nombre para no reescribirlo');

// 3) Volver a entrar con el código conserva la identidad (puntos, intentos).
await ana.fill('#in-codigo',cod); await ana.click('#form-unirse button');
await ana.waitForSelector('#v-lobby.activa'); await w(400);
const jugadores=await host.$$eval('#ui-jugadores li',ls=>ls.map(l=>l.textContent.replace(/[×👑]/g,'').trim()));
ok(jugadores.filter(n=>n==='Ana').length===1, `no se duplica el jugador al volver (lista: ${jugadores.join(', ')})`);

// 4) Botón de salir.
ok(await ana.isVisible('#btn-salir'), 'el botón Salir se ve en la sala de espera');
ana.on('dialog',d=>d.accept());
await ana.click('#btn-salir'); await w(900);
ok(await enInicio(ana), 'Salir devuelve al inicio');
ok(!ana.url().includes('sala='), 'y limpia la URL');
await ana.reload(); await w(900);
ok(await enInicio(ana), 'tras salir, recargar ya no vuelve a meterte');

// 5) Durante la ronda el botón se esconde.
await host.click('#btn-empezar'); await host.waitForSelector('#v-ronda.activa'); await w(400);
ok(!(await host.isVisible('#btn-salir')), 'durante la ronda el botón Salir se oculta');

console.log(err.length?'\n❌ '+err.join('\n'):'\n✅ sin errores de JS');
console.log(fallos?`❌ ${fallos} fallos`:'✅ COMPORTAMIENTO CORRECTO');
await nav.close(); srv.kill(); process.exit(fallos?1:0);
