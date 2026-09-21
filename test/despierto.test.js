import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { setTimeout as esperar } from 'node:timers/promises';

import { mantenerDespierto, urlPublica } from '../server/despierto.js';

describe('urlPublica', () => {
  it('usa URL_PUBLICA cuando está puesta', () => {
    assert.equal(urlPublica({ URL_PUBLICA: 'https://ejemplo.com' }), 'https://ejemplo.com');
  });

  it('cae en la que publica Render', () => {
    assert.equal(
      urlPublica({ RENDER_EXTERNAL_URL: 'https://clueless-party.onrender.com' }),
      'https://clueless-party.onrender.com',
    );
  });

  it('da prioridad a URL_PUBLICA sobre la de Render', () => {
    const url = urlPublica({ URL_PUBLICA: 'https://mia.com', RENDER_EXTERNAL_URL: 'https://otra.com' });
    assert.equal(url, 'https://mia.com');
  });

  it('quita la barra final para no construir URLs con doble barra', () => {
    assert.equal(urlPublica({ URL_PUBLICA: 'https://ejemplo.com/' }), 'https://ejemplo.com');
  });

  it('devuelve cadena vacía si no hay ninguna', () => {
    assert.equal(urlPublica({}), '');
  });
});

describe('mantenerDespierto', () => {
  const abiertos = [];
  const arrancar = (opciones) => {
    const mando = mantenerDespierto(opciones);
    if (mando) abiertos.push(mando);
    return mando;
  };

  after(() => abiertos.forEach((m) => m.parar()));

  it('no hace nada si no hay URL pública (caso local)', () => {
    assert.equal(arrancar({ url: '' }), null);
  });

  it('llama a /api/salud de la URL pública', async () => {
    const visitadas = [];
    const mando = arrancar({
      url: 'https://ejemplo.com',
      cadaMs: 5,
      buscar: async (destino) => {
        visitadas.push(destino);
        return { ok: true, status: 200 };
      },
    });

    assert.equal(mando.url, 'https://ejemplo.com/api/salud');
    await esperar(40);
    mando.parar();

    assert.ok(visitadas.length >= 2, `esperaba varias llamadas, hubo ${visitadas.length}`);
    assert.ok(visitadas.every((d) => d === 'https://ejemplo.com/api/salud'));
    assert.equal(mando.cuenta.correctos, mando.cuenta.intentos);
    assert.equal(mando.cuenta.fallidos, 0);
  });

  it('sigue intentándolo aunque una llamada falle', async () => {
    let llamadas = 0;
    const mando = arrancar({
      url: 'https://ejemplo.com',
      cadaMs: 5,
      buscar: async () => {
        llamadas += 1;
        if (llamadas === 1) throw new Error('red caída');
        return { ok: true, status: 200 };
      },
    });

    await esperar(40);
    mando.parar();

    assert.equal(mando.cuenta.fallidos, 1);
    assert.equal(mando.cuenta.ultimoError, 'red caída');
    assert.ok(mando.cuenta.correctos >= 1, 'debería haberse recuperado tras el fallo');
  });

  it('cuenta como fallo una respuesta que no sea 2xx', async () => {
    const mando = arrancar({
      url: 'https://ejemplo.com',
      cadaMs: 5,
      buscar: async () => ({ ok: false, status: 502 }),
    });

    await esperar(20);
    mando.parar();

    assert.ok(mando.cuenta.fallidos >= 1);
    assert.equal(mando.cuenta.ultimoError, 'HTTP 502');
    assert.equal(mando.cuenta.correctos, 0);
  });

  it('avisa en los registros cuando encadena fallos', async () => {
    const avisos = [];
    const mando = arrancar({
      url: 'https://ejemplo.com',
      cadaMs: 5,
      buscar: async () => { throw new Error('sin red'); },
      log: { warn: (t) => avisos.push(t) },
    });

    await esperar(40);
    mando.parar();

    assert.ok(mando.cuenta.seguidos >= 2, 'debería llevar la cuenta de fallos seguidos');
    assert.ok(avisos.length >= 1, 'debería haber avisado');
    assert.match(avisos[0], /Auto-ping fallido \d+ veces seguidas \(sin red\)/);
  });

  it('no avisa por un fallo suelto y reinicia la cuenta al recuperarse', async () => {
    const avisos = [];
    let llamadas = 0;
    const mando = arrancar({
      url: 'https://ejemplo.com',
      cadaMs: 5,
      buscar: async () => {
        llamadas += 1;
        if (llamadas === 1) throw new Error('fallo suelto');
        return { ok: true, status: 200 };
      },
      log: { warn: (t) => avisos.push(t) },
    });

    await esperar(40);
    mando.parar();

    assert.equal(avisos.length, 0, 'un fallo aislado no merece aviso');
    assert.equal(mando.cuenta.seguidos, 0, 'la racha se reinicia al volver a responder');
  });

  it('deja de llamar cuando se para', async () => {
    let llamadas = 0;
    const mando = arrancar({
      url: 'https://ejemplo.com',
      cadaMs: 5,
      buscar: async () => {
        llamadas += 1;
        return { ok: true, status: 200 };
      },
    });

    await esperar(20);
    mando.parar();
    const tras = llamadas;
    await esperar(30);

    assert.equal(llamadas, tras, 'no debería seguir llamando tras parar');
  });
});
