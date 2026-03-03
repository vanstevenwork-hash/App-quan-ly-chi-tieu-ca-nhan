import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from 'sonner';
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "Chi Tiêu Cá Nhân - Quản lý tài chính thông minh",
  description: "Ứng dụng quản lý chi tiêu cá nhân - theo dõi thu chi, ngân sách và mục tiêu tài chính",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className={`${inter.className} antialiased`} style={{ backgroundColor: '#F0F2F8' }}>
        <Toaster position="top-center" richColors closeButton />
        <div id="root" className="min-h-screen" style={{ backgroundColor: '#F0F2F8', maxWidth: '480px', margin: '0 auto' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
