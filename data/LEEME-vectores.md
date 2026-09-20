# Vectores semánticos

`vectores.bin` son los vectores de **ConceptNet Numberbatch 19.08** recortados a las
palabras del léxico del juego, normalizados y cuantizados a un byte por dimensión
(2245 palabras × 300 dimensiones, 679 KB).

Se regenera con:

```bash
node scripts/construir-vectores.mjs
```

La primera vez descarga los vectores multilingües (3 GB comprimidos) y deja en esta
carpeta `numberbatch-es.txt` como caché, que **no se versiona** (600 MB). El fichero
`vectores.bin` sí está en el repositorio, así que para jugar no hace falta descargar
nada.

## Licencia y atribución

ConceptNet Numberbatch se publica bajo **[CC BY-SA 4.0][cc]**, e incluye datos de
ConceptNet 5, word2vec (Google), GloVe (Stanford), OpenSubtitles y fastText (Meta).

> Speer, Robyn, Joshua Chin, and Catherine Havasi (2017).
> *ConceptNet 5.5: An Open Multilingual Graph of General Knowledge.*
> AAAI 2017. <https://github.com/commonsense/conceptnet-numberbatch>

Esto tiene una consecuencia práctica que conviene tener presente: **`vectores.bin` es
obra derivada**, así que se distribuye también bajo CC BY-SA 4.0, conservando esta
atribución. El código del juego sigue siendo MIT; sólo este fichero de datos arrastra
la licencia compartida.

Si algún día eso estorbase, el juego funciona sin él: si `vectores.bin` no está,
`server/similarity.js` usa únicamente el léxico escrito a mano, que es MIT entero. Se
pierde calidad en las relaciones de asociación (la posición media en el banco de
pruebas pasa de 13 a 18), pero nada deja de funcionar.

[cc]: https://creativecommons.org/licenses/by-sa/4.0/
