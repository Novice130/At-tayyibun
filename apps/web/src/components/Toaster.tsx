'use client';

import { Toaster as SonnerToaster } from 'sonner';

// The workspace resolves two copies of @types/react (19.x at the root, 18.x
// under sonner's peer entry), which makes sonner's forwardRef component fail
// the JSX element-type check even though it renders fine. Wrapping it here
// keeps that cast in one place instead of at every call site.
const Toast = SonnerToaster as unknown as React.ComponentType<{
  position?: 'top-center' | 'top-right' | 'bottom-center' | 'bottom-right';
  richColors?: boolean;
  closeButton?: boolean;
}>;

export function Toaster() {
  return <Toast position="top-center" richColors closeButton />;
}
