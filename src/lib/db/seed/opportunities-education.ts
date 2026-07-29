import {
  type SeedOpportunity, c, ALL, ANY, rules,
  isBangladeshi, monthlyIncomeBelow, isFemale, isStudent,
  cgpaAtLeast, educationAtLeast, ageBetween,
} from './helpers';

/**
 * Education, scholarship, and research programmes.
 * All records are authored sample data — see docs/DEVIATIONS.md §2.
 */
export const SEED_EDUCATION: readonly SeedOpportunity[] = [
  {
    slug: 'pm-education-assistance-stipend',
    org: 'pmeat',
    category: 'scholarship',
    title: ["Prime Minister's Education Assistance Trust Stipend", 'প্রধানমন্ত্রীর শিক্ষা সহায়তা ট্রাস্ট উপবৃত্তি'],
    summary: [
      'A monthly stipend for financially disadvantaged but academically capable students, from secondary to postgraduate level.',
      'আর্থিকভাবে অসচ্ছল কিন্তু মেধাবী শিক্ষার্থীদের জন্য মাধ্যমিক থেকে স্নাতকোত্তর পর্যন্ত মাসিক উপবৃত্তি।',
    ],
    description: [
      'The Trust exists for students who would otherwise drop out for financial reasons. Applications are submitted online each year and are ranked on family income together with examination results, so a strong result with a very low family income is the strongest combination. Students whose father or mother has died, or whose family lost its earner, receive additional weight. The stipend is disbursed directly to the student\'s own account.',
      'যে শিক্ষার্থীরা আর্থিক কারণে পড়া ছেড়ে দিতে বাধ্য হতেন, তাঁদের জন্যই এই ট্রাস্ট। প্রতি বছর অনলাইনে আবেদন নেওয়া হয় এবং পারিবারিক আয়ের সঙ্গে পরীক্ষার ফলাফল মিলিয়ে অগ্রাধিকার নির্ধারণ হয় — তাই খুব কম পারিবারিক আয়ের সঙ্গে ভালো ফলাফল সবচেয়ে শক্তিশালী সমন্বয়। যাঁদের বাবা বা মা মারা গেছেন বা পরিবারের উপার্জনকারী চলে গেছেন, তাঁরা বাড়তি অগ্রাধিকার পান। উপবৃত্তি সরাসরি শিক্ষার্থীর নিজের হিসাবে পাঠানো হয়।',
    ],
    benefits: [
      'A monthly stipend for the full academic year, renewable if you continue to meet the result requirement.',
      'পুরো শিক্ষাবর্ষের জন্য মাসিক উপবৃত্তি, ফলাফলের শর্ত পূরণ অব্যাহত থাকলে নবায়নযোগ্য।',
    ],
    benefitAmount: 2000,
    benefitPeriod: 'monthly',
    lifeEvents: ['higher_education', 'child_education', 'widowhood'],
    tags: ['stipend', 'scholarship', 'students', 'need-based'],
    sourceUrl: 'https://pmeat.gov.bd',
    applyUrl: 'https://eservice.pmeat.gov.bd',
    processingTime: ['60–90 days after the application window closes', 'আবেদনের সময়সীমা শেষ হওয়ার পর ৬০–৯০ দিন'],
    recurrence: 'annual',
    deadlineInDays: 38,
    popularity: 91,
    steps: [
      ['Create an account on the Trust\'s online application portal.', 'ট্রাস্টের অনলাইন আবেদন পোর্টালে একটি হিসাব খুলুন।'],
      ['Enter your last examination result, institution details, and family income.', 'সর্বশেষ পরীক্ষার ফলাফল, প্রতিষ্ঠানের তথ্য ও পারিবারিক আয় লিখুন।'],
      ['Upload your income certificate and studentship certificate as clear photographs.', 'আয়ের প্রত্যয়নপত্র ও অধ্যয়নরত প্রত্যয়নপত্রের স্পষ্ট ছবি সংযুক্ত করুন।'],
      ['Have your institution head verify the application online.', 'প্রতিষ্ঠান প্রধানকে অনলাইনে আবেদনটি যাচাই করাতে বলুন।'],
      ['Note your application number and check the result announcement on the portal.', 'আবেদন নম্বরটি লিখে রাখুন এবং পোর্টালে ফলাফলের ঘোষণা দেখুন।'],
    ],
    docs: [
      {
        name: ['Studentship certificate from your institution', 'প্রতিষ্ঠানের অধ্যয়নরত প্রত্যয়নপত্র'],
        authority: ['School / College / University', 'স্কুল / কলেজ / বিশ্ববিদ্যালয়'],
        validityMonths: 12,
        mistake: ['Submitting an admission receipt instead of a studentship certificate — they are different documents.', 'অধ্যয়নরত প্রত্যয়নপত্রের বদলে ভর্তির রসিদ জমা দেওয়া — এগুলো আলাদা কাগজ।'],
      },
      {
        name: ['Family income certificate', 'পারিবারিক আয়ের প্রত্যয়নপত্র'],
        authority: ['Union Parishad chairman / Ward councillor', 'ইউনিয়ন পরিষদ চেয়ারম্যান / ওয়ার্ড কাউন্সিলর'],
        validityMonths: 6,
      },
      { name: ['Marksheet or transcript of your last examination', 'সর্বশেষ পরীক্ষার নম্বরপত্র বা ট্রান্সক্রিপ্ট'] },
      { name: ['Your own bank account number', 'আপনার নিজের ব্যাংক হিসাব নম্বর'], tip: ['A parent\'s account is not accepted — open a student account, which most banks offer with a ৳10 minimum.', 'অভিভাবকের হিসাব গ্রহণযোগ্য নয় — স্টুডেন্ট অ্যাকাউন্ট খুলুন, বেশিরভাগ ব্যাংক ১০ টাকায় এটি দেয়।'] },
      { name: ['Death certificate of a deceased parent', 'মৃত অভিভাবকের মৃত্যু সনদ'], required: false },
    ],
    rules: rules(
      ['isStudent', 'monthlyIncome', 'education'],
      ALL(
        isBangladeshi(),
        isStudent(3),
        monthlyIncomeBelow(20000, 3),
        educationAtLeast('ssc', ['SSC', 'এসএসসি'], 2),
        c(
          'cgpa',
          'gte',
          3.0,
          ['Your result meets the academic threshold.', 'আপনার ফলাফল একাডেমিক শর্ত পূরণ করেছে।'],
          ['A stronger result improves your ranking, but a lower one does not disqualify you.', 'ভালো ফলাফল অগ্রাধিকার বাড়ায়, তবে কম ফলাফলে আপনি অযোগ্য হন না।'],
          { soft: true, weight: 2, unknown: ['What was your CGPA or GPA in your last examination?', 'সর্বশেষ পরীক্ষায় আপনার সিজিপিএ বা জিপিএ কত ছিল?'] },
        ),
      ),
      [
        'Ranking combines family income and examination result, so meeting the minimums does not guarantee selection.',
        'পারিবারিক আয় ও পরীক্ষার ফলাফল মিলিয়ে অগ্রাধিকার নির্ধারণ হয়, তাই ন্যূনতম শর্ত পূরণেই নির্বাচন নিশ্চিত নয়।',
      ],
    ),
  },

  {
    slug: 'secondary-education-stipend',
    org: 'shed',
    category: 'scholarship',
    title: ['Secondary Education Stipend', 'মাধ্যমিক শিক্ষা উপবৃত্তি'],
    summary: [
      'A quarterly stipend and tuition support for secondary students from low-income families, with priority for girls.',
      'নিম্ন আয়ের পরিবারের মাধ্যমিক শিক্ষার্থীদের জন্য ত্রৈমাসিক উপবৃত্তি ও টিউশন সহায়তা — মেয়েদের অগ্রাধিকার।',
    ],
    description: [
      'The stipend is paid through the school and is conditional on attendance of at least 75 percent and passing the annual examination. Girls in rural areas have historically been the primary target, and the programme is one of the reasons Bangladesh reached gender parity in secondary enrolment. Enrolment is handled by the school, so speaking to the head teacher is the correct first step rather than visiting a government office.',
      'উপবৃত্তি স্কুলের মাধ্যমে দেওয়া হয় এবং কমপক্ষে ৭৫ শতাংশ উপস্থিতি ও বার্ষিক পরীক্ষায় উত্তীর্ণ হওয়া শর্ত। গ্রামীণ এলাকার মেয়েরা ঐতিহাসিকভাবে প্রধান লক্ষ্য, আর এই কর্মসূচিই বাংলাদেশে মাধ্যমিকে ছেলে-মেয়ের সমতা আসার একটি কারণ। তালিকাভুক্তি স্কুল করে, তাই সরকারি অফিসে যাওয়ার বদলে প্রধান শিক্ষকের সঙ্গে কথা বলাই সঠিক প্রথম ধাপ।',
    ],
    benefits: [
      'A quarterly stipend plus tuition assistance paid through your school, and an examination fee waiver.',
      'স্কুলের মাধ্যমে ত্রৈমাসিক উপবৃত্তি ও টিউশন সহায়তা, সঙ্গে পরীক্ষার ফি মাফ।',
    ],
    benefitAmount: 1500,
    benefitPeriod: 'quarterly',
    lifeEvents: ['child_education'],
    tags: ['stipend', 'secondary', 'girls-education', 'attendance-linked'],
    sourceUrl: 'https://shed.gov.bd',
    processingTime: ['Enrolled at the start of the academic year', 'শিক্ষাবর্ষের শুরুতে তালিকাভুক্তি'],
    recurrence: 'annual',
    deadlineInDays: 95,
    popularity: 73,
    steps: [
      ['Speak to your school head teacher about the stipend list for this academic year.', 'এই শিক্ষাবর্ষের উপবৃত্তি তালিকা নিয়ে স্কুলের প্রধান শিক্ষকের সঙ্গে কথা বলুন।'],
      ['Provide the student\'s birth registration certificate and the guardian\'s National ID.', 'শিক্ষার্থীর জন্ম নিবন্ধন সনদ ও অভিভাবকের জাতীয় পরিচয়পত্র দিন।'],
      ['Give a mobile financial account number in the guardian\'s name.', 'অভিভাবকের নামে একটি মোবাইল আর্থিক হিসাব নম্বর দিন।'],
      ['Maintain at least 75 percent attendance to keep receiving payments.', 'টাকা পেতে থাকতে কমপক্ষে ৭৫ শতাংশ উপস্থিতি বজায় রাখুন।'],
    ],
    docs: [
      { name: ['Student birth registration certificate', 'শিক্ষার্থীর জন্ম নিবন্ধন সনদ'], authority: ['Union Parishad / City Corporation', 'ইউনিয়ন পরিষদ / সিটি কর্পোরেশন'] },
      { name: ["Guardian's National ID card", 'অভিভাবকের জাতীয় পরিচয়পত্র'] },
      { name: ['Mobile financial account number in the guardian\'s name', 'অভিভাবকের নামে মোবাইল আর্থিক হিসাব নম্বর'] },
      { name: ['Family income certificate', 'পারিবারিক আয়ের প্রত্যয়নপত্র'], required: false },
    ],
    rules: rules(
      ['isStudent', 'education', 'monthlyIncome'],
      ALL(
        isBangladeshi(),
        isStudent(3),
        c(
          'education',
          'in',
          ['jsc', 'ssc', 'hsc'],
          ['You are at a secondary or higher-secondary level.', 'আপনি মাধ্যমিক বা উচ্চমাধ্যমিক স্তরে আছেন।'],
          ['This stipend covers classes 6 to 12.', 'এই উপবৃত্তি ষষ্ঠ থেকে দ্বাদশ শ্রেণির জন্য।'],
          { weight: 3, unknown: ['Which class or level are you studying in?', 'আপনি কোন শ্রেণিতে বা স্তরে পড়ছেন?'] },
        ),
        monthlyIncomeBelow(12000, 2),
        c('gender', 'eq', 'female', ['Girls are prioritised in this programme.', 'এই কর্মসূচিতে মেয়েরা অগ্রাধিকার পায়।'], ['Boys are eligible but girls are prioritised.', 'ছেলেরাও যোগ্য, তবে মেয়েরা অগ্রাধিকার পায়।'], { soft: true, weight: 1 }),
      ),
    ),
  },

  {
    slug: 'nst-research-fellowship',
    org: 'most',
    category: 'research',
    title: ['National Science and Technology (NST) Research Fellowship', 'জাতীয় বিজ্ঞান ও প্রযুক্তি (এনএসটি) গবেষণা ফেলোশিপ'],
    summary: [
      'An annual research fellowship for MSc, MPhil, and PhD students in science, engineering, and medical disciplines.',
      'বিজ্ঞান, ইঞ্জিনিয়ারিং ও চিকিৎসা বিষয়ে এমএসসি, এমফিল ও পিএইচডি শিক্ষার্থীদের জন্য বার্ষিক গবেষণা ফেলোশিপ।',
    ],
    description: [
      'The NST fellowship funds thesis research rather than tuition. Applications are made online with a supervisor\'s endorsement and a short research proposal, and are assessed on academic record and the scientific merit of the proposal. Awards are made in tiers by degree level, with PhD candidates receiving the largest amount. You may hold only one government fellowship at a time.',
      'এনএসটি ফেলোশিপ টিউশন নয়, থিসিস গবেষণায় অর্থায়ন করে। সুপারভাইজারের সুপারিশ ও একটি সংক্ষিপ্ত গবেষণা প্রস্তাবসহ অনলাইনে আবেদন করা হয় এবং একাডেমিক রেকর্ড ও প্রস্তাবের বৈজ্ঞানিক মান বিচার করা হয়। ডিগ্রি স্তর অনুযায়ী স্তরভেদে অনুদান দেওয়া হয়, পিএইচডি প্রার্থীরা সবচেয়ে বেশি পান। একই সময়ে একটির বেশি সরকারি ফেলোশিপ রাখা যায় না।',
    ],
    benefits: [
      'A research grant disbursed in instalments across the academic year, plus recognition that strengthens future scholarship applications.',
      'শিক্ষাবর্ষ জুড়ে কয়েক কিস্তিতে গবেষণা অনুদান, সঙ্গে ভবিষ্যতের বৃত্তির আবেদনে সহায়ক স্বীকৃতি।',
    ],
    benefitAmount: 60000,
    benefitPeriod: 'yearly',
    lifeEvents: ['higher_education'],
    tags: ['research', 'fellowship', 'science', 'postgraduate'],
    sourceUrl: 'https://most.gov.bd',
    processingTime: ['90–120 days', '৯০–১২০ দিন'],
    recurrence: 'annual',
    deadlineInDays: 52,
    popularity: 57,
    steps: [
      ['Prepare a two-page research proposal with your thesis supervisor.', 'থিসিস সুপারভাইজারের সঙ্গে দুই পৃষ্ঠার গবেষণা প্রস্তাব তৈরি করুন।'],
      ['Register on the Ministry of Science and Technology online fellowship portal.', 'বিজ্ঞান ও প্রযুক্তি মন্ত্রণালয়ের অনলাইন ফেলোশিপ পোর্টালে নিবন্ধন করুন।'],
      ['Upload your transcripts, the proposal, and the supervisor\'s endorsement letter.', 'ট্রান্সক্রিপ্ট, প্রস্তাব ও সুপারভাইজারের সুপারিশপত্র সংযুক্ত করুন।'],
      ['Submit before the deadline and keep the tracking number.', 'সময়সীমার আগে জমা দিন এবং ট্র্যাকিং নম্বর সংগ্রহে রাখুন।'],
    ],
    docs: [
      { name: ['Research proposal (2 pages)', 'গবেষণা প্রস্তাব (২ পৃষ্ঠা)'] },
      { name: ['Supervisor endorsement letter', 'সুপারভাইজারের সুপারিশপত্র'], authority: ['Thesis supervisor / Department head', 'থিসিস সুপারভাইজার / বিভাগীয় প্রধান'] },
      { name: ['All academic transcripts', 'সব একাডেমিক ট্রান্সক্রিপ্ট'] },
      { name: ['Enrolment certificate for the current degree', 'বর্তমান ডিগ্রির ভর্তি প্রত্যয়নপত্র'] },
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
    ],
    rules: rules(
      ['education', 'isStudent'],
      ALL(
        isBangladeshi(),
        isStudent(2),
        educationAtLeast('bachelor', ['a bachelor degree', 'স্নাতক ডিগ্রি'], 3),
        cgpaAtLeast(3.0, 3),
      ),
    ),
  },

  {
    slug: 'bangabandhu-overseas-fellowship',
    org: 'most',
    category: 'scholarship',
    title: ['Bangabandhu Science and Technology Fellowship (Overseas)', 'বঙ্গবন্ধু বিজ্ঞান ও প্রযুক্তি ফেলোশিপ (বিদেশ)'],
    summary: [
      'Full funding for a master\'s or PhD abroad in science and technology, for high-achieving Bangladeshi graduates.',
      'উচ্চ ফলাফলধারী বাংলাদেশি স্নাতকদের জন্য বিদেশে বিজ্ঞান ও প্রযুক্তিতে মাস্টার্স বা পিএইচডির সম্পূর্ণ অর্থায়ন।',
    ],
    description: [
      'This fellowship covers tuition, a living allowance, airfare, and health insurance for study at a recognised foreign university. Candidates must already hold an admission offer or be able to obtain one, and must sign a bond to return and serve in Bangladesh for a specified period. Selection is highly competitive and weighted heavily on undergraduate results and the ranking of the receiving institution.',
      'এই ফেলোশিপ স্বীকৃত বিদেশি বিশ্ববিদ্যালয়ে পড়ার জন্য টিউশন, জীবনযাত্রা ভাতা, বিমান ভাড়া ও স্বাস্থ্য বিমা বহন করে। প্রার্থীর আগে থেকেই ভর্তির প্রস্তাব থাকতে হবে বা তা সংগ্রহের সামর্থ্য থাকতে হবে, এবং নির্দিষ্ট সময় দেশে ফিরে কাজ করার বন্ড সই করতে হবে। নির্বাচন অত্যন্ত প্রতিযোগিতামূলক এবং স্নাতক ফলাফল ও গ্রহণকারী প্রতিষ্ঠানের র‍্যাঙ্কিংয়ে বেশি গুরুত্ব দেওয়া হয়।',
    ],
    benefits: [
      'Full tuition, monthly living allowance, return airfare, health insurance, and a book allowance.',
      'সম্পূর্ণ টিউশন, মাসিক জীবনযাত্রা ভাতা, যাওয়া-আসার বিমান ভাড়া, স্বাস্থ্য বিমা ও বই ভাতা।',
    ],
    benefitPeriod: 'yearly',
    lifeEvents: ['higher_education'],
    tags: ['scholarship', 'overseas', 'fully-funded', 'competitive'],
    sourceUrl: 'https://most.gov.bd',
    processingTime: ['4–6 months including interview', 'সাক্ষাৎকারসহ ৪–৬ মাস'],
    recurrence: 'annual',
    deadlineInDays: 61,
    popularity: 86,
    steps: [
      ['Secure or apply for admission to a recognised foreign university in a science or technology discipline.', 'বিজ্ঞান বা প্রযুক্তি বিষয়ে স্বীকৃত বিদেশি বিশ্ববিদ্যালয়ে ভর্তি নিশ্চিত করুন বা আবেদন করুন।'],
      ['Take IELTS or TOEFL if your destination requires it.', 'গন্তব্য দেশে প্রয়োজন হলে আইইএলটিএস বা টোফেল দিন।'],
      ['Apply through the ministry circular with transcripts, the admission letter, and a study plan.', 'মন্ত্রণালয়ের বিজ্ঞপ্তি অনুযায়ী ট্রান্সক্রিপ্ট, ভর্তির চিঠি ও অধ্যয়ন পরিকল্পনা দিয়ে আবেদন করুন।'],
      ['Attend the selection interview in Dhaka if shortlisted.', 'সংক্ষিপ্ত তালিকায় থাকলে ঢাকায় নির্বাচনী সাক্ষাৎকারে অংশ নিন।'],
      ['Sign the service bond and complete visa formalities after selection.', 'নির্বাচিত হলে সার্ভিস বন্ড সই করে ভিসার আনুষ্ঠানিকতা সম্পন্ন করুন।'],
    ],
    docs: [
      { name: ['Admission offer letter from the foreign university', 'বিদেশি বিশ্ববিদ্যালয়ের ভর্তির প্রস্তাবপত্র'] },
      { name: ['All academic transcripts and certificates', 'সব একাডেমিক ট্রান্সক্রিপ্ট ও সনদ'] },
      { name: ['IELTS or TOEFL score report', 'আইইএলটিএস বা টোফেল স্কোর রিপোর্ট'], required: false, validityMonths: 24 },
      { name: ['Valid passport', 'বৈধ পাসপোর্ট'], authority: ['Department of Immigration and Passports', 'ইমিগ্রেশন ও পাসপোর্ট অধিদপ্তর'], validityMonths: 24, mistake: ['Applying with a passport that expires within a year — renew first, because visas need longer validity.', 'এক বছরের মধ্যে মেয়াদ শেষ হওয়া পাসপোর্ট দিয়ে আবেদন করা — আগে নবায়ন করুন, ভিসার জন্য দীর্ঘ মেয়াদ দরকার।'] },
      { name: ['Study plan or statement of purpose', 'অধ্যয়ন পরিকল্পনা বা উদ্দেশ্য বিবৃতি'] },
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
    ],
    rules: rules(
      ['education', 'cgpa'],
      ALL(
        isBangladeshi(),
        educationAtLeast('bachelor', ['a bachelor degree', 'স্নাতক ডিগ্রি'], 3),
        cgpaAtLeast(3.5, 4),
        ageBetween(21, 40, 2),
        c(
          'ieltsScore',
          'gte',
          6.5,
          ['Your IELTS score meets the usual requirement.', 'আপনার আইইএলটিএস স্কোর সাধারণ শর্ত পূরণ করেছে।'],
          ['Most destinations expect IELTS 6.5 or above; you can apply while preparing.', 'বেশিরভাগ গন্তব্যে আইইএলটিএস ৬.৫ বা তার বেশি চাওয়া হয়; প্রস্তুতি নেওয়ার সময়েও আবেদন করা যায়।'],
          { soft: true, weight: 2, unknown: ['Have you taken IELTS or TOEFL yet?', 'আপনি কি আইইএলটিএস বা টোফেল দিয়েছেন?'] },
        ),
      ),
      [
        'A service bond requiring return to Bangladesh applies to all recipients.',
        'সব গ্রহীতার ক্ষেত্রে দেশে ফেরার শর্তসহ সার্ভিস বন্ড প্রযোজ্য।',
      ],
    ),
  },

  {
    slug: 'ugc-research-grant',
    org: 'ugc',
    category: 'research',
    title: ['UGC Research Grant for University Teachers and Researchers', 'ইউজিসি গবেষণা অনুদান (বিশ্ববিদ্যালয় শিক্ষক ও গবেষক)'],
    summary: [
      'Annual project grants for research at public and recognised private universities.',
      'সরকারি ও স্বীকৃত বেসরকারি বিশ্ববিদ্যালয়ে গবেষণার জন্য বার্ষিক প্রকল্প অনুদান।',
    ],
    description: [
      'Grants fund equipment, fieldwork, and publication costs for a defined project of up to two years. Applications require an institutional endorsement and a budget breakdown, and reporting is mandatory before a second grant can be awarded. Postgraduate researchers may apply jointly with a supervising faculty member.',
      'অনুদান দুই বছর পর্যন্ত নির্দিষ্ট প্রকল্পের যন্ত্রপাতি, মাঠকর্ম ও প্রকাশনার খরচ বহন করে। আবেদনের জন্য প্রাতিষ্ঠানিক সুপারিশ ও বাজেট বিভাজন প্রয়োজন এবং দ্বিতীয় অনুদান পাওয়ার আগে প্রতিবেদন জমা দেওয়া বাধ্যতামূলক। স্নাতকোত্তর গবেষকরা তত্ত্বাবধায়ক শিক্ষকের সঙ্গে যৌথভাবে আবেদন করতে পারেন।',
    ],
    benefits: [
      'A project grant covering equipment, fieldwork, and publication costs, with the possibility of renewal on satisfactory reporting.',
      'যন্ত্রপাতি, মাঠকর্ম ও প্রকাশনার খরচসহ প্রকল্প অনুদান — সন্তোষজনক প্রতিবেদন দিলে নবায়নের সুযোগ।',
    ],
    benefitAmount: 250000,
    benefitPeriod: 'yearly',
    lifeEvents: ['higher_education'],
    tags: ['research', 'grant', 'university', 'academic'],
    sourceUrl: 'https://ugc.gov.bd',
    processingTime: ['3–5 months', '৩–৫ মাস'],
    recurrence: 'annual',
    deadlineInDays: 83,
    popularity: 41,
    steps: [
      ['Prepare a project proposal with objectives, methodology, and an itemised budget.', 'উদ্দেশ্য, পদ্ধতি ও খাতভিত্তিক বাজেটসহ প্রকল্প প্রস্তাব তৈরি করুন।'],
      ['Obtain endorsement from your department and the university research cell.', 'আপনার বিভাগ ও বিশ্ববিদ্যালয় গবেষণা সেল থেকে সুপারিশ নিন।'],
      ['Submit through the university to UGC before the circular deadline.', 'বিজ্ঞপ্তির সময়সীমার আগে বিশ্ববিদ্যালয়ের মাধ্যমে ইউজিসিতে জমা দিন।'],
    ],
    docs: [
      { name: ['Project proposal with itemised budget', 'খাতভিত্তিক বাজেটসহ প্রকল্প প্রস্তাব'] },
      { name: ['Departmental endorsement', 'বিভাগীয় সুপারিশ'], authority: ['Department head', 'বিভাগীয় প্রধান'] },
      { name: ['Curriculum vitae with publication list', 'প্রকাশনার তালিকাসহ জীবনবৃত্তান্ত'] },
      { name: ['Ethical clearance for human or animal subjects', 'মানব বা প্রাণী বিষয়ক গবেষণার নৈতিক ছাড়পত্র'], required: false },
    ],
    rules: rules(
      ['education', 'university'],
      ALL(
        isBangladeshi(),
        educationAtLeast('master', ['a master degree', 'স্নাতকোত্তর ডিগ্রি'], 3),
        c(
          'university',
          'exists',
          undefined,
          ['You are affiliated with a university.', 'আপনি একটি বিশ্ববিদ্যালয়ের সঙ্গে সংযুক্ত।'],
          ['A university affiliation is required to apply.', 'আবেদনের জন্য বিশ্ববিদ্যালয়ের সঙ্গে সংযুক্তি প্রয়োজন।'],
          { weight: 3 },
        ),
      ),
    ),
  },

  {
    slug: 'jms-women-skills-training',
    org: 'jms',
    category: 'training',
    title: ['Jatiyo Mohila Sangstha Skills Training for Women', 'জাতীয় মহিলা সংস্থার নারী দক্ষতা প্রশিক্ষণ'],
    summary: [
      'Free three- to six-month courses for women in tailoring, IT, beauticianship, food processing, and block-batik.',
      'সেলাই, আইটি, বিউটিশিয়ান, খাদ্য প্রক্রিয়াজাতকরণ ও ব্লক-বাটিকে মহিলাদের জন্য বিনামূল্যে তিন থেকে ছয় মাসের কোর্স।',
    ],
    description: [
      'Courses run at district and upazila training centres and end with a certificate that is recognised for youth and SME loan applications. Many centres provide a small daily transport allowance, and some offer residential places for women travelling from remote unions. Completing a course also makes you eligible to apply for a Department of Youth Development enterprise loan.',
      'জেলা ও উপজেলা প্রশিক্ষণ কেন্দ্রে কোর্স চলে এবং শেষে এমন সনদ দেওয়া হয় যা যুব ও এসএমই ঋণের আবেদনে স্বীকৃত। অনেক কেন্দ্র সামান্য দৈনিক যাতায়াত ভাতা দেয়, আর কিছু কেন্দ্র দূরের ইউনিয়ন থেকে আসা মহিলাদের জন্য আবাসিক সুবিধা রাখে। কোর্স শেষ করলে যুব উন্নয়ন অধিদপ্তরের উদ্যোগ ঋণের জন্যও আবেদনের যোগ্যতা তৈরি হয়।',
    ],
    benefits: [
      'Free training, a recognised certificate, a daily transport allowance at many centres, and eligibility for a follow-on enterprise loan.',
      'বিনামূল্যে প্রশিক্ষণ, স্বীকৃত সনদ, অনেক কেন্দ্রে দৈনিক যাতায়াত ভাতা এবং পরবর্তীতে উদ্যোগ ঋণের যোগ্যতা।',
    ],
    benefitPeriod: 'per_course',
    lifeEvents: ['seeking_employment', 'job_loss', 'widowhood', 'entrepreneurship'],
    tags: ['training', 'women', 'skills', 'free'],
    sourceUrl: 'https://jms.gov.bd',
    processingTime: ['Batches start every 3–4 months', 'প্রতি ৩–৪ মাসে নতুন ব্যাচ শুরু'],
    recurrence: 'quarterly',
    deadlineInDays: 26,
    popularity: 69,
    steps: [
      ['Visit your district Jatiyo Mohila Sangstha office and ask which courses have places in the next batch.', 'জেলা জাতীয় মহিলা সংস্থার অফিসে গিয়ে পরবর্তী ব্যাচে কোন কোর্সে আসন আছে জেনে নিন।'],
      ['Complete the enrolment form and submit your National ID and two photographs.', 'ভর্তি ফরম পূরণ করে জাতীয় পরিচয়পত্র ও দুই কপি ছবি জমা দিন।'],
      ['Attend the orientation day to confirm your place.', 'আসন নিশ্চিত করতে ওরিয়েন্টেশনের দিন উপস্থিত থাকুন।'],
      ['Collect your certificate at the end and ask about the linked enterprise loan.', 'শেষে সনদ সংগ্রহ করুন এবং সংযুক্ত উদ্যোগ ঋণ সম্পর্কে জেনে নিন।'],
    ],
    docs: [
      { name: ['National ID card', 'জাতীয় পরিচয়পত্র'] },
      { name: ['Two passport-size photographs', 'দুই কপি পাসপোর্ট সাইজের ছবি'] },
      { name: ['Educational certificate, if you have one', 'শিক্ষাগত সনদ, থাকলে'], required: false, tip: ['Most courses have no minimum education requirement, so apply even without certificates.', 'বেশিরভাগ কোর্সে ন্যূনতম শিক্ষার শর্ত নেই, তাই সনদ না থাকলেও আবেদন করুন।'] },
    ],
    rules: rules(
      ['gender', 'age'],
      ALL(isBangladeshi(), isFemale(), ageBetween(16, 45, 2)),
    ),
  },

  {
    slug: 'ahsania-adult-literacy',
    org: 'ahsania',
    category: 'training',
    title: ['Dhaka Ahsania Mission Adult Literacy and Second-Chance Education', 'ঢাকা আহ্‌ছানিয়া মিশন বয়স্ক শিক্ষা ও দ্বিতীয় সুযোগ শিক্ষা'],
    summary: [
      'Free literacy and numeracy classes for adults who never attended or left school early.',
      'যাঁরা কখনো স্কুলে যাননি বা আগেই ছেড়ে দিয়েছেন — তাঁদের জন্য বিনামূল্যে পড়া, লেখা ও হিসাবের ক্লাস।',
    ],
    description: [
      'Classes run in community centres at times that fit around work, usually early morning or evening, and there is no examination pressure. The programme also offers a bridge course that allows adults to sit the class five equivalency examination, which opens the door to further training and to jobs that require basic certification.',
      'কমিউনিটি সেন্টারে কাজের সময়ের সঙ্গে মিলিয়ে — সাধারণত ভোরে বা সন্ধ্যায় — ক্লাস চলে এবং পরীক্ষার কোনো চাপ নেই। কর্মসূচিতে একটি ব্রিজ কোর্সও আছে যার মাধ্যমে বয়স্করা পঞ্চম শ্রেণির সমমান পরীক্ষা দিতে পারেন, যা আরও প্রশিক্ষণ ও প্রাথমিক সনদ প্রয়োজন হয় এমন কাজের সুযোগ খুলে দেয়।',
    ],
    benefits: [
      'Free classes, free learning materials, and an optional class five equivalency certificate.',
      'বিনামূল্যে ক্লাস, বিনামূল্যে শিক্ষা উপকরণ এবং ইচ্ছা করলে পঞ্চম শ্রেণির সমমান সনদ।',
    ],
    benefitPeriod: 'per_course',
    lifeEvents: ['seeking_employment', 'job_loss'],
    tags: ['ngo', 'literacy', 'adult-education', 'free'],
    sourceUrl: 'https://ahsaniamission.org.bd',
    processingTime: ['Join an open batch at any time', 'যেকোনো সময় চালু ব্যাচে যোগ দেওয়া যায়'],
    recurrence: 'continuous',
    popularity: 38,
    steps: [
      ['Call the Dhaka Ahsania Mission office or visit a community learning centre in your area.', 'ঢাকা আহ্‌ছানিয়া মিশনের অফিসে ফোন করুন বা আপনার এলাকার কমিউনিটি লার্নিং সেন্টারে যান।'],
      ['Join an open batch — no entrance test and no certificate needed to start.', 'চালু ব্যাচে যোগ দিন — শুরু করতে কোনো ভর্তি পরীক্ষা বা সনদ লাগে না।'],
      ['Attend regularly and decide later whether you want to sit the equivalency examination.', 'নিয়মিত ক্লাস করুন এবং পরে ঠিক করুন সমমান পরীক্ষা দেবেন কি না।'],
    ],
    docs: [
      { name: ['National ID card, if you have one', 'জাতীয় পরিচয়পত্র, থাকলে'], required: false, tip: ['You can start classes without any documents. Identification is only needed for the equivalency examination.', 'কোনো কাগজ ছাড়াই ক্লাস শুরু করতে পারেন। শুধু সমমান পরীক্ষার জন্য পরিচয়পত্র দরকার।'] },
    ],
    rules: rules(
      ['age'],
      ALL(
        c('age', 'gte', 15, ['You are old enough for the adult programme.', 'বয়স্ক শিক্ষা কর্মসূচির জন্য আপনার বয়স যথেষ্ট।'], ['This programme is for learners aged 15 and above.', 'এই কর্মসূচি ১৫ বছর ও তার বেশি বয়সীদের জন্য।'], { weight: 2, unknown: ['How old are you?', 'আপনার বয়স কত?'] }),
        ANY(
          c('education', 'in', ['none', 'primary'], ['Your education level matches this programme.', 'আপনার শিক্ষাস্তর এই কর্মসূচির সঙ্গে মেলে।'], ['This programme is for adults with little or no formal schooling.', 'এই কর্মসূচি প্রাতিষ্ঠানিক শিক্ষা কম বা নেই — এমন বয়স্কদের জন্য।'], { weight: 2 }),
          c('education', 'not_exists', undefined, ['You have not recorded a schooling level, which is fine here.', 'আপনি শিক্ষাস্তর লেখেননি, এখানে তাতে অসুবিধা নেই।'], ['—', '—'], { soft: true }),
        ),
      ),
    ),
  },
];
