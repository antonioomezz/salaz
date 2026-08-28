# Negoneycord para desktop

Aplicativo Windows do Negoneycord. É uma **casca**: ele carrega o site que já
está no ar, então não existe código duplicado — o que você corrige no site vale
no app na mesma hora, sem precisar gerar versão nova.

O que a casca acrescenta, e o navegador não dá:

- janela própria, sem barra de endereço
- ícone e entrada própria na barra de tarefas
- permissões de microfone, câmera e tela já concedidas
- links externos (YouTube, Spotify) abrem no navegador de verdade
- tela de "sem conexão" decente em vez do erro do Chromium

## Rodar durante o desenvolvimento

```bash
cd desktop
npm install
npm start
```

Para apontar para o servidor local em vez do que está no ar:

```bash
NEGONEYCORD_URL=http://localhost:3800 npm start
```

## Gerar o aplicativo

```bash
cd desktop
npm run build
```

Sai em `dist/Negoneycord-win32-x64/`. Compacte essa pasta e publique em
**Releases** no GitHub — é de lá que o botão de download do site puxa.

O `dist/` não vai para o git de propósito: são ~270MB, ou ~110MB compactado.

## Sobre o aviso do Windows

O executável não é assinado digitalmente, então o Windows pode mostrar
"Windows protegeu o seu PC" na primeira execução. É só clicar em
**Mais informações** → **Executar assim mesmo**. Some o aviso de vez só com um
certificado de assinatura, que custa algumas centenas de dólares por ano.

## Depois

Esta versão é só a casca. Os poderes que justificam um app nativo ainda não
estão aqui:

- capturar o áudio de **uma janela** específica (o navegador não consegue)
- tecla de atalho global para falar, funcionando dentro do jogo
