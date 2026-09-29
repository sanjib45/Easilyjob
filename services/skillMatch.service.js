/**
 * Intelligent Skill Matching & Profile Score Engine
 * Provides semantic skill tokenization, alias normalization, and multi-factor match score computation.
 */

// Comprehensive Synonym and Alias Mapping for Technical & Non-Technical Skills
const SKILL_ALIASES = {
  // JavaScript & Frontend
  "react": "react",
  "react.js": "react",
  "reactjs": "react",
  "react native": "react native",
  "reactnative": "react native",
  "vue": "vue",
  "vue.js": "vue",
  "vuejs": "vue",
  "angular": "angular",
  "angularjs": "angular",
  "angular.js": "angular",
  "next.js": "nextjs",
  "nextjs": "nextjs",
  "svelte": "svelte",
  "javascript": "javascript",
  "js": "javascript",
  "es6": "javascript",
  "ecmascript": "javascript",
  "typescript": "typescript",
  "ts": "typescript",
  "html": "html",
  "html5": "html",
  "css": "css",
  "css3": "css",
  "sass": "sass",
  "scss": "sass",
  "tailwind": "tailwindcss",
  "tailwindcss": "tailwindcss",
  "bootstrap": "bootstrap",

  // Backend & Runtime
  "node": "nodejs",
  "node.js": "nodejs",
  "nodejs": "nodejs",
  "express": "express",
  "express.js": "express",
  "expressjs": "express",
  "nest": "nestjs",
  "nestjs": "nestjs",
  "nest.js": "nestjs",
  "python": "python",
  "django": "django",
  "flask": "flask",
  "fastapi": "fastapi",
  "java": "java",
  "spring": "spring",
  "springboot": "spring boot",
  "spring boot": "spring boot",
  "c#": "csharp",
  "csharp": "csharp",
  "dotnet": ".net",
  ".net": ".net",
  "c++": "cpp",
  "cpp": "cpp",
  "golang": "go",
  "go": "go",
  "php": "php",
  "laravel": "laravel",
  "ruby": "ruby",
  "rails": "ruby on rails",
  "ruby on rails": "ruby on rails",

  // Databases & Caching
  "mongodb": "mongodb",
  "mongo": "mongodb",
  "mongoose": "mongodb",
  "postgresql": "postgresql",
  "postgres": "postgresql",
  "pg": "postgresql",
  "mysql": "mysql",
  "sql": "sql",
  "sqlite": "sqlite",
  "redis": "redis",
  "prisma": "prisma",

  // Cloud & DevOps
  "aws": "aws",
  "amazon web services": "aws",
  "azure": "azure",
  "gcp": "gcp",
  "google cloud": "gcp",
  "docker": "docker",
  "kubernetes": "kubernetes",
  "k8s": "kubernetes",
  "ci/cd": "cicd",
  "cicd": "cicd",
  "git": "git",
  "github": "github",
  "gitlab": "gitlab",
  "graphql": "graphql",
  "rest": "rest api",
  "rest api": "rest api",
  "restful api": "rest api",
  "microservices": "microservices"
};

/**
 * Normalizes a raw skill string for fuzzy/alias matching.
 * @param {string} raw 
 * @returns {string} Normalized canon key
 */
export function normalizeSkill(raw) {
  if (!raw || typeof raw !== "string") return "";
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9+#.\- ]/g, "");
  return SKILL_ALIASES[cleaned] || cleaned;
}

/**
 * Parses skill list from multiple formats (array, comma-separated, JSON).
 * @param {string|string[]} input 
 * @returns {string[]}
 */
export function parseSkillsList(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(s => String(s).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(s => String(s).trim()).filter(Boolean);
      } catch {
        // Fallback to comma separation
      }
    }
    return trimmed.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Calculates real-time skill & profile match score for a candidate against a job requirement.
 * 
 * @param {Object} params
 * @param {string|string[]} params.candidateSkills Candidate skills
 * @param {string|string[]} params.jobSkills Job required skills
 * @param {number} [params.candidateExp] Years of experience
 * @param {string} [params.candidateLocation]
 * @param {string} [params.jobLocation]
 * @returns {Object} Match Result Breakdown
 */
