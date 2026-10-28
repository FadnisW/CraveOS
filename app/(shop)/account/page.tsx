'use client';

import { useRouter } from 'next/navigation';
import { ProfileScreen } from '@/src/views/ProfileScreen';
import { useShop } from '@/src/context/ShopContext';

export default function AccountPage() {
  const router = useRouter();
  const { navigate, openAuthModal } = useShop();

  return (
    <ProfileScreen
      onNavigate={navigate}
      onOpenAuthModal={openAuthModal}
      onOpenAddressModal={() => router.push('/account/addresses')}
    />
  );
}
