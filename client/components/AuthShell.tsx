import React from 'react';
import { DynamicBackground } from './DynamicBackground';
import GlassSurface from './GlassSurface';
import { useTheme } from '../App';

const GalleryIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export const inputClass =
  'w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';

export const submitClass =
  'w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-blue-500 disabled:bg-gray-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors';

interface AuthShellProps {
  subtitle: string;
  footerText: string;
  footerLink: string;
  onFooterClick: () => void;
  children: React.ReactNode;
}

/** Shared glass-card layout for the Sign in / Create account pages. */
export const AuthShell: React.FC<AuthShellProps> = ({
  subtitle,
  footerText,
  footerLink,
  onFooterClick,
  children,
}) => {
  const { theme } = useTheme();
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <DynamicBackground />
      <div className="relative z-10 w-full max-w-md p-4">
        <GlassSurface
          width="100%"
          height="auto"
          className="shadow-2xl border border-gray-200/20 dark:border-slate-800/50"
          borderRadius={16}
          brightness={theme === 'dark' ? 15 : 90}
          backgroundOpacity={theme === 'dark' ? 0.15 : 0.5}
          blur={12}
          displace={3}
          saturation={1.3}
        >
          <div className="p-8 space-y-8">
            <div className="text-center">
              <GalleryIcon />
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mt-4">Pixel Walls</h1>
              <p className="mt-2 text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
            {children}
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {footerText}{' '}
              <button
                type="button"
                onClick={onFooterClick}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {footerLink}
              </button>
            </p>
          </div>
        </GlassSurface>
      </div>
    </div>
  );
};
