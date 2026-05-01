import React from 'react';

const VOFMUNBadge = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <span className={`inline-flex items-center rounded-full bg-[#f6e3d7] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6E1D1B] ${className}`}>
      {children}
    </span>
  );
};

export default VOFMUNBadge;
