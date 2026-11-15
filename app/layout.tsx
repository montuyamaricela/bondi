import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { QueryProvider } from '@/app/components/providers/query-provider';
import { RealtimeProvider } from '@/app/components/providers/realtime-provider';
import { ThemeProvider } from '@/app/components/providers/theme-provider';
import { Toaster } from '@/app/components/ui/sonner';

const spaceGrotesk = localFont({
  src: './fonts/SpaceGrotesk.ttf',
  variable: '--font-space-grotesk',
  weight: '300 700',
  display: 'swap',
});

const inter = localFont({
  src: './fonts/Inter.ttf',
  variable: '--font-inter',
  weight: '400 700',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: './fonts/JetBrainsMono.ttf',
  variable: '--font-jetbrains-mono',
  weight: '400 700',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bondi',
  description: 'Bondi is a social media platform for the modern age',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>
            <RealtimeProvider>{children}</RealtimeProvider>
            <Toaster duration={3000} position="top-center" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
