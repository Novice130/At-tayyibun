import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/privacy',
  title: 'Privacy Policy | At-Tayyibun',
  description: 'How At-Tayyibun collects, protects and shares your information.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
