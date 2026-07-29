'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * Server-state client.
 *
 * Defaults are tuned for the target network (2G/3G, metered data), not for a
 * desktop on fibre:
 *  • Long `staleTime` — the knowledge base changes daily at most, so refetching
 *    on every focus would burn a citizen's data allowance for nothing.
 *  • `refetchOnWindowFocus` off for the same reason.
 *  • Retries are bounded and skip 4xx: retrying a validation failure three
 *    times just delays the error message.
 */
export function QueryProvider({ children }: { readonly children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              const status = (error as { status?: number })?.status;
              if (typeof status === 'number' && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
          },
          mutations: {
            // A failed mutation must surface immediately; silent retries on a
            // write can produce duplicate records.
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
