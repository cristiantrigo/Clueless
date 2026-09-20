import test from 'node:test';
import assert from 'node:assert/strict';

import { GestorSalas, Sala } from '../server/game.js';
import {
  calor,
  elegirSecreta,
  normalizar,
  rankingDe,
  resolver,
  vecinas,
  existe,
  TOTAL_PALABRAS,
  PALABRAS_LEXICO,
  RESERVAS,
  CON_VECTORES,
  tamañoCacheRanking,
} from '../server/similarity.js';

/**
 * Los umbrales estaban afinados para un vocabulario de 2249 palabras. Se
 * escalan igual que los niveles del juego, con la raíz del crecimiento, para
 * que sigan significando lo mismo si el vocabulario vuelve a cambiar.
 */
const umbral = (n) => Math.round(n * Math.sqrt(TOTAL_PALABRAS / 2249));

// ─── Motor semántico ─────────────────────────────────────────────────────────

test('normaliza tildes pero conserva la eñe', () => {
  assert.equal(normalizar('Camión'), 'camion');
  assert.equal(normalizar('  NIÑO '), 'niño');
  assert.equal(normalizar('pingüino'), 'pinguino');
});

test('resuelve plurales, géneros y descarta lo desconocido', () => {
  assert.equal(resolver('perros'), 'perro');
  assert.equal(resolver('GATAS'), 'gato');
  assert.equal(resolver('  Árboles '), 'arbol');
  assert.equal(resolver('qwertyuiop'), null);
  assert.equal(resolver(''), null);
});

test('la palabra secreta siempre ocupa la posición 1', () => {
  for (const palabra of ['perro', 'guitarra', 'tristeza', 'montaña']) {
    assert.equal(rankingDe(palabra).posiciones.get(palabra), 1);
  }
});

test('el ranking cubre todo el léxico sin huecos', () => {
  const { posiciones, orden } = rankingDe('coche');
  assert.equal(orden.length, TOTAL_PALABRAS);
  assert.equal(new Set(posiciones.values()).size, TOTAL_PALABRAS);
});

test('lo parecido queda cerca y lo ajeno lejos', () => {
  const casos = [
    ['perro', 'gato', 'martillo'],
    ['guitarra', 'piano', 'lechuga'],
    ['invierno', 'verano', 'tornillo'],
    ['medico', 'enfermera', 'calcetin'],
  ];
  for (const [secreta, cerca, lejos] of casos) {
    const p = rankingDe(secreta).posiciones;
    assert.ok(
      p.get(cerca) < p.get(lejos),
      `${cerca} (#${p.get(cerca)}) debería estar más cerca de ${secreta} que ${lejos} (#${p.get(lejos)})`,
    );
    assert.ok(p.get(cerca) <= umbral(60), `${cerca} está demasiado lejos de ${secreta}: #${p.get(cerca)}`);
  }
});

test('parecerse en las letras no acerca si no hay relación de significado', () => {
  // «roto» no debe acercarse a «rojo» por escribirse igual de parecido: era el
  // fallo que hacía que la gente persiguiera pistas falsas.
  const casos = [
    ['rojo', 'roto'], ['rojo', 'robo'], ['gato', 'rato'],
    ['mar', 'mal'], ['pino', 'pito'], ['casa', 'caza'],
  ];
  for (const [secreta, impostora] of casos) {
    const p = rankingDe(secreta).posiciones.get(impostora);
    if (p === undefined) continue; // no está en el léxico
    assert.ok(p > umbral(400), `${impostora} sale demasiado cerca de ${secreta}: #${p}`);
  }
});

test('lo emparentado de verdad sí queda cerca', () => {
  const casos = [
    ['rojo', 'rosa'], ['rojo', 'azul'],
    ['pan', 'panadero'], ['pan', 'panaderia'], ['pan', 'harina'],
    ['flor', 'floristeria'], ['libro', 'libreria'],
  ];
  for (const [secreta, pariente] of casos) {
    const p = rankingDe(secreta).posiciones.get(pariente);
    assert.ok(p !== undefined, `${pariente} no está en el léxico`);
    assert.ok(p <= umbral(60), `${pariente} debería estar cerca de ${secreta}, y está en #${p}`);
  }
});

