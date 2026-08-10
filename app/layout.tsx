import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CraveOS — Multi-Brand Cloud Kitchen Food Delivery',
  description:
    'Order from 8 cloud kitchen brands in one cart, one payment, one delivery. BOX8, MOJO Pizza, ZAZA Biryani, LeanCrust and more — delivered free, only for Eatclub members.',
  keywords: [
    'cloud kitchen',
    'food delivery',
    'BOX8',
    'MOJO Pizza',
    'ZAZA Biryani',
    'Eatclub',
    'CraveOS',
    'multi-brand food',
  ],
  openGraph: {
    title: 'CraveOS — Multi-Brand Cloud Kitchen Food Delivery',
    description:
      'Order from 8 cloud kitchen brands in one cart, one payment, one delivery. Free delivery for members.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
