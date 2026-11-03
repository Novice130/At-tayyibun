import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email preferences | At-Tayyibun',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
