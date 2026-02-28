// AI Content Moderator — reframes negative college/faculty speech positively

const INSTITUTION_KEYWORDS = [
  "college", "university", "institute", "institution", "campus", "department",
  "faculty", "teacher", "professor", "sir", "maam", "ma'am", "madam",
  "hod", "head of department", "dean", "principal", "director",
  "lecturer", "mentor", "instructor", "staff", "administration", "admin",
  "management", "placement", "placement cell", "coordinator",
];

const NEGATIVE_INDICATORS = [
  "worst", "terrible", "horrible", "bad", "poor", "useless", "pathetic",
  "incompetent", "lazy", "careless", "rude", "unfair", "biased",
  "corrupt", "fraud", "waste", "scam", "trash", "garbage", "stupid",
  "dumb", "idiot", "hate", "sucks", "awful", "disgusting", "annoying",
  "irritating", "boring", "outdated", "backward", "hopeless", "joke",
  "doesn't care", "don't care", "never helps", "no support", "toxic",
  "unprofessional", "doesn't teach", "can't teach", "won't help",
  "not helpful", "never available", "always absent", "no knowledge",
  "doesn't know", "favoritism", "partial", "negligent", "fails everyone",
  // Hindi / Hinglish negative
  "bakwas", "bekar", "ghatiya", "faltu", "kharab", "wahiyat",
  "nikamma", "kamchor", "bevakoof", "chutiya", "gadha", "ullu",
  "harami", "kameena", "saala", "sala", "saale", "bhosdike",
  "bhosdi", "madarchod", "behen", "behenchod", "mc", "bc",
  "lodu", "laude", "lavde", "gaandu", "gaand", "chodu",
  "randi", "kutti", "kutiya", "haram", "haramkhor",
  // English cuss words
  "fuck", "fucking", "fucker", "shit", "shitty", "bullshit",
  "ass", "asshole", "bitch", "bastard", "damn", "crap", "crappy",
  "dick", "dumbass", "moron", "imbecile", "jackass", "piss",
  "douche", "douchebag", "wanker", "twat", "bloody", "wtf",
  "stfu", "lmao", "pos",
];

// Cuss words that trigger moderation even WITHOUT institution keywords
const STANDALONE_CUSS_WORDS = [
  "chutiya", "madarchod", "behenchod", "bhosdike", "bhosdi",
  "mc", "bc", "lodu", "laude", "lavde", "gaandu", "gaand",
  "chodu", "randi", "kutti", "kutiya", "haramkhor",
  "fuck", "fucking", "fucker", "shit", "bullshit",
  "asshole", "bitch", "bastard", "dumbass", "dickhead",
  "douche", "douchebag", "wanker", "twat", "stfu", "wtf",
];

const POSITIVE_REFRAMES: Record<string, string[]> = {
  teaching: [
    "has a unique teaching approach that could benefit from modern methods",
    "brings traditional expertise that can be complemented with newer techniques",
    "has deep subject knowledge and could explore more interactive teaching styles",
  ],
  availability: [
    "has a busy schedule managing multiple responsibilities",
    "is dedicated to various institutional duties alongside teaching",
    "balances many commitments and would appreciate scheduled consultations",
  ],
  attitude: [
    "maintains high standards and expectations for students",
    "has a structured approach that encourages self-reliance",
    "values discipline and could benefit from more open communication channels",
  ],
  general: [
    "is part of a system that is continuously evolving and improving",
    "contributes to the institution's journey of growth",
    "represents an area where constructive feedback can drive positive change",
    "is working within a framework that benefits from alumni input and suggestions",
  ],
  placement: [
    "is working to build industry connections and improve opportunities",
    "has potential for growth with alumni network support",
    "would benefit greatly from active alumni engagement and mentorship",
  ],
  institution: [
    "has a strong foundation and is on a path of continuous improvement",
    "offers experiences that build resilience and adaptability in students",
    "provides a platform that alumni can help strengthen through engagement",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function categorizeContext(text: string): keyof typeof POSITIVE_REFRAMES {
  const lower = text.toLowerCase();
  if (/teach|class|lecture|syllabus|subject|curriculum|exam|marks|grade/i.test(lower)) return "teaching";
  if (/available|absent|time|schedule|meet|office|response|reply/i.test(lower)) return "availability";
  if (/rude|attitude|behavior|talk|treat|respect|partial|bias|favor/i.test(lower)) return "attitude";
  if (/placement|job|recruit|hire|company|package|offer/i.test(lower)) return "placement";
  if (/college|university|campus|institute|infrastructure|lab|library|hostel/i.test(lower)) return "institution";
  return "general";
}

export interface ModerationResult {
  isNegativeInstitutional: boolean;
  originalText: string;
  moderatedText: string;
  moderationNote: string;
}

export function moderateContent(text: string): ModerationResult {
  const lower = text.toLowerCase();

  // Check for standalone cuss words (even without institution mention)
  const hasCuss = STANDALONE_CUSS_WORDS.some((w) => {
    const regex = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    return regex.test(lower);
  });

  // Check if the text mentions any institution-related keyword
  const mentionsInstitution = INSTITUTION_KEYWORDS.some((kw) =>
    lower.includes(kw.toLowerCase())
  );

  // Check for negative sentiment
  const hasNegative = NEGATIVE_INDICATORS.some((neg) =>
    lower.includes(neg.toLowerCase())
  );

  // Case 1: Cuss word + institution → reframe positively
  // Case 2: Cuss word alone → clean up language
  // Case 3: Negative + institution → reframe positively
  if (!hasCuss && !(mentionsInstitution && hasNegative)) {
    return {
      isNegativeInstitutional: false,
      originalText: text,
      moderatedText: text,
      moderationNote: "",
    };
  }

  if (hasCuss && !mentionsInstitution) {
    // Standalone cuss — clean it and respond politely
    return {
      isNegativeInstitutional: true,
      originalText: text,
      moderatedText: "I'd like to express my thoughts more constructively.",
      moderationNote:
        "Let's keep the conversation respectful and professional. I'm here to help — could you rephrase what you'd like to do?",
    };
  }

  // Content is negative about institution/faculty — reframe positively
  const category = categorizeContext(text);
  const reframe = pickRandom(POSITIVE_REFRAMES[category]);

  // Extract the subject being discussed
  let subject = "The institution";
  for (const kw of INSTITUTION_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      subject =
        kw.charAt(0).toUpperCase() + kw.slice(1) === "Hod"
          ? "The HOD"
          : `The ${kw}`;
      break;
    }
  }

  const moderatedText = `${subject} ${reframe}.`;

  return {
    isNegativeInstitutional: true,
    originalText: text,
    moderatedText,
    moderationNote:
      "Your feedback has been noted. We've presented it constructively to encourage positive dialogue within the alumni community.",
  };
}

/**
 * Moderate a post's content — replaces negative institutional references
 * with positive reframing while preserving non-negative parts.
 */
export function moderatePost(content: string): {
  moderated: boolean;
  content: string;
  note: string;
} {
  const result = moderateContent(content);
  if (!result.isNegativeInstitutional) {
    return { moderated: false, content, note: "" };
  }

  return {
    moderated: true,
    content: result.moderatedText,
    note: result.moderationNote,
  };
}
