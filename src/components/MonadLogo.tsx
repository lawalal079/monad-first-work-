import React from 'react';

interface MonadLogoProps {
  className?: string;
}

const MonadLogo: React.FC<MonadLogoProps> = ({ className }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#8B5CF6"
        fillRule="evenodd"
        transform="rotate(45 50 50)"
        d="M 20 10 L 80 10 A 10 10 0 0 1 90 20 L 90 80 A 10 10 0 0 1 80 90 L 20 90 A 10 10 0 0 1 10 80 L 10 20 A 10 10 0 0 1 20 10 Z M 35 30 L 65 30 A 5 5 0 0 1 70 35 L 70 65 A 5 5 0 0 1 65 70 L 35 70 A 5 5 0 0 1 30 65 L 30 35 A 5 5 0 0 1 35 30 Z"
      />
    </svg>
  );
};

export default MonadLogo; 