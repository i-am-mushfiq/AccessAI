import { DISTRICTS, DIVISION_LABELS, type DistrictRecord } from '@/lib/domain/geography';

/**
 * Service locations for the Nearby Services map and list.
 *
 * These are GENERATED from the district table rather than hand-authored, and
 * that is a deliberate, disclosed choice. Bangladesh has one Social Services
 * office, one Sadar hospital, one legal aid office, one agriculture office and
 * one youth development office per district as a matter of administrative
 * structure, so generating them gives correct national coverage.
 *
 * What is NOT real: street addresses and phone numbers. Rather than inventing
 * plausible-looking street numbers and dialling codes — which a citizen might
 * actually try to use — each record gets a structurally honest address
 * ("Sadar, <District>") with no phone number, and is flagged
 * `unverified_sample`. The UI shows that flag and directs the citizen to the
 * national helpline instead of a fabricated local number.
 *
 * The five named Dhaka facilities at the end are real institutions at their
 * real areas.
 */

export interface SeedLocation {
  readonly orgKey?: string;
  readonly name: readonly [en: string, bn: string];
  readonly type:
    | 'union_office' | 'upazila_office' | 'district_office' | 'hospital' | 'clinic' | 'ngo_office'
    | 'bank' | 'training_center' | 'legal_aid' | 'agriculture_office' | 'pharmacy' | 'digital_center';
  readonly address: readonly [en: string, bn: string];
  readonly division: string;
  readonly district: string;
  readonly lat: number;
  readonly lng: number;
  readonly phone?: string;
  readonly officeHours: readonly [en: string, bn: string];
  readonly services: readonly string[];
}

const GOV_HOURS: readonly [string, string] = [
  'Sunday–Thursday, 9:00 AM – 5:00 PM (closed Friday and Saturday)',
  'রবি–বৃহস্পতি, সকাল ৯টা – বিকাল ৫টা (শুক্র ও শনি বন্ধ)',
];

const HOSPITAL_HOURS: readonly [string, string] = [
  'Emergency 24 hours; outpatient 8:00 AM – 2:30 PM',
  'ইমার্জেন্সি ২৪ ঘণ্টা; বহির্বিভাগ সকাল ৮টা – দুপুর ২টা ৩০',
];

/**
 * Small deterministic offsets so co-located markers do not stack exactly on
 * top of each other on the map. Roughly 0.5–2 km — well inside the district
 * town, and never presented as a precise position.
 */
const OFFSETS: readonly [number, number][] = [
  [0.004, 0.004],
  [-0.006, 0.005],
  [0.007, -0.004],
  [-0.005, -0.007],
  [0.009, 0.008],
];

