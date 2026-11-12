export interface ScholiaItem {
  term: string;
  etymology: string;
  meaning: string;
}

export interface CuratedMeta {
  gravitas: 'levis' | 'modicus' | 'gravis';
  aphorismus: string;
  resumo: string;
  scholia: ScholiaItem[];
}

export const CURATED_ARTICLE_META: Record<string, CuratedMeta> = {
  'filosofar-na-era-da-ia': {
    gravitas: 'modicus',
    aphorismus: 'É importante pensar, mesmo estando errado.',
    resumo: 'O ensaio enfrenta a ilusão contemporânea de que a facilidade proporcionada pela inteligência artificial representa evolução cognitiva do ser humano. O autor argumenta que a terceirização generalizada do intelecto gera perda irremediável de profundidade analítica, habituando a mente a um determinismo passivo de buscas rápidas e soluções por força bruta ("go horse"). Defende que o propósito primordial de estudar e pensar não é a infalibilidade do resultado prático, mas o próprio exercício do raciocínio crítico: assim como a física aristotélica guarda valor inestimável por instigar o pensamento mesmo quando superada empiricamente, o ato de filosofar é o que preserva a autonomia da inteligência contra a atrofia.',
    scholia: [
      {
        term: 'Determinismo',
        etymology: 'Do latim determinare (delimitar, fixar com termos).',
        meaning: 'A crença ou sistema onde todas as respostas são preestabelecidas por regras fixas, eliminando a contingência da reflexão.',
      },
      {
        term: 'Crítica',
        etymology: 'Do grego krinein (discernir, separar, julgar).',
        meaning: 'A habilidade primordial do pensamento de discriminar o verdadeiro do aparente, perdida quando nos contentamos com resultados prontos.',
      },
      {
        term: 'Prompt',
        etymology: 'Do latim promptus (visível, manifesto, pronto a agir, particípio de promere, trazer à luz).',
        meaning: 'Comando ou instrução textual fornecida como ponto de partida a um modelo computacional de linguagem.',
      },
      {
        term: 'Go horse',
        etymology: 'Expressão idiomática do jargão técnico contemporâneo (eXtreme Go Horse, XGH).',
        meaning: 'Metodologia informal ou caótica de execução direta sem planejamento prévio nem rigor analítico, feita na força bruta.',
      },
    ],
  },
  'sorte-sucesso-e-injustica': {
    gravitas: 'modicus',
    aphorismus: 'Sabendo o que é melhor, ela escolheu a ignorância ou nunca teve a oportunidade de saber?',
    resumo: 'Uma provocativa investigação ética sobre as engrenagens silenciosas do sucesso comercial baseado na exploração da ingenuidade pública. Recusando a discussão convencional sobre mérito ou sorte, o autor questiona a legitimidade moral de lucrar através do rebaixamento intelectual da sociedade, alimentando um consumo raso que perpetua a estupidez coletiva. Formula a questão fundamental sobre a ignorância: ela pode ser considerada uma escolha individual quando o indivíduo jamais teve a oportunidade ou a luz para discernir o melhor, ou capitalizar sobre essa privação equivale a abusar deliberadamente da vulnerabilidade de quem não tem defesas?',
    scholia: [
      {
        term: 'Injustiça',
        etymology: 'Do latim in-justitia (negação do direito reto e equitativo).',
        meaning: 'A violação da equidade que ocorre quando a assimetria de conhecimento é instrumentalizada contra quem não tem meios de defesa.',
      },
      {
        term: 'Ignorância',
        etymology: 'Do latim ignorare (não conhecer, desconhecer).',
        meaning: 'O estado de privação do saber, problematizado pelo autor entre a carência involuntária de oportunidade e a conivência social.',
      },
      {
        term: 'Estupidez',
        etymology: 'Do latim stupiditas, derivado de stupere (ficar atônito, paralisado, entorpecido).',
        meaning: 'Entorpecimento intelectual ou insensibilidade ao discernimento cultivada por estímulos rasos.',
      },
    ],
  },
  'verdade-e-mentira-social': {
    gravitas: 'gravis',
    aphorismus: 'A gravidade não pede a sua opinião se deve atrair: as coisas são verdades independentes dos seus efeitos.',
    resumo: 'O autor confronta a complacência moderna com a falsidade relacional, recusando travestir o ato de pensar X e dizer Y sob rótulos corporativos ou sociais de "soft skills". Resgatando a máxima de São Tomás de Aquino sobre a improbabilidade ontológica de um cristão mentir, estabelece a distinção basilar entre a maldade da pessoa e a maldade objetiva do ato de falsear. Apresenta um modelo analítico de mentira baseado em "tom" (disposição interna) e "grau" (intensidade), sustentando que a verdade possui existência real e objetiva independente de conveniências humanas, aplausos ou consequências utilitárias. Conclui que a mentira social atua como uma droga anestésica que corrompe o discernimento, alertando que mesmo o silêncio complacente pode se constituir em mentira.',
    scholia: [
      {
        term: 'Ontologia',
        etymology: 'Do grego ontos (o ser, aquilo que é) + logos (razão, estudo).',
        meaning: 'O estudo da realidade intrínseca das coisas: a verdade existe em si mesma, não nos acordos humanos.',
      },
      {
        term: 'Aletheia',
        etymology: 'Do grego a-letheia (o desvelamento, o não-esquecimento).',
        meaning: 'A verdade concebida como revelação límpida do real, em oposição direta ao encobrimento e à manipulação intencional.',
      },
      {
        term: 'Soft skill',
        etymology: 'Do inglês soft (suave, maleável) + skill (habilidade, destreza; do nórdico antigo skil, discernimento).',
        meaning: 'Habilidade comportamental e relacional, usada socialmente muitas vezes como eufemismo para polidez ou conveniência.',
      },
      {
        term: 'Intrínseco',
        etymology: 'Do latim intrinsecus (interiormente, de dentro para dentro).',
        meaning: 'Aquilo que pertence à essência e à própria natureza da coisa, independente de fatores exteriores.',
      },
    ],
  },
  'filosofia-teologia-e-artes-liberais': {
    gravitas: 'gravis',
    aphorismus: 'Se você só sabe o quê das coisas e não sabe o porquê, você é um decorador.',
    resumo: 'Uma rigorosa crítica pedagógica à inversão educacional contemporânea que tenta introduzir os estudantes diretamente nas ciências elevadas (como a teologia e a ética superior) sem a indispensável propedêutica das sete artes liberais e da reflexão filosófica básica. O autor distingue categoricamente o "saber o quê" (mera memorização passiva e decoreba) do "saber o porquê" (verdadeiro domínio das causas primeiras). Recupera a estrutura clássica do Trivium (gramática, dialética e retórica) como domínio da linguagem e do pensamento, e do Quadrivium (aritmética, geometria, música e astronomia) como percepção das proporções cósmicas, reafirmando o princípio platônico da Academia de que o acesso às verdades mais sublimes exige preparação intelectual e voluntário compromisso com o rigor.',
    scholia: [
      {
        term: 'Trivium',
        etymology: 'Do latim tres viae (três caminhos).',
        meaning: 'A encruzilhada inicial do pensamento livre composta por Gramática, Lógica/Dialética e Retórica.',
      },
      {
        term: 'Quadrivium',
        etymology: 'Do latim quattuor viae (quatro caminhos).',
        meaning: 'As quatro artes matemáticas medievais: Aritmética (o número em si), Geometria (no espaço), Música (no tempo) e Astronomia (no espaço e tempo).',
      },
      {
        term: 'Techne',
        etymology: 'Do grego τέχνη (arte, ofício, habilidade técnica).',
        meaning: 'A aplicação prática e metódica do conhecimento, raiz da ideia de arte enquanto técnica que capacita e liberta.',
      },
      {
        term: 'Philosophia',
        etymology: 'Do grego philos (amigo, amante) + sophia (sabedoria, discernimento superior).',
        meaning: 'O amor apaixonado pela investigação desinteressada da verdade e das causas primeiras.',
      },
      {
        term: 'Theologia',
        etymology: 'Do grego theos (Deus) + logos (razão, estudo, verbo).',
        meaning: 'A reflexão racional e sistemática sobre a natureza divina e a relação do Criador com a existência.',
      },
      {
        term: 'Dialética',
        etymology: 'Do grego dialektike (arte do diálogo, debate racional de teses).',
        meaning: 'Método de argumentação lógica que confronta proposições contraditórias para alcançar síntese superior.',
      },
      {
        term: 'Retórica',
        etymology: 'Do grego rhetorike (arte da oratória persuasiva).',
        meaning: 'A técnica de estruturar e enunciar o discurso para convencer e transmitir a verdade com clareza.',
      },
      {
        term: 'Petição de princípio',
        etymology: 'Do latim petitio principii (tradução do grego de Aristóteles to en archei aiteisthai).',
        meaning: 'Falácia lógica em que a premissa que se quer demonstrar já é assumida como verdadeira na partida.',
      },
      {
        term: 'Metafísica',
        etymology: 'Do grego meta ta physika (além das coisas físicas/naturais).',
        meaning: 'A investigação ontológica fundamental dos princípios que transcendem a matéria e o mundo sensível.',
      },
    ],
  },
  'suicidio': {
    gravitas: 'gravis',
    aphorismus: 'E se o propósito da existência for ser?',
    resumo: 'Um aprofundado exame filosófico que busca desvendar a coerência lógica e as falhas ontológicas subjacentes ao suicídio. O autor desmonta o raciocínio niilista ("a vida não tem sentido, logo não há por que viver"), evidenciando que ele confunde a incapacidade subjetiva de cognoscer o propósito com a sua inexistência objetiva. Mapeia a questão em vertentes materialistas e teleológicas sob o conceito aristotélico de Telos, examinando a dialética entre altruísmo, vaidade do reconhecimento e a finitude cósmica. Diferencia a existência em três níveis — vida biológica (função orgânica), vida consciente abstrata (capacidade de indagar o sentido) e vida biográfica (a realização concreta do ser no tempo). A partir disso, formula a tese do "suicídio prospectivo": a destruição interna e cotidiana através de drogas, hábitos entorpecentes e fuga do potencial humano, que diferem da morte física imediata apenas na variável do tempo, mas apontam para a mesma negação radical da vida. Conclui que se o propósito transcende a mente finita, a extinção nunca pode ser a resposta racional para aquilo que não se pode esgotar por vias naturais.',
    scholia: [
      {
        term: 'Telos',
        etymology: 'Do grego τέλος (fim, propósito, consumação).',
        meaning: 'A finalidade intrínseca para a qual uma substância ou ação humana se orienta em vista de um bem maior (Telos Ariston).',
      },
      {
        term: 'Eudaimonia',
        etymology: 'Do grego eu (bom) + daimon (espírito guardião, divindade).',
        meaning: 'A plenitude ou florescimento humano, frequentemente traduzida como felicidade madura alcançada pelo exercício da virtude.',
      },
      {
        term: 'Epistemologia',
        etymology: 'Do grego episteme (conhecimento certo, ciência) + logos (estudo).',
        meaning: 'A disciplina filosófica que investiga como cognoscemos e distinguimos a verdade objetiva da mera percepção subjetiva.',
      },
      {
        term: 'Ontologia',
        etymology: 'Do grego ontos (o ser que é) + logos (razão, tratado).',
        meaning: 'O ramo fundamental da filosofia que indaga o estatuto real do ser enquanto ser.',
      },
      {
        term: 'Demiurgo',
        etymology: 'Do grego demiourgos (artesão público, criador; demos, povo + ergon, obra).',
        meaning: 'O princípio ordenador do cosmos material na filosofia platônica, usado no ensaio como figura de validação exterior.',
      },
      {
        term: 'Cognoscer',
        etymology: 'Do latim cognoscere (vir a conhecer perfeitamente, discernir).',
        meaning: 'Apreender pelo intelecto a realidade das coisas além das impressões empíricas imediatas.',
      },
      {
        term: 'Efêmero',
        etymology: 'Do grego ephemeros (que dura apenas um dia; epi, sobre + hemera, dia).',
        meaning: 'Aquilo que é transitório, passageiro e desprovido de permanência temporal.',
      },
      {
        term: 'Prospectivo',
        etymology: 'Do latim prospicere (olhar adiante, antever).',
        meaning: 'Aquilo que se refere ao devir ou futuro potencial que a consciência pode vir a concretizar.',
      },
    ],
  },
  'o-valor-da-etimologia': {
    gravitas: 'levis',
    aphorismus: 'Saber a origem das palavras lhe permite conhecer histórias que você nunca saberia.',
    resumo: 'O ensaio resgata a etimologia como uma arqueologia viva do espírito humano, demonstrando que as palavras não são meros códigos gramaticais convencionais, mas repositórios da história, das virtudes e das transformações culturais da humanidade. Ao dissecar as origens de termos cotidianos — como a transição do latim sclavus para a saudação de cortesia "tchau" no vêneto, ou a locução latina ad Deum na raiz do "adeus" —, o autor revela como a linguagem preserva a memória espiritual dos povos e comprova que resgatar a genealogia dos vocábulos é um meio poderoso de reencontrar o sentido genuíno da realidade.',
    scholia: [
      {
        term: 'Etymon',
        etymology: 'Do grego ἔτυμον (o verdadeiro, autêntico, primitivo).',
        meaning: 'A raiz seminal e o sentido genuíno original de uma palavra antes de suas mutações históricas.',
      },
      {
        term: 'Morfologia',
        etymology: 'Do grego morphe (forma) + logos (estudo).',
        meaning: 'O estudo das formas estruturais dos vocábulos, distinguindo a arquitetura gramatical do conteúdo etimológico histórico.',
      },
      {
        term: 'Tchau',
        etymology: 'Do dialeto vêneto s-ciavo (escravo vosso, submisso às vossas ordens, do latim medieval sclavus).',
        meaning: 'Saudação de despedida que nasceu como reverência cortês de servidão voluntária e respeito mútuo.',
      },
      {
        term: 'Ad Deum',
        etymology: 'Locução latina clássica formada pela preposição ad (a, em direção a) + acusativo Deum (Deus).',
        meaning: 'Recomendação final a Deus ao se despedir, raiz exata da palavra "adeus".',
      },
    ],
  },
  'sobre-o-sincretismo': {
    gravitas: 'modicus',
    aphorismus: 'Unir duas religiões é misturar a verdade na mentira.',
    resumo: 'Uma análise que diferencia a abordagem descritiva da antropologia do julgamento valorativo da filosofia e da teologia perante o sincretismo religioso. Partindo da origem helênica do conceito em Plutarco (a aliança provisória entre cretenses contra um adversário externo), o autor demonstra que a amálgama indiferenciada de crenças com postulados contraditórios não gera síntese nem tolerância autêntica, mas a dissolução da verdade em relativismo. Sustenta que onde tudo possui o mesmo valor sem respeito ao princípio de não-contradição, o valor real de tudo se anula, resultando em uma indiferença que destrói a própria essência da fé.',
    scholia: [
      {
        term: 'Sincretismo',
        etymology: 'Do grego synkretismos (união dos cretenses contra um inimigo comum).',
        meaning: 'A aliança ou amálgama de doutrinas heterogêneas, que da esfera política grega migrou para o campo religioso.',
      },
      {
        term: 'Dogma',
        etymology: 'Do grego dokein (parecer, crer firmemente).',
        meaning: 'Princípio aceito como verdade basilar que não admite contemporização ou fusão arbitrária sem descaracterizar sua fé.',
      },
      {
        term: 'Antropológico',
        etymology: 'Do grego anthropos (homem, ser humano) + logos (estudo, reflexão).',
        meaning: 'Perspectiva descritiva focada nos costumes, manifestações e fenômenos sociais produzidos pela humanidade.',
      },
    ],
  },
  'dificultar-para-aprender': {
    gravitas: 'levis',
    aphorismus: 'Nós fugimos do difícil sendo que nele é onde mais aprendemos.',
    resumo: 'O autor confronta a obsessão moderna pelo atalho, pela conveniência e pela remoção indiscriminada de atritos no aprendizado. Dialogando com a sabedoria estoica e com a psicologia cognitiva do esforço deliberado, defende que o obstáculo e a aporia inicial não são defeitos a serem contornados, mas as ferramentas indispensáveis pelas quais a inteligência se fortalece. A facilidade excessiva funciona como anestesia que gera a ilusão de competência passageira, enquanto o esforço diante da complexidade é a única via para a consolidação duradoura do intelecto.',
    scholia: [
      {
        term: 'Aporia',
        etymology: 'Do grego a-poros (sem passagem, caminho intransitável).',
        meaning: 'O impasse ou dificuldade conceitual inicial que força o filósofo a investigar e pensar além do óbvio.',
      },
      {
        term: 'Askesis',
        etymology: 'Do grego ἄσκησις (exercício, treinamento metódico).',
        meaning: 'A disciplina de suportar o esforço voluntário para forjar uma virtude ou aptidão intelectual.',
      },
    ],
  },
  'nunca-devemos-praticar-algo-que-e-possivelmente-mal': {
    gravitas: 'modicus',
    aphorismus: 'Correr riscos assim é perigosíssimo, mesmo sendo coisas pequenas.',
    resumo: 'Uma reflexão ética que alerta contra o perigo sutil das pequenas concessões cotidianas cujo impacto danoso imediato parece insignificante. Apoiando-se no conceito aristotélico de habitus, o ensaio demonstra que a moralidade é moldada pela repetição cumulativa das ações: quem se permite transgredir em coisas mínimas por conveniência corrompe gradualmente o discernimento do certo e do errado. Mostra que o limiar do mal não se rompe de uma só vez, mas por degraus sucessivos de anestesia moral que tornam atos graves admissíveis para quem já normalizou a desonestidade banal.',
    scholia: [
      {
        term: 'Habitus',
        etymology: 'Do latim habere (ter, posse habitual).',
        meaning: 'A disposição moral constante incorporada pela repetição reiterada de atos, que molda silenciosamente o caráter humano.',
      },
      {
        term: 'Ética',
        etymology: 'Do grego ethos (morada, costume arraigado).',
        meaning: 'O conjunto de costumes e princípios que orientam o agir humano, ameaçado pela erosão sutil das concessões banais.',
      },
      {
        term: 'Ambíguo',
        etymology: 'Do latim ambiguus (que oscila entre duas direções, incerto; ambigere, mover-se em torno).',
        meaning: 'Ato ou enunciado que comporta dupla interpretação ou julgamento moral incerto.',
      },
      {
        term: 'K9',
        etymology: 'Designação moderna derivada de cannabinoid synthetic receptor agonists (família canabinóide sintética).',
        meaning: 'Droga sintética de alta potência neurotóxica utilizada como metáfora do extremo perigoso de degradação.',
      },
    ],
  },
  'a-cultura-do-vitimismo-e-a-mentira-necessidade': {
    gravitas: 'gravis',
    aphorismus: 'Claramente tentar vencer o mal com outro mal não tem funcionado.',
    resumo: 'Uma contundente dissecção moral e sociológica da psique nacional que investiga a gênese da cultura do "levei vantagem" e da trapaça erigidas como falsa identidade. O autor mapeia o histórico de rupturas autoritárias do Brasil — desde a Proclamação da República de 1889 concebida como golpe militar sem respaldo popular ("o povo assistiu bestializado"), passando pela alternância oligárquica do café com leite e os sucessivos golpes da Era Vargas —, demonstrando que apenas uma ínfima fração de nossa história conheceu soberania verdadeiramente democrática. Examina a carência de arquétipos morais e o sacrifício de Tiradentes como mártir e bode expiatório de uma elite que sempre se esquivou das consequências, até a alienação do gentílico "brasileiro" gerado como ofício mercantil extrativista. O núcleo filosófico do ensaio recusa energicamente que séculos de espoliação e desamparo sirvam de salvo-conduto ético para o jeitinho e o vitimismo: o sofrimento crônico explica a tentação da mediocridade, mas não a justifica. Tentar combater a injustiça com esperteza vil é perpetuar o próprio ciclo de degradação que subjugou a nação.',
    scholia: [
      {
        term: 'Oligarquia',
        etymology: 'Do grego oligos (poucos) + arche (governo, poder).',
        meaning: 'O controle do Estado por uma minoria agrária ou financeira em benefício próprio, apartada do povo.',
      },
      {
        term: 'Martírio',
        etymology: 'Do grego martys (testemunha).',
        meaning: 'A morte ou sacrifício assumido como testemunho de uma causa coletiva, encarnado na memória popular por Tiradentes.',
      },
      {
        term: 'Cabresto',
        etymology: 'Do latim capistrum (arreio, cabeçada para animais).',
        meaning: 'A metáfora do eleitor tutelado e subjugado por coação física ou econômica durante a República Velha.',
      },
      {
        term: 'Carta Magna',
        etymology: 'Do latim carta (papel, decreto) + magna (grande, soberana).',
        meaning: 'A lei fundamental e suprema de um país que rege e limita todos os poderes instituídos; Constituição.',
      },
      {
        term: 'Queremismo',
        etymology: 'Neologismo político brasileiro derivado da palavra de ordem popular "Queremos Getúlio" (1945).',
        meaning: 'Movimento popular e caudilhista que reivindicava a continuidade autoritária de Getúlio Vargas no poder.',
      },
      {
        term: 'Pluripartidarismo',
        etymology: 'Do latim plures (vários, múltiplos) + pars (parte, facção política).',
        meaning: 'Regime democrático caracterizado pela livre existência e atuação de múltiplos partidos políticos.',
      },
      {
        term: 'Derrama',
        etymology: 'Do verbo derramar (espalhar amplamente; no sentido fiscal, cobrar cota forçada de tributos).',
        meaning: 'Cobrança compulsória e violenta de impostos atrasados sobre o ouro imposta pela Coroa Portuguesa em Minas Gerais.',
      },
      {
        term: 'Inconfidência',
        etymology: 'Do latim in- (negação) + confidentia (fidelidade, confiança recíproca com a Coroa).',
        meaning: 'Acusação de deslealdade política ou conspiração contra o monarca reinante.',
      },
      {
        term: 'Bode expiatório',
        etymology: 'Do hebraico Azazel (rito bíblico do Levítico) e do latim expiare (purificar com sacrifício).',
        meaning: 'Indivíduo ou grupo que suporta injustamente a punição e culpa pelas faltas alheias para preservar os mandatários.',
      },
    ],
  },
  'como-a-busca-de-deus-e-o-principal-desejo-humano': {
    gravitas: 'gravis',
    aphorismus: 'O humano saiu das marcas de sangue para as marcas da alma.',
    resumo: 'O ensaio investiga a busca humana pelo divino ao longo de 300 mil anos de história, demonstrando como a capacidade de abstração e simbolismo elevou a espécie humana das marcas biológicas de sangue para as marcas transcendentais da alma. Analisa a passagem dos mitos cosmológicos para a filosofia pré-socrática na busca pelo arché (em Tales e Heráclito), identificando nas causas primeiras os atributos seminais da criação e do governo divino. Conecta essa inquietação à encarnação do Logos bíblico (o Verbo da Vulgata que se fez carne) e à teologia patrística de Clemente de Alexandria em Stromata, sustentando a tese de que a filosofia helênica não foi um desvio pagão antagônico, mas uma pedagogia preparatória e providencial para o encontro com o Criador.',
    scholia: [
      {
        term: 'Arché',
        etymology: 'Do grego ἀρχή (início, princípio ordenador, governo; do verbo árchō).',
        meaning: 'O princípio primordial e causa primeira de todas as coisas investigado pelos filósofos pré-socráticos, que ao mesmo tempo origina e rege o cosmos.',
      },
      {
        term: 'Logos',
        etymology: 'Do grego λόγος (palavra, verbo, razão cósmica; derivado de légein, reunir, falar).',
        meaning: 'A Razão ordenadora do universo que na teologia joanina da Vulgata Latina (Verbum) se faz carne e habita entre os homens.',
      },
      {
        term: 'Anacronismo',
        etymology: 'Do grego ἀνά (para trás, contra) + χρόνος (tempo).',
        meaning: 'O vício de projetar conceitos, categorias ou compreensões posteriores sobre épocas e autores do passado.',
      },
      {
        term: 'Stromata',
        etymology: 'Do grego στρώματα (tapeçarias, mantas bordadas, miscelâneas).',
        meaning: 'Título da célebre obra de Tito Flávio Clemente (Clemente de Alexandria), reunindo reflexões sobre fé, cultura grega e filosofia.',
      },
      {
        term: 'Micênico',
        etymology: 'Referente a Micenas (cidade da Grécia Antiga) e à civilização helênica do final da Idade do Bronze.',
        meaning: 'Período anterior à filosofia socrática no qual a busca por sentido se expressava no politeísmo mítico das forças naturais.',
      },
      {
        term: 'Baal',
        etymology: 'Do semítico ba\'al (senhor, mestre, possuidor).',
        meaning: 'Divindade cananeia da fertilidade e tempestades, símbolo bíblico recorrente das tentações de idolatria que afastavam o povo de Israel do culto reto ao Deus verdadeiro.',
      },
    ],
  },
};
