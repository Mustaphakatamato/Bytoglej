import { Suspense } from 'react';
import MessagesClient from '@/components/MessagesClient';

export default function BeskederPage() {
  return (
    <Suspense>
      <MessagesClient />
    </Suspense>
  );
}
