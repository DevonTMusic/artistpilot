export type Bilingual = { en: string; es: string };

export type GlossaryEntry = {
  id: string;
  term: Bilingual;
  short: Bilingual;
  tryIt: Bilingual;
};

export type StudioLesson = {
  id: string;
  minutes: number;
  title: Bilingual;
  goal: Bilingual;
  steps: Bilingual[];
  concepts: string[];
  starter?: string;
  autoTick: Bilingual;
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: "daw",
    term: { en: "DAW", es: "DAW" },
    short: {
      en: "A Digital Audio Workstation is software for recording, editing and mixing music. The Studio is your DAW.",
      es: "Una estación de trabajo de audio digital es el software para grabar, editar y mezclar música. El Studio es tu DAW.",
    },
    tryIt: { en: "Open the Studio and add a track.", es: "Abre el Studio y añade una pista." },
  },
  {
    id: "track",
    term: { en: "Track", es: "Pista" },
    short: {
      en: "One lane for one sound, such as a vocal, a guitar or drums. Stack tracks to build a song.",
      es: "Un carril para un sonido, como una voz, una guitarra o la batería. Apila pistas para construir una canción.",
    },
    tryIt: { en: "Add a Voice track and a Drums track.", es: "Añade una pista de voz y una de batería." },
  },
  {
    id: "region",
    term: { en: "Clip / region", es: "Clip / región" },
    short: {
      en: "A piece of recorded or imported audio on a track. You can move, split, fade and stretch clips.",
      es: "Un fragmento de audio grabado o importado en una pista. Puedes moverlo, cortarlo, hacer fundidos y estirarlo.",
    },
    tryIt: { en: "Record something, then drag the clip to a new spot.", es: "Graba algo y arrastra el clip a otro lugar." },
  },
  {
    id: "bpm",
    term: { en: "BPM", es: "BPM" },
    short: {
      en: "Beats per minute: the speed of the song. Pop is often 100 to 130, hip-hop 70 to 95.",
      es: "Pulsos por minuto: la velocidad de la canción. El pop suele estar entre 100 y 130, el hip-hop entre 70 y 95.",
    },
    tryIt: { en: "Change the BPM while a loop plays.", es: "Cambia el BPM mientras suena un bucle." },
  },
  {
    id: "volume-pan",
    term: { en: "Volume and pan", es: "Volumen y panorama" },
    short: {
      en: "Volume sets how loud a track is. Pan places it left or right in the stereo field.",
      es: "El volumen define qué tan fuerte suena una pista. El panorama la coloca a la izquierda o derecha.",
    },
    tryIt: { en: "Pan one guitar left and another right.", es: "Coloca una guitarra a la izquierda y otra a la derecha." },
  },
  {
    id: "eq",
    term: { en: "EQ (equalizer)", es: "EQ (ecualizador)" },
    short: {
      en: "Turns parts of the sound up or down: low (bass), mid (body) and high (air). Cut mud, add clarity.",
      es: "Sube o baja partes del sonido: graves, medios (cuerpo) y agudos (aire). Quita turbiedad, añade claridad.",
    },
    tryIt: { en: "Cut the low end on a vocal until it sounds clearer.", es: "Recorta los graves de una voz hasta que suene más clara." },
  },
  {
    id: "compression",
    term: { en: "Compression", es: "Compresión" },
    short: {
      en: "Evens out loud and quiet parts so a performance sounds steady and close.",
      es: "Iguala las partes fuertes y suaves para que una interpretación suene estable y cercana.",
    },
    tryIt: { en: "Add compression to a vocal and watch the loud peaks shrink.", es: "Añade compresión a una voz y observa cómo bajan los picos." },
  },
  {
    id: "gate",
    term: { en: "Noise gate", es: "Puerta de ruido" },
    short: {
      en: "Silences a track when it is quieter than a threshold, which hides room noise between phrases.",
      es: "Silencia una pista cuando está por debajo de un umbral, ocultando el ruido de la sala entre frases.",
    },
    tryIt: { en: "Raise the gate threshold until the hiss between words disappears.", es: "Sube el umbral hasta que desaparezca el siseo entre palabras." },
  },
  {
    id: "reverb",
    term: { en: "Reverb", es: "Reverberación" },
    short: {
      en: "Adds the sound of a space, like a room or hall. A little adds depth, a lot washes the sound out.",
      es: "Añade el sonido de un espacio, como una sala. Un poco da profundidad, demasiado difumina el sonido.",
    },
    tryIt: { en: "Add a touch of reverb to a snare.", es: "Añade un toque de reverberación a una caja." },
  },
  {
    id: "pitch-correction",
    term: { en: "Pitch correction", es: "Corrección de tono" },
    short: {
      en: "Nudges sung notes onto the right pitch. Use gentle settings to stay natural, or fast ones for the robotic effect.",
      es: "Acerca las notas cantadas al tono correcto. Usa ajustes suaves para sonar natural, o rápidos para el efecto robótico.",
    },
    tryIt: { en: "Tune a vocal automatically, then try the manual editor.", es: "Afina una voz automáticamente y luego prueba el editor manual." },
  },
  {
    id: "arm",
    term: { en: "Arm a track", es: "Armar una pista" },
    short: {
      en: "Arming tells the Studio which track will record. No armed track, no recording.",
      es: "Armar le dice al Studio qué pista va a grabar. Sin pista armada, no hay grabación.",
    },
    tryIt: { en: "Arm a Voice track and press R.", es: "Arma una pista de voz y pulsa R." },
  },
  {
    id: "export",
    term: { en: "Export / bounce", es: "Exportar / bounce" },
    short: {
      en: "Renders your whole project into one audio file you can share. Stems export each track separately.",
      es: "Convierte todo tu proyecto en un archivo de audio para compartir. Los stems exportan cada pista por separado.",
    },
    tryIt: { en: "Export your mix as a WAV file.", es: "Exporta tu mezcla como archivo WAV." },
  },
];

