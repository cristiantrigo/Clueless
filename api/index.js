/**
 * Punto de entrada para Vercel.
 *
 * En Vercel no se llama a `listen()`: se exporta el servidor HTTP y la
 * plataforma se encarga de atender las peticiones y de la subida a WebSocket.
 */

import { crearAplicacion } from '../server/app.js';

const { servidor } = crearAplicacion();

export default servidor;
