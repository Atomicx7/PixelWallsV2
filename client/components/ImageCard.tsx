import React from 'react';
import { Wallpaper } from '../types';

interface ImageCardProps {
  wallpaper: Wallpaper;
  onSelect: () => void;
}

const ExpandIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" />
    </svg>
);


export const ImageCard: React.FC<ImageCardProps> = ({ wallpaper, onSelect }) => {
  return (
    <div
      className="relative break-inside-avoid rounded-xl overflow-hidden group cursor-pointer mb-6 transition-transform duration-300 ease-in-out hover:scale-105 hover:z-10"
      onClick={onSelect}
    >
      <img
        src={wallpaper.url}
        alt={wallpaper.alt}
        className="w-full h-auto block"
        width={wallpaper.width}
        height={wallpaper.height}
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <ExpandIcon />
      </div>
      <div className="absolute bottom-0 left-0 p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <h3 className="font-bold text-lg">{wallpaper.alt}</h3>
        <p className="text-sm text-gray-300">{wallpaper.author}</p>
      </div>
    </div>
  );
};
