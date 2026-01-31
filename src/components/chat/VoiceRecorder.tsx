// src/components/chat/VoiceRecorder.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { FiTrash2, FiSend, FiLock, FiMic, FiX } from 'react-icons/fi';

interface VoiceRecorderProps {
  isRecording: boolean;
  duration: number;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onLockRecording: () => void;
  onSendRecording: () => void;
  isLocked: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Generate random waveform heights for animation
function generateWaveform(count: number): number[] {
  return Array.from({ length: count }, () => 0.2 + Math.random() * 0.8);
}

export function VoiceRecorder({
  isRecording,
  duration,
  onStopRecording,
  onCancelRecording,
  onLockRecording,
  onSendRecording,
  isLocked,
}: VoiceRecorderProps) {
  const [waveform, setWaveform] = useState<number[]>(generateWaveform(20));
  const waveformInterval = useRef<NodeJS.Timeout | null>(null);

  // Animate waveform while recording
  useEffect(() => {
    if (isRecording) {
      waveformInterval.current = setInterval(() => {
        setWaveform(generateWaveform(20));
      }, 150);
    }

    return () => {
      if (waveformInterval.current) {
        clearInterval(waveformInterval.current);
      }
    };
  }, [isRecording]);

  if (!isRecording) return null;

  // Locked recording mode - shows delete and send buttons
  if (isLocked) {
    return (
      <div className="absolute inset-x-0 bottom-0 bg-[var(--bg-secondary)] border-t border-[var(--border-primary)] p-4 animate-slide-up">
        <div className="flex items-center justify-between">
          {/* Delete button */}
          <button
            onClick={onCancelRecording}
            className="p-3 rounded-full bg-[var(--danger)]/20 hover:bg-[var(--danger)]/30 transition-colors"
            aria-label="Delete recording"
          >
            <FiTrash2 size={24} className="text-[var(--danger)]" />
          </button>

          {/* Waveform and duration */}
          <div className="flex-1 mx-4 flex items-center justify-center gap-3">
            {/* Recording indicator */}
            <span className="w-2 h-2 bg-[var(--danger)] rounded-full animate-recording-pulse" />
            
            {/* Duration */}
            <span className="text-lg font-medium text-[var(--text-primary)] min-w-[50px]">
              {formatDuration(duration)}
            </span>

            {/* Waveform visualization */}
            <div className="flex items-center gap-0.5 h-8">
              {waveform.map((height, index) => (
                <div
                  key={index}
                  className="w-1 bg-[var(--accent-primary)] rounded-full transition-all duration-150"
                  style={{ 
                    height: `${height * 100}%`,
                    opacity: 0.5 + height * 0.5,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Send button */}
          <button
            onClick={() => {
              onStopRecording();
              onSendRecording();
            }}
            className="p-3 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-colors"
            aria-label="Send voice message"
          >
            <FiSend size={24} className="text-white" />
          </button>
        </div>
      </div>
    );
  }

  // Regular recording mode - slide to cancel, slide up to lock
  return (
    <div className="absolute inset-x-0 bottom-0 bg-[var(--bg-secondary)]/95 backdrop-blur-sm border-t border-[var(--border-primary)] p-4 animate-fade-in">
      <div className="flex items-center justify-between">
        {/* Slide to cancel hint */}
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <FiX size={16} />
          <span className="text-sm animate-pulse">← Slide to cancel</span>
        </div>

        {/* Center - Duration and waveform */}
        <div className="flex items-center gap-3">
          {/* Recording indicator */}
          <span className="w-2 h-2 bg-[var(--danger)] rounded-full animate-recording-pulse" />
          
          {/* Duration */}
          <span className="text-base font-medium text-[var(--text-primary)]">
            {formatDuration(duration)}
          </span>

          {/* Small waveform */}
          <div className="flex items-center gap-0.5 h-6">
            {waveform.slice(0, 12).map((height, index) => (
              <div
                key={index}
                className="w-0.5 bg-[var(--accent-primary)] rounded-full transition-all duration-150"
                style={{ height: `${height * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* Lock button */}
        <button
          onClick={onLockRecording}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
          aria-label="Lock recording"
        >
          <span className="text-sm">↑ Lock</span>
          <FiLock size={16} />
        </button>
      </div>

      {/* Recording mic icon */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 p-4 rounded-full bg-[var(--accent-primary)] shadow-lg animate-recording-pulse">
        <FiMic size={28} className="text-white" />
      </div>
    </div>
  );
}

export default VoiceRecorder;
