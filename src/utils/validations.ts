import {
  AvailabilityStatus,
  Candidate,
  CandidateStatus,
  EnglishLevel,
  ProcessStage,
  SelectionProcess,
  SeniorityLevel,
  Vacancy,
  VacancyStatus,
  ValidationResult,
} from "../types/models";

const ENGLISH_LEVELS: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];
const SENIORITY_LEVELS: SeniorityLevel[] = [
  "Junior",
  "Semi-Senior",
  "Senior",
  "Lead",
  "Executive",
];
const AVAILABILITY_STATUSES: AvailabilityStatus[] = [
  "Immediate",
  "2 weeks",
  "1 month",
  "Not available",
];
const CANDIDATE_STATUSES: CandidateStatus[] = ["Active", "In process", "Hired", "Inactive"];
const VACANCY_STATUSES: VacancyStatus[] = ["Open", "In progress", "Closed", "On hold"];
const PROCESS_STAGES: ProcessStage[] = [
  "Screening",
  "Interview",
  "Technical test",
  "Final interview",
  "Offer",
  "Rejected",
  "Hired",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pushErrorIf(condition: boolean, errors: string[], message: string): void {
  if (condition) {
    errors.push(message);
  }
}

export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") {
    return false;
  }

  const value = email.trim();
  const atIndex = value.indexOf("@");
  const dotIndex = value.lastIndexOf(".");

  return (
    atIndex > 0 &&
    atIndex === value.lastIndexOf("@") &&
    !/\s/.test(value) &&
    dotIndex > atIndex + 1 &&
    dotIndex < value.length - 1
  );
}

