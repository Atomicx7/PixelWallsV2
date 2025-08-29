import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './Header';
import { CategoryFilter } from './CategoryFilter';
import { ImageGrid } from './ImageGrid';
import { ImageModal } from './ImageModal';
import { UploadModal } from './UploadModal';
import { BottomNav } from './BottomNav';
import { WALLPAPERS, CATEGORIES } from '../constants';
import { Wallpaper, Category } from '../types';
import { DynamicBackground } from './DynamicBackground';

interface GalleryProps {
  onLogout: () => void;
}

interface UploadData {
  file: File;
  title: string;
  author: string;
  category: Category;
}

const Hero: React.FC = () => {
    const handleScroll = () => {
        document.getElementById('gallery-content')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden text-center p-4">
            <DynamicBackground />
            <div className="relative z-10">
                <h2 className="text-4xl sm:text-5xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight">
                    Discover Your Next <span className="text-blue-600">Wallpaper</span>
                </h2>
                <p className="max-w-3xl mx-auto mt-4 text-lg md:text-xl text-slate-600 dark:text-slate-400">
                    A curated collection of high-quality, elegant wallpapers to beautify your screens. Find inspiration in every pixel.
                </p>
                <div className="mt-8">
                    <button 
                        onClick={handleScroll}
                        className="bg-blue-600 text-white font-bold py-3 px-8 rounded-full hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 inline-flex items-center gap-2"
                    >
                        Explore Collection
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};


export function Gallery({ onLogout }: GalleryProps) {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    const fetchWallpapers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('http://localhost:3001/api/wallpapers');
        if (!response.ok) {
          throw new Error('Failed to fetch from the backend.');
        }
        const data: Wallpaper[] = await response.json();
        setWallpapers(data);
      } catch (err) {
        console.error("Failed to fetch wallpapers:", err);
        setError("Could not connect to the backend server. Is it running? Displaying sample wallpapers as a fallback.");
        setWallpapers(WALLPAPERS); // Fallback to local data
      } finally {
        setLoading(false);
      }
    };

    fetchWallpapers();
  }, []);


  const filteredWallpapers = useMemo(() => {
    if (activeCategory === 'All') {
      return wallpapers;
    }
    return wallpapers.filter(wp => wp.category === activeCategory);
  }, [activeCategory, wallpapers]);

  const handleSelectWallpaper = (wallpaper: Wallpaper) => {
    setSelectedWallpaper(wallpaper);
  };
  
  const handleCloseModal = () => {
    setSelectedWallpaper(null);
  };

  const handleOpenUploadModal = () => setUploadModalOpen(true);
  const handleCloseUploadModal = () => setUploadModalOpen(false);

  const handleImageUpload = async (data: UploadData) => {
    const { file, title, author, category } = data;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('alt', title);
    formData.append('author', author);
    formData.append('category', category);

    try {
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed with status: ' + response.statusText);
      }
      
      const newWallpaper = await response.json();
      setWallpapers(prev => [newWallpaper, ...prev]); // Add new wallpaper to the top of the list
      handleCloseUploadModal();
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. See console for details.");
    }
  };

  return (
    <>
      <Header />
      <main>
        <Hero />
        <div id="gallery-content" className="container mx-auto px-4 py-12 md:py-16 pb-28">
          <CategoryFilter
            categories={CATEGORIES}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />
          <div className="mt-12">
            {loading ? (
              <div className="text-center py-20 text-slate-500 dark:text-slate-400">
                <p>Loading wallpapers...</p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="text-center mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg">
                    <p>{error}</p>
                  </div>
                )}
                <ImageGrid 
                  wallpapers={filteredWallpapers}
                  onSelectWallpaper={handleSelectWallpaper}
                />
              </>
            )}
          </div>
        </div>
      </main>
      
      {selectedWallpaper && (
        <ImageModal wallpaper={selectedWallpaper} onClose={handleCloseModal} />
      )}
      {isUploadModalOpen && (
        <UploadModal 
            onClose={handleCloseUploadModal}
            onUpload={handleImageUpload}
            categories={CATEGORIES.filter(c => c !== 'All')}
        />
      )}
      <BottomNav onUploadClick={handleOpenUploadModal} onLogout={onLogout} />
    </>
  );
}