test('el todo está cerca de sus partes, y la categoría de sus miembros', () => {
  // Una palabra que da nombre a un campo pertenece a ese campo. Sin esto,
  // «casa» no compartía ni una etiqueta con «ventana» y salía en el puesto 857.
  const casos = [
    ['ventana', 'casa'], ['casa', 'ventana'], ['casa', 'cocina'], ['coche', 'rueda'],
    ['arbol', 'hoja'], ['animal', 'perro'], ['comida', 'pan'], ['color', 'azul'],
    ['mar', 'barco'], ['ropa', 'zapato'],
  ];
  for (const [secreta, pariente] of casos) {
    const p = rankingDe(secreta).posiciones.get(pariente);
    assert.ok(p !== undefined, `${pariente} no está en el léxico`);
    assert.ok(p <= umbral(100), `${pariente} debería estar cerca de ${secreta}, y está en #${p}`);
  }
});

test('las partes de una casa no se mezclan con las de una planta', () => {
  // «parte» y «estructura» eran etiquetas compartidas por dominios ajenos, así
  // que los vecinos de «ventana» eran polen, tallo y corteza.
  const p = rankingDe('ventana').posiciones;
  for (const ajena of ['polen', 'tallo', 'corteza', 'semilla']) {
    assert.ok(p.get(ajena) > umbral(300), `${ajena} sale demasiado cerca de ventana: #${p.get(ajena)}`);
  }
});

test('los vectores de Numberbatch están y aportan asociación del mundo real', () => {
  assert.ok(CON_VECTORES, 'falta data/vectores.bin: regénalo con scripts/construir-vectores.mjs');
  // Relaciones que un léxico escrito a mano no cubre y los vectores sí.
  for (const [secreta, asociada] of [['miel', 'abeja'], ['invierno', 'nieve'], ['cama', 'dormir']]) {
    const p = rankingDe(secreta).posiciones.get(asociada);
    assert.ok(p <= umbral(40), `${asociada} debería estar cerca de ${secreta}, y está en #${p}`);
  }
});

test('el vocabulario jugable es grande y el léxico sigue siendo su columna', () => {
  // El jugador puede escribir cualquier palabra corriente del español…
  // Curado, no grande por grande: 13.500 palabras limpias aceptan más intentos
  // reales que 25.000 con flexiones y extranjerismos dentro.
  assert.ok(TOTAL_PALABRAS >= 12000, `sólo ${TOTAL_PALABRAS} palabras jugables`);
  // …pero las relaciones de taxonomía salen del léxico escrito a mano.
  assert.ok(PALABRAS_LEXICO.length >= 2200, `sólo ${PALABRAS_LEXICO.length} en el léxico`);
  // Y la palabra secreta sale siempre de ahí, que es la que está garantizada
  // como adivinable: nadie debería tener que sacar «dermatólogo».
  const delLexico = new Set(PALABRAS_LEXICO);
  for (const nivel of ['facil', 'normal', 'dificil']) {
    assert.ok(RESERVAS[nivel].every((p) => delLexico.has(p)), `${nivel} tiene secretas fuera del léxico`);
  }
});

test('el vocabulario grande no trae flexiones que compitan con su palabra', () => {
  // Con «ventana» secreta, «ventanas» en el puesto 1 arruinaría la ronda.
  for (const flexion of ['ventanas', 'casas', 'perros', 'gata', 'corriendo', 'comiendo']) {
    assert.ok(!existe(flexion), `${flexion} no debería estar en el vocabulario`);
  }
  // Ni conjugaciones de la propia palabra secreta: con «quemar» salían
  // «queman, quemaran, quemare, quemaria, quemarlo, quemarte, quemo» como los
  // siete vecinos más cercanos, que es regalar la ronda.
  for (const forma of ['queman', 'quemaran', 'quemare', 'quemaria', 'quemarlo', 'quemo', 'quemalo', 'ardio']) {
    assert.ok(!existe(forma), `${forma} no debería estar en el vocabulario`);
  }
  // Pero los sustantivos que coinciden con una forma verbal se conservan:
  // «casa» es también de «casar», y «cuenta» de «contar».
  for (const nombre of ['casa', 'cuenta', 'juego', 'cena', 'paso', 'llamada', 'bebida', 'entrada']) {
    assert.ok(existe(nombre), `${nombre} debería seguir en el vocabulario`);
  }
  // Pero sí se resuelven a su lema al escribirlas.
  assert.equal(resolver('ventanas'), 'ventana');
  assert.equal(resolver('gatas'), 'gato');
});

