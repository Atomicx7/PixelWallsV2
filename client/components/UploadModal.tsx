import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Category } from '../types';
import GlassSurface from './GlassSurface';
import { useTheme } from '../App';

const CloseIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const UploadCloudIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
  
const TagIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zm0 0l7 7 7-7" />
    </svg>
);

const TitleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
);

const SpinnerIcon: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- Form Components (moved outside main component to prevent re-rendering bug) ---
const InputField: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

const CustomInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input
        {...props}
        className="block w-full rounded-lg border border-gray-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 py-3 pl-10 pr-4 text-slate-800 dark:text-slate-200 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
    />
);

const CustomSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select
        {...props}
        className="block w-full appearance-none rounded-lg border border-gray-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 py-3 pl-10 pr-10 text-slate-800 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
    />
);

// --- Main Modal Component ---
interface UploadModalProps {
  onClose: () => void;
  onUpload: (data: { file: File, title: string, author: string, category: Category }) => Promise<void>;
  categories: Category[];
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload, categories }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState<Category>(categories.find(c => c !== 'All') || 'Abstract');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [onClose, previewUrl]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setError(null);
      setFile(selectedFile);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setError("Please select a valid image file (PNG, JPG, etc.).");
    }
  }, [previewUrl]);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const isFormValid = file && title.trim() && author.trim() && category;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
        setError("Please fill in all fields and select an image.");
        return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
        await onUpload({ file, title, author, category });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Upload failed: ${message}. Please check your backend server's console for more details.`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <GlassSurface
        width="100%"
        height="auto"
        className="w-full max-w-2xl max-h-[90vh] shadow-2xl"
        borderRadius={24}
        brightness={theme === 'dark' ? 10 : 95}
        backgroundOpacity={theme === 'dark' ? 0.1 : 0.4}
        blur={15}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-200">
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 flex-shrink-0">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Upload New Wallpaper</h2>
              <button type="button" onClick={onClose} className="text-slate-400 bg-black/5 dark:bg-white/5 w-10 h-10 rounded-full flex items-center justify-center hover:text-slate-800 dark:hover:text-white transition-colors" aria-label="Close">
                <CloseIcon />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
              {/* Left Side: Uploader/Preview */}
              <div className="flex flex-col space-y-4">
                {previewUrl ? (
                  <div className="w-full aspect-w-3 aspect-h-4 bg-gray-200 dark:bg-slate-800 rounded-lg overflow-hidden relative group">
                    <img src={previewUrl} alt="Image preview" className="w-full h-full object-cover" />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <p className="text-white font-semibold">Change image</p>
                    </div>
                  </div>
                ) : (
                  <div 
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors h-full ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-300 dark:border-slate-700 hover:border-blue-500'}`}
                  >
                    <UploadCloudIcon className="w-16 h-16 text-gray-400 dark:text-slate-500 transition-transform" />
                    <p className="mt-4 text-center text-sm font-medium text-gray-600 dark:text-slate-300">
                      Drag & drop or <span className="text-blue-500 dark:text-blue-400">click to browse</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">PNG, JPG up to 10MB</p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleInputChange} accept="image/*" className="hidden" />
              </div>

              {/* Right Side: Form Fields */}
              <div className="flex flex-col space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Title</label>
                  <InputField icon={<TitleIcon className="w-5 h-5 text-slate-400" />}>
                    <CustomInput type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Sunset Over Mountains" />
                  </InputField>
                </div>
                <div>
                  <label htmlFor="author" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Author</label>
                  <InputField icon={<UserIcon className="w-5 h-5 text-slate-400" />}>
                    <CustomInput type="text" id="author" value={author} onChange={e => setAuthor(e.target.value)} required placeholder="Jane Doe" />
                  </InputField>
                </div>
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Category</label>
                  <InputField icon={<TagIcon className="w-5 h-5 text-slate-400" />}>
                    <CustomSelect id="category" value={category} onChange={e => setCategory(e.target.value as Category)} required>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </CustomSelect>
                  </InputField>
                </div>
                {error && (
                  <div className="text-red-600 dark:text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-lg">
                    <p className="font-semibold">Upload Failed</p>
                    <p className="text-xs mt-1">{error}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 flex-shrink-0 mt-auto">
              <button type="submit" disabled={!isFormValid || isLoading} className="w-full flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-blue-500 disabled:bg-gray-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100">
                {isLoading && <SpinnerIcon />}
                {isLoading ? 'Uploading...' : 'Upload to Gallery'}
              </button>
            </div>
          </form>
        </div>
      </GlassSurface>
    </div>
  );
};
