import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/about',
  title: 'About | At-Tayyibun',
  description: 'How At-Tayyibun helps Muslims in the United States find a spouse with privacy and family involvement.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
