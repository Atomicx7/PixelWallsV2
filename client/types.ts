export type Category = 'All' | 'Abstract' | 'Pastel' | 'Minimalist' | 'Interiors' | 'Avatars';

export interface Wallpaper {
  id: string;  // Change from number to string to match Google Drive file IDs
  url: string;
  alt: string;
  category: Category;
  author: string;
  width: number;
  height: number;
  provider?: string; // cloudinary | googledrive | imgbb | imagekit | catbox
  fullUrl?: string; // original-quality URL (Cloudinary) for downloads
  createdAt?: string;
}

export interface StorageConfig {
  providers: string[];
  primary: string | null;
  maxUploadMB: number;
  features: { fileUpload: boolean; urlImport: boolean };
  auth?: { enabled: boolean; requiredForUpload: boolean };
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
