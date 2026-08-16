/**
 * Lógica de las salas: jugadores, rondas, intentos, ranking en vivo y puntos.
 *
 * Este módulo no sabe nada de sockets: expone una clase `Sala` con métodos que
 * devuelven el resultado de cada acción, y un `GestorSalas` que las indexa por
 * código. `server/index.js` se encarga de traducir eso a eventos de Socket.IO.
 */

import { randomUUID } from 'node:crypto';
import {
  calor,
  elegirSecreta,
  etiquetasDe,
  nivel,
  rankingDe,
  resolver,
  vecinas,
  TOTAL_PALABRAS,
} from './similarity.js';

export const LIMITES = {
  jugadores: 50,
  jugadoresPorDefecto: 20,
  nombre: 16,
  rondas: 20,
  segundosRonda: [60, 900],
};

const COLORES = [
  '#ff5a5f', '#ffb400', '#31c48d', '#3b82f6', '#a855f7', '#ec4899',
  '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16', '#e11d48',
  '#0ea5e9', '#f43f5e', '#22c55e', '#eab308', '#6366f1', '#d946ef',
  '#10b981', '#fb7185',
];

const CONFIG_POR_DEFECTO = {
  rondas: 5,
  dificultad: 'mezcla', // facil | normal | dificil | mezcla
  segundos: 240,
  maxJugadores: LIMITES.jugadoresPorDefecto,
  pistasAuto: true,
  seguirTrasAcierto: true, // la ronda continúa tras el primer acierto (para el podio)
};

/** Números de sala de 6 cifras, legibles y fáciles de dictar. */
function generarCodigo(existentes) {
  let codigo;
  do {
    codigo = String(Math.floor(100000 + Math.random() * 900000));
  } while (existentes.has(codigo));
  return codigo;
}

function limpiarNombre(nombre) {
  return String(nombre ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LIMITES.nombre);
}

function entero(valor, min, max, porDefecto) {
  const n = Number.parseInt(valor, 10);
  if (Number.isNaN(n)) return porDefecto;
  return Math.max(min, Math.min(max, n));
}

// ─── Sala ────────────────────────────────────────────────────────────────────

export class Sala {
  constructor(codigo, config = {}) {
    this.codigo = codigo;
    this.creada = Date.now();
    this.config = { ...CONFIG_POR_DEFECTO };
    this.configurar(config);

    /** @type {Map<string, Jugador>} token -> jugador */
    this.jugadores = new Map();
    this.hostToken = null;
    this.estado = 'lobby'; // lobby | ronda | resultados | final
    this.ronda = null;
    this.numeroRonda = 0;
    this.usadas = new Set();
    this.temporizador = null;
    this.ultimaActividad = Date.now();
  }

  configurar(parcial = {}) {
    const c = this.config;
    if (parcial.rondas !== undefined) c.rondas = entero(parcial.rondas, 1, LIMITES.rondas, c.rondas);
    if (parcial.segundos !== undefined) {
      c.segundos = entero(parcial.segundos, LIMITES.segundosRonda[0], LIMITES.segundosRonda[1], c.segundos);
    }
    if (parcial.maxJugadores !== undefined) {
      c.maxJugadores = entero(parcial.maxJugadores, 2, LIMITES.jugadores, c.maxJugadores);
    }
    if (parcial.dificultad !== undefined && ['facil', 'normal', 'dificil', 'mezcla'].includes(parcial.dificultad)) {
      c.dificultad = parcial.dificultad;
    }
    if (parcial.pistasAuto !== undefined) c.pistasAuto = Boolean(parcial.pistasAuto);
    if (parcial.seguirTrasAcierto !== undefined) c.seguirTrasAcierto = Boolean(parcial.seguirTrasAcierto);
    return c;
  }

  get listaJugadores() {
    return [...this.jugadores.values()];
  }

  get activos() {
    return this.listaJugadores.filter((j) => !j.expulsado);
  }

  // ── Entradas y salidas ─────────────────────────────────────────────────────