export const STUDIO_LESSONS: StudioLesson[] = [
  {
    id: "first-recording",
    minutes: 5,
    title: { en: "Record your first take", es: "Graba tu primera toma" },
    goal: { en: "Set up a track, record your voice and play it back.", es: "Prepara una pista, graba tu voz y escúchala." },
    steps: [
      { en: "Open the Studio and press Add Track, then choose Voice / Audio.", es: "Abre el Studio, pulsa Añadir pista y elige Voz / Audio." },
      { en: "Click the arm button (the circle) on the track so it is ready to record.", es: "Pulsa el botón de armar (el círculo) en la pista para dejarla lista." },
      { en: "Put on headphones so the mic does not pick up the music, then press R and sing or speak.", es: "Ponte audífonos para que el micrófono no capte la música, pulsa R y canta o habla." },
      { en: "Press Space to stop, then Space again to listen back.", es: "Pulsa Espacio para detener y de nuevo para escuchar." },
    ],
    concepts: ["daw", "track", "arm", "region"],
    starter: "pop-vocal",
    autoTick: { en: "Ticks automatically once you record or import audio.", es: "Se marca sola cuando grabas o importas audio." },
  },
  {
    id: "mixing-basics",
    minutes: 6,
    title: { en: "Balance volume and pan", es: "Equilibra volumen y panorama" },
    goal: { en: "Make every part audible by setting levels and stereo position.", es: "Haz que cada parte se oiga ajustando niveles y posición estéreo." },
    steps: [
      { en: "Record or import two tracks, such as vocals and a beat.", es: "Graba o importa dos pistas, como voz y una base." },
      { en: "Lower the louder track until you can hear both clearly. The vocal should usually sit on top.", es: "Baja la pista más fuerte hasta oír ambas. La voz normalmente va al frente." },
      { en: "Pan supporting instruments a little left or right and keep the vocal in the centre.", es: "Mueve los instrumentos de apoyo un poco a los lados y deja la voz al centro." },
      { en: "Check that the master meter does not hit red.", es: "Comprueba que el medidor master no llegue al rojo." },
    ],
    concepts: ["volume-pan", "bpm"],
    starter: "pop-vocal",
    autoTick: { en: "Ticks automatically once you change a volume and a pan on a project with two or more tracks.", es: "Se marca sola cuando cambias un volumen y un panorama con dos o más pistas." },
  },
  {
    id: "clean-vocal",
    minutes: 8,
    title: { en: "Clean up a vocal", es: "Limpia una voz" },
    goal: { en: "Use gate, EQ and compression to get a clear, steady vocal.", es: "Usa puerta, EQ y compresión para una voz clara y estable." },
    steps: [
      { en: "Record a vocal, then open its effects.", es: "Graba una voz y abre sus efectos." },
      { en: "Try Vocal Polish for a one-click starting point.", es: "Prueba Vocal Polish como punto de partida con un clic." },
      { en: "Raise the gate until room noise between phrases disappears but words stay intact.", es: "Sube la puerta hasta que desaparezca el ruido entre frases sin cortar las palabras." },
      { en: "Cut the lowest frequencies with the EQ to remove rumble.", es: "Recorta las frecuencias más graves con el EQ para quitar retumbos." },
      { en: "Add compression until loud and quiet words feel closer in volume.", es: "Añade compresión hasta que las palabras fuertes y suaves se sientan parejas." },
    ],
    concepts: ["gate", "eq", "compression"],
    autoTick: { en: "Ticks automatically when a vocal track has its gate and compressor on.", es: "Se marca sola cuando una pista de voz tiene activadas la puerta y el compresor." },
  },
  {
    id: "tune-vocal",
    minutes: 8,
    title: { en: "Fix pitch two ways", es: "Corrige el tono de dos maneras" },
    goal: { en: "Tune a vocal automatically, then by hand.", es: "Afina una voz automáticamente y luego a mano." },
    steps: [
      { en: "Select a vocal clip and open Pitch Correction.", es: "Selecciona un clip de voz y abre Corrección de tono." },
      { en: "Pick the song key and a gentle speed, then preview. Faster speeds sound more robotic.", es: "Elige la tonalidad y una velocidad suave, y escucha. Más rápido suena más robótico." },
      { en: "Apply it, or use Undo if you do not like it.", es: "Aplícalo, o usa Deshacer si no te gusta." },
      { en: "For full control, open the manual pitch editor and drag individual notes to the pitch you want.", es: "Para control total, abre el editor manual y arrastra cada nota al tono que quieras." },
    ],
    concepts: ["pitch-correction"],
    autoTick: { en: "Ticks automatically when you apply a pitch fix to a clip.", es: "Se marca sola cuando aplicas una corrección de tono a un clip." },
  },
  {
    id: "finish-and-share",
    minutes: 5,
    title: { en: "Add space, then export", es: "Añade espacio y exporta" },
    goal: { en: "Give the mix depth with reverb and render a file to share.", es: "Dale profundidad con reverberación y genera un archivo para compartir." },
    steps: [
      { en: "Add a little reverb to the vocal. Start small and increase until you notice it, then back off.", es: "Añade un poco de reverberación a la voz. Empieza bajo, súbelo hasta notarlo y luego reduce." },
      { en: "Listen on headphones and on speakers if you can.", es: "Escucha con audífonos y con bocinas si puedes." },
      { en: "Save your project so you can come back to it.", es: "Guarda tu proyecto para volver a él." },
      { en: "Export the mix as a WAV. Use stems if someone else will mix it.", es: "Exporta la mezcla como WAV. Usa stems si alguien más la va a mezclar." },
    ],
    concepts: ["reverb", "export"],
    autoTick: { en: "Ticks automatically when you export a mix (Pro).", es: "Se marca sola cuando exportas una mezcla (Pro)." },
  },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY.map((entry) => [entry.id, entry]),
);