export function calculateSkillMatch({
  candidateSkills = [],
  jobSkills = [],
  candidateExp = null,
  candidateLocation = "",
  jobLocation = ""
} = {}) {
  const parsedCandidateSkills = parseSkillsList(candidateSkills);
  const parsedJobSkills = parseSkillsList(jobSkills);

  if (parsedJobSkills.length === 0) {
    return {
      score: 100,
      matchedSkills: parsedCandidateSkills,
      missingSkills: [],
      matchedCount: parsedCandidateSkills.length,
      requiredCount: 0,
      tier: "EXCELLENT",
      tierLabel: "100% Match",
      tierColor: "#10b981",
      recommendation: "Open requirements — your profile matches this role perfectly."
    };
  }

  // Normalized maps
  const candidateMap = new Map();
  parsedCandidateSkills.forEach(skill => {
    candidateMap.set(normalizeSkill(skill), skill);
  });

  const matchedSkills = [];
  const missingSkills = [];

  parsedJobSkills.forEach(reqSkill => {
    const norm = normalizeSkill(reqSkill);
    if (candidateMap.has(norm)) {
      matchedSkills.push(reqSkill);
    } else {
      // Substring fuzzy check
      let fuzzyFound = false;
      for (const [cNorm, cOriginal] of candidateMap.entries()) {
        if (cNorm && norm && (cNorm.includes(norm) || norm.includes(cNorm))) {
          matchedSkills.push(reqSkill);
          fuzzyFound = true;
          break;
        }
      }
      if (!fuzzyFound) {
        missingSkills.push(reqSkill);
      }
    }
  });

  // Base skill match weight: 75%
  const skillRatio = parsedJobSkills.length > 0 ? (matchedSkills.length / parsedJobSkills.length) : 1;
  let rawScore = skillRatio * 85;

  // Bonus for candidate having rich skillset
  if (parsedCandidateSkills.length >= 5 && matchedSkills.length > 0) {
    rawScore += 10;
  } else if (parsedCandidateSkills.length >= 3 && matchedSkills.length > 0) {
    rawScore += 5;
  }

  // Cap score between 0 and 100
  let finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // If candidate has 0 matching skills and there are required skills, score should be low
  if (matchedSkills.length === 0 && parsedJobSkills.length > 0) {
    finalScore = Math.min(15, finalScore);
  }

  // If all skills match, guaranteed 100%
  if (matchedSkills.length === parsedJobSkills.length && parsedJobSkills.length > 0) {
    finalScore = 100;
  }

  let tier = "LOW";
  let tierLabel = `${finalScore}% Match`;
  let tierColor = "#64748b";
  let recommendation = "Add more matching technical skills to increase your shortlist chances.";

  if (finalScore >= 80) {
    tier = "EXCELLENT";
    tierColor = "#10b981"; // Emerald
    recommendation = `🔥 Excellent Match! You meet ${matchedSkills.length} of ${parsedJobSkills.length} required skills. High chance of shortlist.`;
  } else if (finalScore >= 60) {
    tier = "GOOD";
    tierColor = "#0e74d6"; // Azure
    recommendation = `⚡ Strong Fit! You match ${matchedSkills.length} of ${parsedJobSkills.length} key skills for this position.`;
  } else if (finalScore >= 40) {
    tier = "FAIR";
    tierColor = "#f59e0b"; // Amber
    recommendation = `⚖️ Moderate Match. Consider reviewing missing skills (${missingSkills.slice(0, 2).join(", ")}) before applying.`;
  }

  return {
    score: finalScore,
    matchedSkills,
    missingSkills,
    matchedCount: matchedSkills.length,
    requiredCount: parsedJobSkills.length,
    tier,
    tierLabel,
    tierColor,
    recommendation,
    candidateSkills: parsedCandidateSkills,
    jobSkills: parsedJobSkills
  };
}

/**
 * Computes Profile Completeness Percentage and milestone checklist.
 * @param {Object} user 
 * @returns {Object} { percentage, completedMilestones, pendingMilestones, skillsList }
 */
export function calculateProfileCompleteness(user = {}) {
  let score = 0;
  const completed = [];
  const pending = [];

  // 1. Basic Info (Name & Email) — 20%
  if (user.name && user.email) {
    score += 20;
    completed.push("Personal details & contact info");
  } else {
    pending.push("Complete basic contact information (+20%)");
  }

  // 2. Headline & Bio — 20%
  if (user.headline && user.headline.trim()) {
    score += 10;
    completed.push("Professional headline");
  } else {
    pending.push("Add a professional headline (+10%)");
  }

  if (user.bio && user.bio.trim()) {
    score += 10;
    completed.push("Career summary / bio");
  } else {
    pending.push("Add a brief career summary (+10%)");
  }

  // 3. Key Skills — 25%
  const skills = parseSkillsList(user.skills);
  if (skills.length >= 3) {
    score += 25;
    completed.push(`Key Skills (${skills.length} skills added)`);
  } else if (skills.length > 0) {
    score += 15;
    completed.push(`Key Skills (${skills.length} skills added)`);
    pending.push("Add at least 3 core technical skills (+10%)");
  } else {
    pending.push("Add your key technical skills (+25%)");
  }

  // 4. Experience & Education — 20%
  if (user.experienceYears !== null && user.experienceYears !== undefined && user.experienceYears !== "") {
    score += 10;
    completed.push("Total work experience");
  } else {
    pending.push("Specify your total work experience (+10%)");
  }

  if (user.education && user.education.trim()) {
    score += 10;
    completed.push("Education & highest qualification");
  } else {
    pending.push("Add your highest qualification (+10%)");
  }

  // 5. Preferences & Location — 15%
  if (user.location && user.location.trim()) {
    score += 10;
    completed.push("Preferred location");
  } else {
    pending.push("Specify your city / preferred location (+10%)");
  }

  if (user.phone && user.phone.trim()) {
    score += 5;
    completed.push("Phone number");
  } else {
    pending.push("Add your contact phone number (+5%)");
  }

  return {
    percentage: Math.min(100, score),
    completedMilestones: completed,
    pendingMilestones: pending,
    skillsList: skills
  };
}
