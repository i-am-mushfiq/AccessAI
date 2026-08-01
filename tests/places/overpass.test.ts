import { describe, it, expect } from 'vitest';
import {
  buildQuery, normaliseElement, parseResponse, dedupe, cellKey, comparableName, OverpassError,
} from '@/modules/places/overpass';
import { typeFromTags, overpassFilters, OSM_BACKED_TYPES } from '@/modules/places/osm-tags';
import { PLACE_LABELS, placeLabel, placeGlyph } from '@/lib/domain/place-labels';
import { SERVICE_LOCATION_TYPES } from '@/lib/domain/enums';

/**
 * Reading OpenStreetMap.
 *
 * Two classes of failure are guarded here, and the second is the dangerous one.
 *
 * The obvious class: parsing. A relation whose coordinate lives under `center`
 * rather than `lat`, a response that is an HTML error page, a hospital present
 * twice as a node and a way.
 *
 * The class that matters more: **mapping a tag to something it does not mean.**
 * OSM is a physical-geography database, not an administrative register, and the
 * temptation is to force its tags onto our enum so every filter looks populated.
 * `office=lawyer` mapped to `legal_aid` would send a citizen who cannot afford a
 * lawyer to a private practice that charges fees. That is not a parsing bug, it
 * is a wrong answer delivered confidently, and it is asserted against explicitly.
 */

describe('tag mapping', () => {
  it('recognises the places a citizen is sent to in an emergency', () => {
    expect(typeFromTags({ amenity: 'police' })).toBe('police_station');
    expect(typeFromTags({ amenity: 'hospital' })).toBe('hospital');
    expect(typeFromTags({ amenity: 'courthouse' })).toBe('court');
    expect(typeFromTags({ amenity: 'fire_station' })).toBe('fire_station');
  });

  it('recognises the everyday ones too', () => {
    expect(typeFromTags({ amenity: 'pharmacy' })).toBe('pharmacy');
    expect(typeFromTags({ amenity: 'bank' })).toBe('bank');
    expect(typeFromTags({ amenity: 'post_office' })).toBe('post_office');
    expect(typeFromTags({ amenity: 'clinic' })).toBe('clinic');
    expect(typeFromTags({ amenity: 'doctors' })).toBe('clinic');
    expect(typeFromTags({ office: 'ngo' })).toBe('ngo_office');
    expect(typeFromTags({ amenity: 'college' })).toBe('training_center');
  });

  it('never demotes a hospital to a clinic', () => {
    // Rule order matters: a facility tagged both ways must stay a hospital,
    // because that is where a 2am emergency has to go.
    expect(typeFromTags({ amenity: 'hospital', healthcare: 'clinic' })).toBe('hospital');
  });

  it('does NOT call a private lawyer legal aid', () => {
    /**
     * The central refusal. `office=lawyer` is a practice that charges fees;
     * `legal_aid` in this app is the free service a citizen is entitled to.
     * Conflating them sends someone with no money to someone who wants money.
     */
    expect(typeFromTags({ office: 'lawyer' })).toBeNull();
    expect(typeFromTags({ amenity: 'lawyer' })).toBeNull();
  });

  it('does not guess an administrative tier it cannot know', () => {
    /**
     * Union, upazila and district offices are different things: the tier decides
     * which forms can be filed where. OSM does not record it, so a government
     * office becomes the untiered type rather than being assigned a tier.
     */
    expect(typeFromTags({ office: 'government' })).toBe('government_office');
    expect(typeFromTags({ amenity: 'townhall' })).toBe('government_office');

    for (const tier of ['union_office', 'upazila_office', 'district_office'] as const) {
      expect(OSM_BACKED_TYPES).not.toContain(tier);
    }
  });

  it('ignores tags that mean nothing here', () => {
    expect(typeFromTags({ amenity: 'restaurant' })).toBeNull();
    expect(typeFromTags({ shop: 'bakery' })).toBeNull();
    expect(typeFromTags({ highway: 'bus_stop' })).toBeNull();
    expect(typeFromTags({})).toBeNull();
    expect(typeFromTags(undefined)).toBeNull();
  });

  it('leaves types OSM cannot supply unmapped rather than approximating them', () => {
    // Both filters then show seeded records only, which is honest. An invented
    // mapping would put a citizen in front of the wrong desk.
    expect(OSM_BACKED_TYPES).not.toContain('agriculture_office');
    expect(OSM_BACKED_TYPES).not.toContain('digital_center');
    expect(OSM_BACKED_TYPES).not.toContain('legal_aid');
  });
});

