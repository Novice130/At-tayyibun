import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/signup',
  title: 'Create an account | At-Tayyibun',
  description: 'Create a free At-Tayyibun account, for yourself or for a family member.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
