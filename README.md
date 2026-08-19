# Negoneycord

Mini-Discord: salas por link, chat em tempo real, chamada de voz em grupo, câmera e
compartilhamento de tela.

Sem banco de dados, sem Docker, sem login. As salas vivem na memória do servidor.

---

## Rodar no seu PC

```bash
npm install
```

```bash
npm run dev
```

Abre **http://localhost:3800**.

Para rodar em modo produção (mais rápido e leve):

```bash
npm run build
```

```bash
npm start
```

---

## Como usar

1. Digite seu nome e clique em **Criar sala** — a URL vira algo como `/room/x7K92a`.
2. Clique no cabeçalho da barra lateral (**Sala x7K92a**) para copiar o link.
3. Mande o link para os amigos. Quem abrir só precisa digitar o nome.
4. Todo mundo conversa por texto na hora.
5. Clique no canal de voz **🔊 Geral** para entrar na chamada (o navegador vai pedir permissão do microfone).
6. Dentro da chamada, o botão **Tela** transmite tela inteira, janela ou aba — **com som**. Marque "compartilhar áudio" na janelinha do navegador; funciona melhor compartilhando uma aba do Chrome/Edge.
7. O botão **Câmera** liga a webcam. Câmera e tela funcionam ao mesmo tempo e aparecem como
   quadros separados.
8. Botões de microfone, fone (silenciar todos), configurações e sair da chamada ficam no rodapé da barra lateral.

O botão **+** ao lado de "Canais de texto" e "Canais de voz" cria canais novos na hora.

### Imagens no chat

Cole com **Ctrl+V**, arraste para a janela ou use o clipe. A imagem é reduzida e
recomprimida no navegador antes de subir. Clique nela para ver em tamanho cheio.

As imagens vivem **só na memória do servidor** — nada em disco, nada no navegador. Quando o
serviço reinicia ou hiberna, elas somem por completo junto com as mensagens. Cada sala guarda
no máximo 25 imagens; passando disso, as mais antigas são liberadas.

### Volume de cada pessoa

Clique numa pessoa na lista da direita para abrir o controle dela: slider de **0 a 200%** e
botão de silenciar só aquela pessoa. Fica salvo por nome, então vale nas próximas vezes.

Até 100% o ajuste é direto no elemento de áudio. Acima disso entra amplificação por WebAudio
— pode distorcer, e nesse modo a escolha de dispositivo de saída não se aplica.

### Bot de música

Comandos no chat de texto:

| Comando | O que faz |
| --- | --- |
| `;play hino do vasco` | procura no YouTube e toca a primeira que achar |
| `;play <link do YouTube>` | toca esse vídeo direto |
| `;pause` `;resume` `;skip` `;stop` | controla quem está tocando |
| `;queue` | mostra a fila |
| `;help` | lista os comandos |

`;` e `;;` fazem a mesma coisa — um é atalho do outro. O comando que você digita
fica no chat como mensagem normal, e o bot responde embaixo. Ele também aparece na
lista da direita como um membro, mostrando o que está tocando.

### Busca do bot

Sem configuração nenhuma, a busca lê a página de resultados do YouTube e pega o primeiro
vídeo. **Funciona, mas é frágil**: é um uso não previsto pelo YouTube e quebra se eles
mudarem o layout da página.

Para deixar estável, crie uma chave gratuita da **YouTube Data API v3** e defina a variável
de ambiente `YOUTUBE_API_KEY` (no Render: Environment → Add Environment Variable). Com ela
o bot passa a usar a API oficial. A cota gratuita dá cerca de 100 buscas por dia.

**A cota não gera cobrança.** É um teto rígido: quando acaba, a API só responde com erro até
resetar (meia-noite no horário do Pacífico). Essa API não tem faixa paga, então não há como
gastar dinheiro nela. Não é preciso ativar faturamento no projeto do Google Cloud.

Se a cota estourar, o bot **não para**: ele volta sozinho para a busca pela página. Você só
perde a estabilidade até o dia seguinte.

O servidor guarda a posição da música e sincroniza todo mundo: o player de cada um se corrige
sozinho quando a defasagem passa de 1,5s. Quem entra depois já cai no ponto certo.

**A música toca no navegador de cada um, não pela chamada de voz.** É o que permite usar o
player oficial do YouTube sem baixar áudio no servidor — o caminho que derrubou os bots de
música do Discord em 2021. Efeito prático é o mesmo: todos ouvem juntos, e cada um regula seu
próprio volume.

**Spotify não pode ser transmitido.** Não existe forma legítima de mandar áudio do Spotify
para fora do app deles. Um link do Spotify vira só um cartão com capa e nome — e o bot sugere
mandar o nome da música, que aí ele procura no YouTube e toca.

### Tocar um arquivo de áudio na chamada

Nas configurações, em "Tocar áudio na chamada", escolha um mp3. Ele entra no **mixer** junto
com a sua voz, então todos ouvem pela chamada. É o que o player do YouTube não pode fazer:
o áudio de um iframe é de outra origem e o navegador não deixa capturar.

### Configurações de voz (ícone de engrenagem)

