import type { LifeEvent } from '@/lib/domain/enums';

/**
 * Life-event catalogue — PRD §23.
 *
 * The `keywords` array is the lexicon of the deterministic detector. It must
 * contain Bangla, English, AND Banglish (romanised Bangla) surface forms,
 * because citizens type all three and frequently mix them inside one sentence.
 *
 * Keywords are matched case-insensitively as substrings after normalisation, so
 * short entries are dangerous: "job" would fire on "jobless" correctly but also
 * on unrelated text, and single Bangla syllables collide constantly. Every
 * entry here is at least four characters or a whole distinctive word.
 */

export interface SeedLifeEvent {
  readonly code: LifeEvent;
  readonly label: readonly [en: string, bn: string];
  readonly description: readonly [en: string, bn: string];
  readonly keywords: readonly string[];
  readonly icon: string;
  readonly sortOrder: number;
}

export const SEED_LIFE_EVENTS: readonly SeedLifeEvent[] = [
  {
    code: 'job_loss',
    label: ['I lost my job', 'আমি চাকরি হারিয়েছি'],
    description: [
      'Your income has stopped or dropped sharply because you lost work.',
      'কাজ চলে যাওয়ায় আপনার আয় বন্ধ হয়েছে বা অনেক কমে গেছে।',
    ],
    keywords: [
      'চাকরি হারিয়েছি', 'চাকরি চলে গেছে', 'চাকরি নেই', 'কাজ হারিয়েছি', 'কাজ নেই', 'বেকার',
      'ছাঁটাই', 'চাকরিচ্যুত', 'কর্মহীন', 'আয় বন্ধ',
      'lost my job', 'lost job', 'jobless', 'unemployed', 'laid off', 'retrenched',
      'no work', 'no income', 'out of work', 'fired', 'sacked',
      'chakri hariyechi', 'chakri nei', 'kaj nei', 'bekar', 'chatai',
    ],
    icon: 'briefcase-off',
    sortOrder: 1,
  },
  {
    code: 'seeking_employment',
    label: ['I am looking for work', 'আমি কাজ খুঁজছি'],
    description: [
      'You want a job or training that leads to one.',
      'আপনি চাকরি চান, অথবা এমন প্রশিক্ষণ চান যা কাজে পৌঁছে দেয়।',
    ],
    keywords: [
      'কাজ খুঁজছি', 'চাকরি খুঁজছি', 'চাকরি দরকার', 'কাজ দরকার', 'প্রশিক্ষণ চাই', 'দক্ষতা শিখতে চাই',
      'চাকরির জন্য', 'কর্মসংস্থান',
      'looking for work', 'looking for a job', 'need a job', 'want a job', 'job search',
      'need training', 'want to learn a skill', 'employment', 'vacancy',
      'kaj khujchi', 'chakri khujchi', 'chakri darkar', 'kaj darkar', 'training chai',
    ],
    icon: 'search-check',
    sortOrder: 2,
  },
  {
    code: 'widowhood',
    label: ['My husband has died', 'আমার স্বামী মারা গেছেন'],
    description: [
      'You have lost your husband and the financial support that came with him.',
      'আপনি স্বামীকে হারিয়েছেন এবং তাঁর সঙ্গে আসা আর্থিক সহায়তাও হারিয়েছেন।',
    ],
    keywords: [
      'স্বামী মারা গেছে', 'স্বামী মারা গেছেন', 'স্বামী নেই', 'বিধবা', 'স্বামীর মৃত্যু',
      'স্বামী মৃত', 'স্বামী ইন্তেকাল', 'বিধবা হয়েছি',
      'husband died', 'husband passed away', 'husband has died', 'widow', 'widowed',
      'lost my husband', 'my husband is no more',
      'shami mara gechen', 'shami mara geche', 'shami nei', 'bidhoba', 'shamir mrittu',
    ],
    icon: 'heart-crack',
    sortOrder: 3,
  },
  {
    code: 'divorce',
    label: ['I am divorced or separated', 'আমি তালাকপ্রাপ্তা বা বিচ্ছিন্না'],
    description: [
      'Your marriage has ended, or your husband has left you.',
      'আপনার বিবাহ ভেঙে গেছে, অথবা স্বামী আপনাকে ছেড়ে গেছেন।',
    ],
    keywords: [
      'তালাক', 'ডিভোর্স', 'বিচ্ছেদ', 'স্বামী ছেড়ে গেছে', 'স্বামী পরিত্যক্তা', 'আলাদা থাকি',
      'স্বামী নিগৃহীতা', 'সংসার ভেঙে গেছে',
      'divorce', 'divorced', 'separated', 'husband left me', 'deserted', 'abandoned by husband',
      'talak', 'bicched', 'shami chere geche', 'alada thaki',
    ],
    icon: 'unlink',
    sortOrder: 4,
  },
  {
    code: 'higher_education',
    label: ['I want to continue studying', 'আমি পড়াশোনা চালিয়ে যেতে চাই'],
    description: [
      'You want a scholarship, stipend, or funding to study further, at home or abroad.',
      'দেশে বা বিদেশে আরও পড়ার জন্য আপনি বৃত্তি, উপবৃত্তি বা অর্থায়ন চান।',
    ],
    keywords: [
      'পড়াশোনা', 'বৃত্তি', 'স্কলারশিপ', 'উপবৃত্তি', 'বিদেশে পড়তে', 'উচ্চশিক্ষা',
      'মাস্টার্স', 'পিএইচডি', 'অনার্স', 'ভর্তি হতে চাই', 'গবেষণা', 'ফেলোশিপ',
      'scholarship', 'stipend', 'study abroad', 'higher education', 'masters', 'phd',
      'fellowship', 'research grant', 'want to study', 'continue my studies', 'university admission',
      'briti', 'scholarship chai', 'poroshona', 'bideshe porte', 'uchchoshikkha',
    ],
    icon: 'graduation-cap',
    sortOrder: 5,
  },
  {
    code: 'child_education',
    label: ['I need help with my child\'s education', 'সন্তানের পড়াশোনায় সহায়তা দরকার'],
    description: [
      'You need a stipend or support to keep a child in school.',
      'সন্তানকে স্কুলে রাখতে আপনার উপবৃত্তি বা সহায়তা দরকার।',
    ],
    keywords: [
      'সন্তানের পড়াশোনা', 'ছেলের পড়াশোনা', 'মেয়ের পড়াশোনা', 'স্কুলের খরচ', 'বেতন দিতে পারছি না',
      'সন্তানের উপবৃত্তি', 'বই খাতা', 'ভর্তি ফি',
      'child education', 'school fees', 'my son studies', 'my daughter studies',
      'cannot pay school', 'child stipend', 'school stipend',
      'santaner porashona', 'skuler khoroch', 'beton dite parchi na',
    ],
    icon: 'book-open',
    sortOrder: 6,
  },
  {
    code: 'serious_medical_need',
    label: ['I need medical treatment', 'আমার চিকিৎসা দরকার'],
    description: [
      'You or a family member needs treatment and the cost is a problem.',
      'আপনার বা পরিবারের কারও চিকিৎসা দরকার এবং খরচ একটি সমস্যা।',
    ],
    keywords: [
      'ক্যান্সার', 'কিডনি', 'ডায়ালাইসিস', 'হার্টের সমস্যা', 'অপারেশন', 'চিকিৎসা',
      'হাসপাতাল', 'রোগ', 'অসুস্থ', 'লিভার', 'স্ট্রোক', 'প্যারালাইসিস', 'থ্যালাসেমিয়া',
      'চিকিৎসার টাকা', 'ঔষধের খরচ', 'মানসিক সমস্যা', 'ডাক্তার দেখাতে',
      'cancer', 'kidney', 'dialysis', 'heart disease', 'operation', 'surgery',
      'treatment', 'hospital', 'illness', 'sick', 'liver', 'stroke', 'paralysis',
      'thalassaemia', 'thalassemia', 'medical cost', 'medicine cost', 'mental health', 'depression',
      'chikitsha', 'hospital', 'oshustho', 'daktar', 'operation',
    ],
    icon: 'stethoscope',
    sortOrder: 7,
  },
  {
    code: 'pregnancy',
    label: ['I am pregnant', 'আমি গর্ভবতী'],
    description: [
      'You are expecting a child and want antenatal care or maternity support.',
      'আপনি সন্তানসম্ভবা এবং গর্ভকালীন সেবা বা মাতৃত্ব সহায়তা চান।',
    ],
    keywords: [
      'গর্ভবতী', 'সন্তানসম্ভবা', 'বাচ্চা হবে', 'প্রেগন্যান্ট', 'মাতৃত্ব', 'গর্ভাবস্থা',
      'ডেলিভারি', 'প্রসব',
      'pregnant', 'pregnancy', 'expecting a baby', 'maternity', 'antenatal', 'delivery',
      'gorbhoboti', 'bacha hobe', 'pregnant achi', 'matritto',
    ],
    icon: 'baby',
    sortOrder: 8,
  },
  {
    code: 'disability_onset',
    label: ['I or a family member has a disability', 'আমার বা পরিবারের কারও প্রতিবন্ধিতা আছে'],
    description: [
      'You need a disability allowance, an assistive device, or therapy.',
      'আপনার প্রতিবন্ধী ভাতা, সহায়ক উপকরণ বা থেরাপি দরকার।',
    ],
    keywords: [
      'প্রতিবন্ধী', 'প্রতিবন্ধিতা', 'অন্ধ', 'দৃষ্টি প্রতিবন্ধী', 'শ্রবণ প্রতিবন্ধী', 'বাক প্রতিবন্ধী',
      'হুইলচেয়ার', 'সুবর্ণ নাগরিক', 'পঙ্গু', 'অটিজম', 'বুদ্ধি প্রতিবন্ধী',
      'disability', 'disabled', 'blind', 'deaf', 'wheelchair', 'autism',
      'hearing aid', 'prosthetic', 'suborno nagorik', 'physically challenged',
      'protibondhi', 'protibondhita', 'wheelchair', 'ondho',
    ],
    icon: 'accessibility',
    sortOrder: 9,
  },
  {
    code: 'old_age',
    label: ['I am an elderly citizen', 'আমি একজন বয়স্ক নাগরিক'],
    description: [
      'You are older and want an allowance or priority health services.',
      'আপনার বয়স হয়েছে এবং আপনি ভাতা বা অগ্রাধিকার স্বাস্থ্যসেবা চান।',
    ],
    keywords: [
      'বয়স্ক', 'বৃদ্ধ', 'বয়স্ক ভাতা', 'প্রবীণ', 'বয়স হয়েছে', 'অবসর', 'পেনশন নেই',
      'elderly', 'old age', 'senior citizen', 'old age allowance', 'retired', 'pension',
      'boyosko', 'briddho', 'boyosko bhata', 'probin',
    ],
    icon: 'user-round',
    sortOrder: 10,
  },
  {
    code: 'entrepreneurship',
    label: ['I want to start or grow a business', 'আমি ব্যবসা শুরু বা বড় করতে চাই'],
    description: [
      'You need a loan, training, or registration help for an enterprise.',
      'উদ্যোগের জন্য আপনার ঋণ, প্রশিক্ষণ বা নিবন্ধনে সহায়তা দরকার।',
    ],
    keywords: [
      'ব্যবসা', 'ব্যবসা শুরু', 'দোকান', 'ঋণ চাই', 'পুঁজি', 'উদ্যোক্তা', 'লোন',
      'ব্যবসার জন্য টাকা', 'এসএমই', 'ক্ষুদ্র ঋণ', 'ব্যবসা বড় করতে',
      'business', 'start a business', 'shop', 'loan', 'capital', 'entrepreneur',
      'sme loan', 'microcredit', 'want a loan', 'grow my business', 'startup',
      'byabsa', 'byabsa shuru', 'dokan', 'rin chai', 'loan chai', 'uddokta',
    ],
    icon: 'store',
    sortOrder: 11,
  },
  {
    code: 'crop_loss',
    label: ['My crops or livestock were damaged', 'আমার ফসল বা পশুর ক্ষতি হয়েছে'],
    description: [
      'Flood, drought, pests, or disease has destroyed your crop or animals.',
      'বন্যা, খরা, পোকা বা রোগে আপনার ফসল বা পশু নষ্ট হয়েছে।',
    ],
    keywords: [
      'ফসল নষ্ট', 'ফসলের ক্ষতি', 'ধান নষ্ট', 'জমি ডুবে গেছে', 'গরু মারা গেছে', 'পোকা',
      'খরা', 'লবণাক্ত', 'কৃষি ক্ষতি', 'বীজ দরকার', 'সার দরকার',
      'crop damaged', 'crop loss', 'crop destroyed', 'harvest lost', 'field flooded',
      'cattle died', 'livestock died', 'pest attack', 'drought', 'salinity', 'need seed',
      'foshol nosto', 'fosholer khoti', 'dhan nosto', 'jomi dube geche', 'goru mara geche',
    ],
    icon: 'sprout',
    sortOrder: 12,
  },
  {
    code: 'disaster_recovery',
    label: ['A disaster has affected my home', 'দুর্যোগে আমার ঘরের ক্ষতি হয়েছে'],
    description: [
      'Flood, cyclone, fire, or river erosion has damaged your house or land.',
      'বন্যা, ঘূর্ণিঝড়, আগুন বা নদীভাঙনে আপনার ঘর বা জমির ক্ষতি হয়েছে।',
    ],
    keywords: [
      'বন্যা', 'ঘূর্ণিঝড়', 'নদীভাঙন', 'ঘর ভেঙে গেছে', 'ঘর নষ্ট', 'আগুনে পুড়ে গেছে',
      'ত্রাণ', 'দুর্যোগ', 'ঘরবাড়ি নষ্ট', 'আশ্রয়', 'জলোচ্ছ্বাস',
      'flood', 'cyclone', 'river erosion', 'house destroyed', 'house damaged', 'fire burned',
      'relief', 'disaster', 'homeless', 'shelter', 'storm surge', 'landslide',
      'bonna', 'ghurnijhor', 'nodi bhangon', 'ghor bhenge geche', 'tran', 'durjog',
    ],
    icon: 'cloud-rain-wind',
    sortOrder: 13,
  },
  {
    code: 'legal_dispute',
    label: ['I have a legal problem', 'আমার একটি আইনি সমস্যা আছে'],
    description: [
      'You need a lawyer, mediation, or legal advice and cannot afford the cost.',
      'আপনার আইনজীবী, মধ্যস্থতা বা আইনি পরামর্শ দরকার এবং খরচ বহন করতে পারছেন না।',
    ],
    keywords: [
      'মামলা', 'আইনি সহায়তা', 'উকিল', 'আইনজীবী', 'জমি নিয়ে বিরোধ', 'যৌতুক',
      'নির্যাতন', 'মারধর', 'আদালত', 'থানা', 'অভিযোগ', 'উত্তরাধিকার', 'ভরণপোষণ',
      'legal aid', 'lawyer', 'court case', 'land dispute', 'dowry', 'domestic violence',
      'harassment', 'inheritance', 'maintenance', 'police complaint', 'litigation',
      'mamla', 'aini shohayota', 'ukil', 'jomi niye birodh', 'joutuk', 'nirjaton',
    ],
    icon: 'scale',
    sortOrder: 14,
  },
  {
    code: 'migration',
    label: ['I want to work abroad', 'আমি বিদেশে কাজ করতে চাই'],
    description: [
      'You are planning overseas employment and need registration, training, or a loan.',
      'আপনি বিদেশে কাজের পরিকল্পনা করছেন এবং নিবন্ধন, প্রশিক্ষণ বা ঋণ দরকার।',
    ],
    keywords: [
      'বিদেশে যেতে', 'বিদেশে কাজ', 'প্রবাসে', 'ভিসা', 'দালাল', 'সৌদি', 'মালয়েশিয়া',
      'বিএমইটি', 'প্রবাসী ঋণ', 'পাসপোর্ট', 'বিদেশ যাওয়ার টাকা',
      'work abroad', 'go abroad', 'overseas job', 'migration', 'visa', 'broker',
      'bmet', 'migrant worker', 'passport', 'saudi', 'malaysia', 'middle east',
      'bideshe jete', 'bideshe kaj', 'probashe', 'visa', 'dalal',
    ],
    icon: 'plane',
    sortOrder: 15,
  },
];
