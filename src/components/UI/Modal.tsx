import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../App';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal = ({
  isOpen,
  onClose,
  title,
  children
}: ModalProps) => {
  const { darkMode } = useTheme();
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className={`relative rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
        <div className={`flex items-center justify-between p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-xl font-medium">{title}</h3>
          <button onClick={onClose} className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;