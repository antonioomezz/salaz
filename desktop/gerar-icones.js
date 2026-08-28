/* Recorta a logo (que tem muita margem branca), gera versões e o .ico. */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const origem = path.join(__dirname, '..', 'public', 'logo.png');
const b64 = fs.readFileSync(origem).toString('base64');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const LADO = 512;
  const win = new BrowserWindow({
    width: LADO, height: LADO, show: false, frame: false, transparent: true,
    webPreferences: { offscreen: true },
  });

  // desenha a arte recortada e centralizada sobre o roxo da marca
  const html = `<html><body style="margin:0">
<canvas id="c" width="${LADO}" height="${LADO}"></canvas>
<script>
const img = new Image();
img.onload = () => {
  const c = document.getElementById('c'), g = c.getContext('2d');
  // fundo arredondado na cor da marca
  g.fillStyle = '#5865f2';
  const r = ${LADO} * 0.22;
  g.beginPath();
  g.roundRect(0, 0, ${LADO}, ${LADO}, r);
  g.fill();

  // acha os limites reais do desenho, ignorando o branco em volta
  const t = document.createElement('canvas');
  t.width = img.width; t.height = img.height;
  const tg = t.getContext('2d');
  tg.drawImage(img, 0, 0);
  const d = tg.getImageData(0, 0, img.width, img.height).data;
  let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4;
    const claro = d[i] > 235 && d[i+1] > 235 && d[i+2] > 235;
    if (d[i+3] > 20 && !claro) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const lc = x1 - x0, ac = y1 - y0;
  const escala = (${LADO} * 0.74) / Math.max(lc, ac);
  const lf = lc * escala, af = ac * escala;
  g.imageSmoothingEnabled = false;   // pixel art: sem suavizar
  g.drawImage(img, x0, y0, lc, ac, (${LADO}-lf)/2, (${LADO}-af)/2, lf, af);
  window.pronto = c.toDataURL('image/png');
};
img.src = 'data:image/png;base64,${b64}';
</script></body></html>`;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  let dataUrl = null;
  for (let i = 0; i < 40 && !dataUrl; i++) {
    await new Promise((r) => setTimeout(r, 150));
    dataUrl = await win.webContents.executeJavaScript('window.pronto || null');
  }
  if (!dataUrl) { console.error('nao gerou'); app.quit(); return; }

  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  fs.writeFileSync(path.join(__dirname, 'icon.png'), png);
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'icon-app.png'), png);

  // .ico com o PNG embutido
  const cab = Buffer.alloc(6);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(1, 4);
  const ent = Buffer.alloc(16);
  ent.writeUInt16LE(1, 4); ent.writeUInt16LE(32, 6);
  ent.writeUInt32LE(png.length, 8); ent.writeUInt32LE(22, 12);
  fs.writeFileSync(path.join(__dirname, 'icon.ico'), Buffer.concat([cab, ent, png]));

  console.log('icones gerados a partir da sua arte');
  app.quit();
});
