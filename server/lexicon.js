/**
 * Léxico español organizado por campos semánticos.
 *
 * Cada grupo es un par [etiquetas, palabras]. Ambas partes son cadenas con los
 * elementos separados por espacios. Una palabra puede aparecer en varios grupos:
 * su vector semántico es la unión de las etiquetas de todos los grupos en los
 * que aparece. Cuantos más grupos comparten dos palabras, más cerca están.
 *
 * Las etiquetas van de lo general (`animal`, `comida`) a lo específico
 * (`felino`, `postre`). El motor de similitud pondera cada etiqueta con IDF, así
 * que las etiquetas raras (compartidas por pocas palabras) pesan mucho más que
 * las genéricas.
 */

export const GROUPS = [
  // ─── Animales ──────────────────────────────────────────────────────────────
  ['servivo animal mamifero domestico mascota casa', 'perro gato conejo hamster huron cachorro gatito'],
  ['servivo animal mamifero granja campo util rural', 'vaca cerdo oveja cabra caballo burro mula toro ternero potro'],
  ['servivo animal ave vuela pluma nido', 'pajaro paloma gorrion golondrina cuervo urraca mirlo canario jilguero cigueña'],
  ['servivo animal ave rapaz cazador peligroso', 'aguila halcon buho lechuza buitre azor milano'],
  ['servivo animal ave granja comida corral', 'gallina gallo pato ganso pavo codorniz'],
  ['servivo animal ave exotico color selva', 'loro papagayo tucan flamenco colibri guacamayo'],
  ['servivo animal mamifero salvaje felino peligroso cazador', 'leon tigre leopardo pantera jaguar guepardo lince gato'],
  ['servivo animal mamifero salvaje grande africa sabana', 'elefante jirafa rinoceronte hipopotamo cebra bufalo antilope gacela'],
  ['servivo animal mamifero salvaje bosque europa', 'lobo zorro oso ciervo corzo jabali tejon ardilla erizo comadreja'],
  ['servivo animal mamifero mar nada grande', 'ballena delfin foca orca morsa nutria cachalote'],
  ['servivo animal pez mar nada agua', 'pez tiburon atun sardina salmon merluza bacalao trucha anguila boqueron lenguado'],
  ['servivo animal mar marisco comida concha', 'pulpo calamar cangrejo langosta gamba mejillon almeja ostra sepia'],
  ['servivo animal mar invertebrado', 'medusa estrella coral erizo caracola esponja'],
  ['servivo animal insecto pequeño molesto', 'mosca mosquito hormiga cucaracha pulga piojo garrapata'],
  ['servivo animal insecto vuela jardin', 'abeja avispa mariposa libelula mariquita polilla'],
  ['servivo animal insecto suelo pequeño', 'escarabajo grillo saltamontes gusano oruga ciempies araña'],
  ['servivo animal reptil frio escama', 'serpiente lagarto lagartija cocodrilo caiman tortuga iguana camaleon vibora'],
  ['servivo animal anfibio agua salta', 'rana sapo salamandra triton renacuajo'],
  ['servivo animal mamifero primate selva inteligente', 'mono chimpance gorila orangutan babuino lemur'],
  ['servivo animal mamifero roedor pequeño', 'raton rata ardilla castor topo hamster cobaya'],
  ['servivo animal desierto sequia calor', 'camello dromedario escorpion serpiente buitre'],
  ['servivo animal polo frio hielo nieve', 'pinguino foca reno morsa oso alce'],
  ['servivo animal nocturno vuela cueva', 'murcielago buho lechuza polilla luciernaga'],
  ['animal cuerpo parte', 'cola pata garra pico ala pluma escama pelaje cuerno colmillo hocico bigote'],
  ['animal granja producto comida', 'huevo leche lana miel cuero queso'],
  ['animal grupo conjunto', 'rebaño manada bandada enjambre jauria banco'],
  ['animal vivienda refugio', 'nido madriguera colmena establo jaula corral cuadra'],

  // ─── Plantas y naturaleza ──────────────────────────────────────────────────
  ['servivo planta naturaleza verde crece', 'arbol arbusto hierba cesped musgo helecho matorral seto'],
  ['servivo planta arbol bosque madera alto', 'roble pino abeto olivo sauce alamo abedul castaño haya chopo'],
  ['servivo planta arbol fruto huerto', 'manzano naranjo limonero cerezo almendro higuera palmera vid'],
  ['servivo planta flor bonito olor jardin', 'flor rosa clavel margarita tulipan girasol orquidea amapola lirio jazmin violeta'],
  ['planta parte estructura', 'raiz tronco rama hoja semilla brote fruto espina corteza polen tallo capullo'],
  ['servivo planta hongo bosque comida', 'seta champiñon hongo trufa moho'],
  ['servivo planta desierto espina', 'cactus palmera aloe'],
  ['naturaleza paisaje geografia relieve tierra', 'montaña colina valle llanura meseta acantilado cañon duna cordillera cumbre ladera'],
  ['naturaleza geografia agua rio', 'rio arroyo cascada manantial afluente cauce orilla'],
  ['naturaleza geografia agua mar grande', 'mar oceano golfo bahia estrecho ola marea costa playa'],
  ['naturaleza geografia agua quieta', 'lago laguna charco estanque pantano embalse'],
  ['naturaleza geografia lugar aislado', 'isla peninsula archipielago cabo desierto oasis'],
  ['naturaleza vegetacion densa lugar', 'bosque selva jungla pradera sabana estepa'],
  ['naturaleza clima tiempo cielo agua', 'lluvia nieve granizo llovizna aguacero rocio escarcha'],
  ['naturaleza clima tiempo cielo aire', 'viento brisa rafaga tormenta huracan tornado remolino'],
  ['naturaleza clima cielo visible', 'nube niebla neblina arcoiris rayo trueno relampago cielo'],
  ['naturaleza astro cielo espacio noche luz', 'sol luna estrella planeta cometa galaxia universo eclipse constelacion meteorito'],
  ['naturaleza elemento basico material', 'agua fuego tierra aire'],
  ['naturaleza material suelo mineral', 'piedra roca arena barro polvo tierra grava arcilla'],
  ['naturaleza estado agua frio calor', 'hielo vapor nieve escarcha humedad'],
  ['naturaleza estacion tiempo año ciclo', 'primavera verano otoño invierno'],
  ['naturaleza desastre peligro miedo destruccion', 'terremoto volcan tsunami incendio inundacion avalancha huracan sequia erupcion plaga'],
  ['naturaleza ecologia planeta cuidado', 'medioambiente contaminacion reciclaje basura clima naturaleza bosque energia'],

  // ─── Comida y bebida ───────────────────────────────────────────────────────
  ['comida fruta dulce planta sano', 'manzana pera platano naranja limon mandarina fresa uva sandia melon cereza melocoton piña mango kiwi ciruela higo'],
  ['comida verdura planta huerto sano', 'tomate lechuga zanahoria cebolla ajo patata pimiento pepino calabaza espinaca brocoli guisante berenjena judia acelga'],
  ['comida cereal grano campo', 'trigo arroz maiz avena cebada centeno quinoa harina'],
  ['comida panaderia horno masa', 'pan bollo tostada baguette pasta pizza masa harina'],
  ['comida plato cocina caliente', 'sopa caldo guiso estofado potaje cocido puchero crema'],
  ['comida plato tipico español', 'paella tortilla gazpacho croqueta churro cocido jamon'],
  ['comida plato rapido calle', 'hamburguesa pizza bocadillo sandwich perrito kebab patatas'],
  ['comida postre dulce azucar', 'tarta pastel helado chocolate galleta caramelo flan bizcocho natilla mermelada bombon gominola'],
  ['comida bebida liquido beber sano', 'agua leche zumo batido limonada infusion'],
  ['comida bebida caliente desayuno', 'cafe te chocolate infusion leche'],
  ['comida bebida alcohol fiesta adulto', 'vino cerveza sidra ron whisky champan licor coctel'],
  ['comida carne proteina animal', 'carne pollo ternera cerdo cordero conejo pavo filete chuleta'],
  ['comida embutido cerdo curado', 'jamon chorizo salchichon salami morcilla lomo salchicha'],
  ['comida lacteo leche', 'leche queso yogur mantequilla nata cuajada requeson'],
  ['comida condimento sabor cocina', 'sal pimienta aceite vinagre azucar especia perejil oregano canela laurel'],
  ['comida sabor sensacion gusto', 'dulce salado amargo acido picante soso sabroso'],
  ['comida cocina utensilio casa objeto', 'sarten olla cazuela cuchillo tenedor cuchara plato vaso taza fuente bandeja colador'],
  ['comida cocina aparato calor', 'horno fogon microondas tostadora cafetera parrilla barbacoa'],
  ['comida momento rutina', 'desayuno almuerzo comida merienda cena picoteo aperitivo banquete'],
  ['comida hambre necesidad', 'hambre sed apetito antojo dieta ayuno racion'],

  // ─── Cuerpo y salud ────────────────────────────────────────────────────────
  ['humano cuerpo cabeza cara rostro', 'cabeza cara ojo nariz boca oreja frente mejilla barbilla ceja pestaña labio lengua diente'],
  ['humano cuerpo pelo', 'pelo cabello melena barba bigote flequillo trenza rizo calva'],
  ['humano cuerpo extremidad brazo', 'brazo mano dedo codo hombro muñeca palma puño uña'],
  ['humano cuerpo extremidad pierna andar', 'pierna pie rodilla tobillo muslo talon planta dedo'],
  ['humano cuerpo interno organo vital', 'corazon pulmon higado estomago cerebro riñon intestino vejiga bazo pancreas'],
  ['humano cuerpo estructura interna', 'hueso musculo piel sangre nervio vena arteria esqueleto columna craneo costilla tendon'],
  ['humano cuerpo tronco', 'pecho espalda cintura cadera vientre ombligo cuello hombro'],
  ['humano sentido percepcion', 'vista oido olfato gusto tacto mirada sonido olor sabor'],
  ['humano salud enfermedad malestar', 'fiebre gripe tos resfriado dolor herida cicatriz alergia infeccion mareo nausea'],
  ['humano salud grave enfermedad miedo', 'cancer infarto virus epidemia contagio ictus fractura'],
  ['humano salud medicina hospital cuidado', 'medico enfermera hospital medicina pastilla jeringa vacuna operacion farmacia venda receta consulta ambulancia'],
  ['humano cuerpo accion basica vivir', 'dormir comer beber respirar caminar correr saltar reir llorar hablar mirar escuchar'],
  ['humano cuerpo estado cansancio', 'sueño cansancio fatiga descanso siesta bostezo energia'],
  ['humano higiene limpieza cuerpo', 'ducha baño jabon champu toalla cepillo pasta peine colonia desodorante'],

  // ─── Personas, familia, sociedad ───────────────────────────────────────────
  ['humano familia parentesco amor casa', 'madre padre hijo hija hermano hermana abuelo abuela tio tia primo sobrino nieto cuñado suegra'],
  ['humano familia grupo hogar', 'familia pareja matrimonio boda hogar parentesco linaje apellido'],
  ['humano relacion social amistad', 'amigo vecino compañero colega conocido invitado anfitrion'],
  ['humano relacion amor pareja', 'novio novia esposo esposa amante beso cita amor cariño'],
  ['humano relacion conflicto negativo', 'enemigo rival traidor mentiroso ladron maton'],
  ['humano etapa edad vida', 'bebe niño adolescente joven adulto anciano jubilado recien'],
  ['humano vida ciclo importante', 'nacimiento infancia juventud vejez muerte funeral entierro herencia'],
  ['humano profesion trabajo oficio manual', 'panadero carpintero mecanico fontanero albañil electricista zapatero sastre herrero jardinero'],
  ['humano profesion trabajo servicio publico', 'profesor medico policia bombero cartero conductor basurero soldado enfermera juez'],
  ['humano profesion trabajo oficina empresa', 'jefe secretario contable ingeniero programador vendedor cajero recepcionista abogado economista'],
  ['humano profesion trabajo comida servicio', 'cocinero camarero chef pastelero carnicero pescadero frutero tabernero'],
  ['humano profesion arte creativo', 'actor cantante musico escritor poeta bailarin director fotografo pintor escultor'],
  ['humano profesion campo mar', 'agricultor ganadero pastor pescador marinero minero leñador'],
  ['sociedad politica pais poder', 'pais nacion gobierno presidente ministro alcalde ley voto eleccion partido parlamento'],
  ['sociedad simbolo identidad', 'bandera himno escudo corona moneda idioma cultura tradicion'],
  ['sociedad guerra conflicto violencia miedo', 'guerra soldado ejercito batalla bomba tanque trinchera invasion victoria derrota'],
  ['sociedad arma peligro antiguo', 'espada escudo lanza arco flecha armadura casco daga'],
  ['sociedad arma peligro moderno', 'pistola fusil bala cañon bomba mina granada'],
  ['sociedad paz acuerdo bueno', 'paz tratado alianza acuerdo tregua amistad union'],
  ['sociedad religion fe creencia', 'iglesia dios religion oracion fe alma cielo infierno angel santo pecado milagro'],
  ['sociedad religion lugar edificio', 'iglesia catedral templo mezquita sinagoga monasterio ermita altar campana'],
  ['sociedad justicia ley delito', 'ley juez carcel policia delito robo castigo justicia testigo abogado juicio multa condena'],
  ['sociedad grupo gente multitud', 'gente pueblo multitud publico masa comunidad vecindario tribu clase'],
  ['sociedad problema pobreza', 'pobreza hambre paro crisis desigualdad miseria mendigo refugiado'],

  // ─── Emociones, mente y abstracciones ──────────────────────────────────────
  ['abstracto emocion sentimiento basico', 'alegria tristeza miedo rabia amor odio sorpresa asco ira'],
  ['abstracto emocion positivo bienestar', 'felicidad esperanza cariño ilusion orgullo calma paz gratitud entusiasmo ternura'],
  ['abstracto emocion negativo malestar', 'angustia soledad culpa pena nostalgia ansiedad tristeza vergüenza celos envidia rencor'],
  ['abstracto emocion miedo peligro', 'miedo panico terror susto pavor angustia nervios'],
  ['abstracto virtud valor moral bueno', 'honestidad valentia justicia libertad respeto lealtad bondad paciencia generosidad humildad sinceridad'],
  ['abstracto defecto moral malo', 'mentira egoismo avaricia pereza soberbia crueldad cobardia traicion hipocresia'],
  ['abstracto mente pensamiento idea', 'idea pensamiento memoria recuerdo imaginacion duda razon mente conciencia atencion olvido'],
  ['abstracto sueño deseo futuro', 'sueño deseo meta ambicion proyecto plan futuro destino suerte azar'],
  ['abstracto conocimiento saber', 'saber conocimiento sabiduria ignorancia experiencia talento habilidad genio inteligencia'],
  ['abstracto tiempo medida reloj', 'tiempo hora minuto segundo instante momento rato duracion plazo'],
  ['abstracto tiempo calendario ciclo', 'dia noche semana mes año siglo decada fecha calendario aniversario'],
  ['abstracto tiempo parte dia luz', 'mañana tarde noche madrugada amanecer atardecer mediodia anochecer alba crepusculo'],
  ['abstracto tiempo pasado futuro', 'pasado presente futuro ayer hoy historia recuerdo antigüedad'],
  ['abstracto cantidad numero matematicas', 'numero cero uno dos tres diez cien mil millon mitad doble tercio par'],
  ['abstracto medida unidad ciencia', 'metro kilo litro grado peso altura distancia tamaño volumen area longitud velocidad'],
  ['abstracto verdad misterio secreto', 'secreto misterio pista enigma verdad mentira sospecha rumor engaño adivinanza'],
  ['abstracto suerte azar juego', 'suerte azar destino casualidad fortuna riesgo apuesta oportunidad'],
  ['abstracto orden caos estado', 'orden caos desorden lio calma silencio ruido rutina cambio'],
  ['abstracto problema solucion', 'problema solucion error fallo acierto intento prueba resultado consecuencia'],

  // ─── Casa y objetos ────────────────────────────────────────────────────────
  ['casa habitacion estancia hogar', 'cocina salon dormitorio baño garaje pasillo terraza balcon sotano desvan trastero recibidor'],
  ['casa mueble objeto madera', 'mesa silla sofa cama armario estanteria comoda escritorio taburete banco cuna'],
  ['casa estructura parte', 'puerta ventana pared techo suelo escalera tejado chimenea columna viga'],
  ['casa objeto entrada seguridad', 'llave cerradura timbre buzon felpudo picaporte candado alarma'],
  ['casa textil tela comodidad', 'sabana manta almohada cortina alfombra toalla cojin colcha mantel'],
  ['casa electrodomestico tecnologia util', 'nevera lavadora television microondas aspiradora plancha ventilador estufa lavavajillas secadora'],
  ['casa limpieza orden', 'escoba fregona jabon detergente cubo esponja bayeta basura trapo lejia'],
  ['casa decoracion bonito', 'cuadro jarron espejo lampara planta vela figura reloj estatuilla'],
  ['casa luz iluminacion', 'lampara bombilla vela farol linterna interruptor luz sombra'],
  ['objeto herramienta trabajo manual', 'martillo clavo destornillador sierra taladro tornillo alicates llave lija cinta'],
  ['objeto oficina escuela papel escribir', 'lapiz boligrafo papel cuaderno libro goma regla tijeras pegamento carpeta grapadora rotulador'],
  ['objeto personal pequeño llevar', 'reloj gafas paraguas cartera mochila maleta bolso peine espejo pañuelo monedero'],
  ['objeto contenedor guardar', 'caja bolsa cesta saco bote frasco lata barril maleta bidon'],
  ['objeto cuerda atar', 'cuerda hilo cordon nudo cinta cadena alambre red'],
  ['objeto juguete infancia juego', 'juguete muñeca peluche pelota cometa tobogan columpio patinete triciclo canica'],

  // ─── Ropa ──────────────────────────────────────────────────────────────────
  ['ropa vestir prenda cuerpo', 'camisa camiseta pantalon falda vestido blusa jersey sudadera chaleco mono'],
  ['ropa abrigo frio invierno', 'abrigo chaqueta anorak gabardina bufanda guante gorro jersey'],
  ['ropa pie calzado', 'zapato bota zapatilla sandalia chancla calcetin tacon bota'],
  ['ropa complemento accesorio', 'sombrero gorra cinturon corbata pañuelo bolso gafas guante'],
  ['ropa joya lujo brillo caro', 'anillo collar pulsera pendiente diamante oro plata perla broche'],
  ['ropa interior intimo', 'calzoncillo braga sujetador camiseta pijama bata calcetin'],
  ['ropa tela material coser', 'tela algodon lana seda lino cuero hilo aguja boton cremallera costura'],
  ['ropa baño verano playa', 'bañador bikini toalla chancla gorro gafas'],

  // ─── Transporte y ciudad ───────────────────────────────────────────────────
  ['transporte vehiculo carretera motor', 'coche moto camion autobus furgoneta taxi tractor caravana ambulancia'],
  ['transporte vehiculo sin motor', 'bicicleta patinete monopatin patin carro carretilla trineo'],
  ['transporte vehiculo ferrocarril publico', 'tren metro tranvia autobus vagon locomotora anden'],
  ['transporte vehiculo aire vuela', 'avion helicoptero globo cohete avioneta parapente dron'],
  ['transporte vehiculo agua nada', 'barco barca velero yate canoa balsa submarino ferri lancha'],
  ['transporte parte pieza vehiculo', 'rueda motor volante freno asiento espejo faro matricula neumatico embrague'],
  ['transporte viaje desplazamiento', 'viaje trayecto ruta parada llegada salida billete equipaje pasajero conductor'],
  ['lugar ciudad calle urbano', 'calle plaza avenida acera semaforo cruce esquina rotonda callejon paseo'],
  ['lugar ciudad mobiliario', 'farola banco papelera fuente estatua parque jardin quiosco marquesina'],
  ['lugar edificio publico ciudad', 'escuela hospital museo teatro biblioteca ayuntamiento comisaria estadio piscina polideportivo'],
  ['lugar edificio vivienda', 'casa piso chalet apartamento edificio bloque cabaña granja mansion choza'],
  ['lugar tienda comercio comprar', 'tienda mercado supermercado panaderia farmacia libreria carniceria pescaderia floristeria quiosco'],
  ['lugar ocio salir comer', 'restaurante bar cafeteria taberna discoteca hotel terraza chiringuito'],
  ['lugar viaje transporte infraestructura', 'aeropuerto estacion puerto carretera autopista tunel puente frontera peaje'],
  ['lugar historico edificio antiguo', 'castillo palacio torre muralla catedral ruina piramide templo fortaleza acueducto'],
  ['lugar campo rural tranquilo', 'pueblo aldea granja campo huerto establo molino era'],

  // ─── Dinero y comercio ─────────────────────────────────────────────────────
  ['abstracto dinero economia valor', 'dinero euro moneda billete banco precio sueldo deuda ahorro impuesto prestamo hipoteca'],
  ['abstracto comercio compra venta', 'compra venta cliente factura descuento oferta rebaja negocio empresa tienda mercado caja'],
  ['abstracto riqueza pobreza estado', 'rico pobre lujo fortuna herencia tesoro miseria ruina'],
  ['abstracto trabajo empleo oficina', 'trabajo empleo oficina contrato horario jefe reunion tarea proyecto ascenso despido vacaciones'],

  // ─── Arte y cultura ────────────────────────────────────────────────────────
  ['arte cultura visual crear', 'pintura escultura dibujo cuadro retrato paisaje mural boceto acuarela oleo'],
  ['arte lugar cultura visitar', 'museo galeria exposicion teatro cine auditorio biblioteca'],
  ['arte musica sonido oir', 'musica cancion ritmo melodia nota acorde concierto orquesta coro banda disco'],
  ['arte musica instrumento tocar', 'guitarra piano violin flauta bateria trompeta tambor arpa saxofon acordeon'],
  ['arte literatura libro leer', 'libro novela cuento poema poesia relato pagina capitulo autor lectura biblioteca'],
  ['arte cine pelicula espectaculo', 'cine pelicula documental escena guion camara pantalla actor estreno taquilla'],
  ['arte teatro escenario espectaculo', 'teatro obra escenario telon papel ensayo aplauso publico mascara'],
  ['arte baile movimiento cuerpo', 'baile danza ballet flamenco vals tango coreografia bailarin'],
  ['cultura fiesta celebracion alegria', 'fiesta cumpleaños boda navidad carnaval feria verbena aniversario celebracion brindis'],
  ['cultura fiesta objeto regalo', 'regalo globo tarta vela confeti disfraz mascara adorno guirnalda'],
  ['cultura tradicion antiguo', 'tradicion costumbre leyenda mito cuento folclore refran ritual'],

  // ─── Deporte y juego ───────────────────────────────────────────────────────
  ['deporte juego equipo pelota', 'futbol baloncesto voleibol balonmano rugby beisbol waterpolo'],
  ['deporte individual raqueta', 'tenis padel badminton pingpong squash'],
  ['deporte individual esfuerzo', 'natacion atletismo ciclismo boxeo gimnasia esgrima judo karate escalada surf'],
  ['deporte objeto material', 'pelota balon raqueta porteria red canasta guante casco silbato cronometro'],
  ['deporte competicion premio', 'partido torneo liga campeonato equipo jugador arbitro gol punto medalla trofeo campeon'],
  ['deporte lugar instalacion', 'estadio campo cancha pista gimnasio piscina vestuario grada'],
  ['juego mesa ocio amigos', 'juego ajedrez damas parchis domino cartas dado puzle bingo oca'],
  ['juego videojuego tecnologia ocio', 'videojuego consola mando pantalla nivel personaje partida jugador puntuacion'],

  // ─── Tecnología ────────────────────────────────────────────────────────────
  ['tecnologia aparato electronico util', 'ordenador movil telefono tableta pantalla teclado raton impresora camara altavoz auricular'],
  ['tecnologia internet red digital', 'internet correo pagina red mensaje contraseña archivo programa aplicacion navegador nube servidor'],
  ['tecnologia energia electricidad', 'electricidad bateria cable enchufe bombilla pila corriente carga generador panel'],
  ['tecnologia maquina industria', 'maquina motor robot engranaje palanca turbina fabrica cadena herramienta'],
  ['tecnologia comunicacion mensaje', 'telefono radio television antena señal satelite emisora llamada mensaje'],
  ['tecnologia ciencia futuro', 'robot inteligencia algoritmo dato codigo invento avance laboratorio'],

  // ─── Escuela y ciencia ─────────────────────────────────────────────────────
  ['escuela educacion aprender niño', 'escuela colegio instituto clase aula profesor alumno examen deberes nota pizarra recreo uniforme mochila'],
  ['escuela educacion superior', 'universidad carrera facultad titulo beca tesis apunte matricula graduacion'],
  ['ciencia estudio conocimiento', 'ciencia matematicas fisica quimica biologia geologia astronomia medicina filosofia'],
  ['ciencia estudio humanidades', 'historia geografia literatura arte lengua filosofia arqueologia'],
  ['ciencia metodo investigar', 'experimento teoria hipotesis prueba laboratorio microscopio probeta formula descubrimiento invento'],
  ['ciencia matematicas operacion numero', 'suma resta multiplicacion division ecuacion resultado calculo porcentaje fraccion raiz'],
  ['ciencia materia atomo microscopico', 'atomo molecula celula bacteria gen adn particula electron'],

  // ─── Colores, formas, cualidades ───────────────────────────────────────────
  ['color visual claro', 'blanco amarillo rosa beige dorado plateado'],
  ['color visual oscuro', 'negro marron gris morado azul'],
  ['color visual vivo', 'rojo azul verde amarillo naranja morado violeta turquesa'],
  ['forma geometria dibujo', 'circulo cuadrado triangulo rectangulo rombo ovalo linea punto curva espiral'],
  ['forma geometria volumen', 'esfera cubo cono cilindro piramide prisma'],
  ['cualidad tamaño medida', 'grande pequeño enorme diminuto alto bajo largo corto ancho estrecho gordo delgado'],
  ['cualidad temperatura sensacion', 'caliente frio templado helado ardiente tibio gelido'],
  ['cualidad velocidad movimiento', 'rapido lento veloz quieto inmovil ligero pesado'],
  ['cualidad estado conservacion', 'nuevo viejo limpio sucio lleno vacio roto entero antiguo moderno'],
  ['cualidad fuerza resistencia', 'fuerte debil duro blando rigido flexible resistente fragil'],
  ['cualidad luz vision', 'luz sombra oscuridad brillo claro oscuro reflejo destello penumbra'],
  ['cualidad sonido oir', 'ruido silencio eco grito susurro murmullo estruendo melodia zumbido'],
  ['cualidad textura tacto', 'suave aspero liso rugoso mojado seco pegajoso resbaladizo'],
  ['cualidad belleza aspecto', 'bonito feo guapo elegante sencillo llamativo brillante opaco'],
  ['cualidad dificultad', 'facil dificil complicado sencillo imposible posible'],

  // ─── Materiales ────────────────────────────────────────────────────────────
  ['material sustancia solido', 'madera metal hierro acero plastico cristal papel carton piedra goma'],
  ['material metal valioso brillo', 'oro plata bronce cobre platino hierro acero aluminio'],
  ['material construccion obra', 'ladrillo cemento hormigon teja viga yeso pintura andamio arena'],
  ['material liquido fluido', 'agua aceite leche gasolina alcohol pintura tinta sangre zumo'],

  // ─── Comunicación y lenguaje ───────────────────────────────────────────────
  ['comunicacion lenguaje palabra hablar', 'palabra frase idioma lengua voz acento discurso conversacion dialogo pregunta respuesta'],
  ['comunicacion escrito mensaje', 'carta mensaje nota postal correo firma sobre sello telegrama'],
  ['comunicacion medio noticia', 'periodico noticia revista radio television reportaje entrevista titular prensa'],
  ['comunicacion expresion gesto', 'sonrisa gesto mirada abrazo beso saludo despedida guiño señal'],

  // ─── Acciones y movimiento ─────────────────────────────────────────────────
  ['accion movimiento desplazar', 'andar correr saltar subir bajar entrar salir volver huir perseguir'],
  ['accion movimiento cuerpo', 'girar empujar tirar levantar caer sentarse tumbarse agacharse estirar'],
  ['accion crear hacer', 'construir crear hacer fabricar dibujar escribir cocinar coser pintar reparar'],
  ['accion destruir romper', 'romper destruir quemar cortar rasgar aplastar derribar borrar'],
  ['accion dar recibir', 'dar recibir prestar regalar vender comprar cambiar compartir robar devolver'],
  ['accion sentido percibir', 'ver mirar oir escuchar tocar oler probar sentir notar'],
  ['accion comunicar decir', 'hablar decir contar preguntar responder gritar susurrar cantar leer escribir'],
  ['accion mente pensar', 'pensar recordar olvidar aprender entender imaginar decidir dudar creer soñar'],
];

/**
 * Palabras que nunca deberían salir como palabra secreta (demasiado abstractas,
 * ambiguas o difíciles de adivinar), aunque sí valen como intento.
 */
export const NO_SECRETO = new Set([
  'uno', 'dos', 'tres', 'diez', 'cien', 'mil', 'cero', 'par', 'mitad', 'doble', 'tercio',
  'hoy', 'ayer', 'posible', 'imposible', 'recien', 'sencillo', 'facil', 'dificil',
  'hacer', 'dar', 'ver', 'ir', 'notar', 'creer', 'plana',
]);

/** Etiquetas que marcan una palabra como "fácil" (concreta y cotidiana). */
export const TAGS_FACIL = [
  'animal', 'comida', 'fruta', 'verdura', 'casa', 'ropa', 'color', 'mueble',
  'transporte', 'cuerpo', 'juguete', 'mascota', 'bebida', 'postre',
];

/** Etiquetas que marcan una palabra como "difícil" (abstracta). */
export const TAGS_DIFICIL = [
  'abstracto', 'cualidad', 'sociedad', 'ciencia', 'religion', 'politica',
  'economia', 'moral', 'virtud', 'mente',
];
