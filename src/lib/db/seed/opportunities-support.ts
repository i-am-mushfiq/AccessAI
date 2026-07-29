import {
  type SeedOpportunity, c, ALL, ANY, rules,
  isBangladeshi, monthlyIncomeBelow, isFemale, hasDisability, ageAtLeast,
} from './helpers';

/**
 * Legal aid, disaster response, and community support.
 * All records are authored sample data — see docs/DEVIATIONS.md §2.
 */
export const SEED_SUPPORT: readonly SeedOpportunity[] = [
  {
    slug: 'government-legal-aid',
    org: 'nlaso',
    category: 'legal_aid',
    title: ['Free Government Legal Aid', 'সরকারি বিনামূল্যে আইনগত সহায়তা'],
    summary: [
      'A government-paid lawyer, court fees, and mediation for citizens who cannot afford legal costs. Call 16430.',
      'যাঁরা আইনি খরচ বহন করতে পারেন না তাঁদের জন্য সরকারি খরচে আইনজীবী, আদালত ফি ও মধ্যস্থতা। কল করুন ১৬৪৩০।',
    ],
    description: [
      'The District Legal Aid Committee, chaired by the district judge, appoints and pays a lawyer for eligible citizens in civil, criminal, and family matters. Women, children, persons with disabilities, victims of trafficking, and detainees unable to afford bail receive priority regardless of the income test. Mediation is offered first in family and land disputes, which is often faster and cheaper than litigation. The 16430 helpline is free and operates around the clock.',
      'জেলা জজের নেতৃত্বে জেলা লিগ্যাল এইড কমিটি দেওয়ানি, ফৌজদারি ও পারিবারিক মামলায় যোগ্য নাগরিকের জন্য আইনজীবী নিয়োগ করে ও তাঁর খরচ বহন করে। নারী, শিশু, প্রতিবন্ধী ব্যক্তি, পাচারের শিকার এবং জামিনের খরচ বহনে অক্ষম আটক ব্যক্তিরা আয় যাচাই নির্বিশেষে অগ্রাধিকার পান। পারিবারিক ও ভূমি বিরোধে প্রথমে মধ্যস্থতার সুযোগ দেওয়া হয়, যা মামলার চেয়ে প্রায়ই দ্রুত ও সস্তা। ১৬৪৩০ হেল্পলাইন বিনামূল্যে ও চব্বিশ ঘণ্টা চালু।',
    ],
    benefits: [
      'A lawyer paid for by the state, court and process fees covered, free mediation, and free legal advice by phone.',
      'রাষ্ট্রীয় খরচে আইনজীবী, আদালত ও প্রক্রিয়া ফি বহন, বিনামূল্যে মধ্যস্থতা এবং ফোনে বিনামূল্যে আইনি পরামর্শ।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['legal_dispute', 'divorce', 'widowhood'],
    tags: ['legal-aid', 'free', 'lawyer', 'mediation', 'helpline'],
    sourceUrl: 'https://nlaso.gov.bd',
    processingTime: ['Advice immediately by phone; lawyer assigned in 7–21 days', 'ফোনে সঙ্গে সঙ্গে পরামর্শ; ৭–২১ দিনে আইনজীবী নিয়োগ'],
    recurrence: 'continuous',
    popularity: 76,
    steps: [
      ['Call 16430 free of charge for immediate advice, at any hour.', 'তাৎক্ষণিক পরামর্শের জন্য যেকোনো সময় বিনামূল্যে ১৬৪৩০ নম্বরে কল করুন।'],
      ['Or go to the Legal Aid Office at your district court — every district has one.', 'অথবা আপনার জেলা আদালতের লিগ্যাল এইড অফিসে যান — প্রতিটি জেলায় একটি আছে।'],
      ['Submit the application form with an income certificate and your National ID.', 'আয়ের প্রত্যয়নপত্র ও জাতীয় পরিচয়পত্র দিয়ে আবেদন ফরম জমা দিন।'],
      ['Attend the mediation session first if the committee proposes it.', 'কমিটি প্রস্তাব করলে প্রথমে মধ্যস্থতা সভায় অংশ নিন।'],
      ['If mediation fails, the committee assigns a panel lawyer at no cost to you.', 'মধ্যস্থতা ব্যর্থ হলে কমিটি আপনার কোনো খরচ ছাড়াই প্যানেল আইনজীবী নিয়োগ করে।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      {
        name: ['Income certificate', 'আয়ের প্রত্যয়নপত্র'],
        authority: ['Union Parishad chairman / Ward councillor', 'ইউনিয়ন পরিষদ চেয়ারম্যান / ওয়ার্ড কাউন্সিলর'],
        required: false,
        tip: ['Not needed if you are a woman, a child, a person with a disability, or a detainee — those categories qualify regardless of income.', 'আপনি নারী, শিশু, প্রতিবন্ধী ব্যক্তি বা আটক ব্যক্তি হলে এটি লাগবে না — এই শ্রেণিগুলো আয় নির্বিশেষে যোগ্য।'],
      },
      { name: ['Case documents, notices, or FIR copy if any', 'মামলার কাগজ, নোটিশ বা এফআইআরের কপি, থাকলে'], required: false },
    ],
    rules: rules(
      [],
      ALL(
        isBangladeshi(),
        // Either the income test OR membership of a priority category.
        ANY(
          monthlyIncomeBelow(9000, 2),
          isFemale(2),
          hasDisability(2),
          c('age', 'lt', 18, ['Children qualify regardless of income.', 'শিশুরা আয় নির্বিশেষে যোগ্য।'], ['—', '—'], { soft: true }),
          c('lifeEvents', 'contains_any', ['legal_dispute', 'divorce', 'widowhood'], ['Your situation is covered by legal aid.', 'আপনার পরিস্থিতি আইনি সহায়তার আওতায়।'], ['—', '—'], { soft: true }),
        ),
      ),
      [
        'Women, children, persons with disabilities, trafficking victims, and indigent detainees qualify regardless of the income threshold.',
        'নারী, শিশু, প্রতিবন্ধী ব্যক্তি, পাচারের শিকার এবং নিঃস্ব আটক ব্যক্তিরা আয়সীমা নির্বিশেষে যোগ্য।',
      ],
    ),
  },

  {
    slug: 'blast-legal-aid',
    org: 'blast',
    category: 'legal_aid',
    title: ['BLAST Free Legal Aid and Litigation Support', 'ব্লাস্ট বিনামূল্যে আইনি সহায়তা ও মামলা পরিচালনা'],
    summary: [
      'Free legal advice and court representation from an NGO, with particular strength in family, labour, and land cases.',
      'একটি এনজিওর কাছ থেকে বিনামূল্যে আইনি পরামর্শ ও আদালতে প্রতিনিধিত্ব — পারিবারিক, শ্রম ও ভূমি মামলায় বিশেষ দক্ষতা।',
    ],
    description: [
      'BLAST has offices in most districts and takes cases that government legal aid sometimes cannot prioritise, including dowry, domestic violence, wage claims, and eviction. Advice is free and unlimited; whether BLAST takes on full court representation depends on the case merits and their capacity, which they will tell you at the first meeting rather than leaving you waiting.',
      'বেশিরভাগ জেলায় ব্লাস্টের অফিস আছে এবং তারা এমন মামলাও নেয় যেগুলো সরকারি আইনি সহায়তা সবসময় অগ্রাধিকার দিতে পারে না — যৌতুক, পারিবারিক নির্যাতন, মজুরির দাবি ও উচ্ছেদ এর মধ্যে পড়ে। পরামর্শ বিনামূল্যে ও সীমাহীন; আদালতে সম্পূর্ণ প্রতিনিধিত্ব নেবে কি না তা মামলার যৌক্তিকতা ও তাদের সামর্থ্যের উপর নির্ভর করে, যা প্রথম সাক্ষাতেই তারা জানিয়ে দেয় — অপেক্ষায় ফেলে রাখে না।',
    ],
    benefits: [
      'Free legal advice, mediation, court representation where accepted, and referral to shelter or counselling services.',
      'বিনামূল্যে আইনি পরামর্শ, মধ্যস্থতা, গৃহীত হলে আদালতে প্রতিনিধিত্ব এবং আশ্রয় বা কাউন্সেলিং সেবায় রেফারেল।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['legal_dispute', 'divorce', 'job_loss'],
    tags: ['ngo', 'legal-aid', 'free', 'women', 'labour'],
    sourceUrl: 'https://blast.org.bd',
    processingTime: ['First consultation usually within a week', 'প্রথম পরামর্শ সাধারণত এক সপ্তাহের মধ্যে'],
    recurrence: 'continuous',
    popularity: 54,
    steps: [
      ['Find your district BLAST unit office or call the Dhaka head office for a referral.', 'আপনার জেলার ব্লাস্ট ইউনিট অফিস খুঁজুন বা রেফারেলের জন্য ঢাকার প্রধান কার্যালয়ে ফোন করুন।'],
      ['Attend the first consultation and bring every document you already have.', 'প্রথম পরামর্শে যান এবং আপনার কাছে থাকা সব কাগজ সঙ্গে নিন।'],
      ['Ask directly whether they will take the case, and what the alternative is if not.', 'সরাসরি জিজ্ঞাসা করুন তাঁরা মামলাটি নেবেন কি না, না নিলে বিকল্প কী।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Any notices, agreements, or case papers', 'যেকোনো নোটিশ, চুক্তি বা মামলার কাগজ'], required: false },
      { name: ['Marriage or divorce certificate for family cases', 'পারিবারিক মামলার জন্য বিবাহ বা তালাক সনদ'], required: false },
    ],
    rules: rules(
      [],
      ALL(ANY(monthlyIncomeBelow(15000, 2), isFemale(2), hasDisability(1))),
    ),
  },

  {
    slug: 'violence-against-women-helpline',
    org: 'jms',
    category: 'legal_aid',
    title: ['109 Helpline and Support for Violence Against Women', '১০৯ হেল্পলাইন ও নারী নির্যাতন প্রতিরোধে সহায়তা'],
    summary: [
      'A free 24-hour helpline offering immediate counselling, police liaison, shelter referral, and legal support.',
      'বিনামূল্যে ২৪ ঘণ্টার হেল্পলাইন — তাৎক্ষণিক কাউন্সেলিং, পুলিশের সঙ্গে সমন্বয়, আশ্রয় রেফারেল ও আইনি সহায়তা।',
    ],
    description: [
      'Calling 109 is free from any mobile and does not appear as a charge on your bill. Operators can arrange police intervention, refer you to a government shelter or a One-Stop Crisis Centre at a medical college hospital, and connect you to free legal aid. One-Stop Crisis Centres provide medical treatment, evidence collection, police reporting, and shelter in a single building, which avoids having to repeat the account of what happened at several offices.',
      'যেকোনো মোবাইল থেকে ১০৯ নম্বরে কল করা বিনামূল্যে এবং এটি বিলে খরচ হিসেবে দেখায় না। অপারেটররা পুলিশি হস্তক্ষেপের ব্যবস্থা করতে পারেন, সরকারি আশ্রয়কেন্দ্র বা মেডিকেল কলেজ হাসপাতালের ওয়ান-স্টপ ক্রাইসিস সেন্টারে পাঠাতে পারেন এবং বিনামূল্যে আইনি সহায়তার সঙ্গে যুক্ত করতে পারেন। ওয়ান-স্টপ ক্রাইসিস সেন্টারে একই ভবনে চিকিৎসা, আলামত সংগ্রহ, পুলিশে অভিযোগ ও আশ্রয় — সবই পাওয়া যায়, তাই কয়েকটি অফিসে ঘটনার বর্ণনা বারবার দিতে হয় না।',
    ],
    benefits: [
      'Free 24-hour phone counselling, police liaison, shelter and One-Stop Crisis Centre referral, medical care, and free legal aid.',
      'বিনামূল্যে ২৪ ঘণ্টা ফোনে কাউন্সেলিং, পুলিশের সঙ্গে সমন্বয়, আশ্রয় ও ওয়ান-স্টপ ক্রাইসিস সেন্টারে রেফারেল, চিকিৎসা ও বিনামূল্যে আইনি সহায়তা।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['legal_dispute', 'divorce'],
    tags: ['helpline', 'women', 'emergency', 'free', 'shelter'],
    sourceUrl: 'https://jms.gov.bd',
    processingTime: ['Immediate', 'তাৎক্ষণিক'],
    recurrence: 'continuous',
    popularity: 59,
    steps: [
      ['Call 109 from any mobile — it is free and available at any hour.', 'যেকোনো মোবাইল থেকে ১০৯ নম্বরে কল করুন — বিনামূল্যে, যেকোনো সময়।'],
      ['Describe what you need: counselling, police help, shelter, or legal advice.', 'আপনার কী প্রয়োজন বলুন: কাউন্সেলিং, পুলিশের সহায়তা, আশ্রয় বা আইনি পরামর্শ।'],
      ['Ask to be referred to the nearest One-Stop Crisis Centre if you need medical care or evidence collection.', 'চিকিৎসা বা আলামত সংগ্রহের প্রয়োজন হলে নিকটস্থ ওয়ান-স্টপ ক্রাইসিস সেন্টারে পাঠাতে বলুন।'],
    ],
    docs: [
      { name: ['No documents needed to call or be helped', 'কল করতে বা সহায়তা পেতে কোনো কাগজ লাগবে না'], required: false },
      { name: ['National ID, if available, for shelter admission', 'আশ্রয়কেন্দ্রে ভর্তির জন্য জাতীয় পরিচয়পত্র, থাকলে'], required: false },
    ],
    rules: rules([], ALL(isFemale(1)), [
      'The helpline also accepts calls about violence against children and can be used by anyone reporting on another person\'s behalf.',
      'শিশু নির্যাতনের বিষয়েও হেল্পলাইনে কল করা যায় এবং অন্যের হয়ে যে কেউ অভিযোগ জানাতে পারেন।',
    ]),
  },

  {
    slug: 'disaster-gratuitous-relief',
    org: 'ddm',
    category: 'disaster',
    title: ['Gratuitous Relief after Flood, Cyclone or River Erosion', 'বন্যা, ঘূর্ণিঝড় বা নদীভাঙনের পর ত্রাণ সহায়তা'],
    summary: [
      'Emergency food, cash, and shelter materials for households affected by a declared disaster.',
      'ঘোষিত দুর্যোগে ক্ষতিগ্রস্ত পরিবারের জন্য জরুরি খাদ্য, নগদ ও গৃহনির্মাণ সামগ্রী।',
    ],
    description: [
      'Gratuitous Relief is distributed through the Upazila Nirbahi Officer once a disaster is declared for an area. It typically includes dry food, a cash grant, and corrugated iron sheets with a cash allowance for rebuilding a damaged house. Lists are prepared by ward, so registering with your ward member or councillor promptly is what determines inclusion — relief is rarely added retrospectively.',
      'কোনো এলাকায় দুর্যোগ ঘোষণা হলে উপজেলা নির্বাহী অফিসারের মাধ্যমে ত্রাণ বিতরণ হয়। সাধারণত শুকনো খাবার, নগদ অনুদান এবং ক্ষতিগ্রস্ত ঘর মেরামতের জন্য ঢেউটিন ও নগদ ভাতা দেওয়া হয়। ওয়ার্ড ধরে তালিকা তৈরি হয়, তাই দ্রুত ওয়ার্ড সদস্য বা কাউন্সিলরের কাছে নাম লেখানোই অন্তর্ভুক্তি নির্ধারণ করে — পরে ত্রাণ খুব কম যোগ করা হয়।',
    ],
    benefits: [
      'Dry food package, an emergency cash grant, and corrugated iron sheets with a rebuilding allowance for damaged houses.',
      'শুকনো খাবারের প্যাকেজ, জরুরি নগদ অনুদান এবং ক্ষতিগ্রস্ত ঘরের জন্য ঢেউটিনসহ পুনর্নির্মাণ ভাতা।',
    ],
    benefitAmount: 6000,
    benefitPeriod: 'one_time',
    lifeEvents: ['disaster_recovery', 'crop_loss'],
    tags: ['disaster', 'relief', 'emergency', 'housing'],
    sourceUrl: 'https://ddm.gov.bd',
    processingTime: ['Days to 3 weeks after the list is prepared', 'তালিকা তৈরির পর কয়েক দিন থেকে ৩ সপ্তাহ'],
    recurrence: 'continuous',
    popularity: 69,
    steps: [
      ['Register the damage with your ward member or councillor as soon as it is safe.', 'নিরাপদ হলেই ওয়ার্ড সদস্য বা কাউন্সিলরের কাছে ক্ষতির তথ্য নিবন্ধন করুন।'],
      ['Photograph the damage to your house or land if you can.', 'সম্ভব হলে আপনার ঘর বা জমির ক্ষতির ছবি তুলুন।'],
      ['Confirm your name is on the ward relief list at the Union Parishad.', 'ইউনিয়ন পরিষদে ওয়ার্ড ত্রাণ তালিকায় আপনার নাম আছে কি না নিশ্চিত করুন।'],
      ['Collect relief on the announced distribution day with your National ID.', 'ঘোষিত বিতরণের দিনে জাতীয় পরিচয়পত্র নিয়ে ত্রাণ সংগ্রহ করুন।'],
      ['Apply separately for the house rebuilding grant if your home was destroyed.', 'ঘর সম্পূর্ণ নষ্ট হলে গৃহ পুনর্নির্মাণ অনুদানের জন্য আলাদা আবেদন করুন।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Photographs of the damage', 'ক্ষতির ছবি'], required: false },
      { name: ['Ward member or councillor certification', 'ওয়ার্ড সদস্য বা কাউন্সিলরের প্রত্যয়ন'], required: false },
    ],
    rules: rules(
      ['district'],
      ALL(
        isBangladeshi(),
        c(
          'lifeEvents',
          'contains_any',
          ['disaster_recovery', 'crop_loss'],
          ['You have reported disaster damage.', 'আপনি দুর্যোগে ক্ষতির কথা জানিয়েছেন।'],
          ['This relief is for households affected by a declared disaster.', 'এই ত্রাণ ঘোষিত দুর্যোগে ক্ষতিগ্রস্ত পরিবারের জন্য।'],
          { weight: 4, unknown: ['Has a flood, cyclone, or river erosion affected your household?', 'বন্যা, ঘূর্ণিঝড় বা নদীভাঙনে আপনার পরিবার ক্ষতিগ্রস্ত হয়েছে কি?'] },
        ),
      ),
      [
        'Relief requires a disaster declaration for your area, so availability depends on an official announcement.',
        'ত্রাণের জন্য আপনার এলাকায় দুর্যোগ ঘোষণা প্রয়োজন, তাই এটি সরকারি ঘোষণার উপর নির্ভরশীল।',
      ],
    ),
  },

  {
    slug: 'cyclone-shelter-preparedness',
    org: 'ddm',
    category: 'disaster',
    title: ['Cyclone Shelter Access and Early Warning', 'ঘূর্ণিঝড় আশ্রয়কেন্দ্র ও আগাম সতর্কতা'],
    summary: [
      'Know your nearest cyclone shelter and register for free early-warning alerts before the next storm season.',
      'পরবর্তী ঝড় মৌসুমের আগেই নিকটস্থ ঘূর্ণিঝড় আশ্রয়কেন্দ্র চিনে রাখুন এবং বিনামূল্যে আগাম সতর্কবার্তার জন্য নিবন্ধন করুন।',
    ],
    description: [
      'Bangladesh has thousands of multipurpose cyclone shelters along the coast, and the Cyclone Preparedness Programme has volunteers in every coastal union who receive warnings first. Knowing which shelter serves your village, and how long it takes to walk there with children or an elderly relative, is the single most useful preparation. Shelters accept livestock in designated areas, which is why many families delay leaving.',
      'উপকূল জুড়ে বাংলাদেশে হাজারো বহুমুখী ঘূর্ণিঝড় আশ্রয়কেন্দ্র আছে, আর ঘূর্ণিঝড় প্রস্তুতি কর্মসূচির স্বেচ্ছাসেবকরা প্রতিটি উপকূলীয় ইউনিয়নে সবার আগে সতর্কবার্তা পান। কোন আশ্রয়কেন্দ্র আপনার গ্রামের জন্য এবং শিশু বা বয়স্ক আত্মীয় নিয়ে সেখানে হেঁটে যেতে কত সময় লাগে — এটা জেনে রাখাই সবচেয়ে দরকারি প্রস্তুতি। নির্দিষ্ট জায়গায় আশ্রয়কেন্দ্রে গবাদি পশুও রাখা যায়, যে কারণে অনেক পরিবার দেরি করে রওনা হয়।',
    ],
    benefits: [
      'Free shelter during a storm, free early-warning alerts, livestock space, and drinking water and basic first aid at the shelter.',
      'ঝড়ের সময় বিনামূল্যে আশ্রয়, বিনামূল্যে আগাম সতর্কবার্তা, পশু রাখার জায়গা এবং আশ্রয়কেন্দ্রে খাবার পানি ও প্রাথমিক চিকিৎসা।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['disaster_recovery'],
    tags: ['disaster', 'cyclone', 'preparedness', 'shelter', 'coastal'],
    coverage: [
      'coxs_bazar', 'chattogram', 'noakhali', 'lakshmipur', 'feni', 'bhola', 'patuakhali',
      'barguna', 'pirojpur', 'jhalokati', 'barishal', 'bagerhat', 'khulna', 'satkhira', 'chandpur',
    ],
    sourceUrl: 'https://ddm.gov.bd',
    processingTime: ['Register any time before the season', 'মৌসুমের আগে যেকোনো সময় নিবন্ধন'],
    recurrence: 'continuous',
    popularity: 48,
    steps: [
      ['Ask your Union Parishad which cyclone shelter serves your village.', 'আপনার গ্রামের জন্য কোন ঘূর্ণিঝড় আশ্রয়কেন্দ্র নির্ধারিত তা ইউনিয়ন পরিষদে জেনে নিন।'],
      ['Walk the route once in good weather so you know the time it takes.', 'ভালো আবহাওয়ায় একবার পথটি হেঁটে দেখুন যাতে কত সময় লাগে জানা থাকে।'],
      ['Register your mobile number with the local Cyclone Preparedness Programme volunteer for alerts.', 'সতর্কবার্তা পেতে স্থানীয় ঘূর্ণিঝড় প্রস্তুতি কর্মসূচির স্বেচ্ছাসেবকের কাছে মোবাইল নম্বর নিবন্ধন করুন।'],
      ['Keep National IDs and documents in a waterproof bag ready to carry.', 'জাতীয় পরিচয়পত্র ও কাগজপত্র পানিরোধী ব্যাগে নিয়ে যাওয়ার জন্য প্রস্তুত রাখুন।'],
    ],
    docs: [
      { name: ['No documents required to enter a shelter', 'আশ্রয়কেন্দ্রে ঢুকতে কোনো কাগজ লাগবে না'], required: false, tip: ['Keep your papers in a waterproof bag anyway — replacing a lost National ID after a storm takes weeks.', 'তবুও কাগজপত্র পানিরোধী ব্যাগে রাখুন — ঝড়ের পর হারানো জাতীয় পরিচয়পত্র তুলতে কয়েক সপ্তাহ লাগে।'] },
    ],
    rules: rules(
      ['district'],
      ALL(
        c(
          'district',
          'in',
          ['coxs_bazar', 'chattogram', 'noakhali', 'lakshmipur', 'feni', 'bhola', 'patuakhali',
           'barguna', 'pirojpur', 'jhalokati', 'barishal', 'bagerhat', 'khulna', 'satkhira', 'chandpur'],
          ['Your district is in the coastal cyclone preparedness zone.', 'আপনার জেলা উপকূলীয় ঘূর্ণিঝড় প্রস্তুতি অঞ্চলে পড়ে।'],
          ['Cyclone shelters serve the coastal districts. Ask us about flood preparedness for your area instead.', 'ঘূর্ণিঝড় আশ্রয়কেন্দ্র উপকূলীয় জেলাগুলোর জন্য। আপনার এলাকার বন্যা প্রস্তুতি সম্পর্কে জিজ্ঞাসা করুন।'],
          { weight: 4, unknown: ['Which district do you live in?', 'আপনি কোন জেলায় থাকেন?'] },
        ),
      ),
    ),
  },

  {
    slug: 'brac-legal-empowerment',
    org: 'brac',
    category: 'legal_aid',
    title: ['BRAC Human Rights and Legal Aid Services', 'ব্র্যাক মানবাধিকার ও আইন সহায়তা কার্যক্রম'],
    summary: [
      'Village-level legal awareness, mediation through Shalish, and referral to court where mediation fails.',
      'গ্রাম পর্যায়ে আইনি সচেতনতা, শালিসের মাধ্যমে মধ্যস্থতা এবং মধ্যস্থতা ব্যর্থ হলে আদালতে রেফারেল।',
    ],
    description: [
      'BRAC trains local paralegals who handle dowry, inheritance, land, and family disputes through community mediation, which resolves the large majority of cases without going to court. Where mediation fails, BRAC lawyers can take the case forward. The programme also runs legal awareness classes for women, which is often how people first learn that a practice they have accepted is actually unlawful.',
      'ব্র্যাক স্থানীয় প্যারালিগ্যালদের প্রশিক্ষণ দেয়, যাঁরা যৌতুক, উত্তরাধিকার, ভূমি ও পারিবারিক বিরোধ কমিউনিটি মধ্যস্থতার মাধ্যমে নিষ্পত্তি করেন — বড় অংশ মামলা ছাড়াই মিটে যায়। মধ্যস্থতা ব্যর্থ হলে ব্র্যাকের আইনজীবীরা মামলা এগিয়ে নিতে পারেন। কর্মসূচিতে নারীদের জন্য আইনি সচেতনতা ক্লাসও হয়, যেখানেই অনেকে প্রথম জানতে পারেন যে তাঁরা যে চর্চা মেনে নিয়েছেন তা আসলে বেআইনি।',
    ],
    benefits: [
      'Free legal advice, community mediation, court referral and representation where needed, and free legal awareness classes.',
      'বিনামূল্যে আইনি পরামর্শ, কমিউনিটি মধ্যস্থতা, প্রয়োজনে আদালতে রেফারেল ও প্রতিনিধিত্ব এবং বিনামূল্যে আইনি সচেতনতা ক্লাস।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['legal_dispute', 'divorce', 'widowhood'],
    tags: ['ngo', 'legal-aid', 'mediation', 'free', 'women'],
    sourceUrl: 'https://brac.net',
    processingTime: ['Mediation usually within 2–6 weeks', 'মধ্যস্থতা সাধারণত ২–৬ সপ্তাহের মধ্যে'],
    recurrence: 'continuous',
    popularity: 51,
    steps: [
      ['Contact the BRAC branch office in your upazila and ask for the legal aid clinic.', 'আপনার উপজেলার ব্র্যাক শাখা অফিসে যোগাযোগ করে আইন সহায়তা ক্লিনিকের কথা বলুন।'],
      ['Explain the dispute to the paralegal — bring any documents you have.', 'প্যারালিগ্যালকে বিরোধের কথা খুলে বলুন — আপনার কাছে থাকা কাগজ আনুন।'],
      ['Attend the Shalish mediation session if both parties agree.', 'উভয় পক্ষ রাজি হলে শালিস মধ্যস্থতা সভায় অংশ নিন।'],
      ['Ask for court referral if mediation does not resolve it.', 'মধ্যস্থতায় সমাধান না হলে আদালতে রেফারেল চান।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'], required: false },
      { name: ['Any documents relating to the dispute', 'বিরোধ সংক্রান্ত যেকোনো কাগজ'], required: false },
    ],
    rules: rules([], ALL(ANY(isFemale(2), monthlyIncomeBelow(20000, 1), c('lifeEvents', 'contains_any', ['legal_dispute', 'divorce'], ['Your situation matches this service.', 'আপনার পরিস্থিতি এই সেবার সঙ্গে মেলে।'], ['—', '—'], { soft: true })))),
  },

  {
    slug: 'freedom-fighter-honorarium',
    org: 'dss',
    category: 'social_welfare',
    title: ['Freedom Fighter Honorarium and Family Benefits', 'মুক্তিযোদ্ধা সম্মানী ভাতা ও পারিবারিক সুবিধা'],
    summary: [
      'A monthly honorarium for listed freedom fighters, continuing to the spouse, with education and medical benefits for children.',
      'তালিকাভুক্ত মুক্তিযোদ্ধাদের জন্য মাসিক সম্মানী ভাতা, যা স্ত্রী/স্বামীর ক্ষেত্রেও চলে, সঙ্গে সন্তানদের শিক্ষা ও চিকিৎসা সুবিধা।',
    ],
    description: [
      'The honorarium is paid to freedom fighters on the official Muktibarta list and continues to the surviving spouse after death. Children and grandchildren of listed freedom fighters receive education quotas and stipends, and free treatment is available at designated hospitals. Verification against the official list is the main hurdle, and the Jatiya Muktijoddha Council office handles list corrections.',
      'সরকারি মুক্তিবার্তা তালিকায় থাকা মুক্তিযোদ্ধাদের সম্মানী ভাতা দেওয়া হয় এবং মৃত্যুর পর তা বিধবা স্ত্রী বা স্বামীর ক্ষেত্রেও চলতে থাকে। তালিকাভুক্ত মুক্তিযোদ্ধাদের সন্তান ও নাতি-নাতনিরা শিক্ষা কোটা ও উপবৃত্তি পান এবং নির্ধারিত হাসপাতালে বিনামূল্যে চিকিৎসা পাওয়া যায়। সরকারি তালিকার সঙ্গে যাচাই করাই প্রধান বাধা, আর জাতীয় মুক্তিযোদ্ধা কাউন্সিলের অফিস তালিকা সংশোধন দেখে।',
    ],
    benefits: [
      'A monthly honorarium continuing to the spouse, education stipends and quotas for children, and free treatment at designated hospitals.',
      'মাসিক সম্মানী ভাতা যা স্ত্রী/স্বামীর ক্ষেত্রেও চলে, সন্তানদের শিক্ষা উপবৃত্তি ও কোটা এবং নির্ধারিত হাসপাতালে বিনামূল্যে চিকিৎসা।',
    ],
    benefitAmount: 20000,
    benefitPeriod: 'monthly',
    lifeEvents: ['old_age', 'widowhood'],
    tags: ['honorarium', 'freedom-fighter', 'monthly-cash', 'education'],
    sourceUrl: 'https://molwa.gov.bd',
    processingTime: ['60–120 days, longer if list verification is needed', '৬০–১২০ দিন, তালিকা যাচাই লাগলে আরও বেশি'],
    recurrence: 'continuous',
    popularity: 45,
    steps: [
      ['Verify the name against the official Muktibarta list at the Upazila Muktijoddha Council office.', 'উপজেলা মুক্তিযোদ্ধা কাউন্সিল অফিসে সরকারি মুক্তিবার্তা তালিকার সঙ্গে নাম যাচাই করুন।'],
      ['Collect the honorarium application form from the same office.', 'একই অফিস থেকে সম্মানী ভাতার আবেদন ফরম সংগ্রহ করুন।'],
      ['Attach the gazette or certificate reference, National ID, and account details.', 'গেজেট বা সনদের রেফারেন্স, জাতীয় পরিচয়পত্র ও হিসাবের তথ্য সংযুক্ত করুন।'],
      ['For a surviving spouse, also attach the marriage certificate and the death certificate.', 'বিধবা স্ত্রী বা স্বামীর ক্ষেত্রে বিবাহ সনদ ও মৃত্যু সনদও সংযুক্ত করুন।'],
    ],
    docs: [
      { name: ['Freedom fighter gazette or certificate reference', 'মুক্তিযোদ্ধা গেজেট বা সনদের রেফারেন্স'], authority: ['Ministry of Liberation War Affairs', 'মুক্তিযুদ্ধ বিষয়ক মন্ত্রণালয়'] },
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Marriage certificate (for a surviving spouse)', 'বিবাহ সনদ (বিধবা স্ত্রী/স্বামীর ক্ষেত্রে)'], required: false },
      { name: ['Death certificate (for a surviving spouse)', 'মৃত্যু সনদ (বিধবা স্ত্রী/স্বামীর ক্ষেত্রে)'], required: false },
      { name: ['Bank account details', 'ব্যাংক হিসাবের তথ্য'] },
    ],
    rules: rules(
      ['isFreedomFighterFamily'],
      ALL(
        isBangladeshi(),
        c(
          'isFreedomFighterFamily',
          'eq',
          true,
          ['You have reported a freedom fighter family connection.', 'আপনি মুক্তিযোদ্ধা পরিবারের সঙ্গে সংযোগের কথা জানিয়েছেন।'],
          ['This honorarium is for listed freedom fighters and their spouses.', 'এই সম্মানী ভাতা তালিকাভুক্ত মুক্তিযোদ্ধা ও তাঁদের স্ত্রী/স্বামীর জন্য।'],
          { weight: 4, unknown: ['Are you a listed freedom fighter, or the spouse of one?', 'আপনি কি তালিকাভুক্ত মুক্তিযোদ্ধা, অথবা কোনো মুক্তিযোদ্ধার স্ত্রী/স্বামী?'] },
        ),
        ageAtLeast(18, 1),
      ),
      [
        'Verification against the official Muktibarta list is required and is the most common cause of delay.',
        'সরকারি মুক্তিবার্তা তালিকার সঙ্গে যাচাই বাধ্যতামূলক এবং দেরির সবচেয়ে সাধারণ কারণ এটিই।',
      ],
    ),
  },
];
