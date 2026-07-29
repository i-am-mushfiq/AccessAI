import {
  type SeedOpportunity, c, ALL, ANY, rules,
  isBangladeshi, monthlyIncomeBelow, isFemale, hasDisability, ageAtLeast,
} from './helpers';

/**
 * Healthcare services and navigation.
 * All records are authored sample data — see docs/DEVIATIONS.md §2.
 */
export const SEED_HEALTH: readonly SeedOpportunity[] = [
  {
    slug: 'nicrh-subsidised-cancer-treatment',
    org: 'nicrh',
    category: 'healthcare',
    title: ['Subsidised Cancer Treatment at NICRH', 'জাতীয় ক্যান্সার হাসপাতালে ভর্তুকি মূল্যে চিকিৎসা'],
    summary: [
      'Chemotherapy, radiotherapy, and cancer surgery at heavily subsidised government rates, with free care for the poorest patients.',
      'সরকারি ভর্তুকি মূল্যে কেমোথেরাপি, রেডিওথেরাপি ও ক্যান্সার সার্জারি — সবচেয়ে দরিদ্র রোগীদের জন্য বিনামূল্যে।',
    ],
    description: [
      'NICRH is the national referral centre for cancer. Treatment costs a small fraction of private-hospital rates, and patients certified as poor by their Union Parishad can have charges waived entirely through the hospital\'s social welfare office. A referral is not strictly required, but arriving with a biopsy or pathology report shortens the diagnostic queue considerably. Register early in the morning; the outpatient department fills quickly.',
      'ক্যান্সারের জাতীয় রেফারেল কেন্দ্র হলো এনআইসিআরএইচ। বেসরকারি হাসপাতালের তুলনায় খরচ অনেক কম, আর ইউনিয়ন পরিষদ থেকে দরিদ্র হিসেবে প্রত্যয়িত রোগীদের খরচ হাসপাতালের সমাজকল্যাণ অফিসের মাধ্যমে সম্পূর্ণ মাফ করা যায়। রেফারেল বাধ্যতামূলক নয়, তবে বায়োপসি বা প্যাথলজি রিপোর্ট নিয়ে গেলে রোগ নির্ণয়ের অপেক্ষা অনেক কমে। খুব সকালে নিবন্ধন করুন; বহির্বিভাগ দ্রুত পূর্ণ হয়ে যায়।',
    ],
    benefits: [
      'Diagnostic tests, chemotherapy, radiotherapy, and surgery at government rates, with a full waiver available for certified poor patients.',
      'সরকারি হারে পরীক্ষা-নিরীক্ষা, কেমোথেরাপি, রেডিওথেরাপি ও সার্জারি — প্রত্যয়িত দরিদ্র রোগীদের সম্পূর্ণ মাফের সুযোগ।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['serious_medical_need'],
    tags: ['healthcare', 'cancer', 'hospital', 'subsidised'],
    sourceUrl: 'https://nicrh.gov.bd',
    processingTime: ['Outpatient registration same day; admission depends on bed availability', 'বহির্বিভাগে নিবন্ধন একই দিনে; ভর্তি শয্যা খালি থাকার উপর নির্ভরশীল'],
    recurrence: 'continuous',
    popularity: 80,
    steps: [
      ['Bring any biopsy, pathology, or imaging report you already have to the outpatient department.', 'আপনার কাছে থাকা বায়োপসি, প্যাথলজি বা ইমেজিং রিপোর্ট নিয়ে বহির্বিভাগে যান।'],
      ['Register at the outpatient counter early in the morning and pay the small ticket fee.', 'খুব সকালে বহির্বিভাগের কাউন্টারে নিবন্ধন করে অল্প টিকিট ফি দিন।'],
      ['If you cannot afford treatment, visit the hospital social welfare office with an income certificate.', 'চিকিৎসার খরচ বহন করতে না পারলে আয়ের প্রত্যয়নপত্র নিয়ে হাসপাতালের সমাজকল্যাণ অফিসে যান।'],
      ['Apply separately for the ৳50,000 government one-time grant for cancer patients.', 'ক্যান্সার রোগীদের জন্য সরকারের এককালীন ৫০,০০০ টাকা অনুদানের জন্য আলাদা আবেদন করুন।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Biopsy or pathology report', 'বায়োপসি বা প্যাথলজি রিপোর্ট'], required: false, tip: ['Bring the original report, not a photograph of it — the doctor needs the laboratory letterhead.', 'রিপোর্টের ছবি নয়, মূল কাগজ আনুন — চিকিৎসকের ল্যাবরেটরির প্যাড দরকার।'] },
      { name: ['Referral slip from another hospital', 'অন্য হাসপাতালের রেফারেল স্লিপ'], required: false },
      { name: ['Income certificate for a fee waiver', 'ফি মাফের জন্য আয়ের প্রত্যয়নপত্র'], required: false, authority: ['Union Parishad / Ward councillor', 'ইউনিয়ন পরিষদ / ওয়ার্ড কাউন্সিলর'] },
    ],
    rules: rules(
      ['medicalConditions'],
      ALL(
        isBangladeshi(),
        c(
          'medicalConditions',
          'contains_any',
          ['cancer'],
          ['Your reported condition matches this service.', 'আপনার উল্লেখ করা রোগ এই সেবার সঙ্গে মেলে।'],
          ['This centre treats cancer patients. For other conditions, ask us about the right hospital.', 'এই কেন্দ্র ক্যান্সার রোগীদের চিকিৎসা করে। অন্য রোগের জন্য সঠিক হাসপাতাল সম্পর্কে জিজ্ঞাসা করুন।'],
          { weight: 4, unknown: ['Which illness do you need treatment for?', 'আপনার কোন রোগের চিকিৎসা প্রয়োজন?'] },
        ),
      ),
      [
        'Treatment is available to any citizen; the fee waiver is what depends on income.',
        'চিকিৎসা যেকোনো নাগরিক পেতে পারেন; শুধু ফি মাফ আয়ের উপর নির্ভর করে।',
      ],
    ),
  },

  {
    slug: 'community-clinic-services',
    org: 'dghs',
    category: 'healthcare',
    title: ['Community Clinic Primary Healthcare', 'কমিউনিটি ক্লিনিক প্রাথমিক স্বাস্থ্যসেবা'],
    summary: [
      'Free primary care, 30+ essential medicines, antenatal check-ups, and child immunisation within walking distance of most villages.',
      'বেশিরভাগ গ্রামের হাঁটা দূরত্বে বিনামূল্যে প্রাথমিক চিকিৎসা, ৩০টিরও বেশি অত্যাবশ্যক ঔষধ, গর্ভকালীন পরীক্ষা ও শিশু টিকা।',
    ],
    description: [
      'There are roughly 14,000 community clinics nationwide, each serving about 6,000 people. Services are free and no referral, appointment, or identification is required to be seen. A Community Health Care Provider is present on working days and can refer you upward to a Union Health Centre or Upazila Health Complex when needed. This is the correct first stop for fever, diarrhoea, minor injuries, blood-pressure checks, and pregnancy monitoring.',
      'সারা দেশে প্রায় ১৪,০০০ কমিউনিটি ক্লিনিক আছে, প্রতিটি প্রায় ৬,০০০ মানুষকে সেবা দেয়। সেবা বিনামূল্যে এবং দেখানোর জন্য কোনো রেফারেল, অ্যাপয়েন্টমেন্ট বা পরিচয়পত্র লাগে না। কর্মদিবসে একজন কমিউনিটি হেলথ কেয়ার প্রোভাইডার থাকেন এবং প্রয়োজনে ইউনিয়ন স্বাস্থ্য কেন্দ্র বা উপজেলা স্বাস্থ্য কমপ্লেক্সে পাঠাতে পারেন। জ্বর, ডায়রিয়া, ছোট আঘাত, রক্তচাপ পরীক্ষা ও গর্ভাবস্থার তত্ত্বাবধানের জন্য এটাই সঠিক প্রথম গন্তব্য।',
    ],
    benefits: [
      'Free consultation, free essential medicines, antenatal and postnatal care, child immunisation, and referral upward when needed.',
      'বিনামূল্যে পরামর্শ, বিনামূল্যে অত্যাবশ্যক ঔষধ, গর্ভকালীন ও প্রসব-পরবর্তী সেবা, শিশু টিকা এবং প্রয়োজনে উপরে রেফারেল।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['serious_medical_need', 'pregnancy', 'old_age'],
    tags: ['healthcare', 'primary-care', 'free', 'rural'],
    sourceUrl: 'https://dghs.gov.bd',
    processingTime: ['Walk in on any working day', 'যেকোনো কর্মদিবসে সরাসরি যান'],
    recurrence: 'continuous',
    popularity: 87,
    steps: [
      ['Find your nearest community clinic — most unions have three.', 'নিকটস্থ কমিউনিটি ক্লিনিক খুঁজে নিন — বেশিরভাগ ইউনিয়নে তিনটি থাকে।'],
      ['Walk in during working hours. No appointment or identification is needed.', 'কর্মঘণ্টায় সরাসরি যান। অ্যাপয়েন্টমেন্ট বা পরিচয়পত্র লাগবে না।'],
      ['Ask for a referral slip if you need to see a doctor at a higher facility.', 'উঁচু স্তরের প্রতিষ্ঠানে চিকিৎসক দেখানোর প্রয়োজন হলে রেফারেল স্লিপ চেয়ে নিন।'],
    ],
    docs: [
      { name: ['No documents required', 'কোনো কাগজ লাগবে না'], required: false, tip: ['Bringing your National ID helps the clinic keep your health record, but you will be seen without it.', 'জাতীয় পরিচয়পত্র আনলে ক্লিনিক আপনার স্বাস্থ্য রেকর্ড রাখতে পারে, তবে না আনলেও সেবা পাবেন।'] },
    ],
    rules: rules([], ALL(isBangladeshi()), [
      'Community clinic services are open to everyone with no eligibility test.',
      'কমিউনিটি ক্লিনিকের সেবা সবার জন্য খোলা, কোনো যোগ্যতা যাচাই নেই।',
    ]),
  },

  {
    slug: 'maternal-health-voucher',
    org: 'dghs',
    category: 'healthcare',
    title: ['Maternal Health Voucher Scheme (DSF)', 'মাতৃস্বাস্থ্য ভাউচার স্কিম (ডিএসএফ)'],
    summary: [
      'Free antenatal visits, safe delivery including caesarean, and a cash incentive for using a facility for childbirth.',
      'বিনামূল্যে গর্ভকালীন পরীক্ষা, সিজারসহ নিরাপদ প্রসব এবং প্রতিষ্ঠানে সন্তান প্রসবের জন্য নগদ প্রণোদনা।',
    ],
    description: [
      'The voucher covers three antenatal check-ups, delivery at a designated facility including caesarean section if medically needed, one postnatal visit, and transport costs. A cash incentive is paid after facility delivery. The scheme operates in selected upazilas rather than nationwide, so confirm coverage at your Union Health and Family Welfare Centre before relying on it.',
      'ভাউচারে তিনটি গর্ভকালীন পরীক্ষা, নির্ধারিত প্রতিষ্ঠানে প্রসব — চিকিৎসাগতভাবে প্রয়োজন হলে সিজারসহ, একটি প্রসব-পরবর্তী পরীক্ষা এবং যাতায়াত খরচ অন্তর্ভুক্ত। প্রতিষ্ঠানে প্রসবের পর নগদ প্রণোদনা দেওয়া হয়। এই স্কিম সারা দেশে নয়, নির্বাচিত উপজেলায় চলে — তাই নির্ভর করার আগে ইউনিয়ন স্বাস্থ্য ও পরিবার কল্যাণ কেন্দ্রে আওতা নিশ্চিত করুন।',
    ],
    benefits: [
      'Three free antenatal visits, free facility delivery including caesarean, one postnatal visit, transport reimbursement, and a cash incentive.',
      'তিনটি বিনামূল্যে গর্ভকালীন পরীক্ষা, সিজারসহ বিনামূল্যে প্রাতিষ্ঠানিক প্রসব, একটি প্রসব-পরবর্তী পরীক্ষা, যাতায়াত খরচ ফেরত ও নগদ প্রণোদনা।',
    ],
    benefitAmount: 2000,
    benefitPeriod: 'one_time',
    lifeEvents: ['pregnancy'],
    tags: ['healthcare', 'maternal-health', 'voucher', 'safe-delivery'],
    sourceUrl: 'https://dghs.gov.bd',
    processingTime: ['Voucher issued at first antenatal registration', 'প্রথম গর্ভকালীন নিবন্ধনেই ভাউচার দেওয়া হয়'],
    recurrence: 'continuous',
    popularity: 64,
    steps: [
      ['Register your pregnancy at the Union Health and Family Welfare Centre as early as possible.', 'যত দ্রুত সম্ভব ইউনিয়ন স্বাস্থ্য ও পরিবার কল্যাণ কেন্দ্রে গর্ভধারণ নিবন্ধন করুন।'],
      ['Ask whether the DSF voucher scheme operates in your upazila.', 'আপনার উপজেলায় ডিএসএফ ভাউচার স্কিম চালু আছে কি না জেনে নিন।'],
      ['Collect your voucher booklet and keep it for every visit.', 'ভাউচার বইটি সংগ্রহ করে প্রতিটি ভিজিটে সঙ্গে রাখুন।'],
      ['Deliver at the designated facility to receive the cash incentive.', 'নগদ প্রণোদনা পেতে নির্ধারিত প্রতিষ্ঠানে সন্তান প্রসব করুন।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Pregnancy registration card', 'গর্ভধারণ নিবন্ধন কার্ড'], authority: ['Union Health and Family Welfare Centre', 'ইউনিয়ন স্বাস্থ্য ও পরিবার কল্যাণ কেন্দ্র'] },
      { name: ['Voucher booklet', 'ভাউচার বই'], tip: ['Losing the booklet delays reimbursement. Keep it with your ID in one place.', 'বই হারালে টাকা ফেরত পেতে দেরি হয়। পরিচয়পত্রের সঙ্গে এক জায়গায় রাখুন।'] },
    ],
    rules: rules(
      ['gender', 'isPregnant'],
      ALL(
        isBangladeshi(),
        isFemale(),
        c('isPregnant', 'eq', true, ['You have reported that you are pregnant.', 'আপনি গর্ভবতী বলে জানিয়েছেন।'], ['This voucher is for pregnant women.', 'এই ভাউচার গর্ভবতী মহিলাদের জন্য।'], { weight: 4, unknown: ['Are you currently pregnant?', 'আপনি কি বর্তমানে গর্ভবতী?'] }),
        monthlyIncomeBelow(8000, 2),
      ),
      ['Available in selected upazilas only — confirm local coverage before relying on it.', 'শুধু নির্বাচিত উপজেলায় পাওয়া যায় — নির্ভর করার আগে স্থানীয় আওতা নিশ্চিত করুন।'],
    ),
  },

  {
    slug: 'nimh-mental-health-services',
    org: 'nimh',
    category: 'healthcare',
    title: ['Mental Health Treatment and Counselling', 'মানসিক স্বাস্থ্য চিকিৎসা ও কাউন্সেলিং'],
    summary: [
      'Outpatient counselling, psychiatric treatment, and inpatient care at government rates, plus a free national helpline.',
      'সরকারি হারে বহির্বিভাগে কাউন্সেলিং, মানসিক রোগের চিকিৎসা ও আন্তঃবিভাগ সেবা, সঙ্গে বিনামূল্যে জাতীয় হেল্পলাইন।',
    ],
    description: [
      'You do not need a referral and you do not need a diagnosis to come. Outpatient consultation costs a nominal ticket fee, and medicines on the essential list are provided free when in stock. If travelling to Dhaka is not possible, every district hospital now has a mental health focal person, and the 16263 health helpline can connect you to counselling by phone. Seeking help for anxiety, sleeplessness, or grief is a legitimate reason to attend.',
      'আসতে রেফারেল লাগে না, রোগ নির্ণয়ও লাগে না। বহির্বিভাগে পরামর্শের জন্য নামমাত্র টিকিট ফি লাগে এবং অত্যাবশ্যক তালিকার ঔষধ স্টকে থাকলে বিনামূল্যে দেওয়া হয়। ঢাকায় আসা সম্ভব না হলে এখন প্রতিটি জেলা হাসপাতালে একজন মানসিক স্বাস্থ্য ফোকাল পারসন আছেন, আর ১৬২৬৩ স্বাস্থ্য হেল্পলাইন ফোনেই কাউন্সেলিংয়ে সংযুক্ত করতে পারে। দুশ্চিন্তা, ঘুম না হওয়া বা শোকের জন্য সহায়তা চাওয়া আসার যথেষ্ট কারণ।',
    ],
    benefits: [
      'Outpatient psychiatric consultation and counselling at a nominal fee, free essential medicines when in stock, and inpatient care if needed.',
      'নামমাত্র ফিতে বহির্বিভাগে মানসিক চিকিৎসা ও কাউন্সেলিং, স্টকে থাকলে বিনামূল্যে অত্যাবশ্যক ঔষধ এবং প্রয়োজনে আন্তঃবিভাগ সেবা।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['serious_medical_need', 'widowhood', 'job_loss', 'disaster_recovery'],
    tags: ['healthcare', 'mental-health', 'counselling', 'helpline'],
    sourceUrl: 'https://nimh.gov.bd',
    processingTime: ['Same-day outpatient consultation', 'একই দিনে বহির্বিভাগে পরামর্শ'],
    recurrence: 'continuous',
    popularity: 52,
    steps: [
      ['Call the 16263 health helpline first if you would rather start by phone.', 'ফোনে শুরু করতে চাইলে প্রথমে ১৬২৬৩ স্বাস্থ্য হেল্পলাইনে কল করুন।'],
      ['Or go to the NIMH outpatient department, or your district hospital\'s mental health focal person.', 'অথবা এনআইএমএইচ বহির্বিভাগে যান, কিংবা জেলা হাসপাতালের মানসিক স্বাস্থ্য ফোকাল পারসনের কাছে যান।'],
      ['Pay the nominal outpatient ticket fee and wait to be seen. No referral is needed.', 'নামমাত্র বহির্বিভাগ টিকিট ফি দিয়ে অপেক্ষা করুন। রেফারেল লাগবে না।'],
      ['Ask about the follow-up schedule before you leave.', 'যাওয়ার আগে পরবর্তী সাক্ষাতের সময়সূচি জেনে নিন।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'], required: false },
      { name: ['Previous prescriptions, if any', 'আগের প্রেসক্রিপশন, থাকলে'], required: false },
    ],
    rules: rules([], ALL(isBangladeshi()), [
      'Open to everyone. No referral, diagnosis, or income test is required.',
      'সবার জন্য খোলা। রেফারেল, রোগ নির্ণয় বা আয় যাচাই কিছুই লাগে না।',
    ]),
  },

  {
    slug: 'kidney-foundation-dialysis',
    org: 'kidney_foundation',
    category: 'healthcare',
    title: ['Subsidised and Free Dialysis', 'ভর্তুকি ও বিনামূল্যে ডায়ালাইসিস'],
    summary: [
      'Haemodialysis at a fraction of private-clinic cost, with fully free sessions for patients certified as unable to pay.',
      'বেসরকারি ক্লিনিকের ভগ্নাংশ খরচে হেমোডায়ালাইসিস — অসামর্থ্য প্রত্যয়িত রোগীদের জন্য সম্পূর্ণ বিনামূল্যে।',
    ],
    description: [
      'Kidney failure requires dialysis two to three times a week indefinitely, which is why the cost per session matters so much. The Kidney Foundation runs a sliding scale: patients who can pay something pay a subsidised rate, and patients certified as destitute receive sessions free. Places are limited and there is often a waiting list, so registering early — even before dialysis becomes urgent — is worthwhile.',
      'কিডনি বিকল হলে সপ্তাহে দুই থেকে তিনবার অনির্দিষ্টকাল ডায়ালাইসিস লাগে, তাই প্রতি সেশনের খরচ এত গুরুত্বপূর্ণ। কিডনি ফাউন্ডেশন একটি ধাপে ধাপে হার অনুসরণ করে: যাঁরা কিছু দিতে পারেন তাঁরা ভর্তুকি হারে দেন, আর নিঃস্ব হিসেবে প্রত্যয়িত রোগীরা বিনামূল্যে সেশন পান। আসন সীমিত এবং প্রায়ই অপেক্ষমাণ তালিকা থাকে, তাই ডায়ালাইসিস জরুরি হওয়ার আগেই নিবন্ধন করা ভালো।',
    ],
    benefits: [
      'Subsidised or free haemodialysis sessions, transplant work-up support, and free kidney-function screening camps.',
      'ভর্তুকি বা বিনামূল্যে হেমোডায়ালাইসিস সেশন, প্রতিস্থাপন প্রস্তুতিতে সহায়তা এবং বিনামূল্যে কিডনি পরীক্ষা ক্যাম্প।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['serious_medical_need'],
    tags: ['ngo', 'healthcare', 'dialysis', 'kidney'],
    sourceUrl: 'https://kidneyfoundationbd.com',
    processingTime: ['Registration same day; dialysis slot subject to a waiting list', 'নিবন্ধন একই দিনে; ডায়ালাইসিসের সময় অপেক্ষমাণ তালিকার উপর নির্ভরশীল'],
    recurrence: 'continuous',
    popularity: 58,
    steps: [
      ['Bring your creatinine and eGFR reports and any nephrologist\'s prescription.', 'আপনার ক্রিয়েটিনিন ও ইজিএফআর রিপোর্ট এবং নেফ্রোলজিস্টের প্রেসক্রিপশন আনুন।'],
      ['Register at the Kidney Foundation hospital reception in Mirpur, Dhaka.', 'ঢাকার মিরপুরে কিডনি ফাউন্ডেশন হাসপাতালের রিসেপশনে নিবন্ধন করুন।'],
      ['Apply to the welfare committee with an income certificate for a fee waiver.', 'ফি মাফের জন্য আয়ের প্রত্যয়নপত্র নিয়ে কল্যাণ কমিটিতে আবেদন করুন।'],
      ['Also apply for the ৳50,000 government one-time grant for kidney patients.', 'কিডনি রোগীদের জন্য সরকারের এককালীন ৫০,০০০ টাকা অনুদানেরও আবেদন করুন।'],
    ],
    docs: [
      { name: ['Creatinine and eGFR laboratory reports', 'ক্রিয়েটিনিন ও ইজিএফআর ল্যাব রিপোর্ট'] },
      { name: ["Nephrologist's prescription", 'নেফ্রোলজিস্টের প্রেসক্রিপশন'], required: false },
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Income certificate for a fee waiver', 'ফি মাফের জন্য আয়ের প্রত্যয়নপত্র'], required: false, authority: ['Union Parishad / Ward councillor', 'ইউনিয়ন পরিষদ / ওয়ার্ড কাউন্সিলর'] },
    ],
    rules: rules(
      ['medicalConditions'],
      ALL(
        c(
          'medicalConditions',
          'contains_any',
          ['kidney_failure', 'kidney_disease'],
          ['Your reported condition matches this service.', 'আপনার উল্লেখ করা রোগ এই সেবার সঙ্গে মেলে।'],
          ['This service is for patients with kidney disease or kidney failure.', 'এই সেবা কিডনি রোগ বা কিডনি বিকল রোগীদের জন্য।'],
          { weight: 4, unknown: ['Do you have a kidney condition?', 'আপনার কিডনি সংক্রান্ত কোনো সমস্যা আছে কি?'] },
        ),
      ),
    ),
  },

  {
    slug: 'disability-assistive-devices',
    org: 'dss',
    category: 'healthcare',
    title: ['Free Assistive Devices for Persons with Disabilities', 'প্রতিবন্ধী ব্যক্তিদের জন্য বিনামূল্যে সহায়ক উপকরণ'],
    summary: [
      'Free wheelchairs, crutches, hearing aids, white canes, and prosthetics through Disability Service Centres.',
      'প্রতিবন্ধী সেবা কেন্দ্রের মাধ্যমে বিনামূল্যে হুইলচেয়ার, ক্রাচ, শ্রবণযন্ত্র, সাদা ছড়ি ও কৃত্রিম অঙ্গ।',
    ],
    description: [
      'Disability Service and Help Centres operate in every district and provide devices free of charge along with physiotherapy, speech therapy, and occupational therapy. Devices are issued after an assessment, so bring the person who needs the device rather than applying on their behalf where possible. Repairs and replacements are also free.',
      'প্রতিটি জেলায় প্রতিবন্ধী সেবা ও সহায়তা কেন্দ্র আছে, যেখানে বিনামূল্যে উপকরণের পাশাপাশি ফিজিওথেরাপি, স্পিচ থেরাপি ও অকুপেশনাল থেরাপি দেওয়া হয়। পরীক্ষার পর উপকরণ দেওয়া হয়, তাই সম্ভব হলে যাঁর উপকরণ দরকার তাঁকে সঙ্গে নিয়ে যান, অন্যের হয়ে আবেদন না করে। মেরামত ও প্রতিস্থাপনও বিনামূল্যে।',
    ],
    benefits: [
      'Free assistive devices, free physiotherapy and speech therapy, and free repairs and replacement.',
      'বিনামূল্যে সহায়ক উপকরণ, বিনামূল্যে ফিজিওথেরাপি ও স্পিচ থেরাপি, বিনামূল্যে মেরামত ও প্রতিস্থাপন।',
    ],
    benefitPeriod: 'one_time',
    lifeEvents: ['disability_onset'],
    tags: ['disability', 'assistive-devices', 'free', 'therapy'],
    sourceUrl: 'https://dss.gov.bd',
    processingTime: ['Assessment same day; device issued in 7–30 days depending on stock', 'পরীক্ষা একই দিনে; স্টক অনুযায়ী ৭–৩০ দিনে উপকরণ'],
    recurrence: 'continuous',
    popularity: 55,
    steps: [
      ['Find your district Disability Service and Help Centre.', 'আপনার জেলার প্রতিবন্ধী সেবা ও সহায়তা কেন্দ্র খুঁজে নিন।'],
      ['Attend with the person who needs the device for an assessment.', 'যাঁর উপকরণ দরকার তাঁকে সঙ্গে নিয়ে পরীক্ষার জন্য যান।'],
      ['Bring the Suborno Nagorik card if you already have one; if not, register at the same visit.', 'সুবর্ণ নাগরিক কার্ড থাকলে আনুন; না থাকলে একই দিনে নিবন্ধন করুন।'],
      ['Collect the device and book the follow-up therapy sessions.', 'উপকরণ সংগ্রহ করুন এবং পরবর্তী থেরাপি সেশনের সময় নিন।'],
    ],
    docs: [
      { name: ['Suborno Nagorik card or registration slip', 'সুবর্ণ নাগরিক কার্ড বা নিবন্ধন স্লিপ'], required: false },
      { name: ['National ID or birth registration certificate', 'জাতীয় পরিচয়পত্র বা জন্ম নিবন্ধন সনদ'] },
      { name: ['Medical certificate or prescription describing the need', 'প্রয়োজনের বিবরণসহ মেডিকেল সনদ বা প্রেসক্রিপশন'], required: false },
    ],
    rules: rules(['hasDisability'], ALL(hasDisability())),
  },

  {
    slug: 'elderly-health-priority-services',
    org: 'dghs',
    category: 'healthcare',
    title: ['Priority Health Services for Elderly Citizens', 'বয়স্ক নাগরিকদের জন্য অগ্রাধিকার স্বাস্থ্যসেবা'],
    summary: [
      'Dedicated queues, free consultation, and a senior citizen corner at district and upazila hospitals.',
      'জেলা ও উপজেলা হাসপাতালে আলাদা সারি, বিনামূল্যে পরামর্শ ও প্রবীণ কর্নার।',
    ],
    description: [
      'Government hospitals are required to provide a separate, shorter queue for citizens aged 65 and above, along with free outpatient consultation. Many district hospitals also run a senior citizen corner with blood-pressure and diabetes monitoring. Bring your National ID so the age can be confirmed at the counter without argument.',
      'সরকারি হাসপাতালে ৬৫ বছর ও তার বেশি বয়সীদের জন্য আলাদা ও ছোট সারি এবং বিনামূল্যে বহির্বিভাগে পরামর্শ দেওয়া বাধ্যতামূলক। অনেক জেলা হাসপাতালে রক্তচাপ ও ডায়াবেটিস পরীক্ষার সুবিধাসহ প্রবীণ কর্নারও আছে। বয়স নিয়ে কথা কাটাকাটি ছাড়া কাউন্টারে নিশ্চিত করতে জাতীয় পরিচয়পত্র সঙ্গে আনুন।',
    ],
    benefits: [
      'A separate shorter queue, free outpatient consultation, and routine blood-pressure and diabetes monitoring.',
      'আলাদা ও ছোট সারি, বিনামূল্যে বহির্বিভাগে পরামর্শ এবং নিয়মিত রক্তচাপ ও ডায়াবেটিস পরীক্ষা।',
    ],
    benefitPeriod: 'variable',
    lifeEvents: ['old_age', 'serious_medical_need'],
    tags: ['healthcare', 'elderly', 'priority', 'free'],
    sourceUrl: 'https://dghs.gov.bd',
    processingTime: ['Same day', 'একই দিনে'],
    recurrence: 'continuous',
    popularity: 47,
    steps: [
      ['Go to the outpatient department of your district or upazila hospital.', 'আপনার জেলা বা উপজেলা হাসপাতালের বহির্বিভাগে যান।'],
      ['Show your National ID at the counter and ask for the senior citizen queue.', 'কাউন্টারে জাতীয় পরিচয়পত্র দেখিয়ে প্রবীণ সারিতে যেতে বলুন।'],
      ['Ask whether a senior citizen corner operates that day.', 'সেদিন প্রবীণ কর্নার চালু আছে কি না জেনে নিন।'],
    ],
    docs: [{ name: ['National ID card', 'জাতীয় পরিচয়পত্র'], tip: ['The card is how the counter confirms your age for the priority queue.', 'অগ্রাধিকার সারির জন্য কাউন্টার এই কার্ড দেখেই বয়স নিশ্চিত করে।'] }],
    rules: rules(
      ['age'],
      ALL(isBangladeshi(), ANY(ageAtLeast(65, 3), c('hasDisability', 'eq', true, ['Persons with disabilities also receive priority.', 'প্রতিবন্ধী ব্যক্তিরাও অগ্রাধিকার পান।'], ['—', '—'], { soft: true }))),
    ),
  },
];
