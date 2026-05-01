import React from 'react';

const VOFMUNPageShell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return <div className={`min-h-screen bg-[#f9f9f9] text-[#1a1c1c] ${className}`}>{children}</div>;
};

export default VOFMUNPageShell;
