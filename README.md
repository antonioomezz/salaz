# Salaz

Mini-Discord: salas por link, chat em tempo real, chamada de voz em grupo e compartilhamento de tela.

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
7. Botões de microfone, fone (silenciar todos), configurações e sair da chamada ficam no rodapé da barra lateral.

O botão **+** ao lado de "Canais de texto" e "Canais de voz" cria canais novos na hora.

### Configurações de voz (ícone de engrenagem)

- Escolher **microfone** e **saída de áudio** específicos, em vez do padrão do sistema
- **Volume de entrada** e **de saída**
- Barra de **teste do microfone** ao vivo
- Ligar/desligar **cancelamento de eco**, **redução de ruído** e **ganho automático**
- Ligar/desligar os **efeitos sonoros** e ajustar o volume deles

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
- **Microfone e som da tela são streams separadas.** Chegam pela mesma conexão mas são classificadas por stream: a que tem vídeo é a tela (e o `<video>` toca o som dela), a que só tem áudio é o microfone. Sem essa separação, o som da tela sobrescreveria o microfone de quem transmite.
- **Efeitos sonoros são sintetizados em WebAudio**, sem nenhum arquivo de áudio no repositório.
- **Salas em memória:** reiniciar o servidor apaga tudo. Salas vazias são descartadas depois de 2h.
