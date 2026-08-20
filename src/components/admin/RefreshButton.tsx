'use client';

import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/primitives/Button';

/** A server component page's only way to re-fetch without a full reload — matches this codebase's server-first data pattern. */
export function RefreshButton() {
  const t = useTranslations('common');
  const router = useRouter();

  return (
    <Button variant="tertiary" size="md" onClick={() => router.refresh()} leadingIcon={<RefreshCw size={18} className="icon" />}>
      {t('refresh')}
    </Button>
  );
}
