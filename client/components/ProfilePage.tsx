import React, { useMemo, useState } from 'react';
import { Wallpaper } from '../types';
import { useTheme } from '../App';
import { ImageGrid } from './ImageGrid';
import { ImageModal } from './ImageModal';
import { BottomNav } from './BottomNav';
import GlassSurface from './GlassSurface';

const BackIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
    </svg>
);

const StatCard: React.FC<{ value: string; label: string }> = ({ value, label }) => {
    const { theme } = useTheme();
    return (
        <GlassSurface
            width="100%"
            height="100%"
            borderRadius={16}
            className="w-full h-full"
            brightness={theme === 'dark' ? 15 : 95}
            opacity={0.5}
            backgroundOpacity={theme === 'dark' ? 0.1 : 0.3}
            blur={8}
        >
            <div className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            </div>
        </GlassSurface>
    );
};

interface ProfilePageProps {
    allWallpapers: Wallpaper[];
    onBackToGallery: () => void;
    onHomeClick: () => void;
    onLogout: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ allWallpapers, onBackToGallery, onHomeClick, onLogout }) => {
    const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null);
    const userName = "Jane Doe";

    const userWallpapers = useMemo(() => {
        return allWallpapers.filter(wp => wp.author === userName);
    }, [allWallpapers, userName]);
    
    const handleSelectWallpaper = (wallpaper: Wallpaper) => {
        setSelectedWallpaper(wallpaper);
    };

    const handleCloseModal = () => {
        setSelectedWallpaper(null);
    };

    return (
        <>
            <main className="container mx-auto px-4 py-12 md:py-16 pb-28">
                {/* Header and User Info */}
                <div className="relative mb-12">
                    <button
                        onClick={onBackToGallery}
                        className="absolute top-0 left-0 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                    >
                        <BackIcon className="w-5 h-5" />
                        Back to Gallery
                    </button>
                    <div className="flex flex-col items-center pt-16">
                        <div className="w-24 h-24 bg-gray-200 dark:bg-slate-700 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-800 shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h1 className="mt-4 text-4xl font-bold text-slate-900 dark:text-white">{userName}</h1>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">Wallpaper Enthusiast</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
                    <StatCard value={userWallpapers.length.toString()} label="Uploads" />
                    <StatCard value="1.2k" label="Likes" />
                    <StatCard value="5.8k" label="Downloads" />
                </div>

                {/* User's Gallery */}
                <div>
                    <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">My Uploads</h2>
                    <ImageGrid
                        wallpapers={userWallpapers}
                        onSelectWallpaper={handleSelectWallpaper}
                    />
                </div>
            </main>

            {selectedWallpaper && (
                <ImageModal wallpaper={selectedWallpaper} onClose={handleCloseModal} />
            )}
            
            {/* We don't show the upload button here, but keep nav for consistency */}
            <BottomNav onUploadClick={() => {}} onLogout={onLogout} onHomeClick={onHomeClick} />
        </>
    );
};
