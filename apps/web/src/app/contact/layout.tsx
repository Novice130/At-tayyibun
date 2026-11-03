import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/contact',
  title: 'Contact | At-Tayyibun',
  description: 'Get in touch with the At-Tayyibun team.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
