'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OrdersScreen } from '@/src/views/OrdersScreen';
import { api } from '@/src/lib/api-client';
import { mapApiOrder } from '@/src/lib/order-mapper';
import type { Order } from '@/src/types';
import { LoadingState } from '@/src/components/ui/Feedback';

function OrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!orderId);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getOrderById(orderId)
      .then((row) => {
        if (!cancelled) setOrder(mapApiOrder(row));
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Could not load this order.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return <LoadingState label="Loading your order…" />;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}
      <OrdersScreen
        activeOrder={order}
        onBackToHome={() => router.push('/')}
        onSelectOrder={(selectedId) =>
          router.push(`/orders?order=${encodeURIComponent(selectedId)}`)
        }
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading your orders…" />}>
      <OrdersPageContent />
    </Suspense>
  );
}
