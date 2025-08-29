import React from 'react';
import { ImageCard } from './ImageCard';
import { Wallpaper } from '../types';

interface ImageGridProps {
  wallpapers: Wallpaper[];
  onSelectWallpaper: (wallpaper: Wallpaper) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ wallpapers, onSelectWallpaper }) => {
  if (wallpapers.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500 dark:text-slate-400">
        <p>No wallpapers found in this category.</p>
      </div>
    );
  }

  return (
    <div 
      className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-6 p-1"
      style={{ perspective: '1000px' }}
    >
        {wallpapers.map((wallpaper) => (
            <ImageCard
                key={wallpaper.id}
                wallpaper={wallpaper}
                onSelect={() => onSelectWallpaper(wallpaper)}
            />
        ))}
    </div>
  );
};