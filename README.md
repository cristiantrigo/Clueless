# Clueless Party 🔎

Juego multijugador en español al estilo de [Clueless](https://lessgames.com/clueless) /
Contexto, pero **en sala compartida tipo Kahoot**: el anfitrión abre una sala con
código de 6 cifras, hasta 20 amigos entran desde el móvil y todos ven en directo
**quién se está acercando más** a la palabra secreta. Gana quien la acierte primero.

## Cómo se juega

1. Hay una **palabra secreta** en español. Cada jugador escribe la palabra que quiera.
2. El juego responde con la **posición** de esa palabra en el ranking de cercanía
   semántica a la secreta: la **#1** es la palabra buscada, la **#13.582** es lo más
   lejano que hay.
3. `#847` es 🧊 frío · `#180` es 🙂 templado · `#31` es 🌶️ caliente · `#4` es 🔥 ardiendo.
4. Un **marcador en vivo** ordena a todos los jugadores por su mejor posición: se ve
   en tiempo real quién va ganando terreno.
5. Al cerrar la ronda se revela **lo que probó cada uno**. Durante el juego los intentos
   son privados, pero al terminar son la mejor parte de la partida.
6. El primero en acertar se lleva 1000 puntos, el segundo 800, el tercero 640… y quien
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
2. Espera a que cargue el editor. Se instalan las dependencias, se intenta poner el
   puerto en público y arranca el servidor. En la terminal aparece un recuadro con la
   **dirección para repartir** y si el puerto quedó público o no.
3. Si el recuadro dice `PRIVADA`, hay que cambiarlo a mano. Lo más rápido en el móvil es
   abrir otra terminal y ejecutar:

   ```bash
   gh codespace ports visibility 3000:public --codespace $CODESPACE_NAME
   ```

   Por interfaz: menú ☰ (arriba a la izquierda) → **View** → **Command Palette** → escribe
   `ports` → **Ports: Focus on Ports View**. Aparece abajo, junto a TERMINAL. Mantén
   pulsada la fila del puerto 3000 → *Port Visibility* → *Public*.
4. Reparte la dirección `https://…-3000.app.github.dev`. Esa es la sala.

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

> **Vercel funciona a medias, y no se recomienda.** Admite WebSockets y el repositorio
> trae `vercel.json` y `api/index.js` para desplegarlo ahí, pero sus funciones tienen un
> tope de duración (`maxDuration`, 300 s como máximo en el plan gratuito) y la conexión
> vive dentro de la invocación: **cada pocos minutos se corta a todo el mundo en mitad de
> la partida**, y si además se recicla la instancia, las salas —que viven en su memoria—
> desaparecen. Para que fuese estable habría que mover el estado a Redis (Upstash) con el
> adaptador de Socket.IO. Con un proceso persistente (Render, Railway, Fly.io) no pasa
> nada de esto.

### Que no se duerma

El plan gratuito de Render **apaga el servicio tras 15 minutos sin recibir ninguna
petición**, y volver a encenderlo tarda entre 30 y 60 segundos: quien abra la URL en ese
rato se encuentra la pantalla de carga de Render y se cree que el juego está roto. Como
el juego se convoca por sorpresa —y no siempre lo convoca quien lo mantiene—, no vale
con "entra tú primero a despertarlo". Hay dos capas para que nunca haga falta:

1. **Auto-ping del propio proceso** (`server/despierto.js`). Mientras está vivo, se llama
   a sí mismo por su URL pública cada 5 minutos. La petición sale a internet y vuelve a
   entrar por el balanceador, así que cuenta como tráfico y la cuenta atrás no llega
   nunca a los 15. Se activa solo cuando existe `RENDER_EXTERNAL_URL` (Render la publica)
   o `URL_PUBLICA`; en local no hace nada.
2. **Cron externo** (`.github/workflows/despertador.yml`). Llama a `/api/salud` cada 5
   minutos desde GitHub Actions. Es la única capa que puede despertarlo **cuando ya está
   apagado** (tras un despliegue o una caída), cosa que el auto-ping no puede hacer por
   sí mismo, porque un proceso dormido no se llama. El repositorio es público, así que
   esos minutos de Actions no se cobran.

   > Los `cron` de Actions son *best effort*: GitHub los retrasa cuando hay cola y un
   > horario recién creado puede tardar en darse de alta. Por eso el peso lo lleva el
   > auto-ping, que es un temporizador nuestro y sí es puntual; el cron es la red de
   > seguridad para el rato en que el proceso no está vivo para pingarse. Se puede
   > lanzar a mano desde la pestaña *Actions* → *Despertador* → *Run workflow*.

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `URL_PUBLICA` | `RENDER_EXTERNAL_URL` | URL por la que se llega al servicio. |
| `PING_CADA_MS` | `300000` (5 min) | Cada cuánto se llama a sí mismo. |

Y la URL del cron se cambia sin tocar el código, en *Settings → Secrets and variables →
Actions → Variables*, con la variable `URL_JUEGO`.

> **Dos avisos.**
> El plan gratuito de Render da **750 horas de instancia al mes** y un mes tiene unas
> 730, así que un servicio despierto a todas horas cabe, pero **sólo si es el único
> servicio gratuito de la cuenta**; con dos se pasa del cupo. Si hiciera falta recortar,
> basta con limitar el `cron` a la franja en la que se juega (p. ej. `*/5 8-23 * * *`).
> Y GitHub **desactiva los crons de un repositorio que pasa 60 días sin commits**: si el
> juego se queda parado meses, hay que reactivarlo desde la pestaña *Actions*.

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

Los umbrales de 🔥/🌶️/🙂/💨/🧊 se escalan con el tamaño del vocabulario, así que
significan lo mismo si el léxico crece.

Las **pistas** salen en este orden: número de letras → campo semántico → letra inicial
→ tres palabras muy cercanas → últimas dos letras → la palabra con letras alternas.

## Cómo funciona la cercanía

El motor es determinista y no llama a ningún servicio: suma **dos fuentes que se
compensan**, un léxico escrito a mano y unos vectores semánticos descargados una vez.

- **Vocabulario jugable: 13.582 palabras.** Se puede escribir casi cualquier palabra
  corriente del español.
- `server/lexicon.js` — **2249 palabras** en español agrupadas en ~350 campos
  semánticos. Cada grupo aporta etiquetas (`animal`, `felino`, `postre`, `abstracto`…)
  y una palabra hereda las etiquetas de todos los grupos en los que aparece.
- `server/similarity.js` — construye un vector disperso por palabra, **pondera cada
  etiqueta con IDF** (las raras pesan mucho más que las genéricas) y mide la cercanía
  con coseno. Con la palabra secreta se ordena todo el léxico y esa posición es lo que
  ve el jugador.
- `data/vectores.bin` — vectores de **ConceptNet Numberbatch** para todo el vocabulario,
  cuantizados a un byte por dimensión (7 MB). Ver [`data/LEEME-vectores.md`](data/LEEME-vectores.md).

### El vocabulario grande hay que curarlo, o estropea el juego

Un vocabulario sacado en bruto de una lista de frecuencia es injugable. Con `ventana`
secreta, los vecinos más cercanos salían así:

```
ventanas, ventanilla, ventanillas, vidriera, windows, escaparate, escaparates, …
```

Escribes `ventanas` y estás en el puesto #1 sin haber adivinado nada. De las 30.000
candidatas por frecuencia, **más de la mitad era ruido**: 8.371 flexiones de otra palabra
que ya estaba, 5.813 conjugaciones y 4.075 extranjerismos. El vocabulario final es más
pequeño que uno sin curar y sin embargo acepta más intentos reales: de 25 palabras que
alguien escribiría jugando con `ventana`, éste admite 23 y uno de 25.000 sin filtrar
admitía 22.

Las conjugaciones no se cazan con una lista de sufijos. Con `quemar` de palabra secreta,
los ocho vecinos más cercanos eran `queman, quemaran, quemare, quemaria, quemarlo,
quemarte, quemo, quemandose`: la ronda regalada. El filtro se ancla en el infinitivo —una
palabra es conjugación si se construye sobre un infinitivo que está en el vocabulario— y
además **exige que el vector lo confirme**, porque muchísimos sustantivos coinciden con
una forma verbal: `casa` lo es de `casar`, `juego` de `jugar` y `cuenta` de `contar`, y
ninguno puede perderse. Los participios se dejan fuera a propósito: `llamada`, `bebida`,
`entrada` y `salida` son sustantivos de pleno derecho. `scripts/construir-vectores.mjs`
los filtra, y además **fusiona las variantes de género** —`gata` con `gato`— usando el
propio coseno para decidirlo, porque a ciegas no se puede: las variantes reales rondan
0,85-0,93 y palabras distintas como `casa`/`caso` o `rata`/`rato` no pasan de 0,2. Así
se fusionaron 1.547 sin perder ninguna palabra legítima.

La **palabra secreta sale siempre del léxico escrito a mano**, que es el que garantiza
que sea adivinable y tenga vecindario para dar pistas. El vocabulario grande sólo sirve
para que el jugador pueda escribir lo que quiera.

### Por qué dos fuentes y no una

Cada una sabe lo que a la otra se le escapa, y medirlo por separado lo dejó claro:

| sobre el banco de 44 pares | posición media | peor impostora |
| --- | --- | --- |
| sólo el léxico escrito a mano | 20 | #1018 ✅ |
| sólo Numberbatch | 26 | #46 ❌ |
| **mezcla al 50 %** | **13** | #1186 ✅ |

El léxico manda en la **taxonomía** —el todo y sus partes, el género y sus especies— y
es inmune al parecido ortográfico porque las relaciones están escritas a mano. Los
vectores traen la **asociación del mundo real**, que a un léxico a mano no le cabe: que
la miel va con la abeja (#76 → #12), el invierno con la nieve (#68 → #16) o la cama con
dormir (#14 → #3).

Los vectores arrastran un defecto conocido: acercan palabras por escribirse parecido
(para ellos `rato` está a doce puestos de `gato`). Por eso la mezcla lleva una guarda.
Una cercanía es real si **el léxico relaciona las dos palabras** o si **el coseno pasa de
0,35**; si no hay ninguna de las dos pruebas y encima se escriben parecido, se recorta al
10 %. Ese segundo criterio es lo que deja funcionar la guarda también fuera del léxico:
los parientes morfológicos de verdad (`ventana`/`ventanilla` 0,88, `vidrio`/`vidriera`
0,61, `pan`/`panadería` 0,61) se conservan, y las impostoras (`pino`/`pito` 0,10,
`mar`/`mal` 0,01) se van al fondo.

Si `data/vectores.bin` no está, el juego arranca igual usando sólo el léxico.

**Una palabra pertenece a su propio campo.** Si una palabra da nombre a un campo
semántico, el motor se la asigna como etiqueta: el nombre de una categoría es su
prototipo. Sin esto, `casa` no compartía ni una sola etiqueta con `ventana` —el todo
desconectado de sus partes, y el género de sus especies— y salía en el puesto #857.
Ahora está en el #14.

**Los campos genéricos están separados por dominio.** Etiquetas como `parte` o
`estructura` unían la ventana de una casa con el polen de una flor y la manga de una
camisa, y los vecinos de `ventana` eran `espina, tallo, polen, semilla`. Cada dominio
tiene la suya (`partecasa`, `parteplanta`, `parteanimal`…), así que ahora salen
`persiana, vidriera, puerta, cristal, balcón`.

**El parecido de las letras no acerca por sí solo.** Si dos palabras no comparten nada
de significado, escribirse parecido no suma: con la secreta `rojo`, `roto` cae al
puesto #1918 y `rosa` se queda en el #16, que es lo razonable. El parecido de forma
sólo actúa como empujón entre palabras que ya están emparentadas, para juntar familias
de una misma raíz. Las relaciones de verdad —`pan` con `panadero` y `panadería`— se
declaran en el léxico, no se deducen de la ortografía.

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
  juego.test.js   35 pruebas del motor y de la lógica de sala
  banco.mjs       banco de sentido común: mide 44 pares que cualquiera relacionaría
  e2e.mjs         partida completa por sockets con anfitrión + 20 jugadores
  sesion.mjs      recarga, reconexión y salida, en un navegador de verdad
  reinicio.mjs    mata el servidor en mitad de una partida y comprueba que vuelve
```

## Pruebas

```bash
npm test          # unitarias
npm run test:e2e  # partida real de 20 jugadores contra el servidor
npm run test:reinicio  # una partida en curso sobrevive a un SIGTERM
npm run banco     # calidad de las relaciones: posición media de 44 pares evidentes
npm run vectores  # regenera data/vectores.bin desde ConceptNet (sólo al ampliar el léxico)
```

El banco es la red de seguridad del motor: mide dónde cae cada par que cualquiera
relacionaría (`ventana`/`casa`, `coche`/`rueda`, `miel`/`abeja`…). Da el resultado en
**percentil**, porque la posición bruta no se puede comparar entre vocabularios de
distinto tamaño: el puesto 50 entre 23.000 palabras es mucho mejor que entre 2.200.

| | percentil medio | pares fuera del 2 % superior |
| --- | --- | --- |
| antes de todas las revisiones | 7,3 % | 10 de 44 |
| sólo el léxico curado | 0,58 % | 0 |
| **hoy** | **0,26 %** | **0** |

## Detalles de implementación

- **Las salas sobreviven a un reinicio.** El estado se vuelca a disco cada 10 s y al
  recibir `SIGTERM`, que es lo que llega en un despliegue, y se recupera al arrancar: la
  ronda sigue donde estaba, con sus intentos, sus puntos y su temporizador rearmado (o
  cerrada, si el tiempo se pasó mientras el servidor estaba caído). El ranking de la
  ronda no se guarda —serían megas— y se recalcula en 50 ms desde la palabra secreta.
  Se desactiva con `RUTA_ESTADO=no`.

  > **En el plan gratuito de Render esto no protege**, porque su sistema de ficheros es
  > [efímero](https://render.com/docs/free) y se borra en cada despliegue, reinicio o
  > suspensión, y ese plan [no admite disco persistente](https://render.com/docs/disks).
  > Sí funciona en un VPS, en Railway con volumen, en Render de pago con disco, y en local.

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
