import { useState, useEffect, useRef } from 'react'
import './App.css'
import ServerConfigModal from './ServerConfigModal'
import SFTPClient from './SFTPClient'
import React from 'react'
import { FiFolder, FiFile, FiChevronRight } from 'react-icons/fi'
import LyricsDisplay from './LyricsDisplay'

export default function App() {
  const [currentTrack, setCurrentTrack] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [serverFiles, setServerFiles] = useState([])
  const [currentPath, setCurrentPath] = useState('/')
  const [config, setConfig] = useState({})
  const [isLocalMode, setIsLocalMode] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [metaOr, setMetaOr] = useState({});
  const [lyrics, setLyrics] = useState('');
  const [currentTrackindex, setCurrentTrackindex] = useState(-1);
  const [volume, setVolume] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [playbackMode, setPlaybackMode] = useState('sequential');
  const playbackModeRef = useRef(playbackMode);
  const currentTrackindexRef = useRef(currentTrackindex);
  const debounceTimer = useRef(null);
  const debounceTimerLoad = useRef(null);
  const latestFile = useRef(null);
  const latestIndex = useRef(null);

  useEffect(() => {
    playbackModeRef.current = playbackMode;
    currentTrackindexRef.current = currentTrackindex;
  }, [playbackMode, currentTrackindex]);

  const handlePlayPause = () => {
    if (audioElement) {
      if (isPlaying) {
        audioElement.pause();
      } else {
        audioElement.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleNextTrack = async () => {
    let index;
    index = currentTrackindexRef.current + 1;
    // console.log('index1', index, currentTrackindexRef.current)
    if (index === serverFiles.length) {
      index = 0;
    }
    // console.log('index2', index)
    const file = serverFiles[index];
    setCurrentTrackindex(index);
    await handlePlayFile(file, index);
  };

  const handlePrevTrack = async () => {
    let index = currentTrackindexRef.current - 1
    if (index == -1) {
      index = serverFiles.length - 1;
    }
    const file = serverFiles[index];
    setCurrentTrackindex(index);
    await handlePlayFile(file, index);
  };

  useEffect(() => {
    let interval;
    if (isPlaying && audioElement) {
      interval = setInterval(() => {
        setCurrentTime(audioElement.currentTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, audioElement]);

  const loadFile = async (file, mode) => {
    try {
      const pathSeparator = currentPath.endsWith('/') ? '' : '/';
      const filePath = mode === 'local'
        ? `${currentPath}${pathSeparator}${file.name}`
        : `${currentPath}${file.name}`;
      // console.log('filePath', filePath)
      const { data, size, modified } = await window.electronAPI.file.getStream({
        serverId: config.id,
        path: filePath,
        mode: mode
      });
      const { arrayBuffer, meta } = await SFTPClient.toReadStream(data, size, modified);
      setMetaOr(meta);
      const blob = new Blob([arrayBuffer]);
      if (!blob) return;
      initializeAudio(blob, file)
    } catch (error) {
      const modeStr = mode === 'local' ? '本地' : '远程';
      console.error(`${modeStr}文件播放失败:`, error);
      alert(`${modeStr}文件播放失败: ${error.message}`);
    }
  }
  const newAudioAddEventListenerLoadeddata = () => {
    setCurrentTrackindex(latestIndex.current);
    debounceTimerLoad.current = null;
    // setCurrentTrack(`${file.name}`);
    // console.log('newAudioAddEventListenerLoadeddata')
  }
  const newAudioAddEventListenerEnded = () => {
    setIsPlaying(false);
    const currentMode = playbackModeRef.current;
    // console.log('currentMode', currentMode)
    if (currentMode === 'sequential') {
      // console.log('sequential')
      return handleNextTrack();
    }
    if (currentMode === 'random') {
      // console.log('random')
      const index = Math.floor(Math.random() * serverFiles.length);
      const file = serverFiles[index];
      return handlePlayFile(file, index);
    }
    if (currentMode === 'single') {
      // console.log('single')
      newAudio.currentTime = 0;
      setCurrentTime(0);
      newAudio.play();
      setIsPlaying(true);
      return;
    }
  }
  const initializeAudio = (blob, file) => {
    const audioUrl = URL.createObjectURL(blob);
    let newAudio = null;
    if (audioElement) {
      newAudio = audioElement;
      newAudio.pause();
      newAudio.currentTime = 0;
      URL.revokeObjectURL(newAudio.src);
      newAudio.src = audioUrl;
      newAudio.removeEventListener('loadeddata', newAudioAddEventListenerLoadeddata);
      newAudio.removeEventListener('ended', newAudioAddEventListenerEnded);
    } else {
      newAudio = new Audio(audioUrl);
    }
    setAudioElement(newAudio);
    setCurrentTrack(file.name);
    newAudio.play();
    setIsPlaying(true);
    newAudio.addEventListener('loadeddata', newAudioAddEventListenerLoadeddata);
    newAudio.addEventListener('ended', newAudioAddEventListenerEnded);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    // 从网易云音乐API获取歌词
    debounceTimer.current = setTimeout(() => {
      const songName = file.name.replace(/\.[^/.]+$/, '');
      window.electronAPI.getLyrics(songName).then((searchRes) => {
        if (searchRes?.lrc?.lyric) {
          // console.log('searchRes.lrc.lyric', searchRes.lrc.lyric)
          setLyrics(searchRes.lrc.lyric);
        } else {
          setLyrics('// 该歌曲暂无歌词');
        }
      }).catch((error) => {
        console.error('歌词获取失败:', error);
        setLyrics('// 歌词加载失败');
      }).finally(() => {
        debounceTimer.current = null;
      });
    }, 300);

  }

  const handlePlayFile = (file, index) => {
    console.log('handlePlayFile1', index)
    latestFile.current = file;
    latestIndex.current = index;

    if (debounceTimerLoad.current) {
      clearTimeout(debounceTimerLoad.current);
    }
    debounceTimerLoad.current = setTimeout(() => {
      loadFile(latestFile.current, isLocalMode ? 'local' : 'remote')
    }, 1000);

  };

  const handleRemoteConnect = async (config) => {
    try {
      await SFTPClient.connect(config)
      const files = await SFTPClient.listFiles({ ...config, path: currentPath })
      // console.log('远程服务器文件列表:', files)
      setServerFiles(files)
      setIsConnected(true)
    } catch (error) {
      console.error('远程连接失败:', error)
      alert(`远程连接失败: ${error.message}`)
      await SFTPClient.disconnect()
      setIsConnected(false)
    }
  }

  const handleLocalConnect = async () => {
    // console.log('本地连接')
    const localPath = await window.electronAPI.local.chooseDirectory()
    setCurrentPath(localPath)
    await getLocalListFiles()
  }

  const getLocalListFiles = async () => {
    // console.log('本地连接getLocalListFiles')
    try {
      const files = await window.electronAPI.local.listFiles(currentPath)
      // console.log('本地文件列表:', files)
      setServerFiles(files)
      // setIsConnected(true)
    } catch (error) {
      console.error('本地连接失败:', error)
      alert(`本地连接失败: ${error.message}`)
      // setIsConnected(false)
    }
  }

  useEffect(() => {
    // console.log('isLocalMode', isLocalMode)
    if (config.id && !isLocalMode) {
      setConfig({ ...config, path: currentPath })
      handleRemoteConnect(config)
    }
    if (isLocalMode) {
      getLocalListFiles()
    }
  }, [currentPath])

  const handleDisconnect = async () => {
    // console.log('断开连接')
    try {
      await SFTPClient.disconnect()
      setIsConnected(false)
      setServerFiles([])
      setCurrentPath('/')
    } catch (error) {
      console.error('断开连接失败:', error)
      alert(`断开连接失败: ${error.message}`)
    }
  }

  const handleOpenFolder = async (folderName) => {
    const pathSeparator = currentPath.endsWith('/') ? '' : '/';
    const newPath = `${currentPath}${pathSeparator}${folderName}/`
    setCurrentPath(newPath)
  }

  const handleSaveConfig = (config) => {
    handleRemoteConnect(config)
    setConfig(config)
    setShowConfigModal(false)
  }
  const [isDragging, setIsDragging] = useState(false);

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const offsetX = e.clientX - rect.left;
    const newTime = (offsetX / width) * (metaOr?.duration || 1);

    setCurrentTime(newTime);
    if (audioElement) {
      audioElement.currentTime = newTime;
    }
  };

  const handleMouseDown = () => {
    setIsDragging(true);
    document.body.style.cursor = 'pointer';
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && audioElement) {
        const rect = document.querySelector('.progress-bar').getBoundingClientRect();
        const width = rect.width;
        const offsetX = e.clientX - rect.left;
        const newTime = Math.max(0, Math.min((offsetX / width) * metaOr.duration, metaOr.duration));

        setCurrentTime(newTime);
        audioElement.currentTime = newTime;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, metaOr?.duration]);
  return (
    <React.Fragment>
      <div className="container">
        <div className="top-navbar">
          <div className="nav-content">
            <div className="mode-switch">
              <button
                className={`mode-btn ${!isLocalMode ? 'active' : ''}`}
                onClick={() => {
                  setIsLocalMode(false);
                  handleDisconnect()
                }}
              >
                远程模式
              </button>
              <button
                className={`mode-btn ${isLocalMode ? 'active' : ''}`}
                onClick={() => {
                  setIsLocalMode(true)
                  handleDisconnect()
                }}
              >
                本地模式
              </button>
            </div>
            <button
              className="connect-btn"
              onClick={isConnected ? handleDisconnect : (isLocalMode ? handleLocalConnect : () => setShowConfigModal(true))}
            >
              {isConnected ? '断开连接' : (isLocalMode ? '选择本地文件夹' : '连接服务器')}
            </button>
            {isConnected && (
              <div className="server-status">
                <span>已连接：{config.host}</span>
                <span>当前路径：{currentPath}</span>
              </div>
            )}
            {
              isLocalMode && (
                <div className="server-status">
                  <span>当前路径：{currentPath}</span>
                </div>
              )
            }
          </div>
        </div>
        <div className="main-content">
          <div className="main-content-left">
            <div className="search-container">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="搜索歌曲名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="file-list">

              {serverFiles
                .map((file, index) => (
                  (file.type === 'd' || file.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
                  <div
                    key={`${file.name}_${file.modified}`}
                    className={`file-item ${file.type === 'd' ? 'folder-item' : ''}`}
                    onDoubleClick={() => file.type === 'd' && handleOpenFolder(file.name)}
                  >
                    {file.type === 'd' ? (
                      <FiFolder className="file-icon" />
                    ) : (
                      <FiFile className="file-icon" />
                    )}
                    <span>{file.name}</span>
                    {file.type !== 'd' && (
                      <button
                        className="play-btn"
                        onClick={async () => {
                          // setCurrentTrackindex(index);
                          await handlePlayFile(file, index)
                        }}
                      >
                        {isPlaying && currentTrackindex === index ? '⏸' : '▶'}
                      </button>
                    )}
                  </div>
                ))}

            </div>

            <div className="player-controls">
              <div className="track-info">
                <span style={{ marginRight: 10, fontSize: 25, fontWeight: 600 }}>{currentTrack || '未选择曲目'}</span>
                <span style={{ fontSize: 12, color: "#ccc" }}> ({Math.round(currentTime)}/{Math.round(metaOr?.duration || 0)}s)</span>
                <div
                  className="progress-bar"
                  onClick={handleProgressClick}
                  onMouseDown={handleMouseDown}
                  style={{ cursor: isDragging ? 'pointer' : 'default' }}
                >
                  <div
                    className="progress"
                    style={{
                      width: `${(currentTime / (metaOr?.duration || 1)) * 100}%`,
                      transition: isDragging ? 'none' : 'width 0.3s'
                    }}
                  />
                </div>
              </div>
              <div className="control-buttons">
                <div className="button-group">
                  <button onClick={handlePrevTrack}>⏮</button>
                  <button onClick={handlePlayPause}>{isPlaying ? '⏸' : '▶'}</button>
                  <button onClick={handleNextTrack}>⏭</button>
                </div>
                <div className="mode-buttons">
                  <button
                    className={playbackMode === 'single' ? 'active' : ''}
                    onClick={() => setPlaybackMode('single')}>
                    ↻
                  </button>
                  <button
                    className={playbackMode === 'random' ? 'active' : ''}
                    onClick={() => setPlaybackMode('random')}>
                    ∞
                  </button>
                  <button
                    className={playbackMode === 'sequential' ? 'active' : ''}
                    onClick={() => setPlaybackMode('sequential')}>
                    ⇄
                  </button>
                </div>
                <div className="volume-controls">
                  <button
                    onClick={() => {
                      const newVolume = volume > 0 ? 0 : 1;
                      setVolume(newVolume);
                      if (audioElement) audioElement.volume = newVolume;
                    }}
                  >
                    {volume > 0 ? '🔊' : '🔇'}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => {
                      const newVolume = parseFloat(e.target.value);
                      setVolume(newVolume);
                      if (audioElement) audioElement.volume = newVolume;
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="main-content-right">
            <LyricsDisplay
              lyrics={lyrics}
              currentTime={currentTime}
            />
          </div>
        </div>
      </div>

      <ServerConfigModal
        visible={showConfigModal}
        onCancel={() => setShowConfigModal(false)}
        onSave={handleSaveConfig}
      />
    </React.Fragment>
  )
}


















