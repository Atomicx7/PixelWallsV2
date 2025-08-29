import React from 'react';
import GlassSurface from './GlassSurface';
import { useTheme } from '../App';

interface BottomNavProps {
    onUploadClick: () => void;
    onLogout: () => void;
    onHomeClick: () => void;
}

const HomeIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
);

const UploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);

const LogoutIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4" />
    </svg>
);

export const BottomNav: React.FC<BottomNavProps> = ({ onUploadClick, onLogout, onHomeClick }) => {
    const { theme } = useTheme();
    
    const NavButton: React.FC<{ onClick?: () => void; children: React.ReactNode; 'aria-label': string }> = ({ onClick, children, 'aria-label': ariaLabel }) => (
        <button
            onClick={onClick}
            aria-label={ariaLabel}
            className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-2 rounded-lg"
        >
            {children}
        </button>
    );

    return (
        <div className="fixed bottom-0 left-0 right-0 h-20 flex justify-center z-40">
            <div className="relative w-full max-w-sm h-16 self-center">
                 <GlassSurface
                    width="100%"
                    height="100%"
                    borderRadius={22}
                    className="shadow-lg"
                    brightness={theme === 'dark' ? 15 : 95}
                    opacity={0.5}
                    backgroundOpacity={theme === 'dark' ? 0.3 : 0.6}
                    blur={10}
                    displace={5}
                    saturation={1.5}
                    distortionScale={-60}
                />
                <div className="absolute inset-0 w-full h-full flex items-center justify-around">
                    <NavButton onClick={onHomeClick} aria-label="Home">
                        <HomeIcon />
                    </NavButton>
                    <button
                        onClick={onUploadClick}
                        aria-label="Upload Image"
                        className="w-14 h-14 -mt-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-700 transition-transform hover:scale-110"
                    >
                        <UploadIcon />
                    </button>
                    <NavButton onClick={onLogout} aria-label="Logout">
                        <LogoutIcon />
                    </NavButton>
                </div>
            </div>
        </div>
    );
};
