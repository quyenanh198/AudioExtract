import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './MainContent.css';

interface MainContentProps {
  children: React.ReactNode;
  activeTab: string;
}

export const MainContent: React.FC<MainContentProps> = ({ children, activeTab }) => {
  return (
    <div className="main-content-wrapper">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="page-transition-container"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
