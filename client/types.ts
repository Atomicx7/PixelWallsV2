export type Category = 'All' | 'Abstract' | 'Pastel' | 'Minimalist' | 'Interiors';

export interface Wallpaper {
  id: string;  // Change from number to string to match Google Drive file IDs
  url: string;
  alt: string;
  category: Category;
  author: string;
  width: number;
  height: number;
}
