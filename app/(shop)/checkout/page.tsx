'use client';

import { useRouter } from 'next/navigation';
import { CheckoutScreen } from '@/src/views/CheckoutScreen';
import { useShop } from '@/src/context/ShopContext';

export default function CheckoutPage() {
  const router = useRouter();
  const { activeAddress, openAuthModal, openAddressModal } = useShop();

  return (
    <CheckoutScreen
      onBack={() => router.push('/')}
      onOrderPlaced={(order) => router.push(`/orders?order=${encodeURIComponent(order.id)}`)}
      onOpenAuthModal={openAuthModal}
      onOpenAddressModal={openAddressModal}
      activeAddress={activeAddress}
    />
  );
}
