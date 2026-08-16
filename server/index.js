/**
 * Punto de entrada para un proceso Node normal (local, Render, Railway, un VPS…).
 */

import { crearAplicacion } from './app.js';
import { TOTAL_PALABRAS } from './similarity.js';

const PUERTO = process.env.PORT || 3000;
const { servidor } = crearAplicacion();

servidor.listen(PUERTO, () => {
  console.log(`Clueless Party escuchando en http://localhost:${PUERTO}`);
  console.log(`Léxico cargado: ${TOTAL_PALABRAS} palabras en español.`);
});
