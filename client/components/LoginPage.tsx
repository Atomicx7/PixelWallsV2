import React, { useState } from 'react';
import { DynamicBackground } from './DynamicBackground';
import GlassSurface from './GlassSurface';
import { useTheme } from '../App';

interface LoginPageProps {
  onLogin: () => void;
}

const GalleryIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);


export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { theme } = useTheme();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onLogin();
    }
  };

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
              <p className="mt-2 text-slate-500 dark:text-slate-400">Welcome back. Please sign in to continue.</p>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="text-sm font-bold text-gray-300 sr-only">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-sm font-bold text-gray-300 sr-only">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={!email || !password}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-blue-500 disabled:bg-gray-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
                >
                  Sign In
                </button>
              </div>
            </form>
          </div>
        </GlassSurface>
      </div>
    </div>
  );
};