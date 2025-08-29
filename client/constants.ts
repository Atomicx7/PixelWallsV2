import { Wallpaper, Category } from './types';

export const CATEGORIES: Category[] = ['All', 'Abstract', 'Pastel', 'Interiors', 'Minimalist'];

export const WALLPAPERS: Wallpaper[] = [
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '1', width: 400, height: 550, url: 'https://picsum.photos/id/119/400/550', alt: 'Pastel building facade', category: 'Pastel', author: 'John Doe' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '2', width: 500, height: 400, url: 'https://picsum.photos/id/1016/500/400', alt: 'Serene lake view', category: 'Minimalist', author: 'Jane Smith' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '3', width: 400, height: 500, url: 'https://picsum.photos/id/10/400/500', alt: 'Modern interior with a plant', category: 'Interiors', author: 'Alex Johnson' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '4', width: 400, height: 300, url: 'https://picsum.photos/id/1025/400/300', alt: 'Pastel tones in nature', category: 'Pastel', author: 'Emily White' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '5', width: 400, height: 600, url: 'https://picsum.photos/id/103/400/600', alt: 'Abstract sand dunes', category: 'Abstract', author: 'Chris Green' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '6', width: 500, height: 700, url: 'https://picsum.photos/id/1040/500/700', alt: 'Minimalist architecture', category: 'Minimalist', author: 'Patricia Black' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '7', width: 400, height: 400, url: 'https://picsum.photos/id/1043/400/400', alt: 'Pastel flowers', category: 'Pastel', author: 'Michael Brown' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '8', width: 500, height: 450, url: 'https://picsum.photos/id/1047/500/450', alt: 'Cozy living room', category: 'Interiors', author: 'Sarah Davis' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '9', width: 400, height: 550, url: 'https://picsum.photos/id/1050/400/550', alt: 'Abstract light trails', category: 'Abstract', author: 'David Wilson' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '10', width: 400, height: 350, url: 'https://picsum.photos/id/1060/400/350', alt: 'Desk setup', category: 'Minimalist', author: 'Laura Taylor' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '11', width: 500, height: 650, url: 'https://picsum.photos/id/107/500/650', alt: 'Pink wall texture', category: 'Pastel', author: 'Robert Miller' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '12', width: 400, height: 500, url: 'https://picsum.photos/id/21/400/500', alt: 'Modern desk setup', category: 'Interiors', author: 'Jessica Martinez' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '13', width: 400, height: 600, url: 'https://picsum.photos/id/22/400/600', alt: 'Abstract mountain range', category: 'Abstract', author: 'William Clark' },
  // Fix: Changed id from number to string to match the Wallpaper interface.
  { id: '14', width: 500, height: 500, url: 'https://picsum.photos/id/30/500/500', alt: 'Minimalist coffee cup', category: 'Minimalist', author: 'Linda Harris' },
];