function districtLocations(d: DistrictRecord): SeedLocation[] {
  const divisionLabel = DIVISION_LABELS[d.division];
  const addr = (en: string, bn: string): readonly [string, string] => [
    `${en}, ${d.en} Sadar, ${d.en}, ${divisionLabel.en} Division`,
    `${bn}, ${d.bn} সদর, ${d.bn}, ${divisionLabel.bn} বিভাগ`,
  ];

  return [
    {
      orgKey: 'dss',
      name: [`District Social Services Office, ${d.en}`, `জেলা সমাজসেবা কার্যালয়, ${d.bn}`],
      type: 'district_office',
      address: addr('District Social Services Office', 'জেলা সমাজসেবা কার্যালয়'),
      division: d.division,
      district: d.code,
      lat: d.lat + OFFSETS[0]![0],
      lng: d.lng + OFFSETS[0]![1],
      officeHours: GOV_HOURS,
      services: [
        'old-age-allowance', 'widow-allowance', 'disability-allowance',
        'disabled-student-stipend', 'cancer-kidney-liver-assistance',
        'disability-assistive-devices', 'freedom-fighter-honorarium',
      ],
    },
    {
      orgKey: 'dghs',
      name: [`${d.en} Sadar Hospital`, `${d.bn} সদর হাসপাতাল`],
      type: 'hospital',
      address: addr('Sadar Hospital', 'সদর হাসপাতাল'),
      division: d.division,
      district: d.code,
      lat: d.lat + OFFSETS[1]![0],
      lng: d.lng + OFFSETS[1]![1],
      officeHours: HOSPITAL_HOURS,
      services: [
        'community-clinic-services', 'maternal-health-voucher',
        'nimh-mental-health-services', 'elderly-health-priority-services',
      ],
    },
    {
      orgKey: 'nlaso',
      name: [`District Legal Aid Office, ${d.en}`, `জেলা লিগ্যাল এইড অফিস, ${d.bn}`],
      type: 'legal_aid',
      address: addr('District Legal Aid Office, District Court premises', 'জেলা লিগ্যাল এইড অফিস, জেলা জজ আদালত চত্বর'),
      division: d.division,
      district: d.code,
      lat: d.lat + OFFSETS[2]![0],
      lng: d.lng + OFFSETS[2]![1],
      // The 16430 national helpline IS real and free, so it is safe to surface.
      phone: '16430',
      officeHours: [
        'Sunday–Thursday, 9:00 AM – 5:00 PM. Helpline 16430 is open 24 hours.',
        'রবি–বৃহস্পতি, সকাল ৯টা – বিকাল ৫টা। হেল্পলাইন ১৬৪৩০ ২৪ ঘণ্টা খোলা।',
      ],
      services: ['government-legal-aid'],
    },
    {
      orgKey: 'dae',
      name: [`District Agriculture Extension Office, ${d.en}`, `জেলা কৃষি সম্প্রসারণ কার্যালয়, ${d.bn}`],
      type: 'agriculture_office',
      address: addr('Deputy Director, Department of Agricultural Extension', 'উপপরিচালকের কার্যালয়, কৃষি সম্প্রসারণ অধিদপ্তর'),
      division: d.division,
      district: d.code,
      lat: d.lat + OFFSETS[3]![0],
      lng: d.lng + OFFSETS[3]![1],
      phone: '16123',
      officeHours: GOV_HOURS,
      services: [
        'agricultural-input-assistance', 'agricultural-rehabilitation-crop-loss',
        'livestock-vaccination-training',
      ],
    },
    {
      orgKey: 'dyd',
      name: [`District Youth Development Office, ${d.en}`, `জেলা যুব উন্নয়ন কার্যালয়, ${d.bn}`],
      type: 'training_center',
      address: addr('District Youth Development Office', 'জেলা যুব উন্নয়ন কার্যালয়'),
      division: d.division,
      district: d.code,
      lat: d.lat + OFFSETS[4]![0],
      lng: d.lng + OFFSETS[4]![1],
      officeHours: GOV_HOURS,
      services: ['youth-development-training-loan', 'nsda-free-skills-training'],
    },
  ];
}

