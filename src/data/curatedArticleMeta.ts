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
    resumo: 'O ensaio investiga a comodidade de delegar tarefas cognitivas à inteligência artificial e a consequente perda de profundidade crítica. Defende que o valor de estudar e pensar não reside apenas no acerto mecânico, mas na atividade mesma do raciocínio que impede a atrofia do intelecto.',
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
    ],
  },
  'sorte-sucesso-e-injustica': {
    gravitas: 'modicus',
    aphorismus: 'Sabendo o que é melhor, ela escolheu a ignorância ou nunca teve a oportunidade de saber?',
    resumo: 'O autor examina a composição moral do sucesso comercial baseado na exploração da ignorância alheia. Questiona se alimentar a estupidez social para enriquecer é ético e reflete se as pessoas realmente escolhem a ignorância ou se são privadas do discernimento.',
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
    ],
  },
  'verdade-e-mentira-social': {
    gravitas: 'gravis',
    aphorismus: 'A gravidade não pede a sua opinião se deve atrair: as coisas são verdades independentes dos seus efeitos.',
    resumo: 'O ensaio confronta a naturalização da falsidade sob o rótulo de convenção social e habilidades relacionais (soft skills). Apoiando-se na anedota de São Tomás de Aquino, afirma a gravidade ontológica da mentira e sustenta que a verdade independe de conveniências ou de efeitos práticos imediatos.',
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
    ],
  },
  'filosofia-teologia-e-artes-liberais': {
    gravitas: 'gravis',
    aphorismus: 'Se você só sabe o quê das coisas e não sabe o porquê, você é um decorador.',
    resumo: 'Discute os pré-requisitos intelectuais necessários para o estudo da filosofia e da teologia. Explica as sete artes liberais divididas em Trivium (linguagem) e Quadrivium (ciências exatas da lógica e proporção), resgatando o rigor da Academia platônica e a distinção aristotélica entre techne, física e metafísica.',
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
    ],
  },
  'suicidio': {
    gravitas: 'gravis',
    aphorismus: 'E se o propósito da existência for ser?',
    resumo: 'Uma investigação filosófica sobre a lógica, ontologia e temporalidade do suicídio. O texto diferencia vida biológica, vida consciente abstrata e vida biográfica, recorrendo ao conceito aristotélico de Telos e questionando o suicídio gradual em hábitos de anestesia mental e negação da existência.',
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
    ],
  },
  'o-valor-da-etimologia': {
    gravitas: 'levis',
    aphorismus: 'Saber a origem das palavras lhe permite conhecer histórias que você nunca saberia.',
    resumo: 'Apresenta a etimologia como ciência que desvela a verdade oculta no interior dos vocábulos. Exemplifica como palavras aparentemente comuns — como tchau, escravo e adeus — guardam transformações culturais profundas e mostram o passado da humanidade gravado na linguagem.',
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
    ],
  },
  'sobre-o-sincretismo': {
    gravitas: 'modicus',
    aphorismus: 'Unir duas religiões é misturar a verdade na mentira.',
    resumo: 'Diferencia a avaliação antropológica da avaliação teológica do sincretismo. Aponta que, sob a premissa de que a divindade é única e a verdade não se contradiz, a fusão indiferenciada de crenças divergentes acaba por relativizar a verdade fundamental.',
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
    ],
  },
  'dificultar-para-aprender': {
    gravitas: 'levis',
    aphorismus: 'Nós fugimos do difícil sendo que nele é onde mais aprendemos.',
    resumo: 'Ensaio sintético que desafia a aversão moderna à dificuldade. Argumenta que o obstáculo e a resistência intelectual são condições necessárias para a assimilação duradoura do conhecimento.',
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
    resumo: 'Alerta contra pequenas concessões antiéticas cotidianas cujo impacto material imediato parece desprezível. Mostra como o hábito corrompe a sensibilidade moral por degraus sucessivos, tornando atos graves aceitáveis para quem se habituou às pequenas infrações.',
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
    ],
  },
  'a-cultura-do-vitimismo-e-a-mentira-necessidade': {
    gravitas: 'gravis',
    aphorismus: 'Claramente tentar vencer o mal com outro mal não tem funcionado.',
    resumo: 'Percorre os golpes e rupturas da história republicana brasileira — de 1889 à Era Vargas e ao sacrifício de Tiradentes —, evidenciando a ausência de soberania popular e a manipulação das massas. Conclui que, embora as raízes históricas justifiquem a desconfiança popular, adotar a cultura da trapaça e do vitimismo não soluciona a injustiça.',
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
    ],
  },
};
