'use client';

import { useParams } from 'next/navigation';
import { SupportThreadScreen } from '@/src/views/SupportThreadScreen';

export default function SupportThreadPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!id) return null;

  return <SupportThreadScreen ticketId={id} />;
}
