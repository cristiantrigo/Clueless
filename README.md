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

- **Anfitrión**: abre la web, pulsa *Crear sala nueva* y proyecta la pantalla (la vista
  del anfitrión es un marcador grande pensado para una tele). No juega: ve la palabra
  secreta y controla rondas y pistas.
- **Jugadores**: entran en la misma dirección, meten el código de 6 cifras y su nombre.
  También sirve el enlace directo `.../?sala=123456` que copia el botón *Copiar enlace*.

Para jugar entre varios dispositivos de la misma red basta con que los demás abran la
IP local del anfitrión (`http://192.168.x.x:3000`). Para jugar por internet, despliega
en cualquier servicio que soporte Node y WebSockets (Render, Railway, Fly.io, un VPS…):
sólo necesita `npm start` y la variable `PORT`.

## Ajustes de la sala

| Ajuste | Por defecto | Rango |
| --- | --- | --- |
| Rondas | 5 | 1 – 20 |
| Minutos por ronda | 4 | 1 – 15 |
| Jugadores máximo | 20 | 2 – 50 |
| Dificultad | Mezcla | fácil / normal / difícil / mezcla |
| Pistas automáticas | Sí | al 40 %, 65 % y 85 % del tiempo |
| Seguir tras el primer acierto | Sí | si se desactiva, la ronda acaba con el primer ganador |

El anfitrión puede además dar pistas a mano, terminar la ronda antes de tiempo,
expulsar a alguien y reiniciar el marcador para jugar otra partida.

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
  juego.test.js   22 pruebas del motor y de la lógica de sala
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
- **La palabra secreta nunca viaja** al cliente de un jugador durante la ronda; sólo la
  recibe el anfitrión y todos al cerrarse la ronda.
- Las salas abandonadas se limpian solas a los 10 minutos (y cualquier sala a las 3 horas
  de inactividad).
