'use client';

import { useRouter } from 'next/navigation';
import { HomeScreen } from '@/src/views/HomeScreen';
import { useShop } from '@/src/context/ShopContext';

export default function HomePage() {
  const router = useRouter();
  const { activeAddress, openItemModal, openAddressModal, navigate } = useShop();

  return (
    <HomeScreen
      onSelectBrand={(slug) => router.push(`/restaurants/${encodeURIComponent(slug)}`)}
      onOpenItemModal={openItemModal}
      onNavigate={navigate}
      onSelectCategory={(category) =>
        router.push(`/menu?category=${encodeURIComponent(category)}`)
      }
      activeAddress={activeAddress}
      onOpenAddressModal={openAddressModal}
    />
  );
}
