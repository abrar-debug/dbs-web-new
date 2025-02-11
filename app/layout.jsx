import './globals.css';
import { Inter } from 'next/font/google';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <Navigation />
          <main className="flex-1">{children}</main>
          <Toaster position="top-right" />
          <Footer />
        </div>
      </body>
    </html>
  );
}
