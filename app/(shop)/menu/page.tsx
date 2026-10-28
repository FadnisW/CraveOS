'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MenuScreen } from '@/src/views/MenuScreen';
import { useShop } from '@/src/context/ShopContext';
import { LoadingState } from '@/src/components/ui/Feedback';

function MenuPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openItemModal, activeAddress } = useShop();

  const category = searchParams.get('category') || '';
  const brand = searchParams.get('brand');

  return (
    <MenuScreen
      initialCategory={category}
      initialBrandId={brand}
      hubId={activeAddress?.resolvedHubId}
      onBack={() => router.push('/')}
      onOpenItemModal={openItemModal}
    />
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading the menu…" />}>
      <MenuPageContent />
    </Suspense>
  );
}
