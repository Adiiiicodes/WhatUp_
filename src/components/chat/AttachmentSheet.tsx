// src/components/chat/AttachmentSheet.tsx
'use client';

import { useEffect, useRef } from 'react';
import { 
  FiFile, 
  FiCamera, 
  FiImage, 
  FiMusic, 
  FiMapPin, 
  FiUser,
  FiX 
} from 'react-icons/fi';

interface AttachmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPickDocument: () => void;
  onTakePhoto: () => void;
  onPickImage: () => void;
  onPickAudio?: () => void;
  onPickLocation?: () => void;
  onPickContact?: () => void;
}

interface AttachmentOption {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  gradient: string;
}

export function AttachmentSheet({
  isOpen,
  onClose,
  onPickDocument,
  onTakePhoto,
  onPickImage,
  onPickAudio,
  onPickLocation,
  onPickContact,
}: AttachmentSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const options: AttachmentOption[] = [
    {
      icon: <FiFile size={24} />,
      label: 'Document',
      onClick: () => { onPickDocument(); onClose(); },
      gradient: 'from-purple-500 to-purple-600',
    },
    {
      icon: <FiCamera size={24} />,
      label: 'Camera',
      onClick: () => { onTakePhoto(); onClose(); },
      gradient: 'from-rose-500 to-rose-600',
    },
    {
      icon: <FiImage size={24} />,
      label: 'Gallery',
      onClick: () => { onPickImage(); onClose(); },
      gradient: 'from-pink-500 to-pink-600',
    },
    {
      icon: <FiMusic size={24} />,
      label: 'Audio',
      onClick: () => { onPickAudio?.(); onClose(); },
      gradient: 'from-orange-500 to-orange-600',
    },
    {
      icon: <FiMapPin size={24} />,
      label: 'Location',
      onClick: () => { onPickLocation?.(); onClose(); },
      gradient: 'from-green-500 to-green-600',
    },
    {
      icon: <FiUser size={24} />,
      label: 'Contact',
      onClick: () => { onPickContact?.(); onClose(); },
      gradient: 'from-blue-500 to-blue-600',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
      <div 
        ref={sheetRef}
        className="w-full max-w-lg bg-[var(--bg-secondary)] rounded-t-2xl p-4 animate-slide-up"
      >
        {/* Handle bar */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-[var(--bg-hover)] rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="Close"
        >
          <FiX size={20} className="text-[var(--icon-secondary)]" />
        </button>

        {/* Options grid */}
        <div className="grid grid-cols-3 gap-4 py-4">
          {options.map((option, index) => (
            <button
              key={option.label}
              onClick={option.onClick}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--bg-hover)] transition-all animate-scale-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div 
                className={`w-12 h-12 rounded-full bg-gradient-to-br ${option.gradient} flex items-center justify-center text-white shadow-lg`}
              >
                {option.icon}
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AttachmentSheet;
