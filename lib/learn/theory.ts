import type { Bilingual } from "./content";

export type TheoryLesson = {
  id: string;
  minutes: number;
  pro: boolean;
  title: Bilingual;
  goal: Bilingual;
  points: Bilingual[];
  tryIt: Bilingual;
};

// Free lessons stop at the treble clef; everything after it is Pro.
export const THEORY_LESSONS: TheoryLesson[] = [
  {
    id: "sound-and-pitch",
    minutes: 5,
    pro: false,
    title: { en: "Sound, pitch and the 12 notes", es: "Sonido, altura y las 12 notas" },
    goal: { en: "Understand what a note is and how music names them.", es: "Entiende qué es una nota y cómo se nombran." },
    points: [
      { en: "Pitch is how high or low a sound is. Faster vibrations sound higher.", es: "La altura es qué tan agudo o grave suena un sonido. Vibraciones más rápidas suenan más agudas." },
      { en: "Music uses 7 letter names: A B C D E F G. After G the pattern starts again, one octave higher.", es: "La música usa 7 letras: A B C D E F G (La Si Do Re Mi Fa Sol). Después de G vuelve a empezar, una octava más arriba." },
      { en: "Between most letters there is a black piano key. A sharp (#) raises a note one step; a flat (b) lowers it. Together there are 12 different notes.", es: "Entre casi todas las letras hay una tecla negra. Un sostenido (#) sube una nota medio tono; un bemol (b) la baja. En total hay 12 notas distintas." },
      { en: "The smallest step is a half step (one key to the very next). Two half steps make a whole step.", es: "El paso más pequeño es el semitono (una tecla a la siguiente). Dos semitonos forman un tono." },
      { en: "An octave is the same note name 12 half steps higher. It sounds like the 'same' note, just higher.", es: "Una octava es la misma nota 12 semitonos más arriba. Suena como la 'misma' nota, pero más aguda." },
    ],
    tryIt: { en: "Open the Piano in the Studio and find every C. Notice how they repeat.", es: "Abre el Piano en el Studio y encuentra todas las C (Do). Fíjate cómo se repiten." },
  },
  {
    id: "the-staff",
    minutes: 6,
    pro: false,
    title: { en: "The staff, notes and rests", es: "El pentagrama, las notas y los silencios" },
    goal: { en: "Read the basic building blocks of sheet music.", es: "Lee los bloques básicos de una partitura." },
    points: [
      { en: "The staff is 5 lines and 4 spaces. Lines and spaces are counted from the bottom up.", es: "El pentagrama tiene 5 líneas y 4 espacios. Se cuentan de abajo hacia arriba." },
      { en: "A note's position on the staff shows its pitch: higher on the staff means higher in sound.", es: "La posición de la nota en el pentagrama indica su altura: más arriba en el pentagrama es más agudo." },
      { en: "A note's shape shows its length: whole note = 4 beats, half = 2, quarter = 1, eighth = half a beat.", es: "La forma de la nota indica su duración: redonda = 4 pulsos, blanca = 2, negra = 1, corchea = medio pulso." },
      { en: "Every note length has a matching rest, which is a symbol for silence of the same length.", es: "Cada duración tiene un silencio equivalente, un símbolo para callar esa misma duración." },
      { en: "Ledger lines are short extra lines used for notes above or below the staff.", es: "Las líneas adicionales son rayitas extra para notas por encima o por debajo del pentagrama." },
    ],
    tryIt: { en: "In the Studio piano roll, draw a quarter note, then a half note, and compare their lengths.", es: "En el piano roll del Studio, dibuja una negra y luego una blanca, y compara sus longitudes." },
  },
  {
    id: "treble-clef",
    minutes: 8,
    pro: false,
    title: { en: "The treble clef: reading notes", es: "La clave de sol: leer notas" },
    goal: { en: "Name any note on the treble clef staff.", es: "Nombra cualquier nota en el pentagrama de clave de sol." },
    points: [
      { en: "The treble clef (G clef) curls around the second line from the bottom, which marks the note G above middle C.", es: "La clave de sol se enrolla en la segunda línea desde abajo, que marca la nota Sol (G) sobre el Do central." },
      { en: "Lines from bottom to top are E G B D F. Remember: Every Good Boy Does Fine.", es: "Las líneas de abajo hacia arriba son E G B D F (Mi Sol Si Re Fa). Truco en inglés: Every Good Boy Does Fine." },
      { en: "Spaces from bottom to top spell F A C E, like the word FACE.", es: "Los espacios de abajo hacia arriba son F A C E (Fa La Do Mi), como la palabra FACE." },
      { en: "Middle C sits on a ledger line just below the staff. It is your anchor for finding everything else.", es: "El Do central está en una línea adicional justo debajo del pentagrama. Es tu punto de referencia para todo lo demás." },
      { en: "Treble clef is used for higher sounds: vocals, guitar, flute, violin and the right hand of the piano.", es: "La clave de sol se usa para sonidos agudos: voz, guitarra, flauta, violín y la mano derecha del piano." },
    ],
    tryIt: { en: "Pick any note on the treble staff, name it, then find it on the Studio piano.", es: "Elige una nota del pentagrama, nómbrala y búscala en el piano del Studio." },
  },
  {
    id: "bass-clef",
    minutes: 8,
    pro: true,
    title: { en: "The bass clef", es: "La clave de fa" },
    goal: { en: "Read low notes for bass, left hand and low instruments.", es: "Lee notas graves para bajo, mano izquierda e instrumentos graves." },
    points: [
      { en: "The bass clef (F clef) marks the line for the note F below middle C.", es: "La clave de fa marca la línea de la nota Fa (F) bajo el Do central." },
      { en: "Lines: G B D F A. Spaces: A C E G.", es: "Líneas: G B D F A. Espacios: A C E G." },
      { en: "The grand staff joins treble and bass with middle C in between.", es: "El sistema de piano une clave de sol y de fa con el Do central en medio." },
    ],
    tryIt: { en: "Play a bass line in the Studio and read where it sits on the bass staff.", es: "Toca una línea de bajo en el Studio y lee dónde queda en el pentagrama." },
  },
  {
    id: "rhythm-and-time",
    minutes: 8,
    pro: true,
    title: { en: "Rhythm, beats and time signatures", es: "Ritmo, pulso y compases" },
    goal: { en: "Count beats and understand 4/4, 3/4 and 6/8.", es: "Cuenta pulsos y entiende 4/4, 3/4 y 6/8." },
    points: [
      { en: "The top number is beats per bar; the bottom is the note that gets one beat.", es: "El número de arriba son los pulsos por compás; el de abajo es la figura que vale un pulso." },
      { en: "Dotted notes last 1.5 times as long. Ties join two notes into one.", es: "Los puntillos alargan 1.5 veces. Las ligaduras unen dos notas en una." },
      { en: "Syncopation puts emphasis on off-beats and is what makes music groove.", es: "La síncopa acentúa los contratiempos y es lo que hace que la música tenga groove." },
    ],
    tryIt: { en: "Program a 4-bar drum pattern in the Studio and count it out loud.", es: "Programa un patrón de batería de 4 compases en el Studio y cuéntalo en voz alta." },
  },
  {
    id: "scales-and-keys",
    minutes: 10,
    pro: true,
    title: { en: "Scales, keys and key signatures", es: "Escalas, tonalidades y armaduras" },
    goal: { en: "Build major and minor scales and read key signatures.", es: "Construye escalas mayores y menores y lee armaduras." },
    points: [
      { en: "Major scale pattern: whole, whole, half, whole, whole, whole, half.", es: "Patrón de escala mayor: tono, tono, semitono, tono, tono, tono, semitono." },
      { en: "Natural minor: whole, half, whole, whole, half, whole, whole.", es: "Menor natural: tono, semitono, tono, tono, semitono, tono, tono." },
      { en: "The key signature at the start of the staff lists the sharps or flats of the key. The circle of fifths organizes them.", es: "La armadura al inicio del pentagrama lista los sostenidos o bemoles de la tonalidad. El círculo de quintas los organiza." },
    ],
    tryIt: { en: "Turn on scale snap in the pitch editor and sing a C major scale.", es: "Activa el ajuste a escala en el editor de tono y canta una escala de Do mayor." },
  },
  {
    id: "intervals-and-chords",
    minutes: 10,
    pro: true,
    title: { en: "Intervals, chords and progressions", es: "Intervalos, acordes y progresiones" },
    goal: { en: "Stack notes into chords and use common progressions.", es: "Apila notas en acordes y usa progresiones comunes." },
    points: [
      { en: "An interval is the distance between two notes, such as a third or a fifth.", es: "Un intervalo es la distancia entre dos notas, como una tercera o una quinta." },
      { en: "A triad stacks the 1st, 3rd and 5th notes of a scale. Major sounds bright, minor sounds sad.", es: "Una tríada apila la 1ª, 3ª y 5ª nota de una escala. Mayor suena brillante, menor suena triste." },
      { en: "The I-V-vi-IV progression powers a huge number of pop songs.", es: "La progresión I-V-vi-IV está detrás de muchísimas canciones pop." },
    ],
    tryIt: { en: "Load the Pop Vocal starter and look at its chord notes in the piano roll.", es: "Carga el starter Pop Vocal y mira sus acordes en el piano roll." },
  },
  {
    id: "guitar-tabs",
    minutes: 10,
    pro: true,
    title: { en: "Reading guitar tabs and chord charts", es: "Leer tablaturas y diagramas de acordes" },
    goal: { en: "Play from tablature and chord diagrams.", es: "Toca a partir de tablaturas y diagramas de acordes." },
    points: [
      { en: "Tab has 6 lines, one per string. The bottom line is the low E string; the top line is the high e string.", es: "La tablatura tiene 6 líneas, una por cuerda. La de abajo es la Mi grave; la de arriba es la Mi aguda." },
      { en: "A number is the fret to press. 0 means play the open string.", es: "Un número es el traste a presionar. 0 significa tocar la cuerda al aire." },
      { en: "Numbers stacked vertically are played together as a chord. Symbols like h, p and / mean hammer-on, pull-off and slide.", es: "Números en vertical se tocan juntos como acorde. Símbolos como h, p y / son ligado ascendente, descendente y slide." },
      { en: "Chord diagrams show the strings as vertical lines, frets as horizontal ones and dots for your fingers.", es: "Los diagramas de acordes muestran cuerdas verticales, trastes horizontales y puntos para tus dedos." },
    ],
    tryIt: { en: "Record a guitar track and match a simple 4-chord tab.", es: "Graba una pista de guitarra y sigue una tablatura sencilla de 4 acordes." },
  },
];
