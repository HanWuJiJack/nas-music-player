import React, { useEffect, useMemo, useRef } from 'react';
import { BsMusicNoteBeamed } from 'react-icons/bs';

export default function LyricsDisplay({ lyrics, currentTime }) {
  const containerRef = useRef(null);
  const activeRef = useRef(null);

  const parsedLyrics = useMemo(() => {
    if (!lyrics) return [];
    
    const lines = [];
    let lastTime = 0;
    
    lyrics.split('\n').forEach(line => {
      const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
      if (match) {
        lastTime = parseInt(match[1]) * 60 + parseFloat(match[2]);
        lines.push({
          time: lastTime,
          text: match[3].trim()
        });
      } else if (lines.length > 0 && line.trim()) {
        // 合并无时间戳的歌词到上一行
        lines[lines.length - 1].text += ' ' + line.trim();
      }
    });
    
    return lines.sort((a, b) => a.time - b.time);
  }, [lyrics]);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeRef.current;
      
      // 平滑滚动到当前歌词
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentTime]);

  return (
    <>
      <div className="lyrics-header">
        <BsMusicNoteBeamed className="lyrics-icon" />
        <h3>歌词</h3>
      </div>
      <div className="lyrics-container" ref={containerRef}>
        {parsedLyrics.length > 0 ? (
          parsedLyrics.map((line, index) => {
            const isActive = currentTime >= line.time && 
              (index === parsedLyrics.length - 1 || currentTime < parsedLyrics[index + 1].time);
            return (
              <div 
                key={index}
                ref={isActive ? activeRef : null}
                className={`lyric-line ${isActive ? 'active' : ''}`}
              >
                {line.text}
              </div>
            );
          })
        ) : (
          <div className="lyric-placeholder">
            <BsMusicNoteBeamed className="placeholder-icon" />
            <p>{lyrics ? '正在解析歌词...' : '当前无歌词信息'}</p>
          </div>
        )}
      </div>
    </>
  );
}