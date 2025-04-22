import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'
import ServerConfigModal from './ServerConfigModal'
import SFTPClient from './SFTPClient'
import React from 'react'
import { FiFolder, FiFile, FiMusic, FiSearch, FiServer, FiHome } from 'react-icons/fi'
import { BsMusicNoteBeamed, BsPlayFill, BsPauseFill, BsSkipBackwardFill, BsSkipForwardFill } from 'react-icons/bs'
import { IoMdRepeat, IoMdShuffle, IoMdInfinite } from 'react-icons/io'
import { BiSolidVolumeFull, BiSolidVolumeMute } from 'react-icons/bi'
import LyricsDisplay from './LyricsDisplay'

// 歌词缓存，避免重复请求相同歌词
const lyricsCache = {};

export default function App() {
  const [currentTrack, setCurrentTrack] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [serverFiles, setServerFiles] = useState([])
  const [currentPath, setCurrentPath] = useState('/')
  const [config, setConfig] = useState({})
  const [isLocalMode, setIsLocalMode] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [metaOr, setMetaOr] = useState({});
  const [lyrics, setLyrics] = useState('');
  const [currentTrackindex, setCurrentTrackindex] = useState(-1);
  const [volume, setVolume] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [playbackMode, setPlaybackMode] = useState('sequential');
  const [isDragging, setIsDragging] = useState(false);

  // Refs to track latest state values for use in closures
  const playbackModeRef = useRef(playbackMode);
  const currentTrackindexRef = useRef(currentTrackindex);
  const currentTrackRef = useRef(currentTrack);
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const serverFilesRef = useRef(serverFiles);
  const currentPathRef = useRef(currentPath);
  const isLocalModeRef = useRef(isLocalMode);
  const configRef = useRef(config);
  const latestFile = useRef(null);
  const latestIndex = useRef(-1);
  const debounceTimerLoad = useRef(null);
  const debounceTimer = useRef(null);
  const isConnectedRef = useRef(isConnected);
  // Keep refs in sync with state
  useEffect(() => {
    playbackModeRef.current = playbackMode;
    currentTrackindexRef.current = currentTrackindex;
    currentTrackRef.current = currentTrack;
    isPlayingRef.current = isPlaying;
    volumeRef.current = volume;
    serverFilesRef.current = serverFiles;
    currentPathRef.current = currentPath;
    isLocalModeRef.current = isLocalMode;
    configRef.current = config;
    // 控制音量
    if (audioRef.current) {
      audioRef.current.volume = volumeRef.current;
    }
    isConnectedRef.current = isConnected;
  }, [playbackMode, currentTrackindex, currentTrack, isPlaying, volume, serverFiles, currentPath, isLocalMode, config, isConnected]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlayingRef.current) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlayingRef.current);
    }
  };

  const handleNextTrack = async () => {
    if (serverFilesRef.current.length === 0) {
      return;
    }
    let index;
    index = currentTrackindexRef.current + 1;
    if (index === serverFilesRef.current.length) {
      index = 0;
    }
    const file = serverFilesRef.current[index];
    setCurrentTrackindex(index);
    await handlePlayFile(file, index);
  };

  const handlePrevTrack = async () => {
    if (serverFilesRef.current.length === 0) {
      return;
    }
    let index = currentTrackindexRef.current - 1
    if (index == -1) {
      index = serverFilesRef.current.length - 1;
    }
    const file = serverFilesRef.current[index];
    setCurrentTrackindex(index);
    await handlePlayFile(file, index);
  };

  useEffect(() => {
    let animationFrameId;

    const updatePlayTime = () => {
      if (isPlayingRef.current && audioRef.current) {
        if (Math.abs(currentTime - audioRef.current.currentTime) > 0.1) {
          setCurrentTime(audioRef.current.currentTime);
        }
        animationFrameId = requestAnimationFrame(updatePlayTime);
      }
    };

    if (isPlayingRef.current && audioRef.current) {
      animationFrameId = requestAnimationFrame(updatePlayTime);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlayingRef.current, currentTime]);

  const loadFile = async (file, mode) => {
    try {
      // 检查是否已经在播放同一文件，避免重复加载
      if (currentTrackRef.current === file.name && isPlayingRef.current) {
        return;
      }

      const pathSeparator = currentPathRef.current.endsWith('/') ? '' : '/';
      const filePath = mode === 'local'
        ? `${currentPathRef.current}${pathSeparator}${file.name}`
        : `${currentPathRef.current}${file.name}`;

      const { data, size, modified } = await window.electronAPI.file.getStream({
        serverId: configRef.current.id,
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
  }
  const newAudioAddEventListenerEnded = () => {
    console.log('newAudioAddEventListenerEnded');
    setIsPlaying(false);
    const currentMode = playbackModeRef.current;
    if (currentMode === 'sequential') {
      handleNextTrack();
      return;
    }
    if (currentMode === 'random') {
      const index = Math.floor(Math.random() * serverFilesRef.current.length);
      console.log('随机播放:', index,);
      const file = serverFilesRef.current[index];
      console.log('随机播放file:', file,);
      handlePlayFile(file, index);
      return;
    }
    if (currentMode === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }
  }
  const initializeAudio = (blob, file) => {
    const audioUrl = URL.createObjectURL(blob);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }

      audioRef.current.removeEventListener('loadeddata', newAudioAddEventListenerLoadeddata);
      
      console.log('移除事件监听1');
      audioRef.current.removeEventListener('ended', newAudioAddEventListenerEnded);
      console.log('移除事件监听2');
      audioRef.current.src = audioUrl;
    } else {
      audioRef.current = new Audio(audioUrl);
    }

    setCurrentTrack(file.name);

    audioRef.current.addEventListener('loadeddata', newAudioAddEventListenerLoadeddata);
    audioRef.current.addEventListener('ended', newAudioAddEventListenerEnded);

    audioRef.current.play();
    setIsPlaying(true);

    if (audioRef.current) {
      audioRef.current.volume = volumeRef.current;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const songName = file.name.replace(/\.[^/.]+$/, '');

      if (lyricsCache[songName]) {
        setLyrics(lyricsCache[songName]);
        debounceTimer.current = null;
        return;
      }

      window.electronAPI.getLyrics(songName).then((searchRes) => {
        if (searchRes?.lrc?.lyric) {
          lyricsCache[songName] = searchRes.lrc.lyric;
          setLyrics(searchRes.lrc.lyric);
        } else {
          lyricsCache[songName] = '// 该歌曲暂无歌词';
          setLyrics('// 该歌曲暂无歌词');
        }
      }).catch((error) => {
        console.error('歌词获取失败:', error);
        lyricsCache[songName] = '// 歌词加载失败';
        setLyrics('// 歌词加载失败');
      }).finally(() => {
        debounceTimer.current = null;
      });
    }, 300);
  }

  const handlePlayFile = (file, index) => {
    // 避免多次点击同一首歌重复加载
    if (currentTrackRef.current === file.name && isPlayingRef.current) {
      return;
    }

    latestFile.current = file;
    latestIndex.current = index;

    if (debounceTimerLoad.current) {
      clearTimeout(debounceTimerLoad.current);
    }
    // 缩短延迟时间以提高响应速度
    debounceTimerLoad.current = setTimeout(() => {
      loadFile(latestFile.current, isLocalModeRef.current ? 'local' : 'remote')
    }, 300);
  };

  const handleRemoteConnect = async (config) => {
    try {
      await SFTPClient.connect(config)
      const files = await SFTPClient.listFiles({ ...config, path: currentPathRef.current })
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
    const localPath = await window.electronAPI.local.chooseDirectory()
    setCurrentPath(localPath)
    await getLocalListFiles(localPath)
  }

  const getLocalListFiles = async (path) => {
    console.log('getLocalListFiles', path)
    try {
      const files = await window.electronAPI.local.listFiles(path)
      console.log('files', files)
      setServerFiles(files)
    } catch (error) {
      console.error('本地连接失败:', error)
      alert(`本地连接失败: ${error.message}`)
    }
  }

  const getFileListName = (path) => {
    // 远程模式下，有配置ID且路径发生变化时，重新连接
    if (!isLocalModeRef.current && isConnectedRef.current) {
      console.log("handleRemoteConnect")
      setConfig({ ...configRef.current, path: path });
      handleRemoteConnect(configRef.current);
    }
    // 本地模式下，且已经选择了路径（不是默认路径），列出本地文件
    else if (isLocalModeRef.current) {
      console.log("getLocalListFiles")
      getLocalListFiles(path);
    }
  }
  const handleDisconnect = async (tag = 2) => {
    console.log('handleDisconnect', tag)
    setIsConnected(false)
    setServerFiles([])
    setCurrentPath('/')
    if (tag === 1) {
      setIsLocalMode(false);
    }
    if (tag === 2) {
      setIsLocalMode(true);
      if (isConnectedRef.current) {
        try {
          await SFTPClient.disconnect()
        } catch (error) {
          console.error('断开连接失败:', error)
          alert(`断开连接失败: ${error.message}`)
        }
      }
    }
  }

  const handleOpenFolder = async (folderName) => {
    const pathSeparator = currentPathRef.current.endsWith('/') ? '' : '/';
    const newPath = `${currentPathRef.current}${pathSeparator}${folderName}/`
    setCurrentPath(newPath)
    getFileListName(newPath)
  }

  const handleSaveConfig = (config) => {
    handleRemoteConnect(config)
    setConfig(config)
    setShowConfigModal(false)
  }

  const handleProgressClick = (e) => {
    if (!audioRef.current || !metaOr?.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const offsetX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min((offsetX / width) * metaOr.duration, metaOr.duration));

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
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
      if (isDragging && audioRef.current && metaOr?.duration) {
        const rect = document.querySelector('.progress-bar').getBoundingClientRect();
        const width = rect.width;
        const offsetX = Math.max(0, Math.min(e.clientX - rect.left, width));
        const newTime = Math.max(0, Math.min((offsetX / width) * metaOr.duration, metaOr.duration));

        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, metaOr?.duration]);

  useEffect(() => {
    const handleTimeUpdate = () => {
      if (audioRef.current && !isDragging) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    if (audioRef.current) {
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };
  }, [isDragging]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('loadeddata', newAudioAddEventListenerLoadeddata);
        audioRef.current.removeEventListener('ended', newAudioAddEventListenerEnded);
        audioRef.current.src = '';
        audioRef.current = null;

        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = null;
        }
        if (debounceTimerLoad.current) {
          clearTimeout(debounceTimerLoad.current);
          debounceTimerLoad.current = null;
        }
      }
    };
  }, []);

  const preloadNextFile = (currentIndex) => {
    if (playbackModeRef.current !== 'sequential' || !serverFilesRef.current.length) return;

    const nextIndex = (currentIndex + 1) % serverFilesRef.current.length;
    const nextFile = serverFilesRef.current[nextIndex];

    if (nextFile && nextFile.type !== 'd') {
      setTimeout(() => {
        const songName = nextFile.name.replace(/\.[^/.]+$/, '');
        if (!lyricsCache[songName]) {
          window.electronAPI.getLyrics(songName).then((searchRes) => {
            if (searchRes?.lrc?.lyric) {
              lyricsCache[songName] = searchRes.lrc.lyric;
            }
          }).catch(() => {
            // 预加载错误可以安静处理
          });
        }
      }, 1000);
    }
  };

  useEffect(() => {
    if (currentTrackindex >= 0) {
      preloadNextFile(currentTrackindex);
    }
  }, [currentTrackindex, serverFilesRef.current, playbackModeRef.current]);

  return (
    <React.Fragment>
      <div className="container">
        <div className="top-navbar">
          <div className="nav-content">
            <div className="app-title">
              <FiMusic className="app-icon" />
              <h1>Music Player</h1>
            </div>
            <div className="mode-switch">
              <button
                className={`mode-btn ${!isLocalMode ? 'active' : ''}`}
                onClick={() => {
                  handleDisconnect(1)
                }}
              >
                <FiServer className="mode-icon" />
                远程模式
              </button>
              <button
                className={`mode-btn ${isLocalMode ? 'active' : ''}`}
                onClick={() => {
                  handleDisconnect(2)
                }}
              >
                <FiHome className="mode-icon" />
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
                <span><FiServer className="status-icon" /> {config.host}</span>
                <span><FiFolder className="status-icon" /> {currentPath}</span>
              </div>
            )}
            {
              isLocalMode && (
                <div className="server-status">
                  <span><FiFolder className="status-icon" /> {currentPath}</span>
                </div>
              )
            }
          </div>
        </div>
        <div className="main-content">
          <div className="main-content-left">
            <div className="search-container">
              <div className="search-box">
                <FiSearch className="search-icon" />
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
                      <FiMusic className="file-icon" />
                    )}
                    <span>{file.name}</span>
                    {file.type !== 'd' && (
                      <button
                        className="play-btn"
                        onClick={async () => {
                          await handlePlayFile(file, index)
                        }}
                      >
                        {isPlaying && currentTrackindex === index ? <BsPauseFill /> : <BsPlayFill />}
                      </button>
                    )}
                  </div>
                ))}
            </div>

            <div className="player-controls">
              <div className="track-info">
                <div className="track-title">
                  <BsMusicNoteBeamed className="track-icon" />
                  <span>{currentTrack || '未选择曲目'}</span>
                </div>
                <span className="track-time">
                  {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} /
                  {Math.floor((metaOr?.duration || 0) / 60)}:{String(Math.floor((metaOr?.duration || 0) % 60)).padStart(2, '0')}
                </span>
                <div
                  className="progress-bar"
                  onClick={handleProgressClick}
                  onMouseDown={handleMouseDown}
                  style={{ cursor: isDragging ? 'pointer' : 'default' }}
                >
                  <div
                    className="progress"
                    style={{
                      width: `${((currentTime || 0) / (metaOr?.duration || 1)) * 100}%`,
                      transition: isDragging ? 'none' : 'width 0.1s linear'
                    }}
                  />
                </div>
              </div>
              <div className="control-buttons">
                <div className="button-group">
                  <button onClick={handlePrevTrack}><BsSkipBackwardFill /></button>
                  <button onClick={handlePlayPause} className="play-pause-btn">
                    {isPlaying ? <BsPauseFill /> : <BsPlayFill />}
                  </button>
                  <button onClick={handleNextTrack}><BsSkipForwardFill /></button>
                </div>
                <div className="mode-buttons">
                  <button
                    className={playbackMode === 'single' ? 'active' : ''}
                    onClick={() => setPlaybackMode('single')}
                    title="单曲循环"
                  >
                    <IoMdRepeat />
                  </button>
                  <button
                    className={playbackMode === 'random' ? 'active' : ''}
                    onClick={() => setPlaybackMode('random')}
                    title="随机播放"
                  >
                    <IoMdShuffle />
                  </button>
                  <button
                    className={playbackMode === 'sequential' ? 'active' : ''}
                    onClick={() => setPlaybackMode('sequential')}
                    title="顺序播放"
                  >
                    <IoMdInfinite />
                  </button>
                </div>
                <div className="volume-controls">
                  <button>
                    {volume > 0 ? <BiSolidVolumeFull /> : <BiSolidVolumeMute />}
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


















