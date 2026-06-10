import { AvailabilityStatus, Candidate, SeniorityLevel } from "../types/models";

export type SortOrder = "asc" | "desc";

export function filterByCriteria<T>(items: readonly T[], predicate: (item: T) => boolean): T[] {
  if (items.length === 0) {
    return [];
  }

  return items.filter(predicate);
}

export function sortByField<T, K extends keyof T>(
  items: readonly T[],
  field: K,
  order: SortOrder = "asc"
): T[] {
  if (items.length <= 1) {
    return [...items];
  }

  const direction = order === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    const a = left[field];
    const b = right[field];

    if (a === b) {
      return 0;
    }

    if (a > b) {
      return direction;
    }

    return -direction;
  });
}

export function sortByFields<T>(
  items: readonly T[],
  fields: Array<{ field: keyof T; order?: SortOrder }>
): T[] {
  if (items.length <= 1 || fields.length === 0) {
    return [...items];
  }

  return [...items].sort((left, right) => {
    for (const { field, order = "asc" } of fields) {
      const direction = order === "asc" ? 1 : -1;
      const a = left[field];
      const b = right[field];

      if (a === b) {
        continue;
      }

      return a > b ? direction : -direction;
    }

    return 0;
  });
}

export function filterCandidatesBySkills(
  candidates: Candidate[],
  requiredSkills: string[]
): Candidate[] {
  if (requiredSkills.length === 0 || candidates.length === 0) {
    return [...candidates];
  }

  const normalizedRequired = requiredSkills.map((skill) => skill.trim().toLowerCase());

  return candidates.filter((candidate) => {
    const candidateSkills = new Set(candidate.skills.map((skill) => skill.trim().toLowerCase()));
    return normalizedRequired.every((skill) => candidateSkills.has(skill));
  });
}

export function filterCandidatesBySeniority(
  candidates: Candidate[],
  seniority: SeniorityLevel
): Candidate[] {
  return filterByCriteria(candidates, (candidate) => candidate.seniority === seniority);
}

export function filterCandidatesByAvailability(
  candidates: Candidate[],
  availability: AvailabilityStatus[]
): Candidate[] {
  if (availability.length === 0) {
    return [];
  }

  const availabilitySet = new Set(availability);
  return filterByCriteria(candidates, (candidate) => availabilitySet.has(candidate.availability));
}

export function sortCandidatesBySalary(candidates: Candidate[], order: SortOrder): Candidate[] {
  return sortByField(candidates, "expectedSalary", order);
}

export function sortCandidatesByExperience(candidates: Candidate[], order: SortOrder): Candidate[] {
  return sortByField(candidates, "yearsOfExperience", order);
}