  /**
   * Añade un jugador o recupera al que vuelve con el mismo token.
   * @returns {{ok: true, jugador: Jugador, nuevo: boolean} | {ok: false, error: string}}
   */
  entrar({ nombre, token, esHost = false }) {
    const existente = token ? this.jugadores.get(token) : null;
    if (existente && !existente.expulsado) {
      existente.conectado = true;
      if (nombre) existente.nombre = limpiarNombre(nombre) || existente.nombre;
      this.ultimaActividad = Date.now();
      return { ok: true, jugador: existente, nuevo: false };
    }
    if (existente?.expulsado) return { ok: false, error: 'Te han sacado de esta sala.' };

    const limpio = limpiarNombre(nombre);
    if (limpio.length < 2) return { ok: false, error: 'Escribe un nombre de al menos 2 letras.' };

    if (!esHost) {
      if (this.activos.filter((j) => !j.esHost).length >= this.config.maxJugadores) {
        return { ok: false, error: 'La sala está llena.' };
      }
      const repetido = this.activos.some(
        (j) => j.nombre.toLowerCase() === limpio.toLowerCase(),
      );
      if (repetido) return { ok: false, error: 'Ese nombre ya está cogido en la sala.' };
      if (this.estado === 'final') return { ok: false, error: 'La partida ya ha terminado.' };
    }

    const nuevoToken = token || randomUUID();
    const jugador = {
      token: nuevoToken,
      id: randomUUID().slice(0, 8),
      nombre: limpio,
      color: COLORES[this.jugadores.size % COLORES.length],
      esHost,
      conectado: true,
      expulsado: false,
      puntos: 0,
      victorias: 0,
      socketId: null,
    };
    this.jugadores.set(nuevoToken, jugador);
    if (esHost && !this.hostToken) this.hostToken = nuevoToken;
    this.ultimaActividad = Date.now();
    return { ok: true, jugador, nuevo: true };
  }

  desconectar(token) {
    const jugador = this.jugadores.get(token);
    if (!jugador) return null;
    jugador.conectado = false;
    jugador.socketId = null;
    // En el lobby, quien se va sin haber jugado nada desaparece de la lista.
    if (this.estado === 'lobby' && !jugador.esHost && jugador.puntos === 0) {
      this.jugadores.delete(token);
    }
    return jugador;
  }

  expulsar(token) {
    const jugador = this.jugadores.get(token);
    if (!jugador || jugador.esHost) return null;
    jugador.expulsado = true;
    jugador.conectado = false;
    this.ronda?.intentos.delete(token);
    this.ronda?.progreso.delete(token);
    return jugador;
  }

  get vacia() {
    return this.activos.every((j) => !j.conectado);
  }

  // ── Rondas ─────────────────────────────────────────────────────────────────

  empezarRonda() {
    if (this.estado === 'ronda') return { ok: false, error: 'Ya hay una ronda en marcha.' };
    if (this.numeroRonda >= this.config.rondas) return { ok: false, error: 'No quedan rondas.' };

    const secreta = elegirSecreta(this.config.dificultad, this.usadas);
    this.usadas.add(secreta);
    this.numeroRonda += 1;
    this.estado = 'ronda';

    const ahora = Date.now();
    this.ronda = {
      numero: this.numeroRonda,
      secreta,
      ranking: rankingDe(secreta),
      inicio: ahora,
      acaba: ahora + this.config.segundos * 1000,
      /** @type {Map<string, Array>} token -> intentos */
      intentos: new Map(),
      /** @type {Map<string, {mejor:number, intentos:number, acertadoEn:number|null}>} */
      progreso: new Map(),
      /** @type {Array<{token:string, ms:number, intentos:number}>} */
      aciertos: [],
      pistas: [],
      pistasDadas: 0,
      cerrada: false,
    };

    for (const jugador of this.activos) {
      if (jugador.esHost) continue;
      this.ronda.progreso.set(jugador.token, { mejor: null, intentos: 0, acertadoEn: null });
      this.ronda.intentos.set(jugador.token, []);
    }
    this.ultimaActividad = Date.now();
    return { ok: true, ronda: this.ronda };
  }

