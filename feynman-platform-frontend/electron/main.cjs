// 第 15 课：Electron 主进程。它是一个 Node.js 程序，负责开窗口；窗口里跑的还是我们的 React 页面。
// 开发时加载 Vite 开发服务器（ELECTRON_START_URL），打包后加载 dist-desktop/index.html（file:// 协议）。
// 接口地址仍是 http://localhost:3000/api，所以桌面端运行时后端也要开着。
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // 页面里不能直接用 Node，被注入的脚本也拿不到文件系统
      contextIsolation: true,
    },
  });

  // 笔记里的外部链接用系统浏览器打开，不在应用里开新窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    win.loadURL(startUrl);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist-desktop/index.html'));
  }

  // 冒烟测试用：设了 ELECTRON_SMOKE_SHOT 就在加载完 3 秒后截图存到这个路径并退出
  const shot = process.env.ELECTRON_SMOKE_SHOT;
  if (shot) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const image = await win.webContents.capturePage();
        fs.writeFileSync(shot, image.toPNG());
        console.log(`smoke: ${win.webContents.getURL()} title=${win.getTitle()}`);
        app.quit();
      }, 3000);
    });
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
