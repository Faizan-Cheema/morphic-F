import React from 'react';

// Add prop to control visibility
const Footer: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <footer className="fixed bottom-0 left-0 right-0 w-full p-1 md:p-2 hidden lg:block">
      <div className="flex justify-center items-center">
        <div className='text-sm text-gray-500'>
          The AI Manager can make mistakes. Check important info.
        </div>
      </div>
    </footer>
  );
};

export default Footer;