  /**
   * Procesa el intento de un jugador.
   * @returns {{ok:false, error:string} | {ok:true, intento:object, acierto:boolean, primero:boolean}}
   */
  intentar(token, texto) {
    if (this.estado !== 'ronda' || !this.ronda || this.ronda.cerrada) {
      return { ok: false, error: 'Ahora mismo no hay ronda abierta.' };
    }
    const jugador = this.jugadores.get(token);
    if (!jugador || jugador.expulsado) return { ok: false, error: 'No estás en la sala.' };
    if (jugador.esHost) return { ok: false, error: 'El anfitrión no juega esta ronda.' };

    const progreso = this.ronda.progreso.get(token);
    if (!progreso) return { ok: false, error: 'Te has incorporado tarde: entras en la siguiente ronda.' };
    if (progreso.acertadoEn !== null) return { ok: false, error: 'Ya has acertado esta ronda.' };

    const palabra = resolver(texto);
    if (!palabra) {
      return { ok: false, error: 'No conozco esa palabra. Prueba con un sustantivo común en singular.' };
    }

    const lista = this.ronda.intentos.get(token);
    const repetida = lista.find((i) => i.palabra === palabra);
    if (repetida) return { ok: false, error: `Ya has probado «${palabra}» (posición ${repetida.posicion}).`, repetida: true };

    const posicion = this.ronda.ranking.posiciones.get(palabra) ?? TOTAL_PALABRAS;
    const intento = {
      palabra,
      posicion,
      calor: calor(posicion),
      nivel: nivel(posicion),
      momento: Date.now() - this.ronda.inicio,
    };
    lista.unshift(intento);

    progreso.intentos += 1;
    if (progreso.mejor === null || posicion < progreso.mejor) progreso.mejor = posicion;

    const acierto = posicion === 1;
    let primero = false;
    if (acierto) {
      progreso.acertadoEn = Date.now() - this.ronda.inicio;
      primero = this.ronda.aciertos.length === 0;
      this.ronda.aciertos.push({ token, ms: progreso.acertadoEn, intentos: progreso.intentos });
      jugador.puntos += this.puntosPorAcierto(this.ronda.aciertos.length);
      if (primero) jugador.victorias += 1;
    }

    this.ultimaActividad = Date.now();
    return { ok: true, intento, acierto, primero };
  }

  /** 1º 1000, 2º 800, 3º 640… con un suelo de 150 puntos por acertar. */
  puntosPorAcierto(posicionLlegada) {
    return Math.max(150, Math.round(1000 * 0.8 ** (posicionLlegada - 1)));
  }

  /** Puntos de consolación al cerrar la ronda, según lo cerca que se quedó. */
  puntosPorCercania(mejorPosicion) {
    if (mejorPosicion === null) return 0;
    return Math.round(calor(mejorPosicion) * 2); // hasta ~200 puntos
  }

  /** Pistas progresivas sobre la palabra secreta. */
  darPista() {
    if (this.estado !== 'ronda' || !this.ronda) return null;
    const { secreta } = this.ronda;
    const n = this.ronda.pistasDadas;
    let pista = null;

    if (n === 0) {
      pista = `Tiene ${secreta.length} letras.`;
    } else if (n === 1) {
      const tags = etiquetasDe(secreta);
      const tema = tags[tags.length - 1] ?? 'general';
      pista = `Campo semántico: ${tema}.`;
    } else if (n === 2) {
      pista = `Empieza por «${secreta[0].toUpperCase()}».`;
    } else if (n === 3) {
      const cercanas = vecinas(secreta, 3);
      pista = `Está muy cerca de: ${cercanas.join(', ')}.`;
    } else if (n === 4) {
      pista = `Acaba en «${secreta.slice(-2)}».`;
    } else {
      const visible = secreta
        .split('')
        .map((c, i) => (i % 2 === 0 ? c : '_'))
        .join(' ');
      pista = `Así se escribe: ${visible}`;
    }

    this.ronda.pistasDadas += 1;
    this.ronda.pistas.push(pista);
    return pista;
  }

  /** Cierra la ronda, reparte los puntos de cercanía y devuelve el resumen. */
  cerrarRonda(motivo = 'tiempo') {
    if (!this.ronda || this.ronda.cerrada) return null;
    this.ronda.cerrada = true;
    this.estado = this.numeroRonda >= this.config.rondas ? 'final' : 'resultados';

    for (const [token, progreso] of this.ronda.progreso) {
      const jugador = this.jugadores.get(token);
      if (!jugador || progreso.acertadoEn !== null) continue;
      jugador.puntos += this.puntosPorCercania(progreso.mejor);
    }

    const resumen = {
      motivo,
      numero: this.ronda.numero,
      secreta: this.ronda.secreta,
      vecinas: vecinas(this.ronda.secreta, 8),
      podio: this.ronda.aciertos.map(({ token, ms, intentos }, i) => {
        const j = this.jugadores.get(token);
        return {
          id: j?.id,
          nombre: j?.nombre ?? '—',
          color: j?.color,
          segundos: Math.round(ms / 1000),
          intentos,
          puntos: this.puntosPorAcierto(i + 1),
        };
      }),
      cerca: this.rankingVivo().filter((r) => !r.acertado).slice(0, 5),
      esFinal: this.estado === 'final',
    };

    this.ultimaActividad = Date.now();
    return resumen;
  }

