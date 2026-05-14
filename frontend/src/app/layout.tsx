// src/app/layout.tsx
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'FoodRush — Order Food Online', template: '%s | FoodRush' },
  description: 'Order from hundreds of restaurants near you. Fast delivery, great food.',
  keywords: ['food delivery', 'order food online', 'restaurants'],
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  openGraph: {
    type: 'website', siteName: 'FoodRush',
    title: 'FoodRush — Food Delivery',
    description: 'Order from hundreds of restaurants near you.',
    images: [{ url: '/og-image.png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body className="bg-surface-50 text-gray-900 antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              className: '!font-sans !text-sm !rounded-2xl !shadow-card-hover',
              success: { iconTheme: { primary: '#ff4d00', secondary: '#fff' } },
              duration: 4000,
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
