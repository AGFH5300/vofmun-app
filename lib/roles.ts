// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { UserType } from '@/db/types';

export default function role(user: UserType): string {
  return user?.role || '';
}
