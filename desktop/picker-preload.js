/* Ponte mínima entre a janela do seletor e o processo principal. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('seletor', {
  escolher: (id, comAudio) => ipcRenderer.send('fonte-escolhida', { id, comAudio }),
  cancelar: () => ipcRenderer.send('fonte-escolhida', null),
});
