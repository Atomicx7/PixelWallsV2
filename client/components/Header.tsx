import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';
import GlassSurface from './GlassSurface';

const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
    </svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
);

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="w-10 h-10 bg-gray-200/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center ring-1 ring-gray-300/50 dark:ring-slate-700/50 hover:ring-blue-500 dark:hover:ring-blue-500 transition-all duration-300 focus:outline-none"
            aria-label="Toggle theme"
        >
            <div className="relative w-5 h-5 text-slate-700 dark:text-slate-300">
                <SunIcon className={`absolute transition-all duration-300 transform ${theme === 'light' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}`} />
                <MoonIcon className={`absolute transition-all duration-300 transform ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`} />
            </div>
        </button>
    );
};

const UserAvatar: React.FC<{ onProfileClick: () => void }> = ({ onProfileClick }) => (
    <button onClick={onProfileClick} className="w-10 h-10 bg-gray-200/50 dark:bg-slate-700/50 rounded-full flex items-center justify-center ring-1 ring-gray-300/50 dark:ring-slate-600/50 hover:ring-blue-500 dark:hover:ring-blue-500 transition-all duration-300 focus:outline-none" aria-label="View Profile">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    </button>
);

interface HeaderProps {
    onProfileClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onProfileClick }) => {
    const { theme } = useTheme();
    const [visible, setVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setVisible(false);
            } else {
                setVisible(true);
            }
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [lastScrollY]);


    return (
<header
  className={`fixed top-0 left-0 right-0 z-30 p-2 md:p-4 transition-transform duration-300 ease-in-out ${
    visible ? 'translate-y-0' : '-translate-y-full'
  }`}
>
  <div className="relative h-[64px] container mx-auto">
    <div className="absolute inset-0 z-0 pointer-events-none">
      <GlassSurface
        width="100%"
        height="100%"
        borderRadius={18}
        className="w-full h-full shadow-md"
        brightness={theme === 'dark' ? 15 : 95}
        opacity={0.5}
        backgroundOpacity={theme === 'dark' ? 0.3 : 0.6}
        blur={10}
        displace={5}
        saturation={1.5}
        distortionScale={-60}
      />
    </div>

    <div className="relative z-10 flex h-full w-full items-center justify-between px-4 md:px-6">
      <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
        Pixel Walls
      </h1>
      <div className="flex items-center gap-3 md:gap-4">
        <ThemeToggle />
        <UserAvatar onProfileClick={onProfileClick} />
      </div>
    </div>
  </div>
</header>
    );
};
