interface LessonTranslation {
  instrument: string;
  title: string;
  body: string[];
  practice: string;
}

export const spanishLessons: Record<string, LessonTranslation> = {
  "guitar-1": {
    instrument: "Guitarra",
    title: "Afinación y postura de la guitarra",
    body: [
      "Una guitarra estándar tiene seis cuerdas. De la más gruesa (grave) a la más fina (aguda), se afinan en Mi, La, Re, Sol, Si, Mi.",
      "Usa un afinador de pinza o una aplicación gratuita. Toca una cuerda a la vez y gira su clavija hasta que el afinador muestre la nota correcta. Afina hacia la nota desde abajo para que se mantenga mejor.",
      "Siéntate con la espalda recta y apoya el cuerpo de la guitarra sobre la pierna. Mantén el pulgar de la mano que pisa las cuerdas detrás del mástil y la muñeca relajada.",
    ],
    practice: "Afina las seis cuerdas; después tócalas lentamente y escucha si suenan claras, sin zumbidos.",
  },
  "guitar-2": {
    instrument: "Guitarra",
    title: "Tus dos primeros acordes: Em y Am",
    body: [
      "Mi menor (Em): coloca el dedo medio en el segundo traste de la cuerda La y el anular en el segundo traste de la cuerda Re. Rasguea las seis cuerdas.",
      "La menor (Am): coloca el índice en el primer traste de la cuerda Si, el medio en el segundo traste de Re y el anular en el segundo traste de Sol. Rasguea desde la cuerda La hacia abajo.",
      "Presiona justo detrás del traste, cerca de la barra metálica. Si una cuerda zumba o suena apagada, comprueba que ningún dedo esté tocando la cuerda vecina.",
    ],
    practice: "Alterna entre Em y Am durante un minuto, despacio. Busca notas claras antes de intentar tocar rápido.",
  },
  "guitar-3": {
    instrument: "Guitarra",
    title: "Un patrón de rasgueo constante",
    body: [
      "Rasguear consiste en mover la mano arriba y abajo con regularidad, incluso cuando omites una cuerda.",
      "Prueba este patrón: abajo, abajo, arriba, arriba, abajo, arriba. Cuenta: 1, 2 y, y, 4 y. Mantén la muñeca suelta y deja que el brazo acompañe el movimiento.",
      "Usa la caja de ritmos del Estudio como metrónomo a 70 BPM para aprender a mantener el pulso.",
    ],
    practice: "Toca el patrón con Em durante dos minutos y luego con Am otros dos, sin detener el movimiento de la mano.",
  },
  "piano-1": {
    instrument: "Piano",
    title: "Cómo orientarte en las teclas",
    body: [
      "Las teclas negras aparecen en grupos de dos y tres. La tecla blanca justo a la izquierda de cada grupo de dos negras es Do.",
      "El Do más cercano al centro del teclado se llama Do central. Los demás Dos están a una octava de distancia.",
      "Numera los dedos del 1 al 5 empezando por el pulgar. Mantén las manos curvas, como si sostuvieras una pelota pequeña.",
    ],
    practice: "Encuentra cada Do del teclado y tócalos con el pulgar derecho.",
  },
  "piano-2": {
    instrument: "Piano",
    title: "La escala de Do mayor",
    body: [
      "La escala de Do mayor solo usa teclas blancas: Do, Re, Mi, Fa, Sol, La, Si y luego Do.",
      "Para la mano derecha, usa los dedos 1, 2 y 3; pasa el pulgar por debajo para tocar Fa con el dedo 1 y continúa con 2, 3, 4 y 5.",
      "Toca despacio y de manera uniforme. Cada nota debe tener un volumen y una duración parecidos.",
    ],
    practice: "Toca la escala hacia arriba y hacia abajo cinco veces con la mano derecha, intentando sonar más fluido en cada vuelta.",
  },
  "piano-3": {
    instrument: "Piano",
    title: "Cómo formar acordes: tríadas",
    body: [
      "Una tríada son tres notas apiladas en intervalos de tercera. Do mayor es Do, Mi y Sol. Sol mayor es Sol, Si y Re.",
      "Toca las tríadas con los dedos 1, 3 y 5. La menor es La, Do y Mi; Fa mayor es Fa, La y Do.",
      "Do, Sol, Lam y Fa forman una de las progresiones de acordes más comunes de la música popular.",
    ],
    practice: "Toca Do, Sol, Lam y Fa en orden con la mano derecha; mantén cada acorde durante cuatro pulsos lentos.",
  },
  "bass-1": {
    instrument: "Bajo",
    title: "Cuerdas, postura y pulsación",
    body: [
      "Un bajo estándar de cuatro cuerdas se afina Mi, La, Re, Sol, de la más gruesa a la más fina. Son las cuatro cuerdas más graves de una guitarra, una octava más abajo.",
      "Pulsa alternando los dedos índice y medio. Apoya el pulgar en la pastilla o en la cuerda Mi para mantener la mano estable.",
      "Mantén los dedos de la mano que pisa las cuerdas cerca de los trastes y relaja la mano que pulsa.",
    ],
    practice: "Toca cada cuerda al aire ocho veces alternando los dedos; procura mantener el mismo volumen.",
  },
  "bass-2": {
    instrument: "Bajo",
    title: "Notas fundamentales y ritmo",
    body: [
      "La función principal del bajo es tocar la nota fundamental de cada acorde y coordinarse con el bombo.",
      "En la progresión Do, Sol, Lam, Fa, las fundamentales son: Do en el tercer traste de La, Sol en el tercer traste de Mi, La en la cuerda La al aire y Fa en el primer traste de Mi.",
      "Empieza tocando una nota por pulso. El ritmo importa más que las notas complicadas.",
    ],
    practice: "Toca Do, Sol, Lam y Fa con cuatro pulsos por nota fundamental, junto con el ritmo de batería del Estudio.",
  },
  "bass-3": {
    instrument: "Bajo",
    title: "Octavas para darle movimiento",
    body: [
      "Una octava es la misma nota en una altura más aguda. En el bajo puedes encontrarla dos cuerdas más arriba y dos trastes más adelante.",
      "Por ejemplo, el Sol del tercer traste de la cuerda Mi tiene su octava en el quinto traste de la cuerda Re.",
      "Alternar entre la fundamental y su octava añade energía sin cambiar la armonía.",
    ],
    practice: "Toca fundamental, octava, fundamental, octava en cada acorde de Do, Sol, Lam y Fa.",
  },
  "drums-1": {
    instrument: "Batería",
    title: "Conoce la batería y sujeta las baquetas",
    body: [
      "Una batería básica tiene bombo (se toca con el pie derecho), caja, hi-hat y algunos toms y platillos.",
      "Sujeta cada baqueta entre el pulgar y el índice, aproximadamente a un tercio de la distancia desde el extremo. Deja los demás dedos relajados y permite que la baqueta rebote.",
      "Siéntate erguido y relaja los hombros para tocar durante más tiempo sin tensarte.",
    ],
    practice: "Golpea la caja lentamente durante un minuto, dejando que la baqueta rebote y contando en voz alta.",
  },
  "drums-2": {
    instrument: "Batería",
    title: "Tu primer ritmo de rock",
    body: [
      "Toca el hi-hat en cada corchea, el bombo en los pulsos 1 y 3, y la caja en los pulsos 2 y 4.",
      "Cuenta: 1 y 2 y 3 y 4 y. El hi-hat suena en cada número y en cada «y».",
      "Empieza cerca de 60 BPM y aumenta la velocidad solo cuando el patrón te resulte fácil.",
    ],
    practice: "Toca el ritmo durante dos minutos a 60 BPM y luego súbelo 5 BPM.",
  },
  "drums-3": {
    instrument: "Batería",
    title: "Un relleno sencillo",
    body: [
      "Un relleno es una pausa breve del ritmo que anuncia un cambio, normalmente al final de una frase musical.",
      "Prueba esto: toca el ritmo normal durante tres pulsos y luego golpea la caja cuatro veces entre el pulso 4 y el «y» que lleva al pulso 1.",
      "Entra en el siguiente compás con un platillo crash y el bombo en el pulso 1.",
    ],
    practice: "Toca tres compases del ritmo de rock, añade un relleno y repite durante dos minutos.",
  },
  "ukulele-1": {
    instrument: "Ukelele",
    title: "Afinación y postura del ukelele",
    body: [
      "Un ukelele estándar tiene cuatro cuerdas afinadas Sol, Do, Mi, La. La cuerda Sol está afinada más aguda que la cuerda Do, lo que da al ukelele su sonido brillante.",
      "Usa un afinador de pinza y afina cada cuerda hacia la nota. Apoya el ukelele contra el pecho con el antebrazo que rasguea y sujeta el mástil suavemente con la otra mano.",
      "Relaja la mano que pisa las cuerdas. Basta con presionar un poco detrás del traste.",
    ],
    practice: "Afina las cuatro cuerdas y tócalas despacio para escuchar un sonido claro.",
  },
  "ukulele-2": {
    instrument: "Ukelele",
    title: "Tres acordes fáciles: C, Am y F",
    body: [
      "Do mayor necesita un dedo: coloca el anular en el tercer traste de la cuerda La (la más cercana al suelo). Rasguea las cuatro cuerdas.",
      "La menor (Am) también usa un dedo: coloca el dedo medio en el segundo traste de la cuerda Sol.",
      "Fa mayor usa dos dedos: el medio en el segundo traste de Sol y el índice en el primer traste de Mi.",
    ],
    practice: "Cambia entre Do, Lam y Fa, mantén cada acorde durante cuatro pulsos lentos y repite durante dos minutos.",
  },
  "ukulele-3": {
    instrument: "Ukelele",
    title: "El rasgueo isleño",
    body: [
      "Un rasgueo clásico de ukelele es: abajo, abajo-arriba, arriba-abajo-arriba. Mantén la mano en movimiento aunque no toques las cuerdas.",
      "Rasguea con el índice o con la parte blanda del pulgar, usando la muñeca relajada.",
      "Pruébalo con Do, Lam y Fa junto con el ritmo del Estudio, cerca de 80 BPM.",
    ],
    practice: "Toca el patrón durante cuatro compases en cada acorde y cambia sin detener el movimiento de la mano.",
  },
  "violin-1": {
    instrument: "Violín",
    title: "Postura, sujeción y afinación",
    body: [
      "El violín tiene cuatro cuerdas afinadas Sol, Re, La, Mi, de grave a aguda; cada cuerda está a una quinta de la siguiente.",
      "Apoya el violín en la clavícula izquierda y coloca la barbilla en la mentonera. La mano izquierda sujeta el mástil sin apretar y los hombros permanecen relajados.",
      "Usa un afinador para ajustar primero la cuerda La y luego las demás. Si estás empezando, pide ayuda a un profesor o a una tienda para evitar romper una cuerda.",
    ],
    practice: "Pulsa suavemente cada cuerda al aire con el índice derecho y compárala con un afinador.",
  },
  "violin-2": {
    instrument: "Violín",
    title: "Sujetar el arco y tocar cuerdas al aire",
    body: [
      "Sujeta el arco con la mano relajada y curva. Dobla el pulgar, curva los dedos sobre la vara y apoya el meñique encima.",
      "Coloca el arco a medio camino entre el puente y el diapasón y deslízalo recto, paralelo al puente.",
      "Haz movimientos largos y lentos. Deja que el peso del brazo produzca el sonido, sin apretar.",
    ],
    practice: "Toca la cuerda La con arcos largos: cuatro pulsos hacia abajo y cuatro hacia arriba, durante dos minutos.",
  },
  "violin-3": {
    instrument: "Violín",
    title: "Tus primeras notas en la cuerda La",
    body: [
      "En la cuerda La, la cuerda al aire es La. El primer dedo toca Si, el segundo Do sostenido y el tercero Re.",
      "El segundo y el tercer dedo van cerca uno del otro porque la distancia entre Do sostenido y Re es menor. Unas marcas adhesivas pueden ayudarte a encontrar las posiciones.",
      "Escucha con atención y ajusta cada dedo hasta que la nota suene afinada.",
    ],
    practice: "Toca La, Si, Do sostenido y Re lentamente hacia arriba y hacia abajo, escuchando cada nota durante tres minutos.",
  },
  "vocals-1": {
    instrument: "Voz",
    title: "Postura y respiración",
    body: [
      "Ponte de pie con la espalda erguida, los hombros relajados y los pies separados al ancho de las caderas. Imagina que un hilo levanta suavemente la coronilla.",
      "Respira hacia la parte baja del abdomen para expandir las costillas, en lugar de levantar los hombros.",
      "Cantar bien requiere un flujo de aire constante. Practica inhalar durante cuatro pulsos y soltar el aire lentamente con un «sss» suave durante ocho.",
    ],
    practice: "Haz cinco rondas de cuatro pulsos al inhalar y ocho pulsos de «sss» al exhalar, sin tensión.",
  },
  "vocals-2": {
    instrument: "Voz",
    title: "Calienta la voz",
    body: [
      "Calienta la voz antes de cantar, como harías antes de hacer ejercicio. Empieza con suavidad.",
      "Prueba vibraciones de labios, tarareos y sirenas vocales que se deslizan suavemente por tu registro.",
      "Detente si sientes irritación o dolor. Bebe agua y no fuerces las notas agudas si aún no has calentado.",
    ],
    practice: "Dedica cinco minutos a vibraciones de labios, tarareos y sirenas suaves antes de cantar.",
  },
  "vocals-3": {
    instrument: "Voz",
    title: "Reproducir una nota afinada",
    body: [
      "Toca una nota en un piano o afinador y luego tararea o canta «ah» con la misma nota. Mantenla estable y escucha si suenas más agudo, más grave o igual.",
      "Después prueba la escala de Do mayor: Do, Re, Mi, Fa, Sol, La, Si, Do. Cántala despacio, una nota a la vez.",
      "Grábate en el Estudio y escucha la grabación. Oír tu voz desde fuera es una forma rápida de mejorar.",
    ],
    practice: "Graba la escala de Do mayor en una pista del Estudio y escucha qué notas quedaron desafinadas.",
  },
};
