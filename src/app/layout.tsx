import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Fortnite — плашки раздевалки',
  description: 'Читает раздевалку аккаунта Fortnite и собирает из неё плашки, коллажи и списки для объявления.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
