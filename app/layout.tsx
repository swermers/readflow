import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import Toast from '@/components/Toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Readflow Library',
  description: 'Your personal newsletter sanctuary',
  applicationName: 'Readflow',
  manifest: '/manifest', // Next.js handles the extension automatically
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default', // 'black-translucent' can sometimes hide your header text
    title: 'Readflow',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png', // Use the 180x180 PNG you made!
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff', // Status bar color
  viewportFit: 'cover',
};

export const viewport: Viewport = {
  themeColor: '#090d14',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('readflow-theme') === 'dark') {
              document.documentElement.classList.add('dark');
            }
          } catch (e) {}
        ` }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Toast />
        </ThemeProvider>
      </body>
    </html>
  );
}
