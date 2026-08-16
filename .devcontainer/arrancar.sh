#!/usr/bin/env bash
# Arranque del juego dentro de un Codespace.
#
# Intenta dejar el puerto 3000 en público (que es lo que permite entrar a quien
# no tiene acceso al repositorio), enseña la dirección para repartir y levanta
# el servidor. Fuera de un Codespace se limita a arrancar.

set -u
PUERTO=3000

if [ -n "${CODESPACE_NAME:-}" ]; then
  # Puede fallar si el token del Codespace no tiene permiso; no es motivo para
  # no arrancar, así que se avisa y se sigue.
  if gh codespace ports visibility "${PUERTO}:public" --codespace "$CODESPACE_NAME" >/dev/null 2>&1; then
    visibilidad="pública ✅"
  else
    visibilidad="PRIVADA ⚠️  — cámbiala a Public en la pestaña Ports"
  fi

  dominio="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  url="https://${CODESPACE_NAME}-${PUERTO}.${dominio}"

  echo
  echo "┌──────────────────────────────────────────────────────────────"
  echo "│  Reparte esta dirección a tus amigos:"
  echo "│"
  echo "│    $url"
  echo "│"
  echo "│  Visibilidad del puerto: $visibilidad"
  echo "│  Deja esta pestaña abierta mientras jugáis."
  echo "└──────────────────────────────────────────────────────────────"
  echo
fi

exec npm start
