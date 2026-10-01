export type EditorialMessage = {
  label: string;
  note: string;
  text: string;
};

export type EditorialNiche = {
  id: string;
  title: string;
  description: string;
  rule: string;
  messages: EditorialMessage[];
};

/** Biblioteca curada a partir do painel editorial portátil. {{LECTURA}} é substituído pelo link oficial quando houver. */
const EDITORIAL_NICHES_BASE: EditorialNiche[] = [
  {
    id: "dependencia-recuperacion",
    title: "Dependência e recuperação",
    description: "Recaída, culpa, ciclos, impotência familiar, estigma e desejo de recomeçar.",
    rule: "Não reduzir a recuperação a força de vontade, não diagnosticar e não usar crise ou recaída como oportunidade de abordagem.",
    messages: [
      { label: "1 · reconhecimento cuidadoso", note: "Só usar primeira pessoa se for verdadeiro.", text: "No sé si te sirva que te lo diga, pero conozco de cerca esa sensación de querer cambiar y volver a caer en el mismo lugar. A mí también me costó entender que detrás del hábito había cansancio y cosas que nunca había sabido nombrar. Me compartieron una lectura corta; yo no soy de leer mucho, pero pude terminarla rápido y me dejó pensando. Te la dejo aquí: {{LECTURA}}. Si la lees, vuelve cuando puedas y dime si te tocó o no." },
      { label: "2 · ciclos sem julgamento", note: "Falar de padrões e culpa sem apresentar explicação única.", text: "Tu comentario me recordó una etapa bastante confusa, de esas en las que uno promete que mañana será distinto y luego no sabe por dónde empezar. Hace un tiempo alguien me pasó una lectura de 15–20 minutos. No pretende explicar toda la vida de nadie, pero habla de los ciclos y de la culpa sin juzgar. Quizá te haga sentido: {{LECTURA}}. Si la terminas, me gustaría saber qué te pareció, incluso si no conectó contigo." },
      { label: "3 · sem frase feita", note: "Não prometer solução nem transformar a dor em argumento.", text: "No quiero dejarte una frase hecha porque sé que esto no se resuelve con una frase. Solo vi tu comentario y me acordé de una fase en la que todo parecía repetirse. Me enviaron esta lectura y, aunque casi nunca leo textos así, esta vez seguí hasta el final. La comparto por si llega en un momento útil: {{LECTURA}}. Después, si te nace, vuelve aquí y cuéntame qué te movió." },
    ],
  },
  {
    id: "recuperacion-digital",
    title: "Pornografia e recuperação digital",
    description: "Culpa, isolamento, hábitos digitais, ocultamento, relações e estratégias de recuperação.",
    rule: "Evitar sexualização, vergonha e patologização. Nunca usar detalhes íntimos do comentário como gancho.",
    messages: [
      { label: "1 · culpa e isolamento", note: "Nomear o padrão sem tratar a pessoa como má.", text: "Leí lo que escribiste sobre intentar parar y me resultó familiar esa mezcla de culpa, aislamiento y “esta vez sí”. No me gusta mucho leer, pero esta lectura es corta y va directo a esos patrones sin tratarte como una mala persona: {{LECTURA}}. Si la haces, vuelve al comentario y dime con sinceridad si te tocó o si no te dijo nada." },
      { label: "2 · fuga e desconexão", note: "Apresentar possibilidades, nunca diagnóstico.", text: "A veces uno busca una explicación rápida y termina sintiéndose todavía peor. Tu comentario me recordó una etapa en la que me escondía de lo que estaba viviendo. Me pasaron una lectura de 15–20 minutos y me llamó la atención porque habla de fuga y desconexión, no de vergüenza. Te la dejo: {{LECTURA}}. Si te parece, después me cuentas qué te pareció." },
      { label: "3 · convite sem exposição", note: "Permitir leitura sem exigir explicação ou resposta.", text: "No sé si esto encaje contigo, así que tómalo solo como una posibilidad. Hace tiempo encontré una lectura breve que me ayudó a mirar mis hábitos digitales con un poco más de honestidad. No tienes que responder ni explicar nada. Está aquí por si quieres verla: {{LECTURA}}. Y si la terminas, puedes volver y decirme si realmente te tocó." },
    ],
  },
  {
    id: "ansiedade-panico",
    title: "Ansiedade e pânico",
    description: "Medo, sintomas físicos, hipervigilância, vergonha, evitação e sensação de não ser compreendido.",
    rule: "Reconhecer sem diagnosticar. Não dizer que sabe exatamente como a pessoa se sente.",
    messages: [
      { label: "1 · corpo em alerta", note: "Partir do detalhe citado pela pessoa.", text: "Lo que cuentas de sentir el cuerpo en alerta me recordó una época en la que cualquier sensación parecía anunciar algo terrible. No soy de leer mucho, pero esta lectura era corta y pude hacerla de una vez. Me ayudó a ponerle palabras a cosas que yo no sabía explicar: {{LECTURA}}. Si la lees, vuelve cuando puedas y dime si te acompañó o no." },
      { label: "2 · sem fingir certeza", note: "A frase “no sé exactamente” protege a honestidade.", text: "No voy a decirte que sé exactamente cómo te sientes, porque no sería verdad. Pero sí reconozco ese cansancio de intentar parecer tranquilo mientras por dentro todo está acelerado. Me enviaron esta lectura y me llamó la atención por eso. Dura unos 15–20 minutos: {{LECTURA}}. Si te nace, luego vuelve y cuéntame qué te pareció." },
      { label: "3 · medo e evitação", note: "Não oferecer a leitura como substituto de ajuda profissional.", text: "Vi tu comentario y pensé en una fase en la que dejé de hacer cosas por miedo a que algo pasara. Encontré una lectura breve sobre la jaula mental y los caminos de fuga. No sustituye ayuda profesional; es solo una lectura que quizá te haga compañía: {{LECTURA}}. Si la terminas, dime honestamente si conectó contigo." },
    ],
  },
  {
    id: "depressao-vazio",
    title: "Depressão, vazio e falta de sentido",
    description: "Modo automático, tristeza prolongada, falta de energia, desesperança e dificuldade de pedir apoio.",
    rule: "Não prometer saída rápida, não chamar de falta de vontade e bloquear abordagem em crise aguda.",
    messages: [
      { label: "1 · funcionar por fora", note: "Acolher a diferença entre aparência e experiência interna.", text: "Ese “sigo funcionando, pero por dentro no estoy” me resultó demasiado familiar. Hubo una etapa en la que hacía todo en automático y nadie lo notaba. Me compartieron una lectura corta; pensé que no la terminaría, pero me atrapó porque no intenta darte una frase bonita para arreglarlo todo: {{LECTURA}}. Si la lees, vuelve y dime qué te dejó." },
      { label: "2 · não inventar a história", note: "Reconhecer limite de contexto antes de oferecer algo.", text: "No sé qué hay detrás de tu comentario y no quiero inventarlo. Solo puedo decir que me recordó una época de mucho cansancio y poca esperanza. Me recomendaron esta lectura de 15–20 minutos y la comparto por si puede acompañarte un rato: {{LECTURA}}. Si no te sirve, también está bien; si la terminas, cuéntame qué te pareció." },
      { label: "3 · recomeçar sem cobrança", note: "Evitar motivação vazia e urgência artificial.", text: "A veces no falta voluntad; falta energía para volver a empezar. Yo tardé en entenderlo. Esta lectura me llegó en una fase parecida y, aunque no suelo leer este tipo de cosas, la hice completa. Te la dejo aquí: {{LECTURA}}. Después, si quieres, regresa a este comentario y dime si te tocó o no." },
    ],
  },
  {
    id: "solidao-ajuda",
    title: "Solidão e dificuldade de pedir ajuda",
    description: "Vazio, desejo de vínculo, julgamento, isolamento e conselhos que fazem a pessoa se sentir menos ouvida.",
    rule: "Responder sem transformar pedido indireto de ajuda em lead. Não exigir resposta.",
    messages: [
      { label: "1 · pedido indireto", note: "Reconhecer quando a pessoa fala sem escrever “preciso de ajuda”.", text: "Tu comentario me hizo pensar en esa forma de pedir ayuda sin escribir directamente “necesito ayuda”. También pasé por una época en la que hablaba y sentía que nadie terminaba de escuchar. Me enviaron una lectura breve y me gustó porque no intenta dar consejos rápidos: {{LECTURA}}. Si la lees, vuelve aquí y dime qué sentiste." },
      { label: "2 · sem solução pronta", note: "A pessoa pode não querer explicar nada.", text: "No te escribo para darte una solución, porque sé que a veces eso hace que uno se sienta todavía menos comprendido. Solo encontré una lectura corta sobre desconexión y cansancio emocional. Yo casi no leo, pero esta pude terminarla rápido: {{LECTURA}}. Si te nace, luego me cuentas si tuvo algún sentido para ti." },
      { label: "3 · cercado e sozinho", note: "Usar a imagem do comentário, não uma reflexão genérica.", text: "Leí varias respuestas y la tuya se me quedó en la cabeza. Me recordó una fase en la que estaba rodeado de gente y aun así me sentía completamente solo. Hay una lectura de 15–20 minutos que me ayudó a mirar eso de otra manera: {{LECTURA}}. Puedes verla sin explicar nada y, si quieres, volver después a decirme qué te pareció." },
    ],
  },
  {
    id: "relacoes-dependencia",
    title: "Términos, relações tóxicas e dependência emocional",
    description: "Medo da solidão, ciclos de rompimento, limites, controle, perda de autoestima e dependência emocional.",
    rule: "Não dizer simplesmente “vá embora”; reconhecer medo, dependência, convivência e contexto não visível.",
    messages: [
      { label: "1 · reconhecer o padrão", note: "Falar de comportamento observado sem rotular a pessoa.", text: "Lo que escribiste sobre volver aunque sabías que te hacía daño me recordó una etapa que me costó mucho cerrar. No fue una frase motivacional la que me ayudó; fue empezar a reconocer el patrón. Me pasaron esta lectura corta y me llamó la atención por eso: {{LECTURA}}. Si la haces, vuelve y dime con honestidad si te tocó." },
      { label: "2 · não reduzir a “só vá embora”", note: "Manter complexidade sem normalizar dano.", text: "No conozco toda tu historia y no quiero reducirla a “solo vete”. A veces hay miedo, dependencia, convivencia y muchas cosas que desde afuera no se ven. Encontré una lectura breve sobre patrones y desconexión; quizá te acompañe, quizá no: {{LECTURA}}. Si la terminas, puedes volver y contarme qué te pareció." },
      { label: "3 · voltar a se encontrar", note: "Acolher sem prometer transformação.", text: "Tu comentario me recordó lo difícil que es volver a encontrarse después de una relación que te fue apagando poco a poco. Me enviaron una lectura de 15–20 minutos y, aunque no suelo leer, esta me hizo parar un rato. Te la dejo aquí: {{LECTURA}}. Si te nace, después dime si conectó contigo." },
    ],
  },
  {
    id: "luto-despedida",
    title: "Luto e despedida",
    description: "Perdas, mudanças irreversíveis, silêncio, luto ambíguo e necessidade de companhia sem frases prontas.",
    rule: "Não dizer “tudo passa”, não usar o luto como argumento e não prometer cura.",
    messages: [
      { label: "1 · cada luto é único", note: "Não afirmar que sabe como a pessoa se sente.", text: "No voy a decirte que sé cómo se atraviesa una pérdida, porque cada duelo tiene su propia forma. Tu comentario me recordó un tiempo en el que las frases rápidas me dolían más que ayudarme. Encontré una lectura breve y silenciosa; quizá pueda acompañarte un momento: {{LECTURA}}. Si la lees, vuelve cuando quieras y dime qué te pareció." },
      { label: "2 · sem “tudo passa”", note: "Evitar consolo automático.", text: "Leí lo que escribiste y preferí no responder con “todo pasa”. Hay cosas que no se borran; uno aprende a caminar con ellas de otra manera. Me compartieron una lectura de 15–20 minutos y la hice completa aunque no suelo leer. Te la dejo: {{LECTURA}}. Si después quieres, cuéntame si te tocó." },
      { label: "3 · companhia sem invasão", note: "Usar primeira pessoa somente se for verdadeira.", text: "Tu comentario me hizo recordar una despedida que todavía llevo conmigo. No sé si esta lectura sea para ti, pero habla del silencio que queda cuando algo importante cambia para siempre. Dura poco y está aquí: {{LECTURA}}. Si la terminas, puedes volver y decirme si te hizo compañía o no." },
    ],
  },
  {
    id: "procrastinacao-proposito",
    title: "Procrastinação, hábitos e propósito",
    description: "Fuga, medo, culpa, disciplina, repetição e barreiras para começar.",
    rule: "Não explicar tudo por falta de disciplina nem chamar a pessoa de preguiçosa.",
    messages: [
      { label: "1 · amanhã começo", note: "Tratar fuga e medo como possibilidades, não diagnóstico.", text: "Me acordé de cuántas veces decía “mañana empiezo” cuando en realidad estaba cansado o asustado. Tu comentario me llevó a esa etapa. Me pasaron una lectura corta que habla de la fuga sin llamarte flojo; yo no leo mucho, pero esta me atrapó: {{LECTURA}}. Si la haces, vuelve y dime qué te pareció." },
      { label: "2 · menos dureza", note: "Não apresentar uma explicação única.", text: "No creo que todo se explique por falta de disciplina. A veces uno está evitando algo que todavía no sabe nombrar. Encontré una lectura de 15–20 minutos sobre esos patrones y me ayudó a mirar el asunto con menos dureza: {{LECTURA}}. Si te sirve, después vuelve a este comentario y cuéntame si conectó." },
      { label: "3 · repetição", note: "Citar o desejo de mudar e a repetição real do comentário.", text: "Vi que escribiste que quieres cambiar pero sigues repitiendo lo mismo. Me pasó algo parecido y tardé en entender que el primer paso no siempre es hacer más; a veces es mirar qué estamos evitando. Te dejo esta lectura breve: {{LECTURA}}. Si la terminas, dime honestamente si te movió algo." },
    ],
  },
  {
    id: "espiritualidade-transformacao",
    title: "Espiritualidade, despertar e transformação",
    description: "Esperança, dúvidas, oração, propósito, sinais e busca de sentido sem impor uma crença.",
    rule: "Respeitar a crença sem afirmar que sofrimento é prova, sinal ou resposta divina.",
    messages: [
      { label: "1 · fase difícil ou despertar", note: "Tratar interpretações como possibilidades.", text: "No sé si llamarlo despertar, cambio o simplemente una etapa difícil. Solo sé que tu comentario me recordó una fase en la que ya no me reconocía, pero tampoco sabía quién estaba intentando ser. Me enviaron una lectura corta y me habló justo de esa frontera: {{LECTURA}}. Si la lees, vuelve y dime si te tocó." },
      { label: "2 · buscar significado", note: "Não impor uma resposta espiritual.", text: "Me llamó la atención lo que dijiste sobre las señales. A veces uno busca significado porque está intentando ordenar algo que por dentro se siente confuso. Encontré una lectura de 15–20 minutos que habla de esa búsqueda sin imponer una respuesta: {{LECTURA}}. Si te nace, después cuéntame qué te pareció." },
      { label: "3 · crença pessoal", note: "Primeira pessoa só quando for uma experiência real.", text: "Yo también tuve una época de preguntas que no cabían en las respuestas de siempre. No vengo a decirte qué debes creer. Solo encontré una lectura breve sobre transformación y la comparto porque me acompañó: {{LECTURA}}. Si la terminas, puedes volver y decirme si hizo sentido para ti o si no conectó." },
    ],
  },
  {
    id: "masculinidade-pressao",
    title: "Masculinidade e pressão emocional",
    description: "Pressão para aguentar, vulnerabilidade, raiva, silêncio, medo e dificuldade de pedir ajuda.",
    rule: "Não generalizar homens, não humilhar e não diagnosticar irritabilidade ou silêncio.",
    messages: [
      { label: "1 · “todo bien”", note: "Reconhecer o esforço de esconder o que acontece.", text: "Me acordé de una época en la que responder “todo bien” era más fácil que explicar lo que me pasaba. Tu comentario me tocó por eso. Me enviaron una lectura corta sobre la presión de aguantarlo todo; yo casi no leo, pero esta la terminé rápido: {{LECTURA}}. Si la haces, vuelve y dime si te dijo algo." },
      { label: "2 · medo virando distância", note: "Falar de vulnerabilidade sem generalizar.", text: "No sé si a otros les pasa, pero a mí me enseñaron a esconder el miedo hasta que terminó saliendo como irritación y distancia. Encontré una lectura de 15–20 minutos que habla de esa guerra por dentro sin humillar a nadie: {{LECTURA}}. Si te nace, después cuéntame qué te pareció." },
      { label: "3 · pedir ajuda não é derrota", note: "Se houver risco, não usar a leitura como resposta principal.", text: "Tu comentario me recordó que pedir ayuda puede sentirse como admitir derrota, aunque no lo sea. Pasé por una fase en la que prefería desaparecer antes que decir “no puedo”. Me compartieron esta lectura y la dejo aquí por si llega en buen momento: {{LECTURA}}. Si la lees, vuelve cuando quieras y dime si te tocó." },
    ],
  },
];

