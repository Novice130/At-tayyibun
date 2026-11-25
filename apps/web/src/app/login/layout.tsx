import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/login',
  title: 'Sign in | At-Tayyibun',
  description: 'Sign in to your At-Tayyibun account.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
