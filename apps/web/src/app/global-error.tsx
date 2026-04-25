'use client';

// Sentry temporarily disabled.
// import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
// import { useEffect } from 'react';

export default function GlobalError({ error: _error }: { error: Error & { digest?: string } }) {
  // useEffect(() => {
  //   Sentry.captureException(_error);
  // }, [_error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
