import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import { Providers } from '@/src/components/Providers';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_MERCHANT_NAME
    ? `${process.env.NEXT_PUBLIC_MERCHANT_NAME} — AI Shopping Assistant`
    : 'AI Shopping Assistant',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${syne.variable} ${dmSans.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