const additionalMessageVariations: Record<string, EditorialMessage[]> = {
  "dependencia-recuperacion": [
    { label: "4 · quando a culpa volta", note: "Reconhecer repetição sem transformar recaída em identidade.", text: "Leí tu comentario y me quedé con esa parte en la que parece que la culpa vuelve antes de que uno pueda empezar de nuevo. No sé toda tu historia, pero encontré una lectura que habla de esos ciclos sin convertirlos en una sentencia: {{LECTURA}}. Si la terminas, vuelve a este comentario y dime si algo de ahí te tocó o si no conectó contigo." },
    { label: "5 · recomeçar pequeno", note: "Oferecer companhia, não uma promessa de mudança.", text: "A veces el deseo de cambiar está ahí, pero el cansancio hace que hasta el primer paso parezca enorme. Me acordé de eso al leer tu comentario y te dejo esta lectura breve por si encuentra un lugar en tu momento: {{LECTURA}}. Cuando la leas, si quieres, regresa y cuéntame qué te dejó, incluso si no fue para ti." },
  ],
  "recuperacion-digital": [
    { label: "4 · esconder e repetir", note: "Usar a tensão do comentário, nunca detalhes íntimos como exposição.", text: "Tu comentario nombra algo difícil: querer parar y terminar escondiéndose otra vez. No quiero convertir eso en una etiqueta; esta lectura habla de desconexión y hábitos con un poco más de honestidad: {{LECTURA}}. Si la lees, vuelve luego a este comentario y dime si algo resonó contigo o si no te dijo nada." },
    { label: "5 · sem transformar em vergonha", note: "Separar comportamento de valor pessoal.", text: "No creo que la vergüenza sea una buena forma de empezar a cambiar. Encontré una lectura corta que intenta mirar los patrones sin tratar a nadie como un caso perdido: {{LECTURA}}. Después de leerla, puedes volver a este comentario y contarme si te tocó algo o si no conectó contigo." },
  ],
  "ansiedade-panico": [
    { label: "4 · parecer tranquilo", note: "Reconhecer a diferença entre aparência e alerta interno.", text: "A veces por fuera uno parece tranquilo y por dentro está esperando que algo malo ocurra. Tu comentario me llevó a esa tensión; te comparto una lectura breve que intenta ponerle palabras sin diagnosticarte: {{LECTURA}}. Si la terminas, vuelve a este comentario y dime si te acompañó, aunque la respuesta sea que no." },
    { label: "5 · medo de sentir", note: "Não prometer controle total dos sintomas.", text: "Me llamó la atención esa forma de hablarle al propio cuerpo como si hubiera que desconfiar de cada señal. No sé si eso es lo que te pasa, pero hay una lectura sobre miedo y evitación que quizá te ayude a mirar la pregunta: {{LECTURA}}. Cuando termines, vuelve y dime si algo te hizo sentido o no." },
  ],
  "depressao-vazio": [
    { label: "4 · ninguém percebe", note: "Acolher o funcionamento automático sem romantizar sofrimento.", text: "Lo más duro de seguir funcionando puede ser que nadie note cuánto cuesta hacerlo. Tu comentario me recordó esa parte invisible del cansancio y te dejo una lectura que no intenta resolverlo con una frase: {{LECTURA}}. Si la lees, regresa a este comentario y dime qué te tocó, o si no te tocó nada." },
    { label: "5 · pouca esperança", note: "Não exigir energia, resposta ou gratidão.", text: "No sé qué lugar ocupa hoy la esperanza en tu historia y no quiero inventarlo. Solo encontré una lectura breve que me acompañó cuando empezar de nuevo parecía demasiado lejos: {{LECTURA}}. Después, si la terminas, vuelve cuando puedas y dime si te hizo compañía o no." },
  ],
  "solidao-ajuda": [
    { label: "4 · falar sem ser ouvido", note: "Responder à necessidade de escuta, não oferecer conselho automático.", text: "Hay una diferencia entre hablar y sentir que alguien realmente se quedó escuchando. Tu comentario me hizo pensar en eso; esta lectura breve también parte de esa desconexión: {{LECTURA}}. Si la lees, vuelve a este comentario y dime si algo de ella te alcanzó o si no conectó contigo." },
    { label: "5 · companhia possível", note: "A pessoa pode ler em silêncio e não responder.", text: "No tienes que explicar toda tu historia para que una frase merezca ser escuchada. Te dejo una lectura corta por si puede acompañarte un rato: {{LECTURA}}. Cuando termines, si te nace, regresa y dime qué te dejó, incluso si prefieres decir que no te sirvió." },
  ],
  "relacoes-dependencia": [
    { label: "4 · saber e voltar", note: "Reconhecer ciclos sem ordenar uma decisão imediata.", text: "Saber que algo te hace daño no siempre alcanza para dejarlo atrás de un día para otro. Tu comentario me llevó a esa distancia entre entender y poder actuar; encontré una lectura sobre patrones y vínculos: {{LECTURA}}. Si la terminas, vuelve a este comentario y dime si algo te tocó o si no conectó contigo." },
    { label: "5 · limites e medo", note: "Não simplificar a situação nem culpar quem permanece.", text: "A veces los límites se mezclan con miedo, convivencia y cariño, y desde afuera todo parece más sencillo de lo que es. No quiero darte una orden; solo te comparto esta lectura breve: {{LECTURA}}. Después, si la lees, regresa y cuéntame qué te dejó, aunque no haya cambiado tu forma de verlo." },
  ],
  "luto-despedida": [
    { label: "4 · o que permanece", note: "Não tentar apagar a perda com positividade.", text: "Hay pérdidas que no piden una frase optimista; piden que alguien reconozca lo que todavía permanece. Tu comentario me hizo pensar en eso y te dejo una lectura breve y silenciosa: {{LECTURA}}. Si la terminas, vuelve a este comentario y dime si te acompañó o si no llegó a ti." },
    { label: "5 · sem apressar o luto", note: "Respeitar o tempo da pessoa.", text: "No hay una fecha correcta para dejar de extrañar ni una forma única de despedirse. Encontré una lectura que no intenta apurar ese proceso: {{LECTURA}}. Cuando la leas, si quieres, regresa y dime qué parte te tocó, o si no encontraste nada para ti." },
  ],
  "procrastinacao-proposito": [
    { label: "4 · começar não é acelerar", note: "Diferenciar movimento de pressa e cobrança.", text: "A veces empezar no significa hacer más rápido, sino mirar con honestidad qué nos está frenando. Tu comentario me llevó a esa pregunta y encontré una lectura breve sobre fuga y propósito: {{LECTURA}}. Si la terminas, vuelve a este comentario y dime si algo te movió o si no conectó contigo." },
    { label: "5 · culpa e repetição", note: "Não tratar repetição como falha moral.", text: "La culpa puede hacer que uno esconda justo aquello que necesita entender. Leí tu comentario desde ese lugar y te dejo una lectura que mira los patrones sin llamarte flojo: {{LECTURA}}. Después, regresa cuando puedas y cuéntame si te dejó una pregunta o si no te dijo nada." },
  ],
  "espiritualidade-transformacao": [
    { label: "4 · dúvida e sentido", note: "Permitir dúvida sem corrigir a crença da pessoa.", text: "A veces buscar sentido no significa tener una respuesta espiritual; significa admitir que las respuestas de antes ya no alcanzan. Tu comentario me llevó a esa frontera y te comparto esta lectura: {{LECTURA}}. Si la terminas, vuelve a este comentario y dime si hizo sentido para ti o si no conectó contigo." },
    { label: "5 · esperança sem promessa", note: "Não apresentar a leitura como sinal, cura ou resposta divina.", text: "No quiero decirte qué significa lo que estás viviendo ni convertirlo en una señal. Solo encontré una lectura breve sobre transformación y preguntas difíciles: {{LECTURA}}. Cuando la leas, si te nace, regresa y cuéntame qué te tocó, aunque la respuesta sea que no te dijo nada." },
  ],
  "masculinidade-pressao": [
    { label: "4 · esconder o medo", note: "Falar de vulnerabilidade sem generalizar homens.", text: "A veces esconder el miedo parece más fácil que admitir que algo está doliendo. Tu comentario me hizo pensar en esa defensa y te dejo una lectura sobre la presión de aguantarlo todo: {{LECTURA}}. Si la terminas, vuelve a este comentario y dime si algo resonó contigo o si no conectó." },
    { label: "5 · pedir ajuda", note: "Não romantizar silêncio nem transformar coragem em cobrança.", text: "Pedir ayuda puede sentirse como perder una imagen que uno pasó años sosteniendo. No sé si eso aparece en tu comentario, pero hay una lectura que habla de esa dificultad sin humillar: {{LECTURA}}. Después de leerla, regresa cuando quieras y dime qué te dejó, incluso si no fue para ti." },
  ],
};

