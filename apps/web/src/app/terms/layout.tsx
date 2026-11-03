import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/terms',
  title: 'Terms of Service | At-Tayyibun',
  description: 'The terms for using At-Tayyibun.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
