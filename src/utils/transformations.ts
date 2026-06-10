import {
  Candidate,
  CandidateSelectionReport,
  CandidateStatus,
  RankedCandidate,
  SelectionProcess,
  SeniorityLevel,
  SkillCount,
  Vacancy,
  EnglishLevel,
} from "../types/models";

const SENIORITY_ORDER: SeniorityLevel[] = [
  "Junior",
  "Semi-Senior",
  "Senior",
  "Lead",
  "Executive",
];

const ENGLISH_ORDER: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];

const CANDIDATE_STATUSES: CandidateStatus[] = ["Active", "In process", "Hired", "Inactive"];

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function hasAllRequiredSkills(candidate: Candidate, vacancy: Vacancy): boolean {
  const candidateSkills = new Set(candidate.skills.map((skill) => skill.trim().toLowerCase()));
  return vacancy.requiredSkills
    .map((skill) => skill.trim().toLowerCase())
    .every((requiredSkill) => candidateSkills.has(requiredSkill));
}

function countMatchedRequiredSkills(candidate: Candidate, vacancy: Vacancy): number {
  const candidateSkills = new Set(candidate.skills.map((skill) => skill.trim().toLowerCase()));

  return vacancy.requiredSkills
    .map((skill) => skill.trim().toLowerCase())
    .reduce((total, requiredSkill) => (candidateSkills.has(requiredSkill) ? total + 1 : total), 0);
}

function calculateSkillsScore(candidate: Candidate, vacancy: Vacancy): number {
  const requiredCount = vacancy.requiredSkills.length;

  if (requiredCount === 0) {
    return 0;
  }

  let score = 0;
  const matchedRequiredSkills = countMatchedRequiredSkills(candidate, vacancy);

  if (matchedRequiredSkills === requiredCount) {
    score += 40;
  } else if (matchedRequiredSkills / requiredCount >= 0.5) {
    score += 20;
  }

  const candidateSkills = new Set(candidate.skills.map((skill) => skill.trim().toLowerCase()));
  const preferredMatches = vacancy.preferredSkills
    .map((skill) => skill.trim().toLowerCase())
    .reduce((total, preferredSkill) => (candidateSkills.has(preferredSkill) ? total + 1 : total), 0);

  score += Math.min(preferredMatches * 10, 20);

  return score;
}

function calculateExperienceScore(candidate: Candidate, vacancy: Vacancy): number {
  const { yearsOfExperience } = candidate;

  if (yearsOfExperience >= vacancy.minYearsExperience && yearsOfExperience <= vacancy.maxYearsExperience) {
    return 20;
  }

  const distanceToRange = Math.min(
    Math.abs(yearsOfExperience - vacancy.minYearsExperience),
    Math.abs(yearsOfExperience - vacancy.maxYearsExperience)
  );

  return distanceToRange >= 1 && distanceToRange <= 2 ? 10 : 0;
}

function calculateSeniorityScore(candidate: Candidate, vacancy: Vacancy): number {
  const candidateLevelIndex = SENIORITY_ORDER.indexOf(candidate.seniority);
  const vacancyLevelIndex = SENIORITY_ORDER.indexOf(vacancy.requiredSeniority);

  if (candidateLevelIndex === vacancyLevelIndex) {
    return 15;
  }

  return Math.abs(candidateLevelIndex - vacancyLevelIndex) === 1 ? 7 : 0;
}

function calculateEnglishScore(candidate: Candidate, vacancy: Vacancy): number {
  const candidateLevelIndex = ENGLISH_ORDER.indexOf(candidate.englishLevel);
  const vacancyLevelIndex = ENGLISH_ORDER.indexOf(vacancy.requiredEnglishLevel);

  return candidateLevelIndex >= vacancyLevelIndex ? 15 : 0;
}

function calculateSalaryScore(candidate: Candidate, vacancy: Vacancy): number {
  if (
    candidate.expectedSalary >= vacancy.salaryRangeMin &&
    candidate.expectedSalary <= vacancy.salaryRangeMax
  ) {
    return 10;
  }

  const maxAllowedWithFlex = vacancy.salaryRangeMax * 1.2;

  if (candidate.expectedSalary > vacancy.salaryRangeMax && candidate.expectedSalary <= maxAllowedWithFlex) {
    return 5;
  }

  return 0;
}

export function calculateCandidateScore(candidate: Candidate, vacancy: Vacancy): number {
  const skillsScore = calculateSkillsScore(candidate, vacancy);
  const experienceScore = calculateExperienceScore(candidate, vacancy);
  const seniorityScore = calculateSeniorityScore(candidate, vacancy);
  const englishScore = calculateEnglishScore(candidate, vacancy);
  const salaryScore = calculateSalaryScore(candidate, vacancy);

  const totalScore = skillsScore + experienceScore + seniorityScore + englishScore + salaryScore;
  return Math.max(0, Math.min(100, totalScore));
}

