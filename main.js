const {
  app,
  BrowserWindow,
  ipcMain
} = require('electron')
const Store = require('electron-store')
const path = require('path')
const axios = require('axios');

const schema = {
  servers: {
    type: 'array',
    default: [],
    items: {
      type: 'object',
      properties: {
        id: {
          type: 'string'
        },
        host: {
          type: 'string',
          default: ''
        },
        port: {
          type: 'number',
          default: 22
        },
        username: {
          type: 'string',
          default: ''
        },
        password: {
          type: 'string',
          default: ''
        },
        path: {
          type: 'string',
          default: '/'
        }
      },
      required: ['host', 'username', 'password']
    }
  }
}

const configStore = new Store({
  schema
})



function createWindow() {
  const win = new BrowserWindow({
    width: 1250,
    height: 800,
    minWidth: 1250,
    minHeight: 800,
    // titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, './preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    // win.webContents.openDevTools()
    win.loadFile(path.join(__dirname, 'dist/index.html'))
  }
}

const Client = require('ssh2-sftp-client')
const LocalFileHandler = require(path.join(__dirname, 'src/LocalFileHandler'));

ipcMain.handle('get-file-stream', async (event, cfg) => {
  let sftp = null; // 将sftp声明提升到作用域顶部
  // console.log('get-file-stream', cfg)
  if (!['local', 'remote'].includes(cfg.mode)) {
    throw new Error(`无效的文件模式: ${cfg.mode}`);
  }
  
  // 清理可能的网络连接残留
  if(cfg.mode === 'local' && sftp && sftp.client) {
    await sftp.end().catch(() => {});
  }
  
  // console.log('文件模式验证通过:', cfg.mode);
  if (cfg.mode === 'local') {
    // 确保清理可能的残留连接
    if(sftp && sftp.client) {
      await sftp.end().catch(() => {});
      sftp = null;
    }

    try {
      // console.log('正在处理本地文件:', cfg.path);
      const {
        data,
        size,
        modified
      } = await LocalFileHandler.getFileStream({
        path: cfg.path
      });
      // console.log('文件获取成功，大小:', data.toString('base64').length, size,modified)
      return {
        data: data.toString('base64'),
        size,
        modified
      };
    } catch (error) {
      throw new Error(`本地文件获取失败: ${error.message}`);
    }
  } else {
    // console.log('进入远程模式处理，服务器ID:', cfg.serverId);
    const servers = configStore.get('servers')
    // const servers = configStore.get('servers')
    const config = servers.find(s => s.id === cfg.serverId)
    if (!config) {
      throw new Error('未找到服务器配置: ' + cfg.serverId)
    }
    // console.log('正在连接SFTP服务器:', config.host, '用户:', config.username)
    const sftp = new Client()
    // console.log('正在尝试连接SFTP服务器:')
    try {
      await sftp.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
      })
      // console.log('SFTP连接成功')

      const fileStats = await sftp.stat(cfg.path);
      const chunks = [];
      const stream = await sftp.createReadStream(cfg.path);

      const data = await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
      // console.log('文件获取成功，大小: data.toString');
      return {
        data: data.toString('base64'),
        size: fileStats.size,
        modified: fileStats.modifyTime
      };
    } catch (streamError) {
      console.error('获取文件流失败:', streamError.message)
      throw new Error(`文件流获取失败: ${streamError.message}`)
    } finally {
      await sftp.end()
    }
  }


})


ipcMain.handle('get-servers', () => {
  console.log('正在获取服务器列表:get-servers')
  return configStore.get('servers')
})

ipcMain.handle('save-servers', (event, servers) => {
  console.log('正在保存服务器列表:save-servers')
  configStore.set('servers', servers)
})

ipcMain.handle('connect-to-server', async (_, serverId) => {
  console.log('正在尝试连接SFTP服务器:connect-to-server')
  const sftp = new Client()
  const servers = configStore.get('servers')
  const config = servers.find(s => s.id === serverId)
  // console.log('连接到服务器:', config)
  try {
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    })
    return {
      cwd: await sftp.cwd(config.path)
    }
  } catch (error) {
    console.error('SFTP连接详细错误:', error)
    throw new Error(`连接失败: ${error.message}`)
  } finally {
    await sftp.end()
  }
})

// SFTP文件列表处理
ipcMain.handle('list-files', async (_, config) => {
  console.log('正在尝试连接SFTP服务器:list-files')
  const sftp = new Client()
  try {
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    })
    const files = await sftp.list(config.path || '/')
    return files
  } catch (error) {
    console.error('SFTP连接详细错误:', error)
    throw new Error(`连接失败: ${error.message}`)
  } finally {
    await sftp.end()
  }
})

// 本地文件列表处理
ipcMain.handle('list-local-files', async (_, path) => {
  console.log('正在尝试获取本地文件列表:list-local-files')
  try {
    const files = await LocalFileHandler.listFiles({
      path
    })
    return files
  } catch (error) {
    console.error('获取本地文件列表详细错误:', error)
    throw new Error(`本地文件列表获取失败: ${error.message}`)
  }
})



ipcMain.handle('disconnect', async () => {
  console.log('正在尝试连接SFTP服务器:disconnect')
  try {
    // const sftp = new Client();
    // if (sftp && sftp.client) {
    //   await sftp.end();
    //   console.log('SFTP连接已安全断开');
    // }
    return {
      success: true
    };
  } catch (error) {
    console.error('断开连接失败:', error);
    throw new Error(`断开连接失败: ${error.message}`);
  }
});

// 添加本地文件夹选择对话框
ipcMain.handle('open-directory-dialog', async () => {
  console.log('正在打开本地文件夹选择对话框:open-directory-dialog')
  const {
    dialog
  } = require('electron')
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.filePaths[0]
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})


process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception8888888888888:', error);
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Unhandled Rejection at:999999999',);
});


// 添加歌词获取处理程序
ipcMain.handle('get-lyrics', async (_, songName) => {
  try {
    const response = await axios.get('https://music.163.com/api/search/get', {
      params: {
        s: songName,
        type: 1,
        limit: 1
      }
    });

    const song = response.data.result.songs[0];
    if (!song) return { lrc: { lyric: '// 该歌曲暂无歌词' } };

    const lyricResponse = await axios.get(`https://music.163.com/api/song/lyric?id=${song.id}&lv=1`);
    return lyricResponse.data;
  } catch (error) {
    console.error('歌词获取失败:', error);
    return { lrc: { lyric: '// 歌词加载失败' } };
  }
});