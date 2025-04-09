const fs = require('fs');
const path = require('path');

class LocalFileHandler {
  static async listFiles(config) {
    try {
      const dirPath = config.path || '/'
      // console.log('本地文件列表获取开始2222:', dirPath)
      const files = await fs.promises.readdir(dirPath)
      // console.log('本地文件列表获取成功3333:', files)
      const arr = await Promise.all(files.map(async (fileName) => {
        const filePath = path.join(dirPath, fileName)
        // console.log('本地文件列表获取成功4444:', filePath)
        const stats = await fs.promises.stat(filePath).catch((error) => {
          // console.error('获取文件信息失败:', filePath, error);
          return null;
        })
        return {
          name: fileName,
          type: stats ? (stats.isDirectory() ? "d" : "-") : "e",
          size: stats ? stats.size : 0,
          modifyTime: stats ? stats.mtime : new Date(0),
          accessTime: stats ? stats.atime : new Date(0)
        }
      }))
      // console.log('本地文件列表获取成功6666:', arr)
      const arr2 = arr.filter(item => {
        // console.log('item:', item)
        return item && item.type !== 'e' && (item.type == 'd' || LocalFileHandler.FnFilterNameFarmats(item.name))
      })
      // console.log('本地文件列表获取成功6666:', arr2)
      return arr2
    } catch (error) {
      console.error('本地文件读取失败:', error)
      // throw new Error(`本地文件读取失败: ${error.message}`)
    }
  }

  static FilterNameFarmats = [
    'wav',
    'mp3',
    'flac'
  ]
  static FnFilterNameFarmats(name) {
    if (name.indexOf('.') > -1) {
      const arr = name.split('.')
      const type = arr[arr.length - 1]
      return LocalFileHandler.FilterNameFarmats.includes(type)
    } else {
      return false
    }
  }


  static async getFileStream({
    path
  }) {
    // console.log("getFileStream", path)
    try {
      const stats = await fs.promises.stat(path);
      const data = await fs.promises.readFile(path);
      // console.log("getFileStream", data)
      return {
        data: data,
        size: stats.size,
        modified: stats.mtime
      };
    } catch (error) {
      throw new Error(`文件流获取失败: ${error.message}`)
    }
  }
}

async function streamToArrayBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

module.exports = LocalFileHandler;