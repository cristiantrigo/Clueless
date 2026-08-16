/* Cliente de Clueless Party. */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const socket = io();

  const estado = {
    codigo: null,
    token: null,
    esHost: false,
    vista: null,
    finRonda: 0,
    tic: null,
  };

  const guardado = {
    leer() {
      try { return JSON.parse(localStorage.getItem('clueless') || '{}'); } catch { return {}; }
    },
    escribir(datos) {
      try { localStorage.setItem('clueless', JSON.stringify(datos)); } catch { /* modo privado */ }
    },
    borrar() {
      try { localStorage.removeItem('clueless'); } catch { /* ignorar */ }
    },
  };

  // ─── Navegación de pantallas ───────────────────────────────────────────────

  function mostrarPantalla(id) {
    document.querySelectorAll('.pantalla').forEach((p) => p.classList.toggle('activa', p.id === id));
  }

  function mostrarVista(id) {
    document.querySelectorAll('.vista').forEach((v) => v.classList.toggle('activa', v.id === id));
  }

  function aviso(texto, tipo = 'info') {
    const capa = $('#ui-avisos');
    const el = document.createElement('div');
    el.className = `aviso ${tipo}`;
    el.textContent = texto;
    capa.append(el);
    // Como mucho tres a la vez: si no, una entrada masiva tapa media pantalla.
    while (capa.children.length > 3) capa.firstElementChild.remove();
    setTimeout(() => el.remove(), 3600);
  }

  function mensaje(texto, ok = false) {
    const el = $('#ui-mensaje');
    el.textContent = texto;
    el.classList.toggle('ok', ok);
  }

  // ─── Entrar / crear ────────────────────────────────────────────────────────

  $('#form-unirse').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const codigo = $('#in-codigo').value.replace(/\D/g, '');
    const nombre = $('#in-nombre').value.trim();
    if (codigo.length !== 6) return aviso('El código tiene 6 cifras.', 'caliente');
    unirse(codigo, nombre);
  });

  $('#btn-crear').addEventListener('click', () => {
    socket.emit('crear_sala', { nombre: $('#in-nombre').value.trim() || 'Anfitrión' }, (r) => {
      if (!r.ok) return aviso(r.error, 'caliente');
      iniciarSesion(r, true);
    });
  });

  function unirse(codigo, nombre, token = null) {
    socket.emit('unirse', { codigo, nombre, token }, (r) => {
      if (!r.ok) {
        aviso(r.error, 'caliente');
        guardado.borrar();
        mostrarPantalla('p-inicio');
        return;
      }
      iniciarSesion(r, r.vista?.yo?.esHost ?? false);
    });
  }

  function iniciarSesion(respuesta, esHost) {
    estado.codigo = respuesta.codigo;
    estado.token = respuesta.token;
    estado.esHost = esHost;
    document.body.classList.toggle('es-host', esHost);
    guardado.escribir({ codigo: estado.codigo, token: estado.token, nombre: $('#in-nombre').value.trim() });

    const url = new URL(location.href);
    url.searchParams.set('sala', estado.codigo);
    history.replaceState(null, '', url);

    mostrarPantalla('p-sala');
    pintar(respuesta.vista);
  }

  // ─── Pintado del estado ────────────────────────────────────────────────────

  function pintar(vista) {
    if (!vista) return;
    estado.vista = vista;
    estado.esHost = Boolean(vista.yo?.esHost);
    document.body.classList.toggle('es-host', estado.esHost);

    $('#ui-codigo').textContent = vista.codigo;
    $('#ui-codigo-grande').textContent = vista.codigo;
    $('#ui-total').textContent = vista.totalPalabras.toLocaleString('es-ES');
    $('#ui-url').textContent = `${location.host}${location.pathname}`.replace(/\/$/, '');
    $('#ui-yo').innerHTML = vista.yo
      ? `<b>${escapar(vista.yo.nombre)}</b>${vista.yo.esHost ? ' · anfitrión' : ` · ${vista.yo.puntos} pts`}`
      : '';

    $('#ui-ronda').textContent =
      vista.estado === 'lobby' ? 'Sala de espera'
      : vista.estado === 'final' ? 'Partida terminada'
      : `Ronda ${vista.numeroRonda} de ${vista.config.rondas}`;

    pintarJugadores(vista);
    pintarAjustes(vista);

    if (vista.estado === 'lobby') mostrarVista('v-lobby');
    else if (vista.estado === 'ronda') mostrarVista('v-ronda');
    else if (vista.estado === 'resultados') mostrarVista('v-resultados');
    else mostrarVista('v-final');

    if (vista.estado === 'ronda' && vista.ronda) {
      estado.finRonda = vista.ronda.acaba;
      arrancarCrono();
      pintarIntentos(vista.misIntentos);
      pintarRanking(vista.ranking, vista.yo?.id);
      pintarPistas(vista.ronda.pistas);
      if (estado.esHost) $('#ui-secreta-host').textContent = vista.ronda.secreta ?? '—';
      bloquearIntentos(Boolean(vista.misIntentos.find((i) => i.posicion === 1)));
    } else {
      pararCrono();
    }

    if (vista.estado === 'resultados' || vista.estado === 'final') {
      pintarClasificacion(vista.clasificacion, '#ui-clasificacion');
    }
    if (vista.estado === 'final') {
      pintarClasificacion(vista.clasificacion, '#ui-final');
      $('#btn-siguiente').disabled = true;
    } else {
      $('#btn-siguiente').disabled = false;
    }
  }

  function pintarJugadores(vista) {
    const lista = $('#ui-jugadores');
    lista.innerHTML = '';
    for (const j of vista.jugadores) {
      const li = document.createElement('li');
      li.className = j.conectado ? '' : 'desconectado';
      li.innerHTML = `<span class="punto" style="background:${j.color}"></span><span>${escapar(j.nombre)}</span>`;
      if (estado.esHost && j.token) {
        const x = document.createElement('button');
        x.className = 'expulsar';
        x.type = 'button';
        x.title = `Expulsar a ${j.nombre}`;
        x.textContent = '×';
        x.addEventListener('click', () => {
          if (confirm(`¿Expulsar a ${j.nombre}?`)) socket.emit('expulsar', { token: j.token });
        });
        li.append(x);
      }
      lista.append(li);
    }
    $('#ui-contador').textContent = `${vista.jugadores.length}/${vista.config.maxJugadores}`;
    $('#ui-sin-jugadores').hidden = vista.jugadores.length > 0;
  }

  let ajustesTocados = false;
  function pintarAjustes(vista) {
    if (!estado.esHost || ajustesTocados) return;
    $('#cfg-rondas').value = vista.config.rondas;
    $('#out-rondas').value = vista.config.rondas;
    $('#cfg-minutos').value = Math.round(vista.config.segundos / 60);
    $('#out-minutos').value = Math.round(vista.config.segundos / 60);
    $('#cfg-max').value = vista.config.maxJugadores;
    $('#out-max').value = vista.config.maxJugadores;
    $('#cfg-dificultad').value = vista.config.dificultad;
    $('#cfg-pistas').checked = vista.config.pistasAuto;
    $('#cfg-seguir').checked = vista.config.seguirTrasAcierto;
  }

  function pintarIntentos(intentos) {
    const lista = $('#ui-intentos');
    lista.innerHTML = '';
    const ordenados = [...intentos].sort((a, b) => a.posicion - b.posicion);
    for (const i of ordenados) {
      const li = document.createElement('li');
      li.className = i.posicion === 1 ? 'acierto' : '';
      li.innerHTML = `
        <span class="palabra">${escapar(i.palabra)}</span>
        <span class="pos ${i.nivel.clase}">#${i.posicion.toLocaleString('es-ES')}</span>
        <span class="term" title="${i.nivel.texto}">${i.nivel.emoji}</span>`;
      lista.append(li);
    }
    $('#ui-sin-intentos').hidden = intentos.length > 0;
  }

  function pintarUltimo(intento) {
    const caja = $('#ui-ultimo');
    caja.hidden = false;
    caja.querySelector('.ultimo-palabra').textContent = intento.palabra;
    const pos = caja.querySelector('.ultimo-pos');
    pos.textContent = `#${intento.posicion.toLocaleString('es-ES')} · ${intento.nivel.texto}`;
    pos.className = `ultimo-pos ${intento.nivel.clase}`;
    const barra = caja.querySelector('.barra-calor i');
    barra.style.width = `${Math.max(2, intento.calor)}%`;
    barra.style.background = colorCalor(intento.calor);
  }

  function pintarRanking(filas, miId) {
    const lista = $('#ui-ranking');
    lista.innerHTML = '';
    for (const f of filas) {
      const li = document.createElement('li');
      li.className = `${f.id === miId ? 'yo-soy ' : ''}${f.acertado ? 'ha-acertado' : ''}`;
      const dato = f.acertado
        ? `<b class="acierto">✅ ${f.segundos}s</b><small>${f.intentos} intentos</small>`
        : f.mejor === null
          ? '<b>—</b><small>sin intentos</small>'
          : `<b class="${f.nivel.clase}">#${f.mejor.toLocaleString('es-ES')}</b><small>${f.intentos} intentos</small>`;
      li.innerHTML = `
        <span class="puesto">${f.acertado ? medalla(f.puesto) : f.puesto}</span>
        <span class="quien">
          <span class="punto" style="background:${f.color}"></span>
          <span class="nombre">${escapar(f.nombre)}${f.conectado ? '' : ' 💤'}</span>
        </span>
        <span class="dato">${dato}</span>
        <span class="mini-barra"><i style="width:${Math.max(1, f.calor)}%;background:${colorCalor(f.calor)}"></i></span>`;
      lista.append(li);
    }
  }

  function pintarPistas(pistas) {
    $('#ui-panel-pistas').hidden = !pistas || pistas.length === 0;
    const ul = $('#ui-pistas');
    ul.innerHTML = '';
    for (const p of pistas ?? []) {
      const li = document.createElement('li');
      li.textContent = p;
      ul.append(li);
    }
  }

  function pintarClasificacion(filas, selector) {
    const lista = $(selector);
    lista.innerHTML = '';
    for (const f of filas) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="medalla">${medalla(f.puesto)}</span>
        <span class="quien"><span class="punto" style="background:${f.color}"></span> <b>${escapar(f.nombre)}</b></span>
        <span class="detalle"><b>${f.puntos} pts</b><small>${f.victorias} ${f.victorias === 1 ? 'ronda ganada' : 'rondas ganadas'}</small></span>`;
      lista.append(li);
    }
    if (!filas.length) lista.innerHTML = '<li class="vacio">Sin jugadores.</li>';
  }

  // ─── Cronómetro ────────────────────────────────────────────────────────────

  function arrancarCrono() {
    pararCrono(); // pararCrono oculta el reloj, así que se muestra después
    $('#ui-crono').hidden = false;
    const pinta = () => {
      const restan = Math.max(0, Math.round((estado.finRonda - Date.now()) / 1000));
      const m = Math.floor(restan / 60);
      const s = String(restan % 60).padStart(2, '0');
      $('#ui-crono-num').textContent = `${m}:${s}`;
      $('#ui-crono').classList.toggle('urgente', restan <= 30);
    };
    pinta();
    estado.tic = setInterval(pinta, 500);
  }

  function pararCrono() {
    if (estado.tic) clearInterval(estado.tic);
    estado.tic = null;
    $('#ui-crono').hidden = true;
    $('#ui-crono').classList.remove('urgente');
  }

  // ─── Acciones ──────────────────────────────────────────────────────────────

  $('#form-intento').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const campo = $('#in-palabra');
    const palabra = campo.value.trim();
    if (!palabra) return;
    socket.emit('intentar', { palabra }, (r) => {
      if (!r.ok) return mensaje(r.error);
      campo.value = '';
      mensaje('');
      pintarUltimo(r.intento);
      if (r.acierto) {
        bloquearIntentos(true);
        lanzarConfeti();
        mensaje(r.primero ? '🥇 ¡La primera! Bestial.' : '🎉 ¡Acertada!', true);
      }
    });
    campo.focus();
  });

  $('#btn-empezar').addEventListener('click', () => {
    socket.emit('empezar_ronda', {}, (r) => { if (!r.ok) aviso(r.error, 'caliente'); });
  });
  $('#btn-siguiente').addEventListener('click', () => {
    socket.emit('empezar_ronda', {}, (r) => { if (!r.ok) aviso(r.error, 'caliente'); });
  });
  $('#btn-pista').addEventListener('click', () => {
    socket.emit('pista', {}, (r) => { if (!r.ok) aviso(r.error, 'caliente'); });
  });
  $('#btn-terminar').addEventListener('click', () => {
    if (confirm('¿Terminar la ronda ahora?')) socket.emit('terminar_ronda');
  });
  $('#btn-reiniciar').addEventListener('click', () => {
    socket.emit('reiniciar', {}, (r) => { if (!r.ok) aviso(r.error, 'caliente'); });
  });

  $('#btn-copiar').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?sala=${estado.codigo}`;
    try {
      await navigator.clipboard.writeText(url);
      aviso('Enlace copiado ✂️', 'entra');
    } catch {
      prompt('Copia este enlace:', url);
    }
  });

  // Ajustes del anfitrión: se envían al soltar el control.
  const controles = ['#cfg-rondas', '#cfg-minutos', '#cfg-max', '#cfg-dificultad', '#cfg-pistas', '#cfg-seguir'];
  for (const sel of controles) {
    const el = $(sel);
    el.addEventListener('input', () => {
      ajustesTocados = true;
      $('#out-rondas').value = $('#cfg-rondas').value;
      $('#out-minutos').value = $('#cfg-minutos').value;
      $('#out-max').value = $('#cfg-max').value;
    });
    el.addEventListener('change', () => {
      socket.emit('configurar', {
        config: {
          rondas: Number($('#cfg-rondas').value),
          segundos: Number($('#cfg-minutos').value) * 60,
          maxJugadores: Number($('#cfg-max').value),
          dificultad: $('#cfg-dificultad').value,
          pistasAuto: $('#cfg-pistas').checked,
          seguirTrasAcierto: $('#cfg-seguir').checked,
        },
      }, () => { ajustesTocados = false; });
    });
  }

  // ─── Eventos del servidor ──────────────────────────────────────────────────

  socket.on('estado', pintar);
  socket.on('aviso', ({ texto, tipo }) => aviso(texto, tipo));
  socket.on('pista', ({ texto }) => aviso(`💡 ${texto}`, 'info'));

  socket.on('ronda_inicio', ({ numero, total }) => {
    $('#ui-ultimo').hidden = true;
    bloquearIntentos(false);
    $('#in-palabra').value = '';
    mensaje('');
    aviso(`Ronda ${numero} de ${total}. ¡Ya!`, 'entra');
    if (!estado.esHost) setTimeout(() => $('#in-palabra').focus(), 100);
  });

  socket.on('acierto', ({ nombre, primero, posicionLlegada, segundos }) => {
    aviso(
      primero
        ? `🥇 ¡${nombre} la ha sacado en ${segundos}s!`
        : `✅ ${nombre} también (${posicionLlegada}º, ${segundos}s)`,
      'acierto',
    );
  });

  socket.on('ronda_fin', (resumen) => {
    $('#ui-revelada').textContent = resumen.secreta;
    $('#ui-vecinas').textContent = resumen.vecinas.join(' · ');

    const podio = $('#ui-podio');
    podio.innerHTML = '';
    for (const [i, p] of resumen.podio.entries()) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="medalla">${medalla(i + 1)}</span>
        <span class="quien"><span class="punto" style="background:${p.color}"></span> <b>${escapar(p.nombre)}</b></span>
        <span class="detalle"><b>+${p.puntos} pts</b><small>${p.segundos}s · ${p.intentos} intentos</small></span>`;
      podio.append(li);
    }
    $('#ui-nadie').hidden = resumen.podio.length > 0;

    $('#ui-cerca').innerHTML = resumen.cerca.length
      ? 'Los que más se acercaron sin acertar: ' +
        resumen.cerca.map((c) => `<b>${escapar(c.nombre)}</b> (#${c.mejor ?? '—'})`).join(', ')
      : '';

    if (resumen.esFinal) setTimeout(lanzarConfeti, 300);
  });

  socket.on('expulsado', () => {
    guardado.borrar();
    alert('El anfitrión te ha sacado de la sala.');
    location.href = location.pathname;
  });

  socket.on('desplazado', () => {
    aviso('Has abierto la sala en otra pestaña; esta queda inactiva.', 'caliente');
  });

  socket.on('connect', () => {
    // Reconexión tras una caída: volvemos a la sala en la que ya estábamos.
    if (estado.codigo && estado.token) return unirse(estado.codigo, null, estado.token);
    // Primera conexión: recuperamos la sesión guardada, si la hay.
    if (sesionAuto) {
      const s = sesionAuto;
      sesionAuto = null;
      unirse(s.codigo, s.nombre, s.token);
    }
  });

  socket.on('disconnect', () => aviso('Conexión perdida, reintentando…', 'caliente'));

  // ─── Auxiliares ────────────────────────────────────────────────────────────

  /** Cierra el campo de intentos cuando el jugador ya ha acertado. */
  function bloquearIntentos(bloqueado) {
    const campo = $('#in-palabra');
    campo.disabled = bloqueado;
    campo.placeholder = bloqueado ? '¡Ya la tienes! Mira el ranking…' : 'Escribe una palabra…';
    $('#form-intento button').disabled = bloqueado;
  }

  function escapar(texto) {
    const d = document.createElement('div');
    d.textContent = texto ?? '';
    return d.innerHTML;
  }

  function medalla(puesto) {
    return ['🥇', '🥈', '🥉'][puesto - 1] ?? puesto;
  }

  function colorCalor(pct) {
    if (pct >= 92) return '#31c48d';
    if (pct >= 75) return '#ff4d4d';
    if (pct >= 55) return '#ff9f43';
    if (pct >= 35) return '#ffd23f';
    if (pct >= 18) return '#3ec6c9';
    return '#5b8dee';
  }

  function lanzarConfeti() {
    const capa = $('#ui-confeti');
    const colores = ['#ffd23f', '#ff4d8d', '#31c48d', '#5b8dee', '#a855f7'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = colores[i % colores.length];
      p.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
      p.style.animationDelay = `${Math.random() * 0.5}s`;
      capa.append(p);
      setTimeout(() => p.remove(), 4200);
    }
  }

  // ─── Arranque ──────────────────────────────────────────────────────────────

  fetch('/api/salud')
    .then((r) => r.json())
    .then((d) => { $('#pie-palabras').textContent = d.palabras.toLocaleString('es-ES'); })
    .catch(() => { $('#pie-palabras').textContent = '—'; });

  const salaUrl = new URLSearchParams(location.search).get('sala');
  const sesionGuardada = guardado.leer();

  if (salaUrl) {
    $('#in-codigo').value = salaUrl;
    $('#in-nombre').focus();
  }
  if (sesionGuardada.nombre) $('#in-nombre').value = sesionGuardada.nombre;

  // Sólo se vuelve sola a la sala guardada si el enlace no apunta a otra distinta.
  let sesionAuto =
    sesionGuardada.codigo && sesionGuardada.token && (!salaUrl || salaUrl === sesionGuardada.codigo)
      ? sesionGuardada
      : null;
  // La reconexión la dispara el evento `connect` del socket.
})();