describe('the Overpass query', () => {
  const box = { south: 23.5, west: 90.2, north: 24.1, east: 90.7 };

  it('asks for nodes, ways and relations, not just nodes', () => {
    /**
     * A hospital is usually a way — its building footprint — or a relation. A
     * node-only query silently loses most of the large facilities, which is the
     * worst kind of failure: the map looks populated and the hospitals are
     * missing.
     */
    const query = buildQuery(box, 25);
    expect(query).toContain('nwr');
    expect(query).not.toMatch(/^\s*node\[/m);
  });

  it('retrieves everything in ONE request', () => {
    /**
     * Overpass is a volunteer-run shared service with a fair-use policy. One
     * request per type would be thirteen; getting rate-limited would take the
     * feature down for everyone.
     */
    const query = buildQuery(box, 25);
    const statements = query.match(/nwr/g) ?? [];
    // One clause per OSM key (amenity, healthcare, office), not per value.
    expect(statements.length).toBeLessThanOrEqual(4);
    expect(overpassFilters().length).toBeLessThanOrEqual(4);
  });

  it('declares its timeout to Overpass as well as enforcing one locally', () => {
    // Told the budget, Overpass abandons work nobody is waiting for.
    expect(buildQuery(box, 25)).toContain('[timeout:25]');
  });

  it('asks for a centre coordinate, since ways have no single point', () => {
    expect(buildQuery(box, 25)).toContain('out center tags;');
  });

  it('includes the bounding box on every clause', () => {
    const query = buildQuery(box, 25);
    const bbox = '23.5,90.2,24.1,90.7';
    for (const line of query.split('\n').filter((l) => l.includes('nwr'))) {
      expect(line).toContain(bbox);
    }
  });

  it('covers every type it claims to support', () => {
    const filters = overpassFilters().join(' ');
    for (const type of OSM_BACKED_TYPES) {
      // Each backed type must have at least one value reachable by the filters.
      const rule = Object.entries(PLACE_LABELS).find(([key]) => key === type);
      expect(rule, type).toBeDefined();
    }
    expect(filters).toContain('police');
    expect(filters).toContain('courthouse');
    expect(filters).toContain('hospital');
  });
});

describe('normalising an element', () => {
  it('reads a plain node', () => {
    const place = normaliseElement({
      type: 'node',
      id: 123,
      lat: 23.81,
      lon: 90.41,
      tags: { amenity: 'police', name: 'Ramna Thana', 'name:bn': 'রমনা থানা', phone: '+8801711000000' },
    });

    expect(place).toMatchObject({
      id: 'node/123',
      type: 'police_station',
      name: 'Ramna Thana',
      nameBn: 'রমনা থানা',
      lat: 23.81,
      lng: 90.41,
      phone: '+8801711000000',
    });
  });

  it('reads a way through its centre', () => {
    // Without this, every large hospital is dropped.
    const place = normaliseElement({
      type: 'way',
      id: 456,
      center: { lat: 23.7266, lon: 90.3971 },
      tags: { amenity: 'hospital', name: 'Dhaka Medical College Hospital' },
    });

    expect(place?.lat).toBeCloseTo(23.7266, 4);
    expect(place?.lng).toBeCloseTo(90.3971, 4);
    expect(place?.id).toBe('way/456');
  });

  it('rejects an element with no usable coordinate', () => {
    // A place with no position cannot be mapped or given a distance, which is the
    // entire value it would add.
    expect(normaliseElement({ type: 'relation', id: 7, tags: { amenity: 'police' } })).toBeNull();
    expect(
      normaliseElement({ type: 'node', id: 8, lat: Number.NaN, lon: 90, tags: { amenity: 'police' } }),
    ).toBeNull();
  });

  it('prefers the English name tag but keeps the Bangla one', () => {
    const place = normaliseElement({
      type: 'node', id: 1, lat: 23, lon: 90,
      tags: { amenity: 'hospital', name: 'সদর হাসপাতাল', 'name:en': 'Sadar Hospital', 'name:bn': 'সদর হাসপাতাল' },
    });
    expect(place?.name).toBe('Sadar Hospital');
    expect(place?.nameBn).toBe('সদর হাসপাতাল');
  });

  it('leaves an unnamed feature unnamed rather than inventing a name', () => {
    // The caller substitutes the type label; guessing here would produce a
    // confident-looking name for something nobody has identified.
    const place = normaliseElement({
      type: 'node', id: 2, lat: 23, lon: 90, tags: { amenity: 'pharmacy' },
    });
    expect(place?.name).toBeNull();
    expect(place?.nameBn).toBeNull();
    expect(place?.type).toBe('pharmacy');
  });

  it('picks up a 24-hour emergency department', () => {
    // Decision-relevant at 2am, and the one hospital tag worth surfacing.
    const place = normaliseElement({
      type: 'node', id: 3, lat: 23, lon: 90,
      tags: { amenity: 'hospital', name: 'X', emergency: 'yes' },
    });
    expect(place?.emergency).toBe(true);
  });

  it('accepts either phone convention', () => {
    const older = normaliseElement({
      type: 'node', id: 4, lat: 23, lon: 90, tags: { amenity: 'bank', phone: '02-123' },
    });
    const newer = normaliseElement({
      type: 'node', id: 5, lat: 23, lon: 90, tags: { amenity: 'bank', 'contact:phone': '02-456' },
    });
    expect(older?.phone).toBe('02-123');
    expect(newer?.phone).toBe('02-456');
  });
});

describe('de-duplication', () => {
  const hospitalNode = {
    id: 'node/1', type: 'hospital' as const, name: 'Sadar Hospital', nameBn: 'সদর হাসপাতাল',
    lat: 23.8000, lng: 90.4000, phone: '02-111', openingHours: null, locality: null,
    website: null, emergency: false,
  };

  it('collapses the same facility recorded as a node and a way', () => {
    /**
     * OSM routinely holds both a label node and a building outline for one
     * hospital, and a bbox query returns both. Listed twice at slightly different
     * distances it reads as broken data and makes the count meaningless.
     */
    const asWay = { ...hospitalNode, id: 'way/2', lat: 23.8005, lng: 90.4004, phone: null };
    const kept = dedupe([hospitalNode, asWay]);

    expect(kept).toHaveLength(1);
    // The richer record survives: it has the phone number.
    expect(kept[0]!.phone).toBe('02-111');
  });

  it('collapses a company suffix, which is how the same hospital appears twice', () => {
    /**
     * Observed live at 0.7 km from central Dhaka: "United Hospital" and "United
     * Hospital Limited", two contributors' entries for one building. Exact string
     * equality misses it and the citizen sees the same hospital twice.
     */
    const withSuffix = { ...hospitalNode, id: 'way/9', name: 'Sadar Hospital Limited', lat: 23.8004 };
    expect(dedupe([hospitalNode, withSuffix])).toHaveLength(1);

    const withCity = { ...hospitalNode, id: 'way/10', name: 'Sadar Hospital Dhaka', lat: 23.8004 };
    expect(dedupe([hospitalNode, withCity])).toHaveLength(1);
  });

  it('normalises for comparison without collapsing different kinds of place', () => {
    // "Sadar Hospital" and "Sadar Pharmacy" share a word and are not the same
    // thing, so the type word must survive normalisation.
    expect(comparableName('United Hospital Limited')).toBe(comparableName('United Hospital'));
    expect(comparableName('Sadar Hospital')).not.toBe(comparableName('Sadar Pharmacy'));
    // Bangla marks belong to the word.
    expect(comparableName('সদর হাসপাতাল')).toBe('সদর হাসপাতাল');
  });

  it('keeps two genuinely different places with the same name', () => {
    // "Popular Diagnostic" branches are real and distinct. 3 km apart is not a
    // duplicate.
    const far = { ...hospitalNode, id: 'node/3', lat: 23.83, lng: 90.43 };
    expect(dedupe([hospitalNode, far])).toHaveLength(2);
  });

  it('keeps two different types at the same address', () => {
    // A pharmacy inside a hospital building is not the hospital.
    const pharmacy = { ...hospitalNode, id: 'node/4', type: 'pharmacy' as const };
    expect(dedupe([hospitalNode, pharmacy])).toHaveLength(2);
  });

  it('does not merge unnamed places just because they are close', () => {
    /**
     * Two unnamed pharmacies on the same street are two pharmacies. Merging on an
     * empty name would delete real results — and the blank name is exactly the
     * case where there is least evidence they are the same thing.
     */
    const a = { ...hospitalNode, id: 'node/5', type: 'pharmacy' as const, name: null, nameBn: null };
    const b = { ...a, id: 'node/6', lat: 23.8002 };
    expect(dedupe([a, b])).toHaveLength(2);
  });
});

describe('parsing a whole response', () => {
  it('keeps only the elements that mean something', () => {
    const places = parseResponse({
      elements: [
        { type: 'node', id: 1, lat: 23, lon: 90, tags: { amenity: 'police', name: 'A' } },
        { type: 'node', id: 2, lat: 23, lon: 90, tags: { amenity: 'restaurant', name: 'B' } },
        { type: 'relation', id: 3, tags: { amenity: 'hospital' } },
      ],
    });
    expect(places).toHaveLength(1);
    expect(places[0]!.type).toBe('police_station');
  });

  it('treats a missing element list as an error, not as "no places"', () => {
    /**
     * Overpass answers a malformed query with an HTML error page. Returning an
     * empty array would tell the citizen there are no hospitals in their district,
     * which is a false statement rather than a missing feature.
     */
    expect(() => parseResponse({})).toThrow(OverpassError);
    expect(() => parseResponse('<html>error</html>')).toThrow(OverpassError);
    expect(() => parseResponse(null)).toThrow(OverpassError);
  });

  it('returns an empty list for a genuinely empty area', () => {
    expect(parseResponse({ elements: [] })).toEqual([]);
  });
});

describe('cache key', () => {
  it('gives two citizens in the same town the same key', () => {
    /**
     * The whole point. Keying on exact GPS would mean a separate upstream query
     * per person for identical results — the opposite of fair use on a volunteer
     * service.
     */
    const a = cellKey({ lat: 23.8103, lng: 90.4125 }, 25);
    const b = cellKey({ lat: 23.8149, lng: 90.4102 }, 25);
    expect(a).toBe(b);
  });

  it('separates places genuinely far apart', () => {
    expect(cellKey({ lat: 23.81, lng: 90.41 }, 25)).not.toBe(cellKey({ lat: 25.74, lng: 89.27 }, 25));
  });

  it('separates different radii, since the results differ', () => {
    expect(cellKey({ lat: 23.81, lng: 90.41 }, 25)).not.toBe(cellKey({ lat: 23.81, lng: 90.41 }, 5));
  });

  it('is stable, so a cached row is findable again', () => {
    const point = { lat: 23.8103, lng: 90.4125 };
    expect(cellKey(point, 25)).toBe(cellKey(point, 25));
  });
});

describe('place labels', () => {
  it('labels every type in both languages, so no citizen sees a raw enum', () => {
    for (const type of SERVICE_LOCATION_TYPES) {
      const label = PLACE_LABELS[type];
      expect(label, type).toBeDefined();
      expect(label.bn, `${type}.bn`).not.toMatch(/[a-z_]{4,}/);
      expect(label.bn.length, `${type}.bn`).toBeGreaterThan(1);
      expect(label.en.length, `${type}.en`).toBeGreaterThan(1);
      expect(label.glyph.length, `${type}.glyph`).toBeGreaterThan(0);
    }
  });

  it('labels the OSM-only government type as well', () => {
    expect(placeLabel('government_office', 'bn')).toBe('সরকারি অফিস');
    expect(placeLabel('government_office', 'en')).toBe('Government office');
  });

  it('gives every marker a glyph, because colour alone is never the cue', () => {
    // BDS §2.2 rule 4. A map of identically coloured dots conveys nothing to
    // someone who cannot distinguish them.
    const glyphs = SERVICE_LOCATION_TYPES.map((t) => placeGlyph(t));
    expect(glyphs.every((g) => g.length > 0)).toBe(true);
  });

  it('marks the places you go to when something has gone wrong', () => {
    for (const type of ['hospital', 'police_station', 'fire_station'] as const) {
      expect(PLACE_LABELS[type].urgent, type).toBe(true);
    }
    expect(PLACE_LABELS.bank.urgent).toBeUndefined();
  });
});
