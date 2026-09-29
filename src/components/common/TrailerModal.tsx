'use client';

import React from 'react';
import { X } from 'lucide-react';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  title: string;
}

export default function TrailerModal({ isOpen, onClose, videoUrl, title }: TrailerModalProps) {
  if (!isOpen) return null;

  // Extract YouTube ID if present
  let embedUrl = videoUrl;
  if (videoUrl?.includes('youtube.com/watch?v=')) {
    const videoId = videoUrl.split('watch?v=')[1]?.split('&')[0];
    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl overflow-hidden max-w-4xl w-full relative shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#303645]">
          <h3 className="font-bold text-white text-sm sm:text-base">Trailer: {title}</h3>
          <button
            onClick={onClose}
            className="text-[#9EA6B8] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`Trailer ${title}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white text-sm">
              Video trailer đang được cập nhật
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
