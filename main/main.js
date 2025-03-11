const path = require('path')
const { app, session, BrowserWindow, Menu, ipcMain } = require('electron')
const { ElectronChromeExtensions } = require('electron-chrome-extensions')
const { buildChromeContextMenu } = require('electron-chrome-context-menu')
const { setupHooker, state } = require('./hooker.js')

const ROOT_DIR = path.join(__dirname, '../../')
const PATHS = {
  PRELOAD: path.join(__dirname, '../renderer/hooker/preload.js'),
  LOCAL_EXTENSIONS: path.join(ROOT_DIR, 'extensions'),
  YOMITAN: path.join(ROOT_DIR, 'extensions/yomitan/ext'),
  // TENTEN: path.join(ROOT_DIR, 'extensions/10ten-ja-reader/dist-chrome')
}

const getParentWindowOfTab = (tab) => {
  if (!tab || tab.isDestroyed()) {
    console.warn('Attempted to get parent window of a destroyed tab');
    return null;
  }

  switch (tab.getType()) {
    case 'window':
      return BrowserWindow.fromWebContents(tab);
    case 'browserView':
    case 'webview':
      return tab.getOwnerBrowserWindow();
    case 'backgroundPage':
      return BrowserWindow.getFocusedWindow();
    default:
      throw new Error(`Unable to find parent window of '${tab.getType()}'`);
  }
};

class TabbedBrowserWindow {
  constructor(options) {
    this.session = options.session || session.defaultSession;
    this.extensions = options.extensions;

    this.window = new BrowserWindow(options.window);
    this.id = this.window.id;
    this.webContents = this.window.webContents;

    const url = options.initialUrl || options.urls.newtab;
    this.webContents.loadURL(url);

    this.tab = { webContents: this.webContents };

    this.extensions.addTab(this.tab.webContents, this.window);

    this.extensions.selectTab(this.tab.webContents)
  }

  destroy() {
    this.window.destroy();
  }

  getFocusedTab() {
    return this.tab;
  }
}

class Browser {
  windows = []

  urls = {
    newtab: 'about:blank',
  }

