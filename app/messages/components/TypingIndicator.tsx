// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';

interface Props {
  names: string[];
}

const TypingIndicator: React.FC<Props> = ({ names }) => {
  if (names.length === 0) return null;
  const label = names.length === 1 ? `${names[0]} is typing...` : `${names.join(', ')} are typing...`;
  return (
    <div className="flex items-center gap-2 text-xs text-almost-black-green/70 px-2 py-1">
      <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-deep-red" />
      {label}
    </div>
  );
};

export default TypingIndicator;
