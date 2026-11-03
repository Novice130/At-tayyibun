/**
 * What the contact page shows after POST /requests/:id/contact fails.
 *
 * A view is single-use, so the button must stay for failures that did not
 * settle anything (no connection, rate limit, server error) and go only when
 * the API has said the details are gone (410) or the request is not theirs or
 * does not exist (404, the same answer for both).
 */
export type RevealFailure = { message: string; retryable: boolean };

export function revealFailure(err: unknown): RevealFailure {
  const e = (err ?? {}) as { statusCode?: unknown; message?: unknown };
  const status = typeof e.statusCode === 'number' ? e.statusCode : undefined;
  const serverMessage = typeof e.message === 'string' && e.message.trim() ? e.message.trim() : '';

  if (status === 410) {
    return {
      // The API says which: already viewed, link expired, sent by email, or no
      // longer available.
      message: serverMessage || 'These contact details are no longer available.',
      retryable: false,
    };
  }
  if (status === 404) {
    return { message: 'This request could not be found.', retryable: false };
  }
  if (status === 429) {
    return { message: 'Too many attempts. Please wait a moment and try again.', retryable: true };
  }
  if (status === undefined || status === 408 || status >= 500) {
    return {
      message: 'The contact details could not be loaded. Please check your connection and try again.',
      retryable: true,
    };
  }
  return { message: serverMessage || 'These contact details could not be shown.', retryable: false };
}
