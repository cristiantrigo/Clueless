# Clueless Party 🔎

Juego multijugador en español al estilo de [Clueless](https://lessgames.com/clueless) /
Contexto, pero **en sala compartida tipo Kahoot**: el anfitrión abre una sala con
código de 6 cifras, hasta 20 amigos entran desde el móvil y todos ven en directo
**quién se está acercando más** a la palabra secreta. Gana quien la acierte primero.

## Cómo se juega

1. Hay una **palabra secreta** en español. Cada jugador escribe la palabra que quiera.
2. El juego responde con la **posición** de esa palabra en el ranking de cercanía
   semántica a la secreta: la **#1** es la palabra buscada, la **#1816** es lo más
   lejano que hay.
3. `#847` es 🧊 frío · `#180` es 🙂 templado · `#31` es 🌶️ caliente · `#4` es 🔥 ardiendo.
4. Un **marcador en vivo** ordena a todos los jugadores por su mejor posición: se ve
   en tiempo real quién va ganando terreno.
5. El primero en acertar se lleva 1000 puntos, el segundo 800, el tercero 640… y quien
   no la saca puntúa igualmente según lo cerca que se quedó.

## Arrancar

```bash
npm install
npm start           # http://localhost:3000
```

- **Anfitrión**: abre la web y pulsa *Crear sala nueva*. **Juega como uno más** y además
  controla la partida: empezar rondas, dar pistas, cortar la ronda o expulsar a alguien.
  Como juega, tampoco ve la palabra secreta hasta que la ronda se cierra.
- **Modo marcador**: si el anfitrión desmarca *Yo también juego*, deja de participar y su
  pantalla se convierte en un marcador grande para proyectar en la tele; entonces sí ve la
  palabra secreta. Es lo cómodo cuando alguien hace de presentador.
- **Jugadores**: entran en la misma dirección, meten el código de 6 cifras y su nombre.
  El botón *Invitar amigos* abre la hoja de compartir del móvil (WhatsApp, Telegram…)
  con el enlace directo `.../?sala=123456`; en escritorio copia el enlace al portapapeles.

## Jugar ya

### En la misma red (cero despliegue)

```bash
npm start
```

Los demás abren `http://TU-IP-LOCAL:3000` desde el móvil. Para saber tu IP:
`ipconfig getifaddr en0` (macOS) o `hostname -I` (Linux).

### Sólo con móviles, sin cuentas nuevas ni ordenador

Si nadie tiene portátil a mano y todos estáis con datos móviles, se puede levantar el
servidor desde el navegador del móvil con **GitHub Codespaces**, usando la cuenta de
GitHub que ya tienes. El repositorio trae `.devcontainer/devcontainer.json`, así que
arranca solo:

1. Abre el repositorio en el móvil → botón verde **Code** → pestaña **Codespaces** →
   **Create codespace**.
2. Espera a que cargue el editor. Instala dependencias y ejecuta `npm start` sin que
   tengas que escribir nada.
3. Abre la pestaña **Ports** (o *Puertos*). En el puerto **3000**, cambia la visibilidad
   a **Public**: mantén pulsada la fila → *Port Visibility* → *Public*.
4. Copia la dirección `https://…-3000.app.github.dev` y repártela. Esa es la sala.

Deja la pestaña del Codespace abierta mientras jugáis: si se cierra, el Codespace se
para solo a los 30 minutos. El plan gratuito de GitHub incluye unas decenas de horas
al mes, de sobra para una partida.

### Con amigos que no están contigo, desde un ordenador

Levanta el servidor y ábrelo al mundo con un túnel temporal:

```bash
npm start
npx cloudflared tunnel --url http://localhost:3000   # en otra terminal
```

Cloudflare devuelve una URL `https://algo.trycloudflare.com` que puedes repartir. No
necesita cuenta y admite WebSockets. Deja de funcionar cuando cierres la terminal.

### Alojado de verdad

El repositorio trae `render.yaml` y `Procfile`. Vale cualquier servicio que ejecute un
proceso Node persistente con WebSockets:

- **Render**: *New → Blueprint*, apunta al repositorio y detecta `render.yaml`. Plan gratis.
- **Railway / Fly.io / un VPS**: sólo necesitan `npm start` y la variable `PORT`.

> **Vercel no vale tal cual.** Aunque ya admite WebSockets, sus funciones son efímeras y
> escalan a varias instancias, mientras que las salas de este juego viven en la memoria de
> un proceso: dos jugadores podrían caer en instancias distintas y no verse. Para
> desplegarlo ahí habría que mover el estado de las salas a Redis (Upstash) y añadir el
> adaptador correspondiente de Socket.IO.

## Pensado para el móvil

Los jugadores juegan desde el teléfono, así que la interfaz se diseñó primero para esa
pantalla y luego se amplió al escritorio:

- **Barra compacta de una sola línea** durante la ronda: ronda, cronómetro y tus puntos.
- **Campo de intento fijo**: se queda pegado bajo la cabecera, así que se puede escribir
  sin volver arriba aunque estés repasando el marcador.
- **Dos pestañas** con contador en vivo, *Tus intentos (6)* y *Ranking (2º)*, en lugar de
  una página kilométrica: se ve tu puesto sin desplazarte. En pantallas anchas
  desaparecen y las dos columnas se muestran a la vez.
- **Botón principal anclado abajo** (empezar partida, siguiente ronda), al alcance del pulgar.
- **Vibración** al enviar un intento, más fuerte cuanto más caliente, y un patrón al acertar.
- **Compartir nativo** para invitar, y `manifest.webmanifest` para añadirlo a la pantalla
  de inicio y jugar a pantalla completa.
- Respeta los márgenes seguros (notch, barra inferior) y funciona con el teclado abierto,
  cuando la ventana se queda en 340 px de alto.

## Ajustes de la sala

| Ajuste | Por defecto | Rango |
| --- | --- | --- |
| Rondas | 5 | 1 – 20 |
| Minutos por ronda | 4 | 1 – 15 |
| Jugadores máximo | 20 | 2 – 50 (invitados; el anfitrión va aparte) |
| El anfitrión juega | Sí | desmárcalo para dejar su pantalla de marcador |
| Dificultad | Mezcla | fácil / normal / difícil / mezcla |
| Pistas automáticas | Sí | al 40 %, 65 % y 85 % del tiempo |
| Seguir tras el primer acierto | Sí | si se desactiva, la ronda acaba con el primer ganador |

El anfitrión puede además dar pistas a mano, terminar la ronda antes de tiempo,
expulsar a alguien y reiniciar el marcador para jugar otra partida. El aforo cuenta sólo
a los invitados, así que caben 20 amigos **más** el anfitrión.

Las **pistas** salen en este orden: número de letras → campo semántico → letra inicial
→ tres palabras muy cercanas → últimas dos letras → la palabra con letras alternas.

## Cómo funciona la cercanía

No hay dependencias de IA ni servicios externos: el motor es propio y determinista.

- `server/lexicon.js` — **1816 palabras** en español agrupadas en ~230 campos
  semánticos. Cada grupo aporta etiquetas (`animal`, `felino`, `postre`, `abstracto`…)
  y una palabra hereda las etiquetas de todos los grupos en los que aparece.
- `server/similarity.js` — construye un vector disperso por palabra, **pondera cada
  etiqueta con IDF** (las raras pesan mucho más que las genéricas) y mide la cercanía
  con coseno, más un pequeño componente ortográfico que capta parentescos de forma
  (`pan`/`panadero`). Con la palabra secreta se ordena todo el léxico y esa posición es
  lo que ve el jugador.

Ejemplo real, palabra secreta `urraca`:
`jilguero · pajaro · paloma · canario · mirlo · cigueña · gorrion · cuervo`.

Al escribir se toleran tildes, mayúsculas, plurales, género y diminutivos
(`GATAS` → `gato`, `Árboles` → `arbol`). Las palabras que no están en el léxico se
rechazan sin gastar intento.

### Ampliar el vocabulario

Añade grupos a `GROUPS` en `server/lexicon.js`:

```js
['comida postre dulce azucar', 'tarta pastel helado chocolate'],
```

No hay que tocar nada más: los pesos, las reservas por dificultad y los rankings se
recalculan solos al arrancar.

## Estructura

```
server/
  lexicon.js      léxico español por campos semánticos
  similarity.js   motor de cercanía, normalización y elección de palabra secreta
  game.js         salas, jugadores, rondas, ranking en vivo y puntuación
  index.js        Express + Socket.IO
public/
  index.html      todas las pantallas (inicio, lobby, ronda, resultados, final)
  app.js          cliente
  styles.css      estilos, móvil primero
test/
  juego.test.js   26 pruebas del motor y de la lógica de sala
  e2e.mjs         partida completa por sockets con anfitrión + 20 jugadores
```

## Pruebas

```bash
npm test          # unitarias
npm run test:e2e  # partida real de 20 jugadores contra el servidor
```

## Detalles de implementación

- **Reconexión**: cada jugador guarda un token en `localStorage`; si se le cae el móvil
  o cierra la pestaña, vuelve a su sitio con sus puntos e intentos intactos.
- **Incorporación tardía**: quien entra con la ronda ya empezada juega esa misma ronda con
  el tiempo que quede, en vez de esperar sentado a la siguiente.
- **La palabra secreta nunca viaja** al cliente de nadie que esté jugando durante la ronda
  —tampoco al del anfitrión si participa—; sólo la recibe el anfitrión en modo marcador, y
  todos al cerrarse la ronda.
- Con el anfitrión jugando, el juego reparte tres papeles independientes en la interfaz:
  quien manda (`host-only`), quien juega (`juega-only`) y quien sólo es invitado
  (`invitado-only`). Sus mandos de ronda van fuera del tablero para que sigan a mano
  al cambiar de pestaña en el móvil.
- Las salas abandonadas se limpian solas a los 10 minutos (y cualquier sala a las 3 horas
  de inactividad).