test('el caché de rankings no crece sin límite', () => {
  // Cada ranking ocupa ~1 MB con el vocabulario actual. Sin tope, una
  // instancia pequeña acaba reiniciándose, y eso se lleva todas las salas.
  const usadas = new Set();
  for (let i = 0; i < 150; i++) rankingDe(elegirSecreta('mezcla', usadas));
  assert.ok(
    tamañoCacheRanking() <= 50,
    `hay ${tamañoCacheRanking()} rankings cacheados tras 150 rondas`,
  );
  // Y lo que sigue en el caché se sirve igual de bien.
  assert.equal(rankingDe('perro').posiciones.get('perro'), 1);
});

test('el calor baja al alejarse la posición', () => {
  assert.equal(calor(1), 100);
  assert.ok(calor(10) > calor(100));
  assert.ok(calor(100) > calor(1000));
  assert.ok(calor(TOTAL_PALABRAS) >= 0);
});

test('hay reserva suficiente de palabras secretas en cada dificultad', () => {
  for (const nivel of ['facil', 'normal', 'dificil']) {
    assert.ok(RESERVAS[nivel].length > 100, `${nivel}: sólo ${RESERVAS[nivel].length}`);
  }
  assert.ok(vecinas('perro', 5).length === 5);
});

test('elegirSecreta no repite palabras ya usadas', () => {
  const usadas = new Set();
  for (let i = 0; i < 50; i++) {
    const p = elegirSecreta('facil', usadas);
    assert.ok(!usadas.has(p), `repitió ${p}`);
    usadas.add(p);
  }
});

// ─── Salas ───────────────────────────────────────────────────────────────────

function salaCon(nJugadores, config = {}) {
  const sala = new Sala('123456', { segundos: 120, rondas: 2, ...config });
  const host = sala.entrar({ nombre: 'Anfi', esHost: true }).jugador;
  const jugadores = [];
  for (let i = 0; i < nJugadores; i++) {
    jugadores.push(sala.entrar({ nombre: `Jugador${i}` }).jugador);
  }
  return { sala, host, jugadores };
}

test('rechaza nombres repetidos, cortos y sala llena', () => {
  const sala = new Sala('111111', { maxJugadores: 2 });
  sala.entrar({ nombre: 'Ana' });
  assert.equal(sala.entrar({ nombre: 'ana' }).ok, false);
  assert.equal(sala.entrar({ nombre: 'x' }).ok, false);
  assert.equal(sala.entrar({ nombre: 'Luis' }).ok, true);
  assert.equal(sala.entrar({ nombre: 'Marta' }).ok, false, 'debería estar llena');
});

