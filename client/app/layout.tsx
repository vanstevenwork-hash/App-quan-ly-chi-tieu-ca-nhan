import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from 'sonner';
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#6C63FF',
};

export const metadata: Metadata = {
  title: "Chi Tiêu Cá Nhân - Quản lý tài chính thông minh",
  description: "Ứng dụng quản lý chi tiêu cá nhân - theo dõi thu chi, ngân sách và mục tiêu tài chính",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Chi Tiêu',
  },
  icons: {
    apple: [
      { url: '/icon-192.png', sizes: '192x192' },
      { url: '/icon-512.png', sizes: '512x512' },
    ],
    icon: '/icon-512.png',
  },
};

import ThemeProvider from '@/components/ThemeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* iOS PWA standalone mode */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Chi Tiêu" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#6C63FF" />
        {/* Apple touch icons - iOS uses these for home screen */}
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-512.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className={`${inter.className} antialiased bg-[#F0F2F8] dark:bg-slate-950`}>
        <ThemeProvider />
        <Toaster position="top-center" richColors closeButton />
        <div id="root" className="min-h-screen max-w-[480px] mx-auto bg-[#F0F2F8] dark:bg-slate-900 transition-colors duration-200"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
