import React, { useEffect } from 'react';
import { Wallpaper } from '../types';

interface ImageModalProps {
  wallpaper: Wallpaper;
  onClose: () => void;
}

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);


export const ImageModal: React.FC<ImageModalProps> = ({ wallpaper, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Network response was not ok.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error("Could not download the image via blob, opening in new tab as fallback:", error);
      window.open(imageUrl, '_blank');
    }
  };

  const handleDownloadClick = () => {
      const filename = wallpaper.alt.replace(/\s+/g, '-').toLowerCase();
      downloadImage(wallpaper.url, filename);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 dark:text-slate-300 bg-black/10 dark:bg-white/10 rounded-full p-2 z-10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="w-full md:w-2/3 h-72 md:h-auto bg-gray-100 dark:bg-black">
            <img
                src={wallpaper.url}
                alt={wallpaper.alt}
                className="w-full h-full object-contain"
            />
        </div>

        <div className="w-full md:w-1/3 p-6 flex flex-col justify-center text-slate-800 dark:text-slate-200">
            <h2 className="text-3xl font-bold">{wallpaper.alt}</h2>
            <p className="text-md text-slate-500 dark:text-slate-400 mt-1">by {wallpaper.author}</p>
            <p className="text-sm bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full self-start mt-4">{wallpaper.category}</p>
            <p className="text-slate-500 dark:text-slate-300 mt-4 text-sm">
                Dimensions: {wallpaper.width} x {wallpaper.height}
            </p>

            <button 
                onClick={handleDownloadClick}
                className="mt-6 w-full flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-blue-500"
            >
                <DownloadIcon />
                Download
            </button>
        </div>
      </div>
    </div>
  );
};