- Escolher **microfone**, **saída de áudio** e **câmera** específicos, em vez do padrão do sistema
- **Volume de entrada** e **de saída**
- Barra de **teste do microfone** ao vivo
- Ligar/desligar **cancelamento de eco**, **redução de ruído** e **ganho automático**
- Ligar/desligar os **efeitos sonoros** e ajustar o volume deles
- Preset de **qualidade da transmissão**: "texto e código" (nítido) ou "vídeo e jogo" (fluido)
- Tocar um **arquivo de áudio** dentro da chamada, com fader próprio

Mudanças valem na hora, sem derrubar a chamada. Tudo fica salvo no navegador.

> Se a sua voz sumir enquanto alguém transmite tela com som, desligue o **cancelamento de eco**: ele às vezes confunde o som da transmissão com eco e corta sua voz junto.

---

## Colocar no ar para os amigos

O microfone e o compartilhamento de tela só funcionam em **localhost** ou em **https**. Por isso não dá para simplesmente mandar seu IP local — precisa de um endereço https.

### Opção rápida: túnel para o seu PC

Deixe `npm run dev` rodando e, em outro terminal, exponha a porta 3800 com um túnel https (Cloudflare Tunnel, ngrok ou similar). O túnel devolve uma URL https pública; é essa URL que você manda para os amigos. Funciona enquanto seu PC estiver ligado com o servidor rodando.

### Opção permanente: Render, Railway ou Fly.io

Serve qualquer host que rode Node e aceite WebSocket. **Não use Vercel** — o Socket.IO precisa de um servidor que fique de pé, e o Vercel é serverless.

No Render (tem plano gratuito), crie um *Web Service* apontando para o repositório e configure:

| Campo | Valor |
| --- | --- |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Environment | Node |

O servidor já respeita a variável `PORT` que o host injeta, então não precisa mexer em mais nada.

---

## Se alguém não conseguir ouvir os outros

O MVP usa apenas servidores STUN públicos do Google. Isso resolve a grande maioria dos casos, mas quem estiver atrás de um NAT muito restritivo (algumas redes corporativas e certas operadoras de celular) pode não conectar.

A solução é um servidor TURN. O código já está preparado: basta criar um `.env.local` (veja `.env.example`) com as credenciais de um TURN — há serviços com plano gratuito — e reiniciar. Nenhuma linha de código muda; a configuração está isolada em `src/lib/rtc.ts`.

---

## Como está organizado

```
server.js                  Next.js + Socket.IO no mesmo processo; salas em memória
src/app/page.tsx           tela inicial: nome, criar sala, entrar por código
src/app/room/[id]/page.tsx a sala
src/components/RoomClient  orquestra socket, estado da sala e layout
src/components/Sidebar     canais, quem está na voz, controles de mic/tela/sair
src/components/Chat        mensagens em tempo real
src/components/Stage       vídeos de quem está compartilhando a tela
src/components/MemberList  lista de presentes
src/hooks/useVoice.ts      toda a lógica WebRTC (malha P2P)
src/lib/rtc.ts             STUN/TURN — único lugar a mexer para adicionar TURN
```

### Detalhes que importam

- **Malha P2P (mesh):** cada pessoa se conecta diretamente a cada outra. Ótimo até ~6-8 pessoas na mesma chamada; acima disso o upload de quem transmite começa a sofrer. Trocar por um SFU depois mexe só em `useVoice.ts`.
- **Perfect negotiation:** os dois lados podem mandar oferta ao mesmo tempo sem quebrar a conexão — quem é "polite" cede.
- **Fila de candidatos ICE:** candidatos que chegam antes da descrição remota ficam guardados e são aplicados depois. Sem isso, quem entra na chamada com ela já rolando fica preso sem áudio.
- **O estado de quem está na voz vem do servidor,** não do cliente, para os participantes nunca divergirem sobre quem está onde.
- **Vigia do microfone:** no Windows, abrir a captura de tela pode reiniciar o subsistema de áudio e matar a track do microfone. Um watchdog detecta isso (track `ended` ou `muted`), recaptura o microfone e troca a track nas conexões com `replaceTrack` — sem renegociar e sem derrubar a chamada.
- **Cada tipo de mídia é uma stream separada.** Chegam pela mesma conexão, e o track remoto não
  diz de onde veio. A que só tem áudio é o microfone; para distinguir **câmera de tela**, cada
  pessoa anuncia pelo servidor os ids das suas MediaStreams (`camStreamId`, `screenStreamId`) e o
  receptor usa isso para montar os quadros. Sem isso, câmera e tela se confundiriam.
- **Efeitos sonoros são sintetizados em WebAudio**, sem nenhum arquivo de áudio no repositório.
- **Qualidade da tela é configurada explicitamente.** Sem `contentHint`, `maxBitrate` e
  `degradationPreference`, o navegador degradava a transmissão para 320x180 por conta própria.
  Com eles, e preferindo AV1/VP9, a tela chega em 1920x1080.
- **O mixer só entra quando precisa.** Com o volume de entrada em 100% e nenhum arquivo
  tocando, o que vai para a rede é a track crua do microfone, sem WebAudio no caminho — é o
  ponto mais sensível do app e fica protegido por padrão.
- **Salas em memória:** reiniciar o servidor apaga tudo. Salas vazias são descartadas depois de 2h.
