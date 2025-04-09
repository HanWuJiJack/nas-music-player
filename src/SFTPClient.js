export class SFTPClient {
  static async connect(config) {
    const servers = await window.electronAPI.getServers()
    const existing = servers.find(s =>
      s.id === config.id
    )

    if (existing) {
      await window.electronAPI.saveServers(servers.map(s =>
        s.host === config.host && s.username === config.username
          ? { ...s, ...config }
          : s
      ))
      return window.electronAPI.connectToServer(existing.id)
    }

    const newServer = { ...config }
    await window.electronAPI.saveServers([...servers, newServer])
    return window.electronAPI.connectToServer(newServer.id)
  }

  static async disconnect() {
    return window.electronAPI.disconnect()
  }

  static async listFiles(config) {
    return window.electronAPI.listFiles(config)
  }

  static async toReadStream(data, size, modified) {

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = Buffer.from(data, 'base64');
    const originalArrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const audioArrayBuffer = originalArrayBuffer.slice(0);
    // console.log('文件获取成功，大小arrayBuffer:', originalArrayBuffer);
    return {
      arrayBuffer: originalArrayBuffer,
      meta: {
        size,
        modified,
        duration: await new Promise((resolve, reject) => {
          audioContext.decodeAudioData(audioArrayBuffer, (buffer) => {
            resolve(buffer.duration);
          }, (error) => {
            console.error('解码音频数据失败:', error);
            resolve(null);
          });
        })
      }
    };
  }
  static async getReadStream(serverId, remotePath) {
    // console.log('文件获取成功，大小1111:', remotePath, 'serverId:', serverId);
    const { data, size, modified } = await window.electronAPI.getFileStream({
      serverId,
      remotePath
    });
    // console.log('文件获取成功，大小:', size, 'serverId:', serverId);
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = Buffer.from(data, 'base64');
    const originalArrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const audioArrayBuffer = originalArrayBuffer.slice(0);
    // console.log('文件获取成功，大小arrayBuffer:', originalArrayBuffer);
    return {
      arrayBuffer: originalArrayBuffer,
      meta: {
        size,
        modified,
        duration: await new Promise((resolve, reject) => {
          audioContext.decodeAudioData(audioArrayBuffer, (buffer) => {
            resolve(buffer.duration);
          }, (error) => {
            console.error('解码音频数据失败:', error);
            resolve(null);
          });
        })
      }
    };
  }

  /**
   * 列出目录文件
   * @param {string} path 目录路径
   * @returns {Promise<FileInfo[]>}
   */


  /**
   * 获取文件读取流
   * @param {string} filePath 文件路径
   * @returns {Promise<ReadStream>}
   */
  async getReadStream(filePath) {
    return this.client.createReadStream(filePath)
  }

  /**
   * 断开SFTP连接
   * @returns {Promise<void>}
   */
  async disconnect() {
    return this.client.end()
  }
}

export default SFTPClient