export function rankCandidatesForVacancy(candidates: Candidate[], vacancy: Vacancy): RankedCandidate[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: calculateCandidateScore(candidate, vacancy),
    }))
    .sort((left, right) => right.score - left.score);
}

export function groupCandidatesBySeniority(
  candidates: Candidate[]
): Record<SeniorityLevel, Candidate[]> {
  const initialGroups: Record<SeniorityLevel, Candidate[]> = {
    Junior: [],
    "Semi-Senior": [],
    Senior: [],
    Lead: [],
    Executive: [],
  };

  return candidates.reduce((groups, candidate) => {
    groups[candidate.seniority].push(candidate);
    return groups;
  }, initialGroups);
}

export function countCandidatesByStatus(candidates: Candidate[]): Record<CandidateStatus, number> {
  const initialCount: Record<CandidateStatus, number> = {
    Active: 0,
    "In process": 0,
    Hired: 0,
    Inactive: 0,
  };

  return candidates.reduce((counts, candidate) => {
    counts[candidate.status] += 1;
    return counts;
  }, initialCount);
}

export function calculateAverageSalary(candidates: Candidate[]): number {
  if (candidates.length === 0) {
    return 0;
  }

  const totalExpectedSalary = calculateTotalExpectedSalary(candidates);

  return roundToTwoDecimals(totalExpectedSalary / candidates.length);
}

export function calculateTotalExpectedSalary(candidates: Candidate[]): number {
  return roundToTwoDecimals(
    candidates.reduce((total, candidate) => total + candidate.expectedSalary, 0)
  );
}

export function findMaxExpectedSalary(candidates: Candidate[]): number {
  if (candidates.length === 0) {
    return 0;
  }

  return candidates.reduce(
    (maxSalary, candidate) => Math.max(maxSalary, candidate.expectedSalary),
    Number.NEGATIVE_INFINITY
  );
}

export function findMinExpectedSalary(candidates: Candidate[]): number {
  if (candidates.length === 0) {
    return 0;
  }

  return candidates.reduce(
    (minSalary, candidate) => Math.min(minSalary, candidate.expectedSalary),
    Number.POSITIVE_INFINITY
  );
}

export function findTopSkills(candidates: Candidate[], topN: number): SkillCount[] {
  if (topN <= 0 || candidates.length === 0) {
    return [];
  }

  const counters = candidates.reduce<Map<string, { label: string; count: number }>>((map, candidate) => {
    const uniqueCandidateSkills = new Set(candidate.skills.map((skill) => skill.trim()));

    uniqueCandidateSkills.forEach((skill) => {
      const normalizedSkill = skill.toLowerCase();
      const current = map.get(normalizedSkill);

      if (current) {
        current.count += 1;
      } else {
        map.set(normalizedSkill, { label: skill, count: 1 });
      }
    });

    return map;
  }, new Map());

  return [...counters.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, topN)
    .map((item) => ({
      skill: item.label,
      count: item.count,
    }));
}

export function calculateVacancyFillRate(processes: SelectionProcess[]): number {
  if (processes.length === 0) {
    return 0;
  }

  const hiredCount = processes.filter((process) => process.stage === "Hired").length;
  return roundToTwoDecimals((hiredCount / processes.length) * 100);
}

export function generateCandidateSelectionReport(
  candidates: Candidate[],
  processes: SelectionProcess[],
  topSkillsLimit = 5
): CandidateSelectionReport {
  const statusBreakdown = countCandidatesByStatus(candidates);

  return {
    totalCandidates: candidates.length,
    totalExpectedSalary: calculateTotalExpectedSalary(candidates),
    averageExpectedSalary: calculateAverageSalary(candidates),
    maxExpectedSalary: findMaxExpectedSalary(candidates),
    minExpectedSalary: findMinExpectedSalary(candidates),
    topSkills: findTopSkills(candidates, topSkillsLimit),
    statusBreakdown,
    fillRate: calculateVacancyFillRate(processes),
  };
}

export function candidatesWithFullRequiredSkills(candidates: Candidate[], vacancy: Vacancy): Candidate[] {
  return candidates.filter((candidate) => hasAllRequiredSkills(candidate, vacancy));
}

export function countCandidatesBySeniority(candidates: Candidate[]): Record<SeniorityLevel, number> {
  return candidates.reduce(
    (counts, candidate) => {
      counts[candidate.seniority] += 1;
      return counts;
    },
    {
      Junior: 0,
      "Semi-Senior": 0,
      Senior: 0,
      Lead: 0,
      Executive: 0,
    }
  );
}

export function statusCoverage(candidates: Candidate[]): number {
  const statusesInUse = new Set(candidates.map((candidate) => candidate.status));
  return roundToTwoDecimals((statusesInUse.size / CANDIDATE_STATUSES.length) * 100);
}
