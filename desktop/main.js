/*
 * Negoneycord para desktop.
 *
 * O app é uma casca: ele carrega o Negoneycord que já está no ar, então não
 * existe código duplicado — corrigir algo no site corrige no app também, sem
 * precisar publicar versão nova.
 *
 * O que a casca acrescenta é o que o navegador não dá: janela própria sem
 * barra de endereço, ícone na barra de tarefas e as permissões de mídia já
 * concedidas.
 */
const { app, BrowserWindow, session, shell, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const { abrirSeletor } = require('./seletor');

const URL_PADRAO = 'https://salaz-s87d.onrender.com';
const endereco = process.env.NEGONEYCORD_URL || URL_PADRAO;

// segunda instância apenas foca a janela que já existe
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function configurarPermissoes(ses) {
  /*
   * Microfone, câmera e tela: dentro do app não faz sentido perguntar de
   * novo — a pessoa já escolheu abrir o Negoneycord. Liberamos apenas para o
   * nosso endereço.
   */
  const origemPermitida = new URL(endereco).origin;

  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const daNossaOrigem = webContents.getURL().startsWith(origemPermitida);
    const liberadas = ['media', 'display-capture', 'clipboard-read', 'clipboard-sanitized-write'];
    callback(daNossaOrigem && liberadas.includes(permission));
  });

  ses.setPermissionCheckHandler((_wc, permission, origem) => {
    const liberadas = ['media', 'display-capture', 'clipboard-read'];
    return origem === origemPermitida && liberadas.includes(permission);
  });

  /*
   * Sem isto o compartilhamento de tela NÃO funciona no Electron: o
   * getDisplayMedia do site fica sem resposta, porque não existe o seletor
   * nativo do Chrome aqui dentro.
   *
   * O seletor é nosso, e não do sistema, porque precisamos decidir o áudio
   * conforme a escolha: tela inteira leva o som do sistema, janela não leva
   * (o Windows não deixa isolar o som de uma janela sem componente nativo).
   */
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const fontes = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 200 },
        fetchWindowIcons: true,
      });

      const escolha = await abrirSeletor(fontes);
      if (!escolha) {
        // usuário cancelou: devolver vazio é o jeito correto de recusar
        callback({});
        return;
      }

      const fonte = fontes.find((f) => f.id === escolha.id);
      if (!fonte) {
        callback({});
        return;
      }

      /*
       * 'loopback' captura o som do sistema inteiro. Só oferecemos em tela
       * cheia: para janela ele traria TODO o som do computador, que é
       * justamente o contrário do esperado.
       */
      callback(escolha.comAudio ? { video: fonte, audio: 'loopback' } : { video: fonte });
    } catch (err) {
      console.error('falha ao listar as fontes de tela:', err);
      callback({});
    }
  });
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#1a1b1e',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    title: 'Negoneycord',
    webPreferences: {
      // a casca não injeta nada na página; é só um navegador dedicado
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.loadURL(endereco);

  // links externos (YouTube, Spotify) abrem no navegador de verdade
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(new URL(endereco).origin)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // sem internet, mostra um aviso em vez de tela de erro do Chromium
  win.webContents.on('did-fail-load', (_e, codigo, descricao, urlFalhou) => {
    if (urlFalhou !== endereco) return;
    void win.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(`
<html><body style="background:#1a1b1e;color:#dbdee1;font-family:Segoe UI,sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">
<div><h1 style="font-size:20px;margin:0 0 8px">Sem conexão</h1>
<p style="color:#949ba4;font-size:14px;margin:0 0 20px">
Não consegui alcançar o Negoneycord.<br>Verifique sua internet e tente de novo.</p>
<p style="color:#5c5f66;font-size:12px">${descricao} (${codigo})</p>
<button onclick="location.href='${endereco}'"
style="margin-top:16px;background:#5865f2;color:#fff;border:0;border-radius:8px;
padding:10px 20px;font-size:14px;cursor:pointer">Tentar de novo</button></div>
</body></html>`)
    );
  });

  return win;
}

app.whenReady().then(() => {
  configurarPermissoes(session.defaultSession);
  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
