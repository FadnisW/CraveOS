'use client';

import { useRouter } from 'next/navigation';
import { SearchScreen } from '@/src/views/SearchScreen';
import { useShop } from '@/src/context/ShopContext';

export default function SearchPage() {
  const router = useRouter();
  const { openItemModal, activeAddress } = useShop();

  return (
    <SearchScreen
      hubId={activeAddress?.resolvedHubId}
      onBack={() => router.push('/')}
      onOpenItemModal={openItemModal}
      onSelectBrand={(slug) => router.push(`/restaurants/${encodeURIComponent(slug)}`)}
    />
  );
}
