'use client';

import { useParams, useRouter } from 'next/navigation';
import { RestaurantScreen } from '@/src/views/RestaurantScreen';
import { useShop } from '@/src/context/ShopContext';

export default function RestaurantPage() {
  const router = useRouter();
  const params = useParams<{ slug: string | string[] }>();
  const { activeAddress, openItemModal } = useShop();

  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  if (!slug) {
    return null;
  }

  return (
    <RestaurantScreen
      slug={slug}
      hubId={activeAddress?.resolvedHubId}
      onBack={() => router.push('/menu')}
      onOpenItemModal={openItemModal}
    />
  );
}
