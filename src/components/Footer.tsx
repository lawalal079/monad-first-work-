import React from 'react';
import { useTheme } from '../App';
import MonadLogo from './MonadLogo';

const Footer = () => {
  const {
    darkMode
  } = useTheme();
  const currentYear = new Date().getFullYear();
  return <footer className={`py-6 ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'} mt-10`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center mb-4 md:mb-0">
            <MonadLogo className="h-10 w-10 mr-4" />
            <span className="font-medium">Monad Blockchain</span>
          </div>
          <div className="text-sm">
            <p>© {currentYear} Monad. All rights reserved.</p>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              Documentation
            </a>
            <a href="#" className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              GitHub
            </a>
            <a href="#" className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              Community
            </a>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;