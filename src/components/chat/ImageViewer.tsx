// src/components/chat/ImageViewer.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { FiX, FiDownload, FiShare2, FiZoomIn, FiZoomOut } from 'react-icons/fi';
import { logger } from '@/lib/logger';
import { formatFileSize, copyToClipboard } from '@/lib/utils';

const log = logger.child({ component: 'ImageViewer' });

interface ImageViewerProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  fileSize?: number;
}

export function ImageViewer({
  src,
  alt = 'Image',
  isOpen,
  onClose,
  fileName,
  fileSize,
}: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'image';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      log.info({ fileName }, 'Image downloaded successfully');
    } catch (error) {
      log.error({ error, src }, 'Download failed');
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: fileName || 'Shared Image',
          url: src,
        });
        log.info({ fileName }, 'Image shared successfully');
      } else {
        const success = await copyToClipboard(src);
        if (success) {
          log.info({ fileName }, 'Image URL copied to clipboard');
        }
        // Could show a toast notification here
      }
    } catch (error) {
      log.error({ error }, 'Share failed');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-fade-in"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        {/* File info */}
        <div className="text-white">
          {fileName && (
            <p className="text-sm font-medium truncate max-w-[200px]">{fileName}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-white/60">
            {fileSize && <span>{formatFileSize(fileSize)}</span>}
            {imageDimensions.width > 0 && (
              <span>{imageDimensions.width} × {imageDimensions.height}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
            aria-label="Zoom out"
          >
            <FiZoomOut size={20} className="text-white" />
          </button>
          <span className="text-white text-sm min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 4}
            className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
            aria-label="Zoom in"
          >
            <FiZoomIn size={20} className="text-white" />
          </button>
          <div className="w-px h-6 bg-white/20 mx-2" />
          <button
            onClick={handleDownload}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Download"
          >
            <FiDownload size={20} className="text-white" />
          </button>
          <button
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Share"
          >
            <FiShare2 size={20} className="text-white" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors ml-2"
            aria-label="Close"
          >
            <FiX size={24} className="text-white" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          onLoad={handleImageLoad}
          className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          draggable={false}
        />
      </div>

      {/* Click outside to close hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <p className="text-white/40 text-xs">Click outside or press Esc to close</p>
      </div>
    </div>
  );
}

export default ImageViewer;
