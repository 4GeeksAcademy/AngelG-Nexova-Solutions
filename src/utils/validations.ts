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

function isNonEmptyText(value: string): boolean {
  return value.trim().length > 0;
}

function pushErrorIf(condition: boolean, errors: string[], message: string): void {
  if (condition) {
    errors.push(message);
  }
}

export function isValidEmail(email: string): boolean {
  const value = email.trim();
  const atIndex = value.indexOf("@");
  const dotIndex = value.lastIndexOf(".");

  return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < value.length - 1;
}

export function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function validateCandidate(candidate: Candidate): ValidationResult {
  const errors: string[] = [];

  pushErrorIf(!isNonEmptyText(candidate.id), errors, "Candidate id is required.");
  pushErrorIf(!isNonEmptyText(candidate.fullName), errors, "Candidate fullName is required.");
  pushErrorIf(!isValidEmail(candidate.email), errors, "Candidate email is invalid.");
  pushErrorIf(!isNonEmptyText(candidate.phone), errors, "Candidate phone must not be empty.");
  pushErrorIf(
    candidate.yearsOfExperience < 0 || candidate.yearsOfExperience > 50,
    errors,
    "Candidate yearsOfExperience must be between 0 and 50."
  );
  pushErrorIf(candidate.currentSalary <= 0, errors, "Candidate currentSalary must be greater than 0.");
  pushErrorIf(
    candidate.expectedSalary <= 0,
    errors,
    "Candidate expectedSalary must be greater than 0."
  );
  pushErrorIf(candidate.skills.length < 1, errors, "Candidate must have at least one skill.");
  pushErrorIf(
    !candidate.skills.every((skill) => isNonEmptyText(skill)),
    errors,
    "Candidate skills must be non-empty text values."
  );
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

  pushErrorIf(!isNonEmptyText(vacancy.id), errors, "Vacancy id is required.");
  pushErrorIf(!isNonEmptyText(vacancy.title), errors, "Vacancy title is required.");
  pushErrorIf(!isNonEmptyText(vacancy.companyName), errors, "Vacancy companyName is required.");
  pushErrorIf(vacancy.requiredSkills.length < 1, errors, "Vacancy must include requiredSkills.");
  pushErrorIf(
    !vacancy.requiredSkills.every((skill) => isNonEmptyText(skill)),
    errors,
    "Vacancy requiredSkills must be non-empty values."
  );
  pushErrorIf(
    !vacancy.preferredSkills.every((skill) => isNonEmptyText(skill)),
    errors,
    "Vacancy preferredSkills must be non-empty values."
  );
  pushErrorIf(vacancy.minYearsExperience < 0, errors, "Vacancy minYearsExperience must be >= 0.");
  pushErrorIf(
    vacancy.maxYearsExperience < vacancy.minYearsExperience,
    errors,
    "Vacancy maxYearsExperience must be >= minYearsExperience."
  );
  pushErrorIf(vacancy.salaryRangeMin <= 0, errors, "Vacancy salaryRangeMin must be > 0.");
  pushErrorIf(vacancy.salaryRangeMax <= 0, errors, "Vacancy salaryRangeMax must be > 0.");
  pushErrorIf(
    vacancy.salaryRangeMax < vacancy.salaryRangeMin,
    errors,
    "Vacancy salaryRangeMax must be >= salaryRangeMin."
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

  pushErrorIf(!isNonEmptyText(process.id), errors, "SelectionProcess id is required.");
  pushErrorIf(!isNonEmptyText(process.candidateId), errors, "SelectionProcess candidateId is required.");
  pushErrorIf(!isNonEmptyText(process.vacancyId), errors, "SelectionProcess vacancyId is required.");
  pushErrorIf(!PROCESS_STAGES.includes(process.stage), errors, "SelectionProcess stage is invalid.");
  pushErrorIf(process.score < 0 || process.score > 100, errors, "SelectionProcess score must be 0-100.");
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
