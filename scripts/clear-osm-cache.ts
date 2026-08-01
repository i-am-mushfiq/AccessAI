/* eslint-disable no-console */
import './load-env';
import { db, sqlClient } from '../src/lib/db/client';
import { osmPlaceCache } from '../src/lib/db/schema';

/**
 * Empties the OpenStreetMap place cache.
 *
 * Needed because the cache stores places AFTER normalisation and
 * de-duplication, so changing either leaves the old shape being served until the
 * TTL expires — up to fourteen days of a fix appearing not to work. Rather than
 * shortening the TTL to make development comfortable, at the cost of hammering a
 * volunteer-run service in production, the cache is explicitly clearable.
 *
 * Run:  npm run osm:clear
 */
async function main() {
  const rows = await db.delete(osmPlaceCache).returning({
    key: osmPlaceCache.cellKey,
    count: osmPlaceCache.placeCount,
  });

  if (rows.length === 0) {
    console.log('OSM cache was already empty.');
    return;
  }

  console.log(`Cleared ${rows.length} cached cell(s):`);
  for (const row of rows) console.log(`  ${row.key}  (${row.count} places)`);
  console.log('\nThe next Nearby request re-queries Overpass, which takes ~20 seconds.');
}

main()
  .then(() => sqlClient.close())
  .catch((error) => {
    console.error('\nCould not clear the cache:', error);
    sqlClient.close();
    process.exit(1);
  });