  get segundosRestantes() {
    if (this.estado !== 'ronda' || !this.ronda) return 0;
    return Math.max(0, Math.round((this.ronda.acaba - Date.now()) / 1000));
  }

  // ── Vistas ─────────────────────────────────────────────────────────────────

  /** Quién va más cerca ahora mismo: el corazón del juego. */
  rankingVivo() {
    if (!this.ronda) return [];
    const filas = [];
    for (const [token, progreso] of this.ronda.progreso) {
      const jugador = this.jugadores.get(token);
      if (!jugador || jugador.expulsado) continue;
      filas.push({
        id: jugador.id,
        nombre: jugador.nombre,
        color: jugador.color,
        conectado: jugador.conectado,
        mejor: progreso.mejor,
        calor: progreso.mejor === null ? 0 : calor(progreso.mejor),
        nivel: progreso.mejor === null ? null : nivel(progreso.mejor),
        intentos: progreso.intentos,
        acertado: progreso.acertadoEn !== null,
        segundos: progreso.acertadoEn === null ? null : Math.round(progreso.acertadoEn / 1000),
      });
    }
    filas.sort((a, b) => {
      if (a.acertado !== b.acertado) return a.acertado ? -1 : 1;
      if (a.acertado && b.acertado) return a.segundos - b.segundos;
      if (a.mejor === null) return b.mejor === null ? 0 : 1;
      if (b.mejor === null) return -1;
      return a.mejor - b.mejor;
    });
    return filas.map((f, i) => ({ ...f, puesto: i + 1 }));
  }

  /** Clasificación general acumulada de la partida. */
  clasificacion() {
    return this.activos
      .filter((j) => !j.esHost)
      .sort((a, b) => b.puntos - a.puntos || b.victorias - a.victorias)
      .map((j, i) => ({
        puesto: i + 1,
        id: j.id,
        nombre: j.nombre,
        color: j.color,
        puntos: j.puntos,
        victorias: j.victorias,
        conectado: j.conectado,
      }));
  }

  /** Estado que se envía a un cliente concreto (incluye sus propios intentos). */
  vista(token) {
    const jugador = this.jugadores.get(token) ?? null;
    return {
      codigo: this.codigo,
      estado: this.estado,
      config: this.config,
      totalPalabras: TOTAL_PALABRAS,
      numeroRonda: this.numeroRonda,
      yo: jugador && {
        id: jugador.id,
        nombre: jugador.nombre,
        color: jugador.color,
        esHost: jugador.esHost,
        puntos: jugador.puntos,
        victorias: jugador.victorias,
      },
      jugadores: this.activos
        .filter((j) => !j.esHost)
        .map((j) => ({
          id: j.id,
          token: jugador?.esHost ? j.token : undefined, // sólo el anfitrión puede expulsar
          nombre: j.nombre,
          color: j.color,
          conectado: j.conectado,
          puntos: j.puntos,
          victorias: j.victorias,
        })),
      ronda: this.ronda && {
        numero: this.ronda.numero,
        acaba: this.ronda.acaba,
        restantes: this.segundosRestantes,
        cerrada: this.ronda.cerrada,
        pistas: this.ronda.pistas,
        secreta: this.ronda.cerrada || jugador?.esHost ? this.ronda.secreta : null,
      },
      misIntentos: (this.ronda?.intentos.get(token) ?? []).slice(0, 60),
      ranking: this.rankingVivo(),
      clasificacion: this.clasificacion(),
    };
  }
}

// ─── Gestor ──────────────────────────────────────────────────────────────────

export class GestorSalas {
  constructor() {
    /** @type {Map<string, Sala>} */
    this.salas = new Map();
  }

  crear(config) {
    const codigo = generarCodigo(this.salas);
    const sala = new Sala(codigo, config);
    this.salas.set(codigo, sala);
    return sala;
  }

  obtener(codigo) {
    return this.salas.get(String(codigo ?? '').trim()) ?? null;
  }

  eliminar(codigo) {
    const sala = this.salas.get(codigo);
    if (sala?.temporizador) clearTimeout(sala.temporizador);
    this.salas.delete(codigo);
  }

  /** Limpia salas abandonadas para no acumular memoria. */
  limpiar(maxInactividadMs = 3 * 60 * 60 * 1000) {
    const ahora = Date.now();
    for (const [codigo, sala] of this.salas) {
      const inactiva = ahora - sala.ultimaActividad > maxInactividadMs;
      const abandonada = sala.vacia && ahora - sala.ultimaActividad > 10 * 60 * 1000;
      if (inactiva || abandonada) this.eliminar(codigo);
    }
  }
}