test('admite 20 invitados más el anfitrión, y les da colores', () => {
  const { sala, jugadores } = salaCon(20, { maxJugadores: 20 });
  assert.equal(jugadores.length, 20);
  assert.equal(sala.activos.filter((j) => !j.esHost).length, 20);
  // El anfitrión juega por defecto y no le quita la plaza a nadie.
  assert.equal(sala.participantes.length, 21);
  assert.equal(sala.entrar({ nombre: 'Sobra' }).ok, false);
  assert.ok(jugadores.every((j) => /^#[0-9a-f]{6}$/.test(j.color)));
});

test('el anfitrión juega por defecto y aparece en ranking y clasificación', () => {
  const { sala, host, jugadores } = salaCon(1);
  assert.equal(sala.juega(host), true);
  sala.empezarRonda();

  const suyo = sala.intentar(host.token, rankingDe(sala.ronda.secreta).orden[3]);
  assert.equal(suyo.ok, true, suyo.error);
  assert.equal(sala.rankingVivo().length, 2);

  sala.intentar(jugadores[0].token, sala.ronda.secreta);
  const resumen = sala.cerrarRonda();
  assert.equal(resumen.podio.length, 1);
  assert.ok(host.puntos > 0, 'el anfitrión puntúa por cercanía');
  assert.ok(sala.clasificacion().some((f) => f.esHost), 'sale en la clasificación');
});

test('en modo marcador el anfitrión ni juega ni puntúa', () => {
  const { sala, host } = salaCon(1, { anfitrionJuega: false });
  assert.equal(sala.juega(host), false);
  sala.empezarRonda();
  const r = sala.intentar(host.token, 'mesa');
  assert.equal(r.ok, false);
  assert.match(r.error, /anfitrión no juega/);
  assert.equal(sala.rankingVivo().length, 1);
  sala.cerrarRonda();
  assert.equal(host.puntos, 0);
  assert.ok(!sala.clasificacion().some((f) => f.esHost));
});

test('el jugador que vuelve con su token conserva puntos y nombre', () => {
  const { sala, jugadores } = salaCon(1);
  const [ana] = jugadores;
  ana.puntos = 500;
  sala.desconectar(ana.token);
  const vuelta = sala.entrar({ token: ana.token });
  assert.equal(vuelta.ok, true);
  assert.equal(vuelta.nuevo, false);
  assert.equal(vuelta.jugador.puntos, 500);
  assert.equal(vuelta.jugador.conectado, true);
});

test('una ronda completa: intentos, ranking en vivo y puntos', () => {
  const { sala, jugadores } = salaCon(3);
  const [ana, luis, marta] = jugadores;

  const inicio = sala.empezarRonda();
  assert.equal(inicio.ok, true);
  const secreta = sala.ronda.secreta;
  const { orden } = rankingDe(secreta);

  // Ana falla lejos, Luis se acerca mucho, Marta acierta.
  const lejana = orden[orden.length - 1];
  assert.equal(sala.intentar(ana.token, lejana).ok, true);
  assert.equal(sala.intentar(luis.token, orden[2]).ok, true);

  let vivo = sala.rankingVivo();
  assert.equal(vivo[0].nombre, 'Jugador1', 'Luis debería ir primero por estar más cerca');
  assert.equal(vivo.find((f) => f.nombre === 'Jugador2').mejor, null);

  const acierto = sala.intentar(marta.token, secreta);
  assert.equal(acierto.acierto, true);
  assert.equal(acierto.primero, true);
  assert.equal(marta.puntos, 1000);
  assert.equal(marta.victorias, 1);

  vivo = sala.rankingVivo();
  assert.equal(vivo[0].nombre, 'Jugador2', 'quien acierta encabeza el ranking');
  assert.equal(vivo[0].acertado, true);

  const resumen = sala.cerrarRonda();
  assert.equal(resumen.secreta, secreta);
  assert.equal(resumen.podio.length, 1);
  assert.ok(luis.puntos > ana.puntos, 'quien se quedó más cerca puntúa más');
  assert.ok(ana.puntos >= 0);
});

test('no se puede repetir palabra ni seguir tras acertar', () => {
  const { sala, jugadores } = salaCon(1);
  const [ana] = jugadores;
  sala.empezarRonda();
  const secreta = sala.ronda.secreta;
  const otra = rankingDe(secreta).orden[5];

  assert.equal(sala.intentar(ana.token, otra).ok, true);
  const repe = sala.intentar(ana.token, otra);
  assert.equal(repe.ok, false);
  assert.ok(repe.repetida);

  sala.intentar(ana.token, secreta);
  assert.equal(sala.intentar(ana.token, 'mesa').ok, false);
});

test('el orden de llegada reparte puntos decrecientes', () => {
  const { sala, jugadores } = salaCon(3);
  sala.empezarRonda();
  const secreta = sala.ronda.secreta;
  jugadores.forEach((j) => sala.intentar(j.token, secreta));
  assert.equal(jugadores[0].puntos, 1000);
  assert.equal(jugadores[1].puntos, 800);
  assert.equal(jugadores[2].puntos, 640);
  assert.equal(jugadores[0].victorias, 1);
  assert.equal(jugadores[1].victorias, 0);
});

test('quien entra a mitad de ronda puede jugar esa misma ronda', () => {
  const { sala } = salaCon(1, { anfitrionJuega: false });
  sala.empezarRonda();
  const tarde = sala.entrar({ nombre: 'Tardon' });
  assert.equal(tarde.ok, true);

  const intento = sala.intentar(tarde.jugador.token, rankingDe(sala.ronda.secreta).orden[4]);
  assert.equal(intento.ok, true, intento.error);
  assert.equal(sala.rankingVivo().length, 2);

  const acierto = sala.intentar(tarde.jugador.token, sala.ronda.secreta);
  assert.equal(acierto.acierto, true);
  assert.equal(tarde.jugador.puntos, 1000);
});

test('quien participa nunca se queda con cero puntos', () => {
  // Con el mejor intento en la última posición el calor redondea a 0, y salir
  // sin nada por haber jugado sienta peor que salir con un punto.
  const { sala, jugadores } = salaCon(1, { anfitrionJuega: false });
  sala.empezarRonda();
  const { orden } = rankingDe(sala.ronda.secreta);
  sala.intentar(jugadores[0].token, orden[orden.length - 1]);
  sala.cerrarRonda();
  assert.ok(jugadores[0].puntos > 0, 'se quedó a cero habiendo jugado');
});

test('las palabras desconocidas no consumen intento', () => {
  const { sala, jugadores } = salaCon(1);
  sala.empezarRonda();
  const r = sala.intentar(jugadores[0].token, 'asdfghjk');
  assert.equal(r.ok, false);
  assert.equal(sala.ronda.progreso.get(jugadores[0].token).intentos, 0);
});

test('el anfitrión no juega y las pistas van en orden', () => {
  const { sala, host } = salaCon(1, { anfitrionJuega: false });
  sala.empezarRonda();
  assert.equal(sala.intentar(host.token, 'mesa').ok, false);

  const pistas = [sala.darPista(), sala.darPista(), sala.darPista()];
  assert.match(pistas[0], /letras/);
  assert.match(pistas[1], /Campo semántico/);
  assert.match(pistas[2], /Empieza por/);
  assert.equal(sala.ronda.pistas.length, 3);
});

test('la partida acaba al agotar las rondas configuradas', () => {
  const { sala, jugadores } = salaCon(1, { rondas: 2, anfitrionJuega: false });
  sala.empezarRonda();
  sala.cerrarRonda();
  assert.equal(sala.estado, 'resultados');
  sala.empezarRonda();
  const resumen = sala.cerrarRonda();
  assert.equal(sala.estado, 'final');
  assert.equal(resumen.esFinal, true);
  assert.equal(sala.empezarRonda().ok, false);
  assert.equal(sala.clasificacion()[0].nombre, jugadores[0].nombre);
});

test('no se repite palabra secreta entre rondas', () => {
  const sala = new Sala('222222', { rondas: 12 });
  sala.entrar({ nombre: 'Ana' });
  const vistas = new Set();
  for (let i = 0; i < 12; i++) {
    sala.empezarRonda();
    assert.ok(!vistas.has(sala.ronda.secreta), `repetida: ${sala.ronda.secreta}`);
    vistas.add(sala.ronda.secreta);
    sala.cerrarRonda();
  }
});

test('el anfitrión ve los tokens de los demás, pero no el suyo ni los jugadores', () => {
  const { sala, host, jugadores } = salaCon(2);
  const vistaHost = sala.vista(host.token);
  const vistaJugador = sala.vista(jugadores[0].token);
  assert.ok(vistaHost.jugadores.filter((j) => !j.esHost).every((j) => typeof j.token === 'string'));
  // Sin token propio no hay botón de expulsarse a uno mismo.
  assert.equal(vistaHost.jugadores.find((j) => j.esHost).token, undefined);
  assert.ok(vistaJugador.jugadores.every((j) => j.token === undefined));
});

test('la palabra secreta no se filtra durante la ronda, ni al anfitrión que juega', () => {
  const { sala, host, jugadores } = salaCon(1);
  sala.empezarRonda();
  assert.equal(sala.vista(jugadores[0].token).ronda.secreta, null);
  assert.equal(sala.vista(host.token).ronda.secreta, null, 'si juega, tampoco la ve');
  sala.cerrarRonda();
  assert.equal(sala.vista(jugadores[0].token).ronda.secreta, sala.ronda.secreta);
  assert.equal(sala.vista(host.token).ronda.secreta, sala.ronda.secreta);
});

test('en modo marcador el anfitrión sí ve la palabra secreta', () => {
  const { sala, host } = salaCon(1, { anfitrionJuega: false });
  sala.empezarRonda();
  assert.equal(sala.vista(host.token).ronda.secreta, sala.ronda.secreta);
});

test('expulsar saca al jugador del ranking, y al anfitrión no se le expulsa', () => {
  const { sala, host, jugadores } = salaCon(2, { anfitrionJuega: false });
  sala.empezarRonda();
  sala.intentar(jugadores[0].token, 'mesa');
  sala.expulsar(jugadores[0].token);
  assert.equal(sala.rankingVivo().length, 1);
  assert.equal(sala.entrar({ token: jugadores[0].token }).ok, false);
  assert.equal(sala.expulsar(host.token), null);
});

test('el gestor crea códigos únicos de 6 cifras y limpia salas muertas', () => {
  const gestor = new GestorSalas();
  const codigos = new Set();
  for (let i = 0; i < 200; i++) {
    const sala = gestor.crear();
    assert.match(sala.codigo, /^\d{6}$/);
    assert.ok(!codigos.has(sala.codigo));
    codigos.add(sala.codigo);
  }
  assert.equal(gestor.salas.size, 200);
  for (const sala of gestor.salas.values()) sala.ultimaActividad = 0;
  gestor.limpiar();
  assert.equal(gestor.salas.size, 0);
});
