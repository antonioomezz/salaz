/*
 * Seletor de tela do app.
 *
 * Existe porque a escolha da fonte decide o áudio, e isso o seletor do
 * sistema não sabe fazer: tela inteira leva o som do computador, janela não
 * leva nenhum. Antes daqui o código pegava a primeira fonte da lista sem
 * perguntar nada — era o que fazia a transmissão sair preta, compartilhando
 * uma janela qualquer, muitas vezes minimizada.
 */
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const escapar = (t) =>
  String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function montarHtml(fontes) {
  const cartao = (f) => {
    const ehTela = f.id.startsWith('screen:');
    return `
      <button class="fonte" data-id="${escapar(f.id)}" data-tela="${ehTela ? '1' : '0'}">
        <img src="${f.thumbnail.toDataURL()}" alt="">
        <span class="nome">${escapar(f.name)}</span>
        <span class="tipo">${ehTela ? 'som do computador incluído' : 'sem som'}</span>
      </button>`;
  };

  const telas = fontes.filter((f) => f.id.startsWith('screen:'));
  const janelas = fontes.filter((f) => !f.id.startsWith('screen:'));

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin:0; background:#1a1b1e; color:#dbdee1;
    font-family:'Segoe UI',system-ui,sans-serif; padding:20px; user-select:none; }
  h1 { font-size:17px; margin:0 0 4px; color:#fff; }
  .ajuda { font-size:12px; color:#949ba4; margin:0 0 18px; line-height:1.5; }
  h2 { font-size:11px; text-transform:uppercase; letter-spacing:.06em;
    color:#949ba4; margin:18px 0 10px; }
  .grade { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:12px; }
  .fonte { background:#2b2d31; border:2px solid transparent; border-radius:10px;
    padding:8px; cursor:pointer; text-align:left; color:inherit; font:inherit;
    display:flex; flex-direction:column; gap:6px; transition:border-color .12s, background .12s; }
  .fonte:hover { background:#35373c; border-color:#5865f2; }
  .fonte img { width:100%; aspect-ratio:16/10; object-fit:cover;
    border-radius:6px; background:#000; }
  .nome { font-size:12.5px; color:#dbdee1; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis; }
  .tipo { font-size:10.5px; color:#949ba4; }
  .rodape { position:sticky; bottom:0; margin-top:20px; padding-top:14px;
    background:#1a1b1e; display:flex; justify-content:flex-end; }
  .cancelar { background:#383a40; color:#dbdee1; border:0; border-radius:8px;
    padding:9px 20px; font-size:13px; cursor:pointer; }
  .cancelar:hover { background:#404249; }
  .vazio { font-size:12px; color:#949ba4; }
</style></head><body>
  <h1>O que você quer transmitir?</h1>
  <p class="ajuda">
    Compartilhar uma <b>tela inteira</b> leva junto o som do computador.<br>
    Uma <b>janela</b> vai sem som — o Windows não permite isolar o áudio de uma janela.
  </p>

  <h2>Telas</h2>
  <div class="grade">${telas.map(cartao).join('') || '<p class="vazio">nenhuma tela</p>'}</div>

  <h2>Janelas</h2>
  <div class="grade">${janelas.map(cartao).join('') || '<p class="vazio">nenhuma janela aberta</p>'}</div>

  <div class="rodape"><button class="cancelar" id="cancelar">Cancelar</button></div>

<script>
  document.querySelectorAll('.fonte').forEach((b) => {
    b.addEventListener('click', () => {
      window.seletor.escolher(b.dataset.id, b.dataset.tela === '1');
    });
  });
  document.getElementById('cancelar').addEventListener('click', () => window.seletor.cancelar());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.seletor.cancelar(); });
</script></body></html>`;
}

/** Abre o seletor e resolve com { id, comAudio }, ou null se cancelar. */
function abrirSeletor(fontes) {
  return new Promise((resolve) => {
    const pai = BrowserWindow.getAllWindows()[0] ?? null;
    const win = new BrowserWindow({
      width: 860,
      height: 660,
      parent: pai,
      modal: true,
      show: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      title: 'Escolher o que transmitir',
      backgroundColor: '#1a1b1e',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'picker-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    let respondido = false;
    const responder = (valor) => {
      if (respondido) return;
      respondido = true;
      ipcMain.removeListener('fonte-escolhida', aoEscolher);
      if (!win.isDestroyed()) win.close();
      resolve(valor);
    };

    const aoEscolher = (evento, dados) => {
      // só aceita mensagens da própria janela do seletor
      if (evento.sender !== win.webContents) return;
      responder(dados);
    };

    ipcMain.on('fonte-escolhida', aoEscolher);
    // fechar no X equivale a cancelar
    win.on('closed', () => responder(null));

    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(montarHtml(fontes)));
    win.once('ready-to-show', () => win.show());
  });
}

module.exports = { abrirSeletor };
