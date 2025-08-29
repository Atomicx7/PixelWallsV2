import React from 'react';
import { Category } from '../types';

interface CategoryFilterProps {
  categories: Category[];
  activeCategory: Category;
  setActiveCategory: (category: Category) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({ categories, activeCategory, setActiveCategory }) => (
  <div className="flex justify-center items-center flex-wrap gap-2 md:gap-3">
    {categories.map(category => (
      <button
        key={category}
        onClick={() => setActiveCategory(category)}
        className={`px-4 py-2 text-sm md:text-base font-medium rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-black focus:ring-blue-500 ${
          activeCategory === category
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-gray-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-700'
        }`}
      >
        {category}
      </button>
    ))}
  </div>
);