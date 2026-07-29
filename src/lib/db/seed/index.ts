import { SEED_ORGANIZATIONS } from './organizations';
import { SEED_WELFARE } from './opportunities-welfare';
import { SEED_EDUCATION } from './opportunities-education';
import { SEED_HEALTH } from './opportunities-health';
import { SEED_LIVELIHOOD } from './opportunities-livelihood';
import { SEED_SUPPORT } from './opportunities-support';
import { SEED_LIFE_EVENTS } from './life-events';
import { SEED_LOCATIONS } from './locations';
import { validateRuleSet } from '@/lib/domain/rules';
import type { SeedOpportunity } from './helpers';

export { SEED_ORGANIZATIONS, SEED_LIFE_EVENTS, SEED_LOCATIONS };
export type { SeedOpportunity } from './helpers';

export const SEED_OPPORTUNITIES: readonly SeedOpportunity[] = [
  ...SEED_WELFARE,
  ...SEED_EDUCATION,
  ...SEED_HEALTH,
  ...SEED_LIVELIHOOD,
  ...SEED_SUPPORT,
];

/**
 * Integrity checks run before anything is written.
 *
 * The seed corpus is the product's substance, so a broken record must fail the
 * seed loudly rather than producing a programme that silently never matches
 * anyone or points at an organisation that does not exist.
 */
export function validateSeedCorpus(): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const orgKeys = new Set(SEED_ORGANIZATIONS.map((o) => o.key));
  const slugs = new Set<string>();
  const lifeEventCodes = new Set(SEED_LIFE_EVENTS.map((e) => e.code));

  for (const org of SEED_ORGANIZATIONS) {
    if (!org.name[0].trim() || !org.name[1].trim()) {
      errors.push(`Organisation "${org.key}" is missing an English or Bangla name.`);
    }
  }

  for (const opportunity of SEED_OPPORTUNITIES) {
    const where = `Opportunity "${opportunity.slug}"`;

    if (slugs.has(opportunity.slug)) errors.push(`${where}: duplicate slug.`);
    slugs.add(opportunity.slug);

    if (!orgKeys.has(opportunity.org)) {
      errors.push(`${where}: references unknown organisation "${opportunity.org}".`);
    }

    // Bilingual completeness — a missing Bangla string would leave a citizen
    // reading English on a Bangla-default screen.
    for (const [field, value] of Object.entries({
      title: opportunity.title,
      summary: opportunity.summary,
      description: opportunity.description,
      benefits: opportunity.benefits,
    })) {
      const tuple = value as readonly [string, string];
      if (!tuple[0]?.trim()) errors.push(`${where}: ${field} is missing English text.`);
      if (!tuple[1]?.trim()) errors.push(`${where}: ${field} is missing Bangla text.`);
    }

    const ruleCheck = validateRuleSet(opportunity.rules);
    if (!ruleCheck.ok) {
      errors.push(`${where}: invalid rule set — ${ruleCheck.errors.join('; ')}`);
    }

    for (const event of opportunity.lifeEvents) {
      if (!lifeEventCodes.has(event)) {
        errors.push(`${where}: references unknown life event "${event}".`);
      }
    }

    if (opportunity.steps.length === 0) {
      errors.push(`${where}: has no application steps, so no action plan can be generated.`);
    }
    if (opportunity.docs.length === 0) {
      warnings.push(`${where}: has no document checklist.`);
    }
    if (!opportunity.sourceUrl) {
      warnings.push(`${where}: has no source URL, so it cannot be cited.`);
    }
    if (opportunity.rules.requiredFields.length === 0 && opportunity.category !== 'healthcare') {
      warnings.push(`${where}: declares no required fields — it will match every profile.`);
    }
  }

  const referencedSlugs = new Set(SEED_LOCATIONS.flatMap((l) => l.services));
  for (const slug of referencedSlugs) {
    if (!slugs.has(slug)) {
      errors.push(`Location references unknown opportunity slug "${slug}".`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export const SEED_STATS = {
  organizations: SEED_ORGANIZATIONS.length,
  opportunities: SEED_OPPORTUNITIES.length,
  locations: SEED_LOCATIONS.length,
  lifeEvents: SEED_LIFE_EVENTS.length,
  categories: new Set(SEED_OPPORTUNITIES.map((o) => o.category)).size,
} as const;
