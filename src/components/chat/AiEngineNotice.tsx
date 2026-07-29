'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Cpu } from 'lucide-react';
import { Banner } from '@/components/primitives/Banner';
import { Button } from '@/components/primitives/Button';
import type { AiEngine } from '@/lib/domain/enums';

/**
 * States plainly which engine is answering.
 *
 * This is the honesty requirement from the build brief made visible: when no API
 * key is configured, responses come from the deterministic composer, and the
 * citizen is told so — including the fact that the eligibility decisions and the
 * underlying facts are identical, and only the wording is less fluent. Hiding
 * that would be presenting template output as model output.
 */
export function AiEngineNotice({
  mode,
  degraded = false,
  className,
}: {
  readonly mode: AiEngine;
  readonly degraded?: boolean;
  readonly className?: string;
}) {
  const t = useTranslations('chat');
  const tc = useTranslations('common');
  const [expanded, setExpanded] = useState(false);

  if (mode !== 'simulated' && !degraded) return null;

  return (
    <Banner
      tone="info"
      statusWord={degraded ? tc('appName') : t('engineSimulated')}
      className={className}
      actions={
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          onClick={() => setExpanded((v) => !v)}
          leadingIcon={<Cpu size={18} className="icon" />}
        >
          {expanded ? tc('close') : tc('viewDetails')}
        </Button>
      }
    >
      {degraded ? t('engineDegraded') : t('engineSimulated')}
      {expanded ? <p className="mt-2">{t('engineSimulatedExplain')}</p> : null}
    </Banner>
  );
}
