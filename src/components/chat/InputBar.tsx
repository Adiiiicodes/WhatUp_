// src/components/chat/InputBar.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  FiSmile, 
  FiPaperclip, 
  FiCamera, 
  FiMic, 
  FiSend,
  FiX 
} from 'react-icons/fi';

interface InputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttachPress: () => void;
  onEmojiPress: () => void;
  onCameraPress?: () => void;
  onMicPressIn: () => void;
  onMicPressOut: () => void;
  isSending?: boolean;
  isRecording?: boolean;
  hasMedia?: boolean;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

export function InputBar({
  value,
  onChangeText,
  onSend,
  onAttachPress,
  onEmojiPress,
  onCameraPress,
  onMicPressIn,
  onMicPressOut,
  isSending = false,
  isRecording = false,
  hasMedia = false,
  placeholder = 'Type a message',
  maxLength = 1000,
  disabled = false,
}: InputBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;
  const canSend = hasText || hasMedia;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend && !isSending) {
        onSend();
      }
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      onMicPressOut(); // Stop recording
    } else if (!canSend) {
      onMicPressIn(); // Start recording
    }
  };

  return (
    <div className="flex items-end gap-2 p-3 bg-[var(--bg-tertiary)] border-t border-[var(--border-primary)]">
      {/* Left side actions */}
      <div className="flex items-center gap-1">
        {/* Emoji button */}
        <button
          onClick={onEmojiPress}
          disabled={disabled}
          className="p-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
          aria-label="Emoji"
        >
          <FiSmile size={22} className="text-[var(--icon-secondary)]" />
        </button>

        {/* Attachment button */}
        <button
          onClick={onAttachPress}
          disabled={disabled}
          className="p-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
          aria-label="Attach file"
        >
          <FiPaperclip size={22} className="text-[var(--icon-secondary)]" />
        </button>
      </div>

      {/* Text input */}
      <div 
        className={`flex-1 flex items-center bg-[var(--bg-secondary)] rounded-3xl px-4 py-2 transition-all ${
          isFocused ? 'ring-2 ring-[var(--accent-primary)]' : ''
        }`}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChangeText(e.target.value.slice(0, maxLength))}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled || isRecording}
          rows={1}
          className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none resize-none text-base max-h-[120px]"
          style={{ minHeight: '24px' }}
        />

        {/* Character count (show when near limit) */}
        {value.length > maxLength * 0.8 && (
          <span 
            className={`text-xs ml-2 ${
              value.length >= maxLength 
                ? 'text-[var(--danger)]' 
                : 'text-[var(--text-tertiary)]'
            }`}
          >
            {maxLength - value.length}
          </span>
        )}
      </div>

      {/* Right side - Camera or Send/Mic button */}
      <div className="flex items-center gap-1">
        {/* Camera button (only show when no text and no media) */}
        {!canSend && !isRecording && onCameraPress && (
          <button
            onClick={onCameraPress}
            disabled={disabled}
            className="p-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            aria-label="Camera"
          >
            <FiCamera size={22} className="text-[var(--icon-secondary)]" />
          </button>
        )}

        {/* Send button (show when there's text or media) */}
        {canSend && !isRecording ? (
          <button
            onClick={onSend}
            disabled={disabled || isSending}
            className="p-2.5 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-all transform scale-100 disabled:opacity-50"
            aria-label="Send message"
          >
            <FiSend 
              size={20} 
              className={`text-white transition-transform ${isSending ? 'animate-pulse' : ''}`}
            />
          </button>
        ) : (
          /* Mic button (show when no text/media, click to toggle recording) */
          <button
            onClick={handleMicClick}
            disabled={disabled || isSending}
            className={`p-2.5 rounded-full transition-all transform ${
              isRecording
                ? 'bg-[var(--danger)] scale-110 animate-pulse'
                : 'hover:bg-[var(--bg-hover)]'
            } disabled:opacity-50`}
            aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
          >
            {isRecording ? (
              <FiX size={22} className="text-white" />
            ) : (
              <FiMic size={22} className="text-[var(--icon-secondary)]" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default InputBar;