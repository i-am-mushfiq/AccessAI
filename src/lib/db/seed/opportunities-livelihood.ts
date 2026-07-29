import {
  type SeedOpportunity, c, ALL, ANY, rules,
  isBangladeshi, monthlyIncomeBelow, isFemale, ageBetween, ageAtLeast,
  isFarmerLike, landAtMost, educationAtLeast, hasNationalId,
} from './helpers';

/**
 * Agriculture, enterprise, employment, and financial inclusion.
 * All records are authored sample data — see docs/DEVIATIONS.md §2.
 */
export const SEED_LIVELIHOOD: readonly SeedOpportunity[] = [
  /* ------------------------------------------------------- agriculture */
  {
    slug: 'agricultural-input-assistance',
    org: 'dae',
    category: 'agriculture',
    title: ['Agricultural Input Assistance (Krishi Pronodona)', 'কৃষি প্রণোদনা সহায়তা'],
    summary: [
      'Free seed, fertiliser, and sometimes cash per bigha for smallholder farmers each cropping season.',
      'প্রতি ফসল মৌসুমে ক্ষুদ্র কৃষকদের জন্য বিনামূল্যে বীজ, সার এবং কখনো বিঘা প্রতি নগদ সহায়তা।',
    ],
    description: [
      'Input assistance is distributed each season through the upazila agriculture office to farmers on the Krishi Card register. Packages differ by crop and season — Aman and Boro rice, wheat, maize, mustard, and pulses each have their own allocation. Registering for a Krishi Card is the single most useful step, because almost every other agricultural benefit is distributed against that register.',
      'প্রতি মৌসুমে উপজেলা কৃষি অফিসের মাধ্যমে কৃষি কার্ড নিবন্ধিত কৃষকদের মধ্যে প্রণোদনা বিতরণ করা হয়। ফসল ও মৌসুম অনুযায়ী প্যাকেজ ভিন্ন হয় — আমন ও বোরো ধান, গম, ভুট্টা, সরিষা ও ডালের নিজস্ব বরাদ্দ আছে। কৃষি কার্ডে নিবন্ধন করাই সবচেয়ে দরকারি ধাপ, কারণ প্রায় সব কৃষি সুবিধাই এই নিবন্ধনের বিপরীতে বিতরণ হয়।',
    ],
    benefits: [
      'Free certified seed and fertiliser for the season, and a cash top-up per bigha in some crops.',
      'মৌসুমের জন্য বিনামূল্যে প্রত্যয়িত বীজ ও সার, কিছু ফসলে বিঘা প্রতি নগদ সহায়তা।',
    ],
    benefitAmount: 3000,
    benefitPeriod: 'per_course',
    lifeEvents: ['crop_loss'],
    tags: ['agriculture', 'subsidy', 'seed', 'fertiliser', 'krishi-card'],
    sourceUrl: 'https://dae.gov.bd',
    processingTime: ['Distributed within the season, usually 2–4 weeks after the list is finalised', 'মৌসুমের মধ্যেই বিতরণ, সাধারণত তালিকা চূড়ান্ত হওয়ার ২–৪ সপ্তাহ পর'],
    recurrence: 'biannual',
    deadlineInDays: 33,
    popularity: 85,
    steps: [
      ['Register for a Krishi Card at your Union Parishad or upazila agriculture office if you do not have one.', 'কৃষি কার্ড না থাকলে ইউনিয়ন পরিষদ বা উপজেলা কৃষি অফিসে নিবন্ধন করুন।'],
      ['Ask the Sub-Assistant Agriculture Officer for your block about the current season\'s package.', 'আপনার ব্লকের উপ-সহকারী কৃষি অফিসারের কাছে চলতি মৌসুমের প্যাকেজ সম্পর্কে জানুন।'],
      ['Attend the distribution day at the announced location with your Krishi Card and National ID.', 'কৃষি কার্ড ও জাতীয় পরিচয়পত্র নিয়ে ঘোষিত স্থানে বিতরণের দিন উপস্থিত থাকুন।'],
    ],
    docs: [
      { name: ['Krishi (Farmer) Card', 'কৃষি কার্ড'], authority: ['Department of Agricultural Extension', 'কৃষি সম্প্রসারণ অধিদপ্তর'], mistake: ['Arriving on distribution day without the card — the list is checked against the card number, not your name.', 'বিতরণের দিন কার্ড ছাড়া যাওয়া — তালিকা নাম নয়, কার্ড নম্বর দিয়ে মেলানো হয়।'] },
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Land record or lease agreement', 'জমির দলিল বা বর্গা চুক্তি'], required: false, tip: ['Sharecroppers are eligible too — a written lease or the landowner\'s statement is usually accepted.', 'বর্গাচাষিরাও যোগ্য — লিখিত বর্গা চুক্তি বা জমির মালিকের বিবৃতি সাধারণত গ্রহণ করা হয়।'] },
    ],
    rules: rules(
      ['occupation', 'district'],
      ALL(isBangladeshi(), isFarmerLike(), landAtMost(750, true)),
    ),
  },

  {
    slug: 'agricultural-rehabilitation-crop-loss',
    org: 'dae',
    category: 'disaster',
    title: ['Agricultural Rehabilitation after Crop Loss', 'ফসল ক্ষতির পর কৃষি পুনর্বাসন সহায়তা'],
    summary: [
      'Replacement seed, seedlings, and cash support for farmers whose crops were destroyed by flood, cyclone, drought, or salinity.',
      'বন্যা, ঘূর্ণিঝড়, খরা বা লবণাক্ততায় ফসল নষ্ট হওয়া কৃষকদের জন্য বীজ, চারা ও নগদ সহায়তা।',
    ],
    description: [
      'When a disaster damages standing crops, the upazila agriculture office prepares a damage list and distributes rehabilitation packages so the next season is not also lost. Report the damage quickly — the list closes within weeks of the event and late claims are rarely added. Photographs of the damaged field taken on your phone are useful supporting evidence.',
      'দুর্যোগে দাঁড়ানো ফসল নষ্ট হলে উপজেলা কৃষি অফিস ক্ষতির তালিকা তৈরি করে এবং পুনর্বাসন প্যাকেজ বিতরণ করে যাতে পরের মৌসুমও নষ্ট না হয়। দ্রুত ক্ষতির খবর দিন — ঘটনার কয়েক সপ্তাহের মধ্যেই তালিকা বন্ধ হয়ে যায় এবং দেরিতে করা দাবি খুব কম যোগ হয়। মোবাইলে তোলা ক্ষতিগ্রস্ত জমির ছবি সহায়ক প্রমাণ হিসেবে কাজে লাগে।',
    ],
    benefits: [
      'Free replacement seed and seedlings, fertiliser, and in severe cases a cash grant per affected bigha.',
      'বিনামূল্যে বিকল্প বীজ ও চারা, সার এবং মারাত্মক ক্ষতির ক্ষেত্রে ক্ষতিগ্রস্ত বিঘা প্রতি নগদ অনুদান।',
    ],
    benefitAmount: 5000,
    benefitPeriod: 'one_time',
    lifeEvents: ['crop_loss', 'disaster_recovery'],
    tags: ['agriculture', 'disaster', 'rehabilitation', 'crop-loss'],
    sourceUrl: 'https://dae.gov.bd',
    processingTime: ['15–45 days after the damage list is finalised', 'ক্ষতির তালিকা চূড়ান্ত হওয়ার ১৫–৪৫ দিন পর'],
    recurrence: 'continuous',
    popularity: 66,
    steps: [
      ['Photograph the damaged field as soon as it is safe to do so.', 'নিরাপদ হলেই ক্ষতিগ্রস্ত জমির ছবি তুলে রাখুন।'],
      ['Report the loss to your block Sub-Assistant Agriculture Officer immediately.', 'সঙ্গে সঙ্গে আপনার ব্লকের উপ-সহকারী কৃষি অফিসারকে ক্ষতির কথা জানান।'],
      ['Ensure your name and Krishi Card number are entered on the upazila damage list.', 'উপজেলার ক্ষতির তালিকায় আপনার নাম ও কৃষি কার্ড নম্বর উঠেছে কি না নিশ্চিত করুন।'],
      ['Collect the rehabilitation package on the announced distribution day.', 'ঘোষিত বিতরণের দিনে পুনর্বাসন প্যাকেজ সংগ্রহ করুন।'],
    ],
    docs: [
      { name: ['Krishi Card', 'কৃষি কার্ড'] },
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Photographs of the damaged crop', 'ক্ষতিগ্রস্ত ফসলের ছবি'], required: false },
    ],
    rules: rules(
      ['occupation'],
      ALL(
        isBangladeshi(),
        isFarmerLike(),
        c(
          'lifeEvents',
          'contains_any',
          ['crop_loss', 'disaster_recovery'],
          ['You have reported crop or disaster damage.', 'আপনি ফসল বা দুর্যোগের ক্ষতির কথা জানিয়েছেন।'],
          ['This support is for farmers who have suffered crop damage.', 'এই সহায়তা ফসলের ক্ষতিগ্রস্ত কৃষকদের জন্য।'],
          { weight: 3, unknown: ['Has a flood, cyclone, or drought damaged your crop?', 'বন্যা, ঘূর্ণিঝড় বা খরায় আপনার ফসলের ক্ষতি হয়েছে কি?'] },
        ),
      ),
    ),
  },

  {
    slug: 'livestock-vaccination-training',
    org: 'dls',
    category: 'agriculture',
    title: ['Livestock Vaccination, Treatment and Rearing Training', 'প্রাণিসম্পদ টিকা, চিকিৎসা ও পালন প্রশিক্ষণ'],
    summary: [
      'Free or low-cost vaccination and veterinary treatment for cattle, goats, and poultry, plus free rearing training.',
      'গরু, ছাগল ও হাঁস-মুরগির জন্য বিনামূল্যে বা কম খরচে টিকা ও চিকিৎসা, সঙ্গে বিনামূল্যে পালন প্রশিক্ষণ।',
    ],
    description: [
      'Upazila livestock offices run vaccination campaigns against anthrax, foot-and-mouth disease, and Newcastle disease, and provide subsidised veterinary treatment year round. They also run short courses on dairy, beef fattening, and poultry rearing, and course completion helps when applying for a youth or SME enterprise loan.',
      'উপজেলা প্রাণিসম্পদ অফিস অ্যানথ্রাক্স, ক্ষুরারোগ ও রানীক্ষেত রোগের বিরুদ্ধে টিকাদান কর্মসূচি পরিচালনা করে এবং সারা বছর কম খরচে পশুচিকিৎসা দেয়। দুগ্ধ, গরু মোটাতাজাকরণ ও হাঁস-মুরগি পালনের সংক্ষিপ্ত কোর্সও চলে, আর কোর্স শেষ করা যুব বা এসএমই উদ্যোগ ঋণের আবেদনে সহায়ক হয়।',
    ],
    benefits: [
      'Free vaccination campaigns, subsidised veterinary treatment and medicine, and free rearing training with a certificate.',
      'বিনামূল্যে টিকাদান কর্মসূচি, কম খরচে পশুচিকিৎসা ও ঔষধ এবং সনদসহ বিনামূল্যে পালন প্রশিক্ষণ।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['entrepreneurship', 'crop_loss', 'seeking_employment'],
    tags: ['agriculture', 'livestock', 'training', 'veterinary'],
    sourceUrl: 'https://dls.gov.bd',
    processingTime: ['Vaccination on campaign days; training batches every 2–3 months', 'কর্মসূচির দিনে টিকা; প্রতি ২–৩ মাসে প্রশিক্ষণ ব্যাচ'],
    recurrence: 'quarterly',
    popularity: 62,
    steps: [
      ['Visit or call your upazila livestock office and ask for the vaccination campaign calendar.', 'উপজেলা প্রাণিসম্পদ অফিসে যান বা ফোন করে টিকাদান কর্মসূচির সময়সূচি জেনে নিন।'],
      ['Register the number and type of animals you keep.', 'আপনার কতটি ও কী ধরনের পশু আছে তা নিবন্ধন করুন।'],
      ['Ask to be added to the next rearing training batch.', 'পরবর্তী পালন প্রশিক্ষণ ব্যাচে নাম লেখাতে বলুন।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['List or count of animals kept', 'পালিত পশুর তালিকা বা সংখ্যা'], required: false },
    ],
    rules: rules(
      [],
      ALL(
        isBangladeshi(),
        ANY(
          c('livestock', 'exists', undefined, ['You keep livestock.', 'আপনি গবাদি পশু পালন করেন।'], ['—', '—'], { weight: 2 }),
          isFarmerLike(),
          c('hasBusiness', 'eq', true, ['You run a business that may include livestock.', 'আপনার ব্যবসা আছে, যাতে পশুপালন থাকতে পারে।'], ['—', '—'], { soft: true }),
        ),
      ),
    ),
  },

  {
    slug: 'krishi-bank-crop-loan',
    org: 'bb',
    category: 'financial',
    title: ['Concessional Crop Loan at 4% Interest', '৪% সুদে রেয়াতি ফসল ঋণ'],
    summary: [
      'Bank credit for crop cultivation at a subsidised 4% interest rate, with no collateral for small amounts.',
      'ফসল চাষের জন্য ভর্তুকি দেওয়া ৪% সুদে ব্যাংক ঋণ — ছোট পরিমাণে জামানত ছাড়াই।',
    ],
    description: [
      'Bangladesh Bank requires scheduled banks to lend for agriculture at a concessional rate, with a lower rate for selected import-substitute crops such as pulses, oilseeds, spices, and maize. Loans below a threshold are available without collateral against a group guarantee or the Krishi Card. Interest is charged on the declining balance, so repaying early genuinely reduces the total cost.',
      'বাংলাদেশ ব্যাংক তফসিলি ব্যাংকগুলোকে কৃষিতে রেয়াতি হারে ঋণ দিতে বাধ্য করে, আর ডাল, তেলবীজ, মসলা ও ভুট্টার মতো নির্বাচিত আমদানি-বিকল্প ফসলে হার আরও কম। নির্দিষ্ট সীমার নিচের ঋণ দলগত জামিন বা কৃষি কার্ডের বিপরীতে জামানত ছাড়াই পাওয়া যায়। অবশিষ্ট স্থিতির উপর সুদ ধরা হয়, তাই আগে শোধ করলে মোট খরচ সত্যিই কমে।',
    ],
    benefits: [
      'Crop loan at 4% interest, no collateral below the threshold, and a repayment schedule aligned to harvest.',
      '৪% সুদে ফসল ঋণ, নির্দিষ্ট সীমার নিচে জামানত ছাড়া এবং ফসল কাটার সঙ্গে মিলিয়ে পরিশোধের সময়সূচি।',
    ],
    benefitAmount: 100000,
    benefitPeriod: 'one_time',
    lifeEvents: ['crop_loss', 'entrepreneurship'],
    tags: ['loan', 'agriculture', 'concessional', 'financial-inclusion'],
    sourceUrl: 'https://bb.org.bd',
    processingTime: ['15–30 days', '১৫–৩০ দিন'],
    recurrence: 'continuous',
    popularity: 74,
    steps: [
      ['Open a ৳10 farmer account at Krishi Bank, Rupali Bank, or any scheduled bank branch if you do not have one.', 'না থাকলে কৃষি ব্যাংক, রূপালী ব্যাংক বা যেকোনো তফসিলি ব্যাংক শাখায় ১০ টাকার কৃষক হিসাব খুলুন।'],
      ['Ask specifically for the agricultural loan at the concessional rate, not a general personal loan.', 'সাধারণ ব্যক্তিগত ঋণ নয়, নির্দিষ্টভাবে রেয়াতি হারের কৃষি ঋণ চান।'],
      ['Submit your Krishi Card, National ID, and land or lease documents.', 'কৃষি কার্ড, জাতীয় পরিচয়পত্র ও জমি বা বর্গার কাগজ জমা দিন।'],
      ['Read the repayment schedule before signing and keep a copy.', 'সই করার আগে পরিশোধের সময়সূচি পড়ে নিন এবং একটি কপি রাখুন।'],
    ],
    docs: [
      { name: ['Krishi Card', 'কৃষি কার্ড'] },
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Land record or lease agreement', 'জমির দলিল বা বর্গা চুক্তি'] },
      { name: ['Bank account (a ৳10 farmer account is sufficient)', 'ব্যাংক হিসাব (১০ টাকার কৃষক হিসাবই যথেষ্ট)'] },
      { name: ['Two passport-size photographs', 'দুই কপি পাসপোর্ট সাইজের ছবি'] },
    ],
    rules: rules(
      ['occupation'],
      ALL(isBangladeshi(), isFarmerLike(), ageAtLeast(18, 2), hasNationalId(false)),
    ),
  },

  /* ---------------------------------------------------------- enterprise */
  {
    slug: 'bb-women-entrepreneur-refinance',
    org: 'bb',
    category: 'business',
    title: ['Bangladesh Bank Refinance Scheme for Women Entrepreneurs', 'নারী উদ্যোক্তাদের জন্য বাংলাদেশ ব্যাংক পুনঃঅর্থায়ন তহবিল'],
    summary: [
      'Business loans for women at a capped 5% interest rate, with up to ৳25 lakh available without collateral.',
      'নারীদের জন্য সর্বোচ্চ ৫% সুদে ব্যবসা ঋণ — ২৫ লাখ টাকা পর্যন্ত জামানত ছাড়াই।',
    ],
    description: [
      'Every scheduled bank in Bangladesh is required to lend to women entrepreneurs from this refinance window at a capped rate, and a defined share of SME lending must go to women. Collateral-free lending is available up to a threshold against a personal guarantee. If a branch refuses without explaining which condition you fail, you may escalate to the bank\'s SME desk or Bangladesh Bank\'s customer interest protection cell.',
      'বাংলাদেশের প্রতিটি তফসিলি ব্যাংক এই পুনঃঅর্থায়ন উইন্ডো থেকে নারী উদ্যোক্তাদের নির্ধারিত সর্বোচ্চ হারে ঋণ দিতে বাধ্য, এবং এসএমই ঋণের একটি নির্দিষ্ট অংশ নারীদের কাছে যেতে হবে। ব্যক্তিগত জামিনের বিপরীতে নির্দিষ্ট সীমা পর্যন্ত জামানতবিহীন ঋণ পাওয়া যায়। কোন শর্ত পূরণ হয়নি তা না জানিয়ে শাখা প্রত্যাখ্যান করলে ব্যাংকের এসএমই ডেস্ক বা বাংলাদেশ ব্যাংকের গ্রাহক স্বার্থ সংরক্ষণ কেন্দ্রে অভিযোগ করা যায়।',
    ],
    benefits: [
      'Term or working-capital loan at a capped 5% interest rate, collateral-free up to the threshold, with a grace period.',
      'সর্বোচ্চ ৫% সুদে মেয়াদি বা চলতি মূলধন ঋণ, নির্দিষ্ট সীমা পর্যন্ত জামানতবিহীন, সঙ্গে গ্রেস পিরিয়ড।',
    ],
    benefitAmount: 2500000,
    benefitPeriod: 'one_time',
    lifeEvents: ['entrepreneurship', 'job_loss'],
    tags: ['loan', 'women', 'sme', 'business', 'low-interest'],
    sourceUrl: 'https://bb.org.bd',
    processingTime: ['30–60 days', '৩০–৬০ দিন'],
    recurrence: 'continuous',
    popularity: 81,
    steps: [
      ['Register your business — a trade licence from the Union Parishad or city corporation is the minimum.', 'ব্যবসা নিবন্ধন করুন — ইউনিয়ন পরিষদ বা সিটি কর্পোরেশনের ট্রেড লাইসেন্সই ন্যূনতম।'],
      ['Prepare a simple business plan showing expected monthly income and expenses.', 'প্রত্যাশিত মাসিক আয় ও ব্যয় দেখিয়ে একটি সহজ ব্যবসা পরিকল্পনা তৈরি করুন।'],
      ['Go to the SME or women entrepreneur desk at a bank branch, not the general counter.', 'ব্যাংক শাখার সাধারণ কাউন্টারে নয়, এসএমই বা নারী উদ্যোক্তা ডেস্কে যান।'],
      ['Ask explicitly for the Bangladesh Bank refinance scheme rate and get the terms in writing.', 'স্পষ্টভাবে বাংলাদেশ ব্যাংক পুনঃঅর্থায়ন তহবিলের হার চান এবং শর্তগুলো লিখিতভাবে নিন।'],
    ],
    docs: [
      { name: ['Trade licence', 'ট্রেড লাইসেন্স'], authority: ['Union Parishad / City Corporation', 'ইউনিয়ন পরিষদ / সিটি কর্পোরেশন'], validityMonths: 12 },
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Business plan or income and expense statement', 'ব্যবসা পরিকল্পনা বা আয়-ব্যয়ের হিসাব'] },
      { name: ['Bank account statement for the last 6 months', 'সর্বশেষ ৬ মাসের ব্যাংক হিসাব বিবরণী'], required: false },
      { name: ['TIN certificate', 'টিআইএন সনদ'], required: false, tip: ['Not required for small loans, but having one speeds approval.', 'ছোট ঋণে দরকার নেই, তবে থাকলে অনুমোদন দ্রুত হয়।'] },
    ],
    rules: rules(
      ['gender', 'hasBusiness'],
      ALL(
        isBangladeshi(),
        isFemale(),
        ageAtLeast(18, 2),
        ANY(
          c('hasBusiness', 'eq', true, ['You already run a business.', 'আপনার ইতিমধ্যে ব্যবসা আছে।'], ['—', '—'], { weight: 3 }),
          c('lifeEvents', 'contains_any', ['entrepreneurship'], ['You want to start a business.', 'আপনি ব্যবসা শুরু করতে চান।'], ['This scheme is for women who run or are starting a business.', 'এই তহবিল ব্যবসা পরিচালনা বা শুরু করতে চাওয়া নারীদের জন্য।'], { weight: 2 }),
        ),
      ),
    ),
  },

  {
    slug: 'smef-credit-wholesale',
    org: 'smef',
    category: 'business',
    title: ['SME Foundation Credit Wholesale Programme', 'এসএমই ফাউন্ডেশন ক্রেডিট হোলসেল কর্মসূচি'],
    summary: [
      'Collateral-free enterprise loans at concessional interest through partner banks and financial institutions.',
      'অংশীদার ব্যাংক ও আর্থিক প্রতিষ্ঠানের মাধ্যমে রেয়াতি সুদে জামানতবিহীন উদ্যোগ ঋণ।',
    ],
    description: [
      'SME Foundation does not lend directly; it channels funds to partner banks that then lend to small manufacturers, traders, and service businesses. Clusters — such as a group of shoemakers or handloom weavers in one area — are given priority, so applying as part of a recognised cluster association strengthens the case considerably.',
      'এসএমই ফাউন্ডেশন সরাসরি ঋণ দেয় না; এটি অংশীদার ব্যাংকে তহবিল পাঠায়, যারা ছোট উৎপাদক, ব্যবসায়ী ও সেবা প্রতিষ্ঠানকে ঋণ দেয়। ক্লাস্টার — যেমন এক এলাকার জুতা প্রস্তুতকারক বা তাঁতিদের দল — অগ্রাধিকার পায়, তাই স্বীকৃত ক্লাস্টার সমিতির অংশ হিসেবে আবেদন করলে সুযোগ অনেক বাড়ে।',
    ],
    benefits: [
      'Collateral-free loan at concessional interest, business training, and market linkage and trade fair support.',
      'রেয়াতি সুদে জামানতবিহীন ঋণ, ব্যবসা প্রশিক্ষণ এবং বাজার সংযোগ ও বাণিজ্য মেলায় সহায়তা।',
    ],
    benefitAmount: 500000,
    benefitPeriod: 'one_time',
    lifeEvents: ['entrepreneurship'],
    tags: ['loan', 'sme', 'business', 'cluster'],
    sourceUrl: 'https://smef.gov.bd',
    processingTime: ['45–75 days', '৪৫–৭৫ দিন'],
    recurrence: 'continuous',
    deadlineInDays: 58,
    popularity: 67,
    steps: [
      ['Check the SME Foundation website for the current list of partner banks.', 'এসএমই ফাউন্ডেশনের ওয়েবসাইটে অংশীদার ব্যাংকের চলতি তালিকা দেখুন।'],
      ['Join or form a cluster association if one exists for your trade in your area.', 'আপনার এলাকায় আপনার পেশার ক্লাস্টার সমিতি থাকলে যোগ দিন, না থাকলে গঠন করুন।'],
      ['Apply at the partner bank\'s SME desk with your trade licence and business records.', 'ট্রেড লাইসেন্স ও ব্যবসার হিসাব নিয়ে অংশীদার ব্যাংকের এসএমই ডেস্কে আবেদন করুন।'],
    ],
    docs: [
      { name: ['Trade licence', 'ট্রেড লাইসেন্স'], validityMonths: 12 },
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Business records for the last 6–12 months', 'সর্বশেষ ৬–১২ মাসের ব্যবসার হিসাব'] },
      { name: ['Cluster association membership certificate', 'ক্লাস্টার সমিতির সদস্যপদ সনদ'], required: false },
    ],
    rules: rules(
      ['hasBusiness'],
      ALL(
        isBangladeshi(),
        ageAtLeast(18, 2),
        c('hasBusiness', 'eq', true, ['You run a business.', 'আপনার ব্যবসা আছে।'], ['This programme is for existing small and medium enterprises.', 'এই কর্মসূচি চালু ক্ষুদ্র ও মাঝারি উদ্যোগের জন্য।'], { weight: 3, unknown: ['Do you currently run a business?', 'আপনি কি বর্তমানে কোনো ব্যবসা পরিচালনা করেন?'] }),
        c('employees', 'lte', 120, ['Your enterprise is within the SME size limit.', 'আপনার প্রতিষ্ঠান এসএমই আকারের সীমার মধ্যে।'], ['Enterprises above the SME employee threshold are not covered.', 'এসএমই কর্মী সীমার বেশি প্রতিষ্ঠান এর আওতায় নেই।'], { soft: true }),
      ),
    ),
  },

  {
    slug: 'youth-development-training-loan',
    org: 'dyd',
    category: 'training',
    title: ['Youth Development Training and Enterprise Loan', 'যুব উন্নয়ন প্রশিক্ষণ ও উদ্যোগ ঋণ'],
    summary: [
      'Free vocational training for young people, followed by a low-interest self-employment loan for graduates.',
      'তরুণদের জন্য বিনামূল্যে কর্মমুখী প্রশিক্ষণ, এরপর প্রশিক্ষিতদের জন্য কম সুদে আত্মকর্মসংস্থান ঋণ।',
    ],
    description: [
      'The Department of Youth Development runs both residential and non-residential courses in computer skills, electrical work, refrigeration, tailoring, livestock, and fish farming. The important part is the sequence: completing a course makes you eligible for the youth enterprise loan, which is why training is worth doing even if you already know the trade.',
      'যুব উন্নয়ন অধিদপ্তর কম্পিউটার দক্ষতা, ইলেকট্রিক কাজ, রেফ্রিজারেশন, সেলাই, পশুপালন ও মাছ চাষে আবাসিক ও অনাবাসিক — দুই ধরনের কোর্স চালায়। গুরুত্বপূর্ণ বিষয়টি হলো ক্রম: কোর্স শেষ করলেই যুব উদ্যোগ ঋণের যোগ্যতা তৈরি হয়, তাই কাজ জানা থাকলেও প্রশিক্ষণ নেওয়া লাভজনক।',
    ],
    benefits: [
      'Free training with a certificate, a residential stipend on some courses, and eligibility for a low-interest enterprise loan afterwards.',
      'সনদসহ বিনামূল্যে প্রশিক্ষণ, কিছু কোর্সে আবাসিক ভাতা এবং পরে কম সুদে উদ্যোগ ঋণের যোগ্যতা।',
    ],
    benefitAmount: 200000,
    benefitPeriod: 'one_time',
    lifeEvents: ['seeking_employment', 'job_loss', 'entrepreneurship'],
    tags: ['training', 'youth', 'loan', 'self-employment'],
    sourceUrl: 'https://dyd.gov.bd',
    processingTime: ['Training batches every 2–3 months; loan 30–45 days after completion', 'প্রতি ২–৩ মাসে প্রশিক্ষণ ব্যাচ; কোর্স শেষে ৩০–৪৫ দিনে ঋণ'],
    recurrence: 'quarterly',
    deadlineInDays: 21,
    popularity: 77,
    steps: [
      ['Visit your upazila or district Youth Development office and ask for the course list.', 'উপজেলা বা জেলা যুব উন্নয়ন অফিসে গিয়ে কোর্সের তালিকা চান।'],
      ['Enrol in a course that matches the work you want to do.', 'আপনি যে কাজ করতে চান তার সঙ্গে মিলিয়ে কোর্সে ভর্তি হন।'],
      ['Complete the course and collect your certificate and youth registration number.', 'কোর্স শেষ করে সনদ ও যুব নিবন্ধন নম্বর সংগ্রহ করুন।'],
      ['Apply for the enterprise loan with your certificate and a simple business plan.', 'সনদ ও একটি সহজ ব্যবসা পরিকল্পনা নিয়ে উদ্যোগ ঋণের আবেদন করুন।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Educational certificate (class 8 pass is enough for most courses)', 'শিক্ষাগত সনদ (বেশিরভাগ কোর্সে অষ্টম শ্রেণি পাসই যথেষ্ট)'] },
      { name: ['Two passport-size photographs', 'দুই কপি পাসপোর্ট সাইজের ছবি'] },
      { name: ['Training certificate (for the loan stage)', 'প্রশিক্ষণ সনদ (ঋণের ধাপে)'] },
      { name: ['Guarantor National ID (for the loan stage)', 'জামিনদারের জাতীয় পরিচয়পত্র (ঋণের ধাপে)'] },
    ],
    rules: rules(
      ['age'],
      ALL(isBangladeshi(), ageBetween(18, 35, 3), educationAtLeast('primary', ['class 5', 'পঞ্চম শ্রেণি'], 1)),
    ),
  },

  {
    slug: 'pksf-microenterprise-loan',
    org: 'pksf',
    category: 'financial',
    title: ['PKSF Microenterprise Loan through Partner Organisations', 'অংশীদার সংস্থার মাধ্যমে পিকেএসএফ ক্ষুদ্র উদ্যোগ ঋণ'],
    summary: [
      'Group-guaranteed microcredit for rural enterprise, with no land collateral and weekly or monthly repayment.',
      'গ্রামীণ উদ্যোগের জন্য দলগত জামিনে ক্ষুদ্রঋণ — জমির জামানত ছাড়া, সাপ্তাহিক বা মাসিক পরিশোধে।',
    ],
    description: [
      'PKSF funds around 200 partner organisations that lend at village level. Because lending is group-based, you join a group of neighbours who guarantee each other rather than pledging land. Compare the effective annual rate between partner organisations before joining — rates differ, and the weekly instalment can make a high rate look small.',
      'পিকেএসএফ প্রায় ২০০টি অংশীদার সংস্থাকে অর্থায়ন করে, যারা গ্রাম পর্যায়ে ঋণ দেয়। ঋণ দলভিত্তিক হওয়ায় জমি বন্ধক না দিয়ে প্রতিবেশীদের নিয়ে একটি দলে যোগ দিতে হয়, যেখানে সদস্যরা পরস্পরের জামিনদার। যোগ দেওয়ার আগে অংশীদার সংস্থাগুলোর প্রকৃত বার্ষিক সুদহার তুলনা করুন — হার ভিন্ন হয়, আর সাপ্তাহিক কিস্তি দেখে বেশি সুদও কম মনে হতে পারে।',
    ],
    benefits: [
      'Enterprise credit without land collateral, flexible instalments, and business and financial literacy training.',
      'জমির জামানত ছাড়া উদ্যোগ ঋণ, নমনীয় কিস্তি এবং ব্যবসা ও আর্থিক সাক্ষরতা প্রশিক্ষণ।',
    ],
    benefitAmount: 300000,
    benefitPeriod: 'one_time',
    lifeEvents: ['entrepreneurship', 'job_loss'],
    tags: ['microcredit', 'loan', 'rural', 'group-guarantee'],
    sourceUrl: 'https://pksf.org.bd',
    processingTime: ['15–30 days after joining a group', 'দলে যোগ দেওয়ার ১৫–৩০ দিন পর'],
    recurrence: 'continuous',
    popularity: 70,
    steps: [
      ['Find a PKSF partner organisation working in your union.', 'আপনার ইউনিয়নে কাজ করা পিকেএসএফ অংশীদার সংস্থা খুঁজে নিন।'],
      ['Join or form a borrower group with neighbours you trust.', 'বিশ্বাসযোগ্য প্রতিবেশীদের নিয়ে ঋণগ্রহীতা দলে যোগ দিন বা দল গঠন করুন।'],
      ['Ask for the effective annual interest rate in writing before signing.', 'সই করার আগে প্রকৃত বার্ষিক সুদহার লিখিতভাবে চেয়ে নিন।'],
      ['Attend the financial literacy session and keep your passbook safe.', 'আর্থিক সাক্ষরতা সেশনে অংশ নিন এবং পাসবই সাবধানে রাখুন।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Two passport-size photographs', 'দুই কপি পাসপোর্ট সাইজের ছবি'] },
      { name: ['Group membership form', 'দলীয় সদস্যপদ ফরম'], authority: ['PKSF partner organisation', 'পিকেএসএফ অংশীদার সংস্থা'] },
    ],
    rules: rules(
      ['age'],
      ALL(isBangladeshi(), ageAtLeast(18, 2), monthlyIncomeBelow(30000, 1)),
    ),
  },

  /* ---------------------------------------------------------- employment */
  {
    slug: 'nsda-free-skills-training',
    org: 'nsda',
    category: 'employment',
    title: ['Free Certified Skills Training', 'বিনামূল্যে সনদায়িত দক্ষতা প্রশিক্ষণ'],
    summary: [
      'Free short courses with a nationally recognised certificate in construction, garments, IT, hospitality, and light engineering.',
      'নির্মাণ, গার্মেন্টস, আইটি, আতিথেয়তা ও লাইট ইঞ্জিনিয়ারিংয়ে জাতীয়ভাবে স্বীকৃত সনদসহ বিনামূল্যে সংক্ষিপ্ত কোর্স।',
    ],
    description: [
      'Courses are delivered through registered training providers and lead to a National Skills Certificate, which is recognised by employers and required for many overseas jobs. Unemployed young people, women, returning migrants, and persons with disabilities are prioritised, and some courses pay a small daily allowance.',
      'নিবন্ধিত প্রশিক্ষণ প্রদানকারীর মাধ্যমে কোর্স পরিচালিত হয় এবং শেষে জাতীয় দক্ষতা সনদ দেওয়া হয়, যা নিয়োগকর্তারা স্বীকার করেন এবং অনেক বিদেশি চাকরির জন্য বাধ্যতামূলক। বেকার তরুণ, নারী, প্রত্যাগত প্রবাসী ও প্রতিবন্ধী ব্যক্তিরা অগ্রাধিকার পান এবং কিছু কোর্সে অল্প দৈনিক ভাতা দেওয়া হয়।',
    ],
    benefits: [
      'Free training, a National Skills Certificate, a daily allowance on some courses, and job placement support.',
      'বিনামূল্যে প্রশিক্ষণ, জাতীয় দক্ষতা সনদ, কিছু কোর্সে দৈনিক ভাতা এবং চাকরি খোঁজায় সহায়তা।',
    ],
    benefitPeriod: 'per_course',
    lifeEvents: ['seeking_employment', 'job_loss', 'migration'],
    tags: ['training', 'skills', 'employment', 'certification', 'free'],
    sourceUrl: 'https://nsda.gov.bd',
    processingTime: ['New batches monthly at most centres', 'বেশিরভাগ কেন্দ্রে প্রতি মাসে নতুন ব্যাচ'],
    recurrence: 'continuous',
    deadlineInDays: 17,
    popularity: 72,
    steps: [
      ['Search the NSDA portal or visit a Technical Training Centre to see available courses.', 'এনএসডিএ পোর্টালে খুঁজুন বা কারিগরি প্রশিক্ষণ কেন্দ্রে গিয়ে চালু কোর্স দেখুন।'],
      ['Enrol with your National ID and last educational certificate.', 'জাতীয় পরিচয়পত্র ও সর্বশেষ শিক্ষাগত সনদ দিয়ে ভর্তি হন।'],
      ['Attend regularly — certification requires a minimum attendance.', 'নিয়মিত ক্লাস করুন — সনদের জন্য ন্যূনতম উপস্থিতি প্রয়োজন।'],
      ['Sit the assessment and collect your National Skills Certificate.', 'মূল্যায়ন পরীক্ষা দিয়ে জাতীয় দক্ষতা সনদ সংগ্রহ করুন।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Last educational certificate', 'সর্বশেষ শিক্ষাগত সনদ'], required: false },
      { name: ['Two passport-size photographs', 'দুই কপি পাসপোর্ট সাইজের ছবি'] },
    ],
    rules: rules(
      ['age'],
      ALL(
        isBangladeshi(),
        ageBetween(16, 45, 3),
        ANY(
          c('occupation', 'eq', 'unemployed', ['You are currently seeking work, which is prioritised.', 'আপনি বর্তমানে কাজ খুঁজছেন, যা অগ্রাধিকার পায়।'], ['—', '—'], { soft: true, weight: 2 }),
          isFemale(1),
          c('hasDisability', 'eq', true, ['Persons with disabilities are prioritised.', 'প্রতিবন্ধী ব্যক্তিরা অগ্রাধিকার পান।'], ['—', '—'], { soft: true }),
          c('lifeEvents', 'contains_any', ['seeking_employment', 'job_loss', 'migration'], ['Your situation matches this programme.', 'আপনার পরিস্থিতি এই কর্মসূচির সঙ্গে মেলে।'], ['—', '—'], { soft: true }),
        ),
      ),
    ),
  },

  {
    slug: 'bmet-overseas-employment-training',
    org: 'bmet',
    category: 'employment',
    title: ['Overseas Employment Registration and Pre-Departure Training', 'বিদেশে কর্মসংস্থান নিবন্ধন ও প্রাক-বহির্গমন প্রশিক্ষণ'],
    summary: [
      'Official BMET registration, skills and language training, and a migration loan — the safe route to working abroad.',
      'সরকারি বিএমইটি নিবন্ধন, দক্ষতা ও ভাষা প্রশিক্ষণ এবং প্রবাস ঋণ — বিদেশে কাজের নিরাপদ পথ।',
    ],
    description: [
      'Registering with BMET and obtaining a smart card is the legal route to overseas employment; going through an unregistered broker is the single most common way migrants lose money and end up undocumented. BMET also runs language and skills courses, and Probashi Kallyan Bank lends against a confirmed visa at a lower rate than informal lenders.',
      'বিএমইটিতে নিবন্ধন করে স্মার্ট কার্ড নেওয়াই বিদেশে কর্মসংস্থানের বৈধ পথ; অনিবন্ধিত দালালের মাধ্যমে যাওয়াই প্রবাসীদের টাকা হারানো ও অবৈধ হয়ে পড়ার সবচেয়ে সাধারণ কারণ। বিএমইটি ভাষা ও দক্ষতার কোর্সও চালায়, আর প্রবাসী কল্যাণ ব্যাংক নিশ্চিত ভিসার বিপরীতে অনানুষ্ঠানিক ঋণদাতার চেয়ে কম সুদে ঋণ দেয়।',
    ],
    benefits: [
      'Official registration and smart card, subsidised skills and language training, a migration loan at a lower rate, and welfare protection while abroad.',
      'সরকারি নিবন্ধন ও স্মার্ট কার্ড, কম খরচে দক্ষতা ও ভাষা প্রশিক্ষণ, কম সুদে প্রবাস ঋণ এবং বিদেশে থাকা অবস্থায় কল্যাণ সুরক্ষা।',
    ],
    benefitAmount: 200000,
    benefitPeriod: 'one_time',
    lifeEvents: ['migration', 'seeking_employment', 'job_loss'],
    tags: ['employment', 'overseas', 'migration', 'training', 'loan'],
    sourceUrl: 'https://bmet.gov.bd',
    processingTime: ['Registration in days; training 1–3 months', 'নিবন্ধন কয়েক দিনে; প্রশিক্ষণ ১–৩ মাস'],
    recurrence: 'continuous',
    popularity: 78,
    steps: [
      ['Register on the BMET online portal or at a District Employment and Manpower Office.', 'বিএমইটি অনলাইন পোর্টালে বা জেলা কর্মসংস্থান ও জনশক্তি অফিসে নিবন্ধন করুন।'],
      ['Verify that any recruiting agency you use holds a valid BMET licence — check the number on the BMET site.', 'আপনি যে রিক্রুটিং এজেন্সি ব্যবহার করছেন তার বৈধ বিএমইটি লাইসেন্স আছে কি না যাচাই করুন — বিএমইটির সাইটে নম্বর দেখে নিন।'],
      ['Complete the mandatory pre-departure orientation and any required skills or language course.', 'বাধ্যতামূলক প্রাক-বহির্গমন ওরিয়েন্টেশন এবং প্রয়োজনীয় দক্ষতা বা ভাষা কোর্স সম্পন্ন করুন।'],
      ['Apply to Probashi Kallyan Bank for a migration loan against your confirmed visa.', 'নিশ্চিত ভিসার বিপরীতে প্রবাসী কল্যাণ ব্যাংকে প্রবাস ঋণের আবেদন করুন।'],
      ['Collect your BMET smart card before departure and keep a photograph of it.', 'যাওয়ার আগে বিএমইটি স্মার্ট কার্ড সংগ্রহ করুন এবং একটি ছবি তুলে রাখুন।'],
    ],
    docs: [
      { name: ['Valid passport', 'বৈধ পাসপোর্ট'], authority: ['Department of Immigration and Passports', 'ইমিগ্রেশন ও পাসপোর্ট অধিদপ্তর'], validityMonths: 18 },
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Medical fitness certificate from an approved centre', 'অনুমোদিত কেন্দ্রের মেডিকেল ফিটনেস সনদ'], validityMonths: 3 },
      { name: ['Employment contract or visa', 'নিয়োগ চুক্তি বা ভিসা'], mistake: ['Paying a broker before seeing a written contract — always read the salary, hours, and job title first.', 'লিখিত চুক্তি দেখার আগে দালালকে টাকা দেওয়া — আগে বেতন, কর্মঘণ্টা ও পদের নাম পড়ে নিন।'] },
      { name: ['Skills or language training certificate', 'দক্ষতা বা ভাষা প্রশিক্ষণ সনদ'], required: false },
    ],
    rules: rules(
      ['age'],
      ALL(isBangladeshi(), ageAtLeast(18, 3), hasNationalId(false)),
      [
        'Women migrating for domestic work must complete an additional mandatory training module.',
        'গৃহকর্মে যেতে চাওয়া নারীদের অতিরিক্ত বাধ্যতামূলক প্রশিক্ষণ মডিউল সম্পন্ন করতে হয়।',
      ],
    ),
  },

  /* ----------------------------------------------------------- financial */
  {
    slug: 'ten-taka-farmer-account',
    org: 'bb',
    category: 'financial',
    title: ['৳10 Bank Account for Farmers and Low-Income Citizens', 'কৃষক ও নিম্ন আয়ের নাগরিকদের জন্য ১০ টাকার ব্যাংক হিসাব'],
    summary: [
      'Open a no-frills bank account with a ৳10 initial deposit, no minimum balance, and no maintenance fee.',
      '১০ টাকা জমা দিয়ে হিসাব খোলা যায় — ন্যূনতম স্থিতি বা রক্ষণাবেক্ষণ ফি ছাড়া।',
    ],
    description: [
      'This is the account that unlocks almost everything else: government allowances, stipends, and subsidies are increasingly paid only into a bank or mobile financial account in the beneficiary\'s own name. Banks are required to open it for eligible citizens and cannot demand an introducer or a minimum balance. If a branch refuses, ask for the refusal in writing and mention the Bangladesh Bank circular.',
      'এই হিসাবটিই বাকি প্রায় সবকিছুর দরজা খুলে দেয়: সরকারি ভাতা, উপবৃত্তি ও ভর্তুকি ক্রমেই কেবল সুবিধাভোগীর নিজের নামের ব্যাংক বা মোবাইল আর্থিক হিসাবে দেওয়া হচ্ছে। ব্যাংকগুলো যোগ্য নাগরিকের জন্য এটি খুলতে বাধ্য এবং পরিচয়দানকারী বা ন্যূনতম স্থিতি দাবি করতে পারে না। শাখা প্রত্যাখ্যান করলে লিখিতভাবে কারণ চান এবং বাংলাদেশ ব্যাংকের সার্কুলারের কথা বলুন।',
    ],
    benefits: [
      'A bank account for a ৳10 deposit, no minimum balance, no annual fee, and a debit card on request.',
      '১০ টাকা জমায় ব্যাংক হিসাব, ন্যূনতম স্থিতি নেই, বার্ষিক ফি নেই, চাইলে ডেবিট কার্ড।',
    ],
    benefitPeriod: 'one_time',
    lifeEvents: ['old_age', 'seeking_employment', 'entrepreneurship', 'widowhood'],
    tags: ['financial-inclusion', 'bank-account', 'no-fee'],
    sourceUrl: 'https://bb.org.bd',
    processingTime: ['Same day to 7 days', 'একই দিন থেকে ৭ দিন'],
    recurrence: 'continuous',
    popularity: 83,
    steps: [
      ['Go to any state-owned bank branch — Sonali, Janata, Agrani, Rupali, or Krishi Bank.', 'যেকোনো রাষ্ট্রায়ত্ত ব্যাংক শাখায় যান — সোনালী, জনতা, অগ্রণী, রূপালী বা কৃষি ব্যাংক।'],
      ['Ask specifically for the ৳10 no-frills account, not a regular savings account.', 'সাধারণ সঞ্চয়ী হিসাব নয়, নির্দিষ্টভাবে ১০ টাকার নো-ফ্রিলস হিসাব চান।'],
      ['Provide your National ID and one photograph, and deposit ৳10.', 'জাতীয় পরিচয়পত্র ও এক কপি ছবি দিন এবং ১০ টাকা জমা দিন।'],
      ['Collect your account number and cheque book or debit card.', 'হিসাব নম্বর এবং চেক বই বা ডেবিট কার্ড সংগ্রহ করুন।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['One passport-size photograph', 'এক কপি পাসপোর্ট সাইজের ছবি'] },
      { name: ['Krishi Card, if you are a farmer', 'কৃষক হলে কৃষি কার্ড'], required: false },
    ],
    rules: rules(
      [],
      ALL(
        isBangladeshi(),
        hasNationalId(false),
        ANY(
          isFarmerLike(),
          monthlyIncomeBelow(25000, 1),
          c('occupation', 'in', ['day_labourer', 'garment_worker', 'rickshaw_driver', 'weaver', 'homemaker', 'unemployed', 'student'], ['Your occupation qualifies for this account.', 'আপনার পেশা এই হিসাবের যোগ্যতা পূরণ করে।'], ['—', '—'], { soft: true }),
        ),
      ),
    ),
  },
];