  constructor() {
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve
    })

    app.whenReady().then(this.init.bind(this))

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.destroy()
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) this.createInitialWindow()
    })

    app.on('web-contents-created', this.onWebContentsCreated.bind(this))
  }

  destroy() {
    app.quit()
  }

  getFocusedWindow() {
    return this.windows.find((w) => w.window.isFocused()) || this.windows[0]
  }

  getWindowFromBrowserWindow(window) {
    return !window.isDestroyed() ? this.windows.find((win) => win.id === window.id) : null
  }

  getWindowFromWebContents(webContents) {
    let window

    if (this.popup && webContents === this.popup.browserWindow?.webContents) {
      window = this.popup.parent
    } else {
      window = getParentWindowOfTab(webContents)
    }

    return window ? this.getWindowFromBrowserWindow(window) : null
  }

  async init() {
    this.initSession()
    if (process.platform !== 'darwin') {
      Menu.setApplicationMenu(null)
    } else {
      Menu.setApplicationMenu(Menu.buildFromTemplate([]))
    }

    if ('registerPreloadScript' in this.session) {
      this.session.registerPreloadScript({
        id: 'shell-preload',
        type: 'frame',
        filePath: PATHS.PRELOAD,
      })
    } else {
      this.session.setPreloads([PATHS.PRELOAD])
    }

    this.extensions = new ElectronChromeExtensions({
      license: 'internal-license-do-not-use',
      session: this.session,
      modulePath: path.join(ROOT_DIR, 'node_modules/electron-chrome-extensions'),
    
      createTab: async (details) => {
        await this.ready;
        const win = this.createWindow({
          initialUrl: details.url || this.urls.newtab
        });
        if (typeof details.active === 'boolean' ? details.active : true) {
          win.window.focus();
        }
        return [win.tab.webContents, win.window];
      },
    
      selectTab: (tabWc) => {
        const win = this.getWindowFromWebContents(tabWc);
        win?.window.focus();
      },
    
      removeTab: (tabWc) => {
        const win = this.getWindowFromWebContents(tabWc);
        win?.window.close();
      },
    
      createWindow: async (details) => {
        await this.ready;
        const win = this.createWindow({
          initialUrl: details.url,
        });
        return win.window;
      },
    
      removeWindow: (browserWindow) => {
        const win = this.getWindowFromBrowserWindow(browserWindow);
        win?.destroy();
      },
    });

    this.extensions.on('browser-action-popup-created', (popup) => {
      this.popup = popup
    })

    this.extensions.on('url-overrides-updated', (urlOverrides) => {
      if (urlOverrides.newtab) {
        this.urls.newtab = urlOverrides.newtab
      }
    })

    await this.session.loadExtension(PATHS.YOMITAN, { allowFileAccess: true })
    // await this.session.loadExtension(PATHS.TENTEN, { allowFileAccess: true })

    await Promise.all(
      this.session.getAllExtensions().map(async (extension) => {
        const manifest = extension.manifest
        if (manifest.manifest_version === 3 && manifest?.background?.service_worker) {
          await this.session.serviceWorkers.startWorkerForScope(extension.url)
        }
      }),
    )

    this.createInitialWindow()
    this.resolveReady()

    ipcMain.on('open-new-window', () => {
      const displayUrl = `file://${path.join(__dirname, '../renderer/popup/popup.html')}`;
      const isMac = process.platform === 'darwin';
      const win = new TabbedBrowserWindow({
        initialUrl: displayUrl,
        session: this.session,
        extensions: this.extensions,
        window: {
          frame: false,
          transparent: true,
          show: false,
          hasShadow: isMac ? false : undefined,
          webPreferences: {
            sandbox: true,
            nodeIntegration: false,
            enableRemoteModule: false,
            contextIsolation: true,
            worldSafeExecuteJavaScript: true,
          },
        },
      });
    
      win.window.once('ready-to-show', () => {
        win.window.maximize();
        win.window.show();
      });
    
      win.window.once('show', () => {
        win.window.focus();
        win.window.setAlwaysOnTop(true, 'screen-saver');
        if (state.currentExeName) {
          win.webContents.send('update-text', { text: state.currentText, exeName: state.currentExeName });
        }
      });
    
      this.windows.push(win);
    });

    ipcMain.on('set-bounds', (event, bounds) => {
      console.log('Received bounds:', bounds);
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (bounds === 'full') {
          const { width, height } = win.getBounds();
          win.setShape([{ x: 0, y: 0, width, height }]);
        } else {
          const shapes = bounds.map(b => ({
            x: Math.round(b.x),
            y: Math.round(b.y),
            width: Math.round(b.width),
            height: Math.round(b.height)
          }));
          win.setShape(shapes);
        }
      }
    });
  }

  initSession() {
    this.session = session.defaultSession

    const userAgent = this.session
      .getUserAgent()
      .replace(/\sElectron\/\S+/, '')
      .replace(new RegExp(`\\s${app.getName()}/\\S+`), '')
    this.session.setUserAgent(userAgent)

    this.session.serviceWorkers.on('running-status-changed', (event) => {
      console.info
    })

    if (process.env.SHELL_DEBUG) {
      this.session.serviceWorkers.once('running-status-changed', () => {
        const tab = this.windows[0]?.getFocusedTab()
        if (tab) {
          tab.webContents.inspectServiceWorker()
        }
      })
    }
  }

  createWindow(options) {
    const win = new TabbedBrowserWindow({
      ...options,
      urls: this.urls,
      extensions: this.extensions,
      window: {
        width: 1280,
        height: 650,
        // transparent: true,
        // frame: false,
        // titleBarStyle: 'hidden',
        // titleBarOverlay: {
        //   height: 31,
        //   color: '#39375b',
        //   symbolColor: '#ffffff',
        // },
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          enableRemoteModule: false,
          contextIsolation: true,
          worldSafeExecuteJavaScript: true,
        },
      },
    })
    this.windows.push(win)
    setupHooker();

    if (process.env.SHELL_DEBUG) {
      win.webContents.openDevTools({ mode: 'detach' })
    }

    return win
  }

  createInitialWindow() {
    const fileUrl = `file://${path.join(__dirname, '../renderer/hooker/hooker_config.html')}`;
    this.createWindow({ initialUrl: fileUrl });
  }

  async onWebContentsCreated(event, webContents) {
    const type = webContents.getType()
    const url = webContents.getURL()
    console.log(`'web-contents-created' event [type:${type}, url:${url}]`)

    if (process.env.SHELL_DEBUG && ['backgroundPage', 'remote'].includes(webContents.getType())) {
      webContents.openDevTools({ mode: 'detach', activate: true })
    }

    webContents.setWindowOpenHandler((details) => {
      switch (details.disposition) {
        case 'foreground-tab':
        case 'background-tab':
        case 'new-window': {
          return {
            action: 'allow',
            outlivesOpener: true,
            createWindow: ({ webContents: guest, webPreferences }) => {
              const win = this.createWindow({ initialUrl: details.url });
              return win.tab.webContents;
            },
          };
        }
        default:
          return { action: 'allow' };
      }
    });
    
    webContents.on('context-menu', (event, params) => {
      const menu = buildChromeContextMenu({
        params,
        webContents,
        extensionMenuItems: this.extensions.getContextMenuItems(webContents, params),
        openLink: (url, disposition) => {
          this.createWindow({ initialUrl: url });
        },
      });
      menu.popup();
    });
  }
}

module.exports = Browser
