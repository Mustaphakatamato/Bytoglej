'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/providers/AppProvider';
import ListingDetailClient from '@/components/ListingDetailClient';

export default function ListingDetailLegacyPage() {
  const { activeListing } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (activeListing?.id) {
      // Redirect to the canonical shareable URL
      router.replace('/opslag/' + activeListing.id);
    } else {
      router.replace('/opslag');
    }
  }, [activeListing?.id]);

  // Render while redirect is in-flight
  if (activeListing) return <ListingDetailClient />;
  return null;
}
