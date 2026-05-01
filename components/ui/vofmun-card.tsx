import React from 'react';

const VOFMUNCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`rounded-xl border border-[#ece5e1] bg-white shadow-[0_8px_32px_rgba(26,28,28,0.06)] ${className}`}>
      {children}
    </div>
  );
};

export default VOFMUNCard;
