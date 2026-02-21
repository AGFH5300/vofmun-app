// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';
import { User } from '@/lib/chat/types';
import { User2 } from 'lucide-react';

interface Props {
  user?: User | null;
  size?: number;
}

const UserAvatar: React.FC<Props> = ({ user, size = 36 }) => {
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt={user.full_name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-soft-ivory text-deep-red border border-soft-rose"
      style={{ width: size, height: size }}
    >
      {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User2 size={size * 0.5} />}
    </div>
  );
};

export default UserAvatar;
