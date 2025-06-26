import React, { ReactNode } from 'react';

interface CardProps {
  title?: string | ReactNode;
  children: ReactNode;
  className?: string;
}

const Card = ({
  title,
  children,
  className = ''
}: CardProps) => {
  return (
    <div className={`rounded-lg shadow-md bg-white dark:bg-gray-800 flex flex-col h-full ${className}`}>
      {title && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
      )}
      <div className="flex-grow overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

export default Card;