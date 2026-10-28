import type { ReactNode } from 'react';
import { ShopShell } from '@/src/components/shop/ShopShell';

export default function ShopLayout({ children }: { children: ReactNode }) {
  return <ShopShell>{children}</ShopShell>;
}
