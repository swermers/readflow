import type { Metadata, Viewport } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import Toast from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Readflow Library',
  description: 'Your personal newsletter sanctuary',
  applicationName: 'Readflow',
  manifest: '/manifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Readflow',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-readflow-1.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
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
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('readflow-theme') === 'dark') {
              document.documentElement.classList.add('dark');
            }
          } catch (e) {}
        ` }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toast />
        </ThemeProvider>
      </body>
    </html>
  );
}
