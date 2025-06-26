import React, { useState, useEffect, createContext, useContext } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import SearchBar from './components/SearchBar';
import KeyMetrics from './components/Dashboard/KeyMetrics';
import BlocksSection from './components/Dashboard/BlocksSection';
import TransactionsSection from './components/Dashboard/TransactionsSection';
import DeploymentsSection from './components/Dashboard/DeploymentsSection';
import GasSection from './components/Dashboard/GasSection';
import EventsLog from './components/Dashboard/EventsLog';

const AppThemeContext = createContext({ darkMode: true, toggleDarkMode: () => {} });

export const useTheme = () => useContext(AppThemeContext);

const App = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <AppThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} text-gray-800 dark:text-gray-200`}>
        <Header />
        <main className="container mx-auto p-4 md:p-6 lg:p-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Explore the Monad Blockchain</h1>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400">
              A real-time, high-performance blockchain explorer for the Monad ecosystem.
            </p>
          </div>
          <SearchBar />
          <div className="space-y-8">
            <KeyMetrics />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* EcosystemHealth removed */}
          </div>

          <BlocksSection />
          <TransactionsSection />
            
          <DeploymentsSection />

          <GasSection />
          <EventsLog />
          </div>

        </main>
        <Footer />
      </div>
    </AppThemeContext.Provider>
  );
};

export default App;