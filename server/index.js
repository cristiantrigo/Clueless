/**
 * Punto de entrada para un proceso Node normal (local, Render, Railway, un VPS…).
 */

import { crearAplicacion } from './app.js';
import { mantenerDespierto, urlPublica } from './despierto.js';
import { TOTAL_PALABRAS } from './similarity.js';

const PUERTO = process.env.PORT || 3000;
const { servidor } = crearAplicacion();

servidor.listen(PUERTO, () => {
  console.log(`Clueless Party escuchando en http://localhost:${PUERTO}`);
  console.log(`Léxico cargado: ${TOTAL_PALABRAS} palabras en español.`);

  // En un alojamiento gratuito, dormirse significa que el siguiente que entre
  // espere casi un minuto a que el contenedor vuelva. Ver server/despierto.js.
  const despertador = mantenerDespierto();
  if (despertador) console.log(`Auto-ping activo contra ${despertador.url}`);
  else if (!urlPublica()) console.log('Sin URL pública: auto-ping desactivado (normal en local).');
});
