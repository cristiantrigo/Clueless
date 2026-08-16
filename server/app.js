/**
 * Montaje de la aplicación: Express para los ficheros estáticos y Socket.IO
 * para las salas.
 *
 * Se exporta `crearAplicacion()` en vez de arrancar directamente porque hay dos
 * puntos de entrada: `server/index.js` para un proceso normal y `api/index.js`
 * para el despliegue en Vercel, donde la plataforma se queda con el servidor.
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import { Server } from 'socket.io';

import { GestorSalas, LIMITES } from './game.js';
import { TOTAL_PALABRAS } from './similarity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function crearAplicacion() {
  const app = express();
  const servidor = http.createServer(app);
  const io = new Server(servidor, { cors: { origin: '*' } });
  const gestor = new GestorSalas();

  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
  app.get('/api/salud', (_req, res) => {
    res.json({ ok: true, salas: gestor.salas.size, palabras: TOTAL_PALABRAS, limites: LIMITES });
  });

  // ─── Utilidades de emisión ───────────────────────────────────────────────────

  /** Envía a cada socket de la sala su propia vista (cada uno ve sus intentos). */
  function emitirEstado(sala) {
    for (const jugador of sala.listaJugadores) {
      if (!jugador.socketId) continue;
      io.to(jugador.socketId).emit('estado', sala.vista(jugador.token));
    }
  }

  function avisar(sala, texto, tipo = 'info') {
    io.to(`sala:${sala.codigo}`).emit('aviso', { texto, tipo, ts: Date.now() });
  }

  function limpiarTemporizadores(sala) {
    if (sala.temporizador) clearTimeout(sala.temporizador);
    if (sala.temporizadoresPista) sala.temporizadoresPista.forEach(clearTimeout);
    sala.temporizador = null;
    sala.temporizadoresPista = [];
  }

  function terminarRonda(sala, motivo) {
    const resumen = sala.cerrarRonda(motivo);
    if (!resumen) return;
    limpiarTemporizadores(sala);
    io.to(`sala:${sala.codigo}`).emit('ronda_fin', resumen);
    emitirEstado(sala);
  }

  function programarRonda(sala) {
    limpiarTemporizadores(sala);
    const msRestantes = sala.ronda.acaba - Date.now();
    sala.temporizador = setTimeout(() => terminarRonda(sala, 'tiempo'), msRestantes);

    if (sala.config.pistasAuto) {
      // Tres pistas repartidas por la ronda: al 40 %, 65 % y 85 % del tiempo.
      sala.temporizadoresPista = [0.4, 0.65, 0.85].map((fraccion) =>
        setTimeout(() => {
          const pista = sala.darPista();
          if (pista) {
            io.to(`sala:${sala.codigo}`).emit('pista', { texto: pista });
            emitirEstado(sala);
          }
        }, msRestantes * fraccion),
      );
    }
  }

  /** ¿Han acertado ya todos los que estaban jugando? */
  function todosHanAcertado(sala) {
    const progresos = [...(sala.ronda?.progreso.values() ?? [])];
    return progresos.length > 0 && progresos.every((p) => p.acertadoEn !== null);
  }

  // ─── Socket.IO ───────────────────────────────────────────────────────────────

  io.on('connection', (socket) => {
    /** @type {{codigo: string, token: string} | null} */
    let sesion = null;

    const responder = (cb, dato) => {
      if (typeof cb === 'function') cb(dato);
    };

    function vincular(sala, jugador) {
      // Si el mismo jugador tenía otra pestaña abierta, la anterior se descarta.
      if (jugador.socketId && jugador.socketId !== socket.id) {
        io.to(jugador.socketId).emit('desplazado');
      }
      jugador.socketId = socket.id;
      jugador.conectado = true;
      sesion = { codigo: sala.codigo, token: jugador.token };
      socket.join(`sala:${sala.codigo}`);
    }

    socket.on('crear_sala', ({ nombre, config } = {}, cb) => {
      const sala = gestor.crear(config);
      const alta = sala.entrar({ nombre: nombre || 'Anfitrión', esHost: true });
      if (!alta.ok) {
        gestor.eliminar(sala.codigo);
        return responder(cb, alta);
      }
      vincular(sala, alta.jugador);
      responder(cb, { ok: true, codigo: sala.codigo, token: alta.jugador.token, vista: sala.vista(alta.jugador.token) });
    });

    socket.on('unirse', ({ codigo, nombre, token } = {}, cb) => {
      const sala = gestor.obtener(codigo);
      if (!sala) return responder(cb, { ok: false, error: 'No existe ninguna sala con ese código.' });

      const alta = sala.entrar({ nombre, token });
      if (!alta.ok) return responder(cb, alta);

      vincular(sala, alta.jugador);
      responder(cb, { ok: true, codigo: sala.codigo, token: alta.jugador.token, vista: sala.vista(alta.jugador.token) });

      if (alta.nuevo) avisar(sala, `${alta.jugador.nombre} se ha unido`, 'entra');
      emitirEstado(sala);
    });

    socket.on('configurar', ({ config } = {}, cb) => {
      const sala = sesion && gestor.obtener(sesion.codigo);
      if (!sala) return responder(cb, { ok: false, error: 'Sala no encontrada.' });
      if (sesion.token !== sala.hostToken) return responder(cb, { ok: false, error: 'Sólo el anfitrión.' });
      if (sala.estado === 'ronda') return responder(cb, { ok: false, error: 'No se puede cambiar en mitad de una ronda.' });

      sala.configurar(config);
      responder(cb, { ok: true, config: sala.config });
      emitirEstado(sala);
    });

    socket.on('empezar_ronda', (_datos, cb) => {
      const sala = sesion && gestor.obtener(sesion.codigo);
      if (!sala) return responder(cb, { ok: false, error: 'Sala no encontrada.' });
      if (sesion.token !== sala.hostToken) return responder(cb, { ok: false, error: 'Sólo el anfitrión.' });
      if (sala.participantes.length === 0) {
        return responder(cb, { ok: false, error: 'Todavía no hay jugadores en la sala.' });
      }

      const inicio = sala.empezarRonda();
      if (!inicio.ok) return responder(cb, inicio);

      programarRonda(sala);
      responder(cb, { ok: true });
      io.to(`sala:${sala.codigo}`).emit('ronda_inicio', {
        numero: sala.ronda.numero,
        total: sala.config.rondas,
        acaba: sala.ronda.acaba,
      });
      emitirEstado(sala);
    });

    socket.on('intentar', ({ palabra } = {}, cb) => {
      const sala = sesion && gestor.obtener(sesion.codigo);
      if (!sala) return responder(cb, { ok: false, error: 'Sala no encontrada.' });

      const resultado = sala.intentar(sesion.token, palabra);
      responder(cb, resultado);
      if (!resultado.ok) return;

      const jugador = sala.jugadores.get(sesion.token);

      if (resultado.acierto) {
        io.to(`sala:${sala.codigo}`).emit('acierto', {
          nombre: jugador.nombre,
          color: jugador.color,
          primero: resultado.primero,
          posicionLlegada: sala.ronda.aciertos.length,
          segundos: Math.round(resultado.intento.momento / 1000),
          intentos: resultado.intento.posicion === 1 ? sala.ronda.progreso.get(sesion.token).intentos : 0,
        });

        if (!sala.config.seguirTrasAcierto || todosHanAcertado(sala)) {
          terminarRonda(sala, todosHanAcertado(sala) ? 'todos' : 'ganador');
          return;
        }
      } else if (resultado.intento.posicion <= 10) {
        avisar(sala, `¡${jugador.nombre} está ardiendo! 🔥`, 'caliente');
      }

      emitirEstado(sala);
    });

    socket.on('pista', (_datos, cb) => {
      const sala = sesion && gestor.obtener(sesion.codigo);
      if (!sala) return responder(cb, { ok: false, error: 'Sala no encontrada.' });
      if (sesion.token !== sala.hostToken) return responder(cb, { ok: false, error: 'Sólo el anfitrión.' });

      const pista = sala.darPista();
      if (!pista) return responder(cb, { ok: false, error: 'No hay ronda abierta.' });
      responder(cb, { ok: true, pista });
      io.to(`sala:${sala.codigo}`).emit('pista', { texto: pista });
      emitirEstado(sala);
    });

    socket.on('terminar_ronda', (_datos, cb) => {
      const sala = sesion && gestor.obtener(sesion.codigo);
      if (!sala) return responder(cb, { ok: false, error: 'Sala no encontrada.' });
      if (sesion.token !== sala.hostToken) return responder(cb, { ok: false, error: 'Sólo el anfitrión.' });
      terminarRonda(sala, 'anfitrion');
      responder(cb, { ok: true });
    });

    socket.on('expulsar', ({ token } = {}, cb) => {
      const sala = sesion && gestor.obtener(sesion.codigo);
      if (!sala) return responder(cb, { ok: false, error: 'Sala no encontrada.' });
      if (sesion.token !== sala.hostToken) return responder(cb, { ok: false, error: 'Sólo el anfitrión.' });

      const fuera = sala.expulsar(token);
      if (!fuera) return responder(cb, { ok: false, error: 'Ese jugador no está en la sala.' });
      if (fuera.socketId) {
        io.to(fuera.socketId).emit('expulsado');
        io.sockets.sockets.get(fuera.socketId)?.leave(`sala:${sala.codigo}`);
      }
      responder(cb, { ok: true });
      avisar(sala, `${fuera.nombre} ha sido expulsado`, 'sale');
      emitirEstado(sala);
    });

    socket.on('reiniciar', (_datos, cb) => {
      const sala = sesion && gestor.obtener(sesion.codigo);
      if (!sala) return responder(cb, { ok: false, error: 'Sala no encontrada.' });
      if (sesion.token !== sala.hostToken) return responder(cb, { ok: false, error: 'Sólo el anfitrión.' });

      limpiarTemporizadores(sala);
      sala.estado = 'lobby';
      sala.ronda = null;
      sala.numeroRonda = 0;
      sala.usadas.clear();
      for (const jugador of sala.listaJugadores) {
        jugador.puntos = 0;
        jugador.victorias = 0;
      }
      responder(cb, { ok: true });
      avisar(sala, 'Partida nueva: marcador a cero', 'info');
      emitirEstado(sala);
    });

    socket.on('disconnect', () => {
      if (!sesion) return;
      const sala = gestor.obtener(sesion.codigo);
      if (!sala) return;
      const jugador = sala.desconectar(sesion.token);
      if (jugador && !jugador.esHost) avisar(sala, `${jugador.nombre} se ha desconectado`, 'sale');
      emitirEstado(sala);
    });
  });


  const limpieza = setInterval(() => gestor.limpiar(), 5 * 60 * 1000);
  limpieza.unref?.();

  return { app, servidor, io, gestor };
}
