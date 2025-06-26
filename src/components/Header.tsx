import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../App';
import MonadLogo from './MonadLogo';

const Header = () => {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <header className="bg-white dark:bg-gray-900 shadow-md">
      <div className="container mx-auto flex justify-between items-center p-4">
        <div className="flex items-center space-x-4">
          <MonadLogo className="w-10 h-10" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Monad Dashboard</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;