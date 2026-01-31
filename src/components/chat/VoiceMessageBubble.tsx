// src/components/chat/VoiceMessageBubble.tsx
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { FiPlay, FiPause } from 'react-icons/fi';

interface VoiceMessageBubbleProps {
  audioUrl: string;
  duration?: number;
  isMyMessage: boolean;
  onPlay?: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Generate consistent waveform based on URL (pseudo-random but deterministic)
function generateWaveform(url: string, count: number): number[] {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash = hash & hash;
  }
  
  return Array.from({ length: count }, (_, i) => {
    const value = Math.abs(Math.sin(hash * (i + 1) * 0.1)) * 0.7 + 0.3;
    return value;
  });
}

export function VoiceMessageBubble({
  audioUrl,
  duration: initialDuration = 0,
  isMyMessage,
  onPlay,
}: VoiceMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const waveform = useMemo(() => generateWaveform(audioUrl, 20), [audioUrl]);

  useEffect(() => {
    // Create audio element
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    });

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    } else {
      audio.play();
      onPlay?.();
      
      progressInterval.current = setInterval(() => {
        if (audio.duration && isFinite(audio.duration)) {
          setProgress(audio.currentTime / audio.duration);
          setCurrentTime(audio.currentTime);
        }
      }, 100);
    }

    setIsPlaying(!isPlaying);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    audio.currentTime = percentage * audio.duration;
    setProgress(percentage);
    setCurrentTime(audio.currentTime);
  };

  const displayTime = isPlaying ? currentTime : duration;

  return (
    <div className="flex items-center gap-3 min-w-[200px] max-w-[280px]">
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isMyMessage
            ? 'bg-white/20 hover:bg-white/30'
            : 'bg-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/30'
        }`}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <FiPause 
            size={20} 
            className={isMyMessage ? 'text-white' : 'text-[var(--accent-primary)]'} 
          />
        ) : (
          <FiPlay 
            size={20} 
            className={`${isMyMessage ? 'text-white' : 'text-[var(--accent-primary)]'} ml-0.5`} 
          />
        )}
      </button>

      {/* Waveform and duration */}
      <div className="flex-1 min-w-0">
        {/* Waveform */}
        <div 
          className="flex items-center gap-0.5 h-8 cursor-pointer"
          onClick={handleWaveformClick}
        >
          {waveform.map((height, index) => {
            const barProgress = index / waveform.length;
            const isPlayed = barProgress <= progress;
            
            return (
              <div
                key={index}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isPlayed
                    ? isMyMessage
                      ? 'bg-white'
                      : 'bg-[var(--accent-primary)]'
                    : isMyMessage
                      ? 'bg-white/40'
                      : 'bg-[var(--text-tertiary)]'
                }`}
                style={{ height: `${height * 100}%` }}
              />
            );
          })}
        </div>

        {/* Duration */}
        <div className="flex justify-between items-center mt-1">
          <span 
            className={`text-xs ${
              isMyMessage ? 'text-white/70' : 'text-[var(--text-secondary)]'
            }`}
          >
            {formatDuration(displayTime)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default VoiceMessageBubble;
