/**
 * Histórico de versões do Negoneycord.
 *
 * A versão que aparece no rodapé é a primeira entrada desta lista — mantenha
 * a mais recente sempre no topo ao adicionar algo novo.
 */
export type Release = {
  version: string;
  /** dd/mm */
  date: string;
  /** resumo curto do que essa versão trouxe */
  headline: string;
  changes: string[];
};

export const RELEASES: Release[] = [
  {
    version: '0.16.0',
    date: '01/09',
    headline: 'Quem entra no meio da transmissão passa a ver',
    changes: [
      'Entrar numa chamada onde alguém já transmitia falhava de forma intermitente: metade dos candidatos de conexão era descartada, e quando a metade errada se perdia nada chegava — nem imagem, nem voz.',
      'Causa: os sinais de conexão eram tratados em paralelo, então um candidato era aplicado no meio da troca de negociação e o navegador o rejeitava.',
      'Agora cada participante tem uma fila e os sinais entram um de cada vez; o que não serve na hora é guardado e reaplicado, em vez de sumir.',
      'Tela cheia voltou a funcionar no aplicativo: ele estava negando a permissão, e o botão não respondia a nada. Dois cliques na imagem também alternam.',
      'A escolha do dispositivo de saída também estava sendo ignorada dentro do aplicativo, pelo mesmo motivo.',
    ],
  },
  {
    version: '0.15.0',
    date: '27/08',
    headline: 'Logo nova e fim da tela preta no app',
    changes: [
      'A arte do Negoneycord agora é a marca em todo lugar: telas de entrada, ícone do app e avatar do bot.',
      'Tela preta no aplicativo: ele escolhia a primeira janela da lista sem perguntar nada, muitas vezes uma minimizada. Agora abre um seletor de verdade, com miniaturas.',
      'Transmitir uma tela leva o som do computador junto; transmitir uma janela vai sem som, e o seletor avisa isso antes.',
    ],
  },
  {
    version: '0.14.0',
    date: '27/08',
    headline: 'Aplicativo de verdade para Windows',
    changes: [
      'Agora existe um Negoneycord.exe — janela própria, ícone na barra de tarefas, independente do navegador.',
      'É portátil: extrai a pasta e roda, sem instalar nada no sistema.',
      'O botão no canto virou Baixar e leva ao aplicativo.',
    ],
  },
  {
    version: '0.13.1',
    date: '24/08',
    headline: 'Botão Instalar e foto funcionando',
    changes: [
      'O botão Instalar não aparecia: faltava um handler de "fetch" no service worker, que o Chrome exige para considerar o site instalável.',
      'Agora ele está sempre visível — se o navegador não oferecer a instalação automática, mostra o caminho pelo menu.',
      'A foto de perfil já salva e volta sozinha ao recarregar.',
    ],
  },
  {
    version: '0.13.0',
    date: '24/08',
    headline: 'Foto de perfil e instalação como app',
    changes: [
      'Foto de perfil salva na nuvem: clique no seu nome, no rodapé da barra lateral. Ela volta sempre que você entrar.',
      'Botão Instalar ao lado da versão — o Negoneycord ganha ícone próprio e abre em janela sem barra de navegador.',
      'Volume da música corrigido: abaixo de 17% ficava mudo. A curva ficou mais suave e só o zero é silêncio.',
    ],
  },
  {
    version: '0.12.0',
    date: '24/08',
    headline: 'Corta o som do teclado',
    changes: [
      'Porta de ruído: o microfone só transmite quando você fala de verdade — é o que corta teclado e chiado, que a supressão do navegador deixa passar.',
      'A barra de teste do microfone mostra o limiar, para você calibrar vendo.',
      'Isolamento de voz do Chrome ligado, um filtro bem mais forte que a redução de ruído comum.',
    ],
  },
  {
    version: '0.11.0',
    date: '24/08',
    headline: 'Corrige tela preta para quem assiste',
    changes: [
      'A transmissão podia chegar preta nos outros enquanto quem transmitia via tudo certo — a prévia local não passa pelo codificador, então o problema ficava invisível de um lado só.',
      'Causa: o codec AV1 era preferido, mas é codificado por software e trava a 1080p; e uma trava minha impedia o codificador de reduzir para se salvar.',
      'Agora VP9 vem primeiro, e um vigia troca para H264 sozinho se nada estiver sendo codificado.',
      'Volume de saída vai até 200%, para fones fracos.',
      'Volume da música ganhou curva perceptual: o fim do curso fica realmente baixo, em vez de continuar alto.',
    ],
  },
  {
    version: '0.10.0',
    date: '24/08',
    headline: 'Som da transmissão sob controle',
    changes: [
      'Ao compartilhar uma janela, o som do sistema não vaza mais junto — nenhum navegador consegue isolar o áudio de uma janela, então esse áudio é descartado em vez de transmitido.',
      'Nova escolha nas configurações: som só da aba (padrão), do sistema inteiro, ou sem som.',
      'Um aviso na sala explica o que aconteceu com o áudio ao começar a transmitir.',
    ],
  },
  {
    version: '0.9.1',
    date: '24/08',
    headline: 'Controle de volume finalmente visível',
    changes: [
      'O controle de volume não aparecia: ele abria dentro de barras estreitas com recorte, e ficava cortado.',
      'Agora ele flutua por cima de tudo e sempre dentro da tela, inclusive no celular.',
      'A lista de pessoas some em janelas menores que 1024px — um botão no topo traz ela de volta.',
    ],
  },
  {
    version: '0.9.0',
    date: '24/08',
    headline: 'Versão visível no rodapé',
    changes: [
      'Indicador de versão no canto inferior direito, clicável para ver este histórico.',
      'Dá para conferir num relance se o navegador já carregou a versão nova.',
    ],
  },
  {
    version: '0.8.0',
    date: '24/08',
    headline: 'Volume da live separado do volume da voz',
    changes: [
      'Cada pessoa tem dois faders independentes de 0 a 200%: Voz e Live.',
      'O controle abre com clique ou com botão direito, na lista da direita e no canal de voz.',
      'Botão para silenciar só o som da live, no canto do quadro.',
      'Acima de 100% o áudio agora é amplificado de verdade — antes o volume travava em 100%.',
      'Resolve ouvir a chamada duplicada quando alguém transmite a tela inteira com som.',
    ],
  },
  {
    version: '0.7.0',
    date: '19/08',
    headline: 'Identidade visual própria',
    changes: [
      'Emojis substituídos por uma marca desenhada, igual em qualquer sistema.',
      'O bot passou a se chamar Nego Ney.',
      'Telas de entrada redesenhadas e configurações organizadas em cartões.',
      'Foco visível por teclado e sliders iguais entre navegadores.',
    ],
  },
  {
    version: '0.6.0',
    date: '19/08',
    headline: 'Transmissão em 1080p60',
    changes: [
      'Taxa de quadros virou escolha explícita, com 60 fps como padrão.',
      'Preset de vídeo prefere VP9/H264 no lugar do AV1, que não sustenta 60 fps.',
      'Medidor no próprio quadro mostrando resolução, fps de captura, fps enviado e Mbps.',
      'Teto de banda subiu para 10 Mbps.',
    ],
  },
  {
    version: '0.5.0',
    date: '19/08',
    headline: 'Bot procura música por nome',
    changes: [
      'Agora aceita nome em vez de link: ;play hino do vasco.',
      'O comando que você digita aparece no chat, antes da resposta do bot.',
      'O bot aparece na lista da direita como um membro.',
      'Link do Spotify vira um cartão — não é possível transmitir áudio de lá.',
    ],
  },
  {
    version: '0.4.0',
    date: '19/08',
    headline: 'Webcam',
    changes: [
      'Botão de ligar a câmera e seleção de dispositivo nas configurações.',
      'Câmera e tela funcionam juntas, em quadros separados.',
      'O app passou a se chamar Negoneycord.',
    ],
  },
  {
    version: '0.3.0',
    date: '18/08',
    headline: 'Música, imagens e tela em 1080p',
    changes: [
      'Bot de música com player sincronizado entre todos.',
      'Imagens no chat: colar, arrastar ou anexar.',
      'Volume individual por pessoa.',
      'Transmissão de tela subiu de 320x180 para 1920x1080.',
      'Mixer para tocar um arquivo de áudio dentro da chamada.',
    ],
  },
  {
    version: '0.2.0',
    date: '17/08',
    headline: 'Áudio confiável',
    changes: [
      'Microfone se recupera sozinho quando o Windows derruba a captura.',
      'Compartilhamento de tela passou a levar som junto.',
      'Efeitos sonoros ao entrar, sair e mandar mensagem.',
      'Painel de configurações de voz.',
    ],
  },
  {
    version: '0.1.0',
    date: '17/08',
    headline: 'Primeira versão',
    changes: [
      'Salas por link, chat em tempo real e canais de texto e voz.',
      'Chamada de voz em grupo e compartilhamento de tela.',
    ],
  },
];

export const CURRENT_VERSION = RELEASES[0].version;
