'use client';

import VOFMUNTopNav from './vofmun-top-nav';
import VOFMUNMobileBottomNav from './vofmun-mobile-bottom-nav';

interface CustomNavProps {
  embedded?: boolean;
}

const CustomNav = ({ embedded = false }: CustomNavProps) => {
  if (embedded) {
    return null;
  }

  return (
    <>
      <VOFMUNTopNav />
      <VOFMUNMobileBottomNav />
    </>
  );
};

export default CustomNav;