const requiredReturnClosures: Array<[RegExp, string]> = [
  [/Si la terminas, me gustaría saber qué te pareció, incluso si no conectó contigo\./g, "Si la terminas, vuelve a este comentario y dime qué te pareció, incluso si no conectó contigo."],
  [/Si no te sirve, también está bien; si la terminas, cuéntame qué te pareció\./g, "Si no te sirve, también está bien; si la terminas, vuelve a este comentario y cuéntame qué te pareció."],
  [/Si te parece, después me cuentas qué te pareció\./g, "Si la lees, vuelve después a este comentario y dime qué te dejó, aunque no haya conectado contigo."],
  [/Si la terminas, dime honestamente si conectó contigo\./g, "Si la terminas, vuelve a este comentario y dime honestamente si conectó contigo o no."],
  [/Si te nace, luego me cuentas si tuvo algún sentido para ti\./g, "Si te nace, vuelve después a este comentario y dime si tuvo algún sentido para ti o no."],
  [/Si te nace, después dime si conectó contigo\./g, "Si te nace, vuelve luego a este comentario y dime si conectó contigo o no."],
  [/Si después quieres, cuéntame si te tocó\./g, "Si después quieres, vuelve a este comentario y cuéntame si algo te tocó o no."],
  [/Si la terminas, dime honestamente si te movió algo\./g, "Si la terminas, vuelve a este comentario y dime honestamente si algo te movió o no."],
  [/Si te nace, después cuéntame qué te pareció\./g, "Si te nace, vuelve después a este comentario y cuéntame qué te pareció, aunque no haya conectado contigo."],
];