export function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function validateCandidate(candidate: Candidate): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(candidate)) {
    return { valid: false, errors: ["Candidate must be an object."] };
  }

  pushErrorIf(!isNonEmptyText(candidate.id), errors, "Candidate id is required.");
  pushErrorIf(!isNonEmptyText(candidate.fullName), errors, "Candidate fullName is required.");
  pushErrorIf(!isValidEmail(candidate.email), errors, "Candidate email is invalid.");
  pushErrorIf(!isNonEmptyText(candidate.phone), errors, "Candidate phone must not be empty.");
  pushErrorIf(
    !isFiniteNumber(candidate.yearsOfExperience) ||
      candidate.yearsOfExperience < 0 ||
      candidate.yearsOfExperience > 50,
    errors,
    "Candidate yearsOfExperience must be a finite number between 0 and 50."
  );
  pushErrorIf(
    !isFiniteNumber(candidate.currentSalary) || candidate.currentSalary <= 0,
    errors,
    "Candidate currentSalary must be a finite number greater than 0."
  );
  pushErrorIf(
    !isFiniteNumber(candidate.expectedSalary) || candidate.expectedSalary <= 0,
    errors,
    "Candidate expectedSalary must be a finite number greater than 0."
  );
  if (!Array.isArray(candidate.skills)) {
    errors.push("Candidate skills must be an array.");
  } else {
    pushErrorIf(candidate.skills.length < 1, errors, "Candidate must have at least one skill.");
    pushErrorIf(
      !candidate.skills.every((skill: unknown) => isNonEmptyText(skill)),
      errors,
      "Candidate skills must be non-empty text values."
    );
  }
  pushErrorIf(!ENGLISH_LEVELS.includes(candidate.englishLevel), errors, "Candidate englishLevel is invalid.");
  pushErrorIf(!SENIORITY_LEVELS.includes(candidate.seniority), errors, "Candidate seniority is invalid.");
  pushErrorIf(
    !AVAILABILITY_STATUSES.includes(candidate.availability),
    errors,
    "Candidate availability is invalid."
  );
  pushErrorIf(!CANDIDATE_STATUSES.includes(candidate.status), errors, "Candidate status is invalid.");
  pushErrorIf(!isNonEmptyText(candidate.location), errors, "Candidate location is required.");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateVacancy(vacancy: Vacancy): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(vacancy)) {
    return { valid: false, errors: ["Vacancy must be an object."] };
  }

  pushErrorIf(!isNonEmptyText(vacancy.id), errors, "Vacancy id is required.");
  pushErrorIf(!isNonEmptyText(vacancy.title), errors, "Vacancy title is required.");
  pushErrorIf(!isNonEmptyText(vacancy.companyName), errors, "Vacancy companyName is required.");
  if (!Array.isArray(vacancy.requiredSkills)) {
    errors.push("Vacancy requiredSkills must be an array.");
  } else {
    pushErrorIf(vacancy.requiredSkills.length < 1, errors, "Vacancy must include requiredSkills.");
    pushErrorIf(
      !vacancy.requiredSkills.every((skill: unknown) => isNonEmptyText(skill)),
      errors,
      "Vacancy requiredSkills must be non-empty values."
    );
  }
  if (!Array.isArray(vacancy.preferredSkills)) {
    errors.push("Vacancy preferredSkills must be an array.");
  } else {
    pushErrorIf(
      !vacancy.preferredSkills.every((skill: unknown) => isNonEmptyText(skill)),
      errors,
      "Vacancy preferredSkills must be non-empty values."
    );
  }
  pushErrorIf(
    !isFiniteNumber(vacancy.minYearsExperience) || vacancy.minYearsExperience < 0,
    errors,
    "Vacancy minYearsExperience must be a finite number >= 0."
  );
  pushErrorIf(
    !isFiniteNumber(vacancy.maxYearsExperience) ||
      !isFiniteNumber(vacancy.minYearsExperience) ||
      vacancy.maxYearsExperience < vacancy.minYearsExperience,
    errors,
    "Vacancy maxYearsExperience must be a finite number >= minYearsExperience."
  );
  pushErrorIf(
    !isFiniteNumber(vacancy.salaryRangeMin) || vacancy.salaryRangeMin <= 0,
    errors,
    "Vacancy salaryRangeMin must be a finite number > 0."
  );
  pushErrorIf(
    !isFiniteNumber(vacancy.salaryRangeMax) || vacancy.salaryRangeMax <= 0,
    errors,
    "Vacancy salaryRangeMax must be a finite number > 0."
  );
  pushErrorIf(
    !isFiniteNumber(vacancy.salaryRangeMin) ||
      !isFiniteNumber(vacancy.salaryRangeMax) ||
      vacancy.salaryRangeMax < vacancy.salaryRangeMin,
    errors,
    "Vacancy salaryRangeMax must be a finite number >= salaryRangeMin."
  );
  pushErrorIf(
    !ENGLISH_LEVELS.includes(vacancy.requiredEnglishLevel),
    errors,
    "Vacancy requiredEnglishLevel is invalid."
  );
  pushErrorIf(
    !SENIORITY_LEVELS.includes(vacancy.requiredSeniority),
    errors,
    "Vacancy requiredSeniority is invalid."
  );
  pushErrorIf(!VACANCY_STATUSES.includes(vacancy.status), errors, "Vacancy status is invalid.");
  pushErrorIf(!isNonEmptyText(vacancy.location), errors, "Vacancy location is required.");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateSelectionProcess(process: SelectionProcess): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(process)) {
    return { valid: false, errors: ["SelectionProcess must be an object."] };
  }

  pushErrorIf(!isNonEmptyText(process.id), errors, "SelectionProcess id is required.");
  pushErrorIf(!isNonEmptyText(process.candidateId), errors, "SelectionProcess candidateId is required.");
  pushErrorIf(!isNonEmptyText(process.vacancyId), errors, "SelectionProcess vacancyId is required.");
  pushErrorIf(!PROCESS_STAGES.includes(process.stage), errors, "SelectionProcess stage is invalid.");
  pushErrorIf(
    !isFiniteNumber(process.score) || process.score < 0 || process.score > 100,
    errors,
    "SelectionProcess score must be a finite number between 0 and 100."
  );
  pushErrorIf(!isValidDate(process.createdAt), errors, "SelectionProcess createdAt must be a valid Date.");
  pushErrorIf(!isValidDate(process.updatedAt), errors, "SelectionProcess updatedAt must be a valid Date.");

  if (isValidDate(process.createdAt) && isValidDate(process.updatedAt)) {
    pushErrorIf(
      process.updatedAt.getTime() < process.createdAt.getTime(),
      errors,
      "SelectionProcess updatedAt cannot be earlier than createdAt."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