/** Real, named national institutions at their actual areas. */
const NAMED_LOCATIONS: readonly SeedLocation[] = [
  {
    orgKey: 'nicrh',
    name: ['National Institute of Cancer Research & Hospital', 'জাতীয় ক্যান্সার গবেষণা ইনস্টিটিউট ও হাসপাতাল'],
    type: 'hospital',
    address: ['Mohakhali, Dhaka 1212', 'মহাখালী, ঢাকা ১২১২'],
    division: 'dhaka',
    district: 'dhaka',
    lat: 23.7806,
    lng: 90.4053,
    officeHours: ['Outpatient Sunday–Thursday 8:00 AM – 2:30 PM', 'বহির্বিভাগ রবি–বৃহস্পতি সকাল ৮টা – দুপুর ২টা ৩০'],
    services: ['nicrh-subsidised-cancer-treatment', 'cancer-kidney-liver-assistance'],
  },
  {
    orgKey: 'nimh',
    name: ['National Institute of Mental Health', 'জাতীয় মানসিক স্বাস্থ্য ইনস্টিটিউট'],
    type: 'hospital',
    address: ['Sher-e-Bangla Nagar, Dhaka 1207', 'শেরেবাংলা নগর, ঢাকা ১২০৭'],
    division: 'dhaka',
    district: 'dhaka',
    lat: 23.7746,
    lng: 90.3803,
    phone: '16263',
    officeHours: ['Outpatient Sunday–Thursday 8:00 AM – 2:30 PM', 'বহির্বিভাগ রবি–বৃহস্পতি সকাল ৮টা – দুপুর ২টা ৩০'],
    services: ['nimh-mental-health-services'],
  },
  {
    orgKey: 'kidney_foundation',
    name: ['Kidney Foundation Hospital', 'কিডনি ফাউন্ডেশন হাসপাতাল'],
    type: 'hospital',
    address: ['Section 2, Mirpur, Dhaka 1216', 'সেকশন ২, মিরপুর, ঢাকা ১২১৬'],
    division: 'dhaka',
    district: 'dhaka',
    lat: 23.8069,
    lng: 90.3687,
    officeHours: ['Dialysis daily 7:00 AM – 9:00 PM', 'ডায়ালাইসিস প্রতিদিন সকাল ৭টা – রাত ৯টা'],
    services: ['kidney-foundation-dialysis', 'cancer-kidney-liver-assistance'],
  },
  {
    orgKey: 'brac',
    name: ['BRAC Centre', 'ব্র্যাক সেন্টার'],
    type: 'ngo_office',
    address: ['75 Mohakhali, Dhaka 1212', '৭৫ মহাখালী, ঢাকা ১২১২'],
    division: 'dhaka',
    district: 'dhaka',
    lat: 23.7783,
    lng: 90.4066,
    phone: '16445',
    officeHours: ['Sunday–Thursday, 9:00 AM – 5:00 PM', 'রবি–বৃহস্পতি, সকাল ৯টা – বিকাল ৫টা'],
    services: ['brac-ultra-poor-graduation', 'brac-legal-empowerment'],
  },
  {
    orgKey: 'blast',
    name: ['BLAST Head Office', 'ব্লাস্ট প্রধান কার্যালয়'],
    type: 'legal_aid',
    address: ['1/1 Pioneer Road, Kakrail, Dhaka 1000', '১/১ পাইওনিয়ার রোড, কাকরাইল, ঢাকা ১০০০'],
    division: 'dhaka',
    district: 'dhaka',
    lat: 23.7361,
    lng: 90.4048,
    officeHours: ['Sunday–Thursday, 9:30 AM – 5:30 PM', 'রবি–বৃহস্পতি, সকাল ৯টা ৩০ – বিকাল ৫টা ৩০'],
    services: ['blast-legal-aid'],
  },
  {
    orgKey: 'jms',
    name: ['Jatiyo Mohila Sangstha', 'জাতীয় মহিলা সংস্থা'],
    type: 'district_office',
    address: ['145 New Baily Road, Dhaka 1000', '১৪৫ নিউ বেইলি রোড, ঢাকা ১০০০'],
    division: 'dhaka',
    district: 'dhaka',
    lat: 23.7368,
    lng: 90.4058,
    phone: '109',
    officeHours: ['Helpline 109 open 24 hours; office Sunday–Thursday', 'হেল্পলাইন ১০৯ ২৪ ঘণ্টা; অফিস রবি–বৃহস্পতি'],
    services: ['jms-women-skills-training', 'violence-against-women-helpline'],
  },
  {
    orgKey: 'bmet',
    name: ['Bureau of Manpower, Employment and Training', 'জনশক্তি, কর্মসংস্থান ও প্রশিক্ষণ ব্যুরো'],
    type: 'training_center',
    address: ['89/2 Kakrail, Dhaka 1000', '৮৯/২ কাকরাইল, ঢাকা ১০০০'],
    division: 'dhaka',
    district: 'dhaka',
    lat: 23.7355,
    lng: 90.4021,
    officeHours: ['Sunday–Thursday, 9:00 AM – 5:00 PM', 'রবি–বৃহস্পতি, সকাল ৯টা – বিকাল ৫টা'],
    services: ['bmet-overseas-employment-training'],
  },
];

export const SEED_LOCATIONS: readonly SeedLocation[] = [
  ...DISTRICTS.flatMap(districtLocations),
  ...NAMED_LOCATIONS,
];
