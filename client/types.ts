export type Category = 'All' | 'Abstract' | 'Pastel' | 'Minimalist' | 'Interiors';

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
}
