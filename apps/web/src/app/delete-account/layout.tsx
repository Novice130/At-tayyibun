import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/delete-account',
  title: 'Delete Account | At-Tayyibun',
  description:
    'How to permanently delete your At-Tayyibun account and data from the app, on the web, or by support request.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
