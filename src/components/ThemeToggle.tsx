import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'header' | 'profile';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'header' }) => {
  const { theme, toggleTheme } = useTheme();

  const headerClasses = "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 bg-white/10 hover:bg-white/20 text-white border border-white/20";
  const profileClasses = "flex items-center gap-3 p-4 rounded-lg transition-all duration-200 border hover:shadow-md dark:border-gray-600 dark:hover:border-gray-500";

  return (
    <button
      onClick={toggleTheme}
      className={variant === 'header' ? headerClasses : profileClasses}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
    >
      {theme === 'light' ? (
        <>
          <Moon className="w-4 h-4" />
          {variant === 'profile' && <span>Dark Theme</span>}
        </>
      ) : (
        <>
          <Sun className="w-4 h-4" />
          {variant === 'profile' && <span>Light Theme</span>}
        </>
      )}
    </button>
  );
};