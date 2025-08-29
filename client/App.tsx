import React, { useState, createContext, useContext, useEffect, useMemo } from 'react';
import { LoginPage } from './components/LoginPage';
import { Gallery } from './components/Gallery';
import { ProfilePage } from './components/ProfilePage';
import { Wallpaper, Category } from './types';
import { WALLPAPERS } from './constants';

// --- Theme Management ---
type Theme = 'light' | 'dark';
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };
  
  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

const API_BASE_URL = 'https://pixel-walls-v2.vercel.app';

interface UploadData {
  file: File;
  title: string;
  author: string;
  category: Category;
}

const MainApp: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [view, setView] = useState<'gallery' | 'profile'>('gallery');
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchWallpapers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/wallpapers`);
        if (!response.ok) {
          throw new Error('Failed to fetch from the backend.');
        }
        const data: Wallpaper[] = await response.json();
        setWallpapers(data);
      } catch (err) {
        console.error("Failed to fetch wallpapers:", err);
        setError("Could not connect to the server. Displaying sample wallpapers as a fallback.");
        setWallpapers(WALLPAPERS);
      } finally {
        setLoading(false);
      }
    };
    fetchWallpapers();
  }, []);
  
  const handleImageUpload = async (data: UploadData) => {
    const formData = new FormData();
    formData.append('image', data.file);
    formData.append('alt', data.title);
    formData.append('author', data.author);
    formData.append('category', data.category);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        let errorMessage = `Server responded with status: ${response.status}`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.details || errorBody.error || JSON.stringify(errorBody);
        } catch (e) {
            const errorText = await response.text();
            if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }
      
      const newWallpaper = await response.json();
      setWallpapers(prev => [newWallpaper, ...prev]);
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  };

  const navigateToProfile = () => setView('profile');
  const navigateToGallery = () => setView('gallery');

  if (view === 'profile') {
    return <ProfilePage allWallpapers={wallpapers} onBackToGallery={navigateToGallery} onHomeClick={navigateToGallery} onLogout={onLogout} />;
  }

  return (
    <Gallery 
      wallpapers={wallpapers}
      loading={loading}
      error={error}
      onLogout={onLogout} 
      onProfileClick={navigateToProfile}
      onUpload={handleImageUpload}
      onHomeClick={navigateToGallery}
    />
  );
};


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => setIsAuthenticated(true);
  const handleLogout = () => setIsAuthenticated(false);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-black text-slate-800 dark:text-slate-200 font-sans transition-colors duration-300">
        {isAuthenticated ? (
          <MainApp onLogout={handleLogout} />
        ) : (
          <LoginPage onLogin={handleLogin} />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
