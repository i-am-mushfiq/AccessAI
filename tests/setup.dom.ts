/**
 * DOM test setup — the env defaults from ./setup.ts plus jest-dom matchers.
 *
 * Kept separate from the node setup so the unit project does not pay for jsdom
 * matchers it never uses.
 */
import './setup';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Every test renders into a fresh document; a leaked tree would make queries
// like getByRole('radio') ambiguous across tests rather than failing honestly.
afterEach(() => {
  cleanup();
});
