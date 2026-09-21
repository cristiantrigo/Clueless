/**
 * Mantener el servicio despierto.
 *
 * Los alojamientos gratuitos (Render, Railway, Fly…) apagan el proceso cuando
 * pasa un rato sin recibir peticiones. En Render son 15 minutos, y volver a
 * encenderlo tarda entre 30 y 60 segundos: el primero que abre la URL se come
 * una pantalla de carga y piensa que el juego está roto.
 *
 * El arreglo es que nunca llegue a dormirse. Mientras el proceso está vivo se
 * llama a sí mismo por su URL pública cada pocos minutos; la petición sale a
 * internet y vuelve a entrar por el balanceador, así que para el alojamiento es
 * tráfico real y reinicia la cuenta atrás.
 *
 * Esto sólo cubre el caso de "está despierto y quiero que siga estándolo". Si
 * el proceso llega a apagarse (un despliegue, una caída, una franja sin ping)
 * ya no puede despertarse solo: de eso se encarga el cron de GitHub Actions en
 * .github/workflows/despertador.yml, que es externo.
 */

/**
 * Cada cuánto llamarse. A 5 minutos harían falta tres fallos seguidos para
 * pasarse de los 15 y que el alojamiento lo apague; a 10 bastaban dos. Una
 * petición cada cinco minutos no cuesta nada, así que el margen sale gratis.
 */
const CADA_MS = Number(process.env.PING_CADA_MS ?? 5 * 60 * 1000);

/** Si el servicio no contesta en este tiempo, se abandona y se reintenta luego. */
const ESPERA_MAXIMA_MS = 20000;

/**
 * La URL pública por la que se llega al servicio. Render la publica sola; en
 * otros sitios se pone a mano con URL_PUBLICA.
 */
export function urlPublica(entorno = process.env) {
  const url = entorno.URL_PUBLICA || entorno.RENDER_EXTERNAL_URL || '';
  return url.trim().replace(/\/+$/, '');
}

/**
 * Arranca el ping periódico. Devuelve un mando con `parar()` y un contador de
 * lo que ha ido pasando, que es lo que mira la prueba.
 *
 * @param {object} opciones
 * @param {string} [opciones.url] URL pública; por defecto la del entorno.
 * @param {number} [opciones.cadaMs] Periodo entre llamadas.
 * @param {Function} [opciones.buscar] `fetch` a usar (se sustituye en pruebas).
 * @param {Console} [opciones.log]
 * @returns {{parar: Function, cuenta: object, url: string} | null} null si no hay URL.
 */
export function mantenerDespierto({
  url = urlPublica(),
  cadaMs = CADA_MS,
  buscar = globalThis.fetch,
  log = console,
} = {}) {
  if (!url) {
    // En local no hay nada que mantener despierto, y avisar de ello cada vez
    // sería ruido en el arranque del día a día.
    return null;
  }

  const destino = `${url}/api/salud`;
  const cuenta = { intentos: 0, correctos: 0, fallidos: 0, seguidos: 0, ultimoError: null };

  /** Fallos seguidos a partir de los cuales ya peligra la ventana de 15 min. */
  const FALLOS_PARA_AVISAR = 2;

  async function llamar() {
    cuenta.intentos += 1;
    try {
      const respuesta = await buscar(destino, {
        // Cabecera propia para poder distinguir estos pings del tráfico real
        // si algún día miramos los registros.
        headers: { 'user-agent': 'clueless-despertador' },
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      });
      if (respuesta.ok) {
        cuenta.correctos += 1;
        cuenta.seguidos = 0;
      } else {
        anotarFallo(`HTTP ${respuesta.status}`);
      }
    } catch (err) {
      // Un ping fallido no es grave: el siguiente llega en unos minutos y el
      // cron externo sigue cubriendo por su lado. No queremos tirar el proceso
      // por esto, así que sólo se anota.
      anotarFallo(err.message);
    }
  }

  function anotarFallo(motivo) {
    cuenta.fallidos += 1;
    cuenta.seguidos += 1;
    cuenta.ultimoError = motivo;
    // Un fallo suelto no dice nada; varios seguidos sí, porque significan que
    // el servicio va camino de dormirse y conviene verlo en los registros.
    if (cuenta.seguidos >= FALLOS_PARA_AVISAR) {
      log.warn?.(`Auto-ping fallido ${cuenta.seguidos} veces seguidas (${motivo}).`);
    }
  }

  const temporizador = setInterval(llamar, cadaMs);
  // Sin unref el proceso no terminaría nunca al cerrarlo desde una prueba.
  temporizador.unref?.();

  return {
    url: destino,
    cuenta,
    parar() {
      clearInterval(temporizador);
    },
  };
}