function enforceReturnClosure(text: string) {
  return requiredReturnClosures.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

function casualModelText(text: string) {
  return text
    .replace(/(\d+)[–—](\d+)/g, "$1 a $2")
    .replace(/\s*[—–]\s*/g, " ")
    .replace(/\s*;\s*/g, ", ")
    .replace(/\s+-\s+/g, " ")
    .replace(/[ \t]{2,}/g, " ");
}

export const EDITORIAL_NICHES: EditorialNiche[] = EDITORIAL_NICHES_BASE.map(niche => ({
  ...niche,
  messages: [...niche.messages, ...(additionalMessageVariations[niche.id] ?? [])].map(message => ({ ...message, text: casualModelText(enforceReturnClosure(message.text)) })),
}));

export const EDITORIAL_CLOSING_VARIATIONS = [
  "Si la terminas, vuelve a este comentario y dime si algo te tocó o si no conectó contigo.",
  "Cuando acabes, regresa por aquí y cuéntame qué te dejó, incluso si no fue para ti.",
  "Después de leerla, puedes volver y decirme qué parte resonó contigo, o si no encontraste nada.",
  "Si llegas hasta el final, vuelve cuando puedas y dime honestamente si te hizo compañía o no.",
  "Cuando la termines, regresa a este comentario y dime si algo se movió en ti, aunque sea una duda.",
  "Después, si te nace, vuelve y cuéntame qué encontraste ahí. También está bien si no conectó.",
];

export function buildEditorialLibraryContext(topic: string, link?: string) {
  const normalized = topic.toLocaleLowerCase();
  const keywords: Record<string, string[]> = {
    "dependencia-recuperacion": ["adicc", "depend", "reca", "sobried", "culpa"],
    "recuperacion-digital": ["porn", "digital", "habito", "compuls", "sexual"],
    "ansiedade-panico": ["ansied", "pánico", "panico", "miedo", "alerta"],
    "depressao-vazio": ["depres", "vacío", "vacio", "desesper", "cansancio"],
    "solidao-ajuda": ["soledad", "solo", "ayuda", "aislam", "escuchar"],
    "relacoes-dependencia": ["relación", "relacion", "tóxic", "toxic", "ruptura", "dependencia"],
    "luto-despedida": ["duelo", "luto", "pérdida", "perdida", "despedida"],
    "procrastinacao-proposito": ["procrast", "disciplina", "mañana", "manana", "propósito", "proposito"],
    "espiritualidade-transformacao": ["espiritual", "despertar", "oración", "oracion", "señal", "senal", "dios"],
    "masculinidade-pressao": ["hombre", "masculin", "miedo", "irritación", "irritacion", "presión", "presion"],
  };
  const selected = EDITORIAL_NICHES.filter(niche => keywords[niche.id]?.some(keyword => normalized.includes(keyword))).slice(0, 2);
  const niches = selected.length ? selected : EDITORIAL_NICHES.slice(0, 3);
  if (!link) {
    return niches.map(niche => `NICHO: ${niche.title}\nREGRA: ${niche.rule}\nMODELOS DE REFERÊNCIA: use o contexto do vídeo e da conversa. Não mencione leitura, retorno após leitura ou link inexistente.`).join("\n\n");
  }
  return niches.map(niche => `NICHO: ${niche.title}\nREGRA: ${niche.rule}\nMODELOS:\n${niche.messages.map(message => `- ${message.text.replaceAll("{{LECTURA}}", link)}`).join("\n")}`).join("\n\n");
}
