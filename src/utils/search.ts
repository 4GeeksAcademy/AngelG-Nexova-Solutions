import { Candidate } from "../types/models";

export function linearSearchIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (const [index, item] of items.entries()) {
    if (predicate(item)) {
      return index;
    }
  }

  return -1;
}

export function findCandidateById(candidates: Candidate[], id: string): Candidate | null {
  const index = linearSearchIndex(candidates, (candidate) => candidate.id === id);
  return index >= 0 ? candidates[index] ?? null : null;
}

export function findCandidateByEmail(candidates: Candidate[], email: string): Candidate | null {
  const normalizedEmail = email.trim().toLowerCase();
  const index = linearSearchIndex(
    candidates,
    (candidate) => candidate.email.trim().toLowerCase() === normalizedEmail
  );

  return index >= 0 ? candidates[index] ?? null : null;
}

export function binarySearchCandidateBySalary(
  sortedCandidates: Candidate[],
  targetSalary: number
): number {
  let left = 0;
  let right = sortedCandidates.length - 1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const candidateAtMiddle = sortedCandidates[middle];

    if (!candidateAtMiddle) {
      return -1;
    }

    const currentSalary = candidateAtMiddle.expectedSalary;

    if (currentSalary === targetSalary) {
      return middle;
    }

    if (currentSalary < targetSalary) {
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return -1;
}
