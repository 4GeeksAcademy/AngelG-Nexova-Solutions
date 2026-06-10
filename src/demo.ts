import { Candidate, SelectionProcess, Vacancy } from "./types/models";
import {
  filterCandidatesByAvailability,
  filterCandidatesBySeniority,
  filterCandidatesBySkills,
  sortCandidatesByExperience,
  sortCandidatesBySalary,
  sortByFields,
} from "./utils/collections";
import {
  binarySearchCandidateBySalary,
  findCandidateByEmail,
  findCandidateById,
} from "./utils/search";
import {
  calculateAverageSalary,
  calculateCandidateScore,
  calculateTotalExpectedSalary,
  calculateVacancyFillRate,
  countCandidatesByStatus,
  findMaxExpectedSalary,
  findMinExpectedSalary,
  findTopSkills,
  generateCandidateSelectionReport,
  groupCandidatesBySeniority,
  rankCandidatesForVacancy,
} from "./utils/transformations";
import { validateCandidate, validateSelectionProcess, validateVacancy } from "./utils/validations";

const sampleCandidates: Candidate[] = [
  {
    id: "C-2024-0451",
    fullName: "María González",
    email: "maria.gonzalez@email.com",
    phone: "+56912345678",
    yearsOfExperience: 5,
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
    englishLevel: "B2",
    seniority: "Semi-Senior",
    currentSalary: 3500,
    expectedSalary: 4200,
    availability: "1 month",
    location: "Valencia, España",
    remoteOnly: false,
    status: "Active",
  },
  {
    id: "C-2024-0452",
    fullName: "Juan Pérez",
    email: "juan.perez@email.com",
    phone: "+56987654321",
    yearsOfExperience: 3,
    skills: ["JavaScript", "React", "CSS", "HTML"],
    englishLevel: "B1",
    seniority: "Junior",
    currentSalary: 2200,
    expectedSalary: 2800,
    availability: "Immediate",
    location: "Miami, Florida, Estados Unidos",
    remoteOnly: true,
    status: "Active",
  },
  {
    id: "C-2024-0453",
    fullName: "Carolina Silva",
    email: "carolina.silva@email.com",
    phone: "+56911223344",
    yearsOfExperience: 8,
    skills: ["TypeScript", "Node.js", "PostgreSQL", "Docker", "AWS"],
    englishLevel: "C1",
    seniority: "Senior",
    currentSalary: 5500,
    expectedSalary: 6500,
    availability: "2 weeks",
    location: "Valencia, España",
    remoteOnly: false,
    status: "Active",
  },
];

const sampleVacancy: Vacancy = {
  id: "V-2024-0892",
  title: "Senior Full-Stack Developer",
  companyName: "TechCorp Solutions",
  requiredSkills: ["TypeScript", "React", "Node.js"],
  preferredSkills: ["PostgreSQL", "Docker"],
  minYearsExperience: 4,
  maxYearsExperience: 8,
  requiredEnglishLevel: "B2",
  requiredSeniority: "Senior",
  salaryRangeMin: 5000,
  salaryRangeMax: 7000,
  isRemote: true,
  location: "Remote",
  status: "Open",
};

const sampleProcesses: SelectionProcess[] = [
  {
    id: "SP-2024-1523",
    candidateId: "C-2024-0451",
    vacancyId: "V-2024-0892",
    stage: "Interview",
    score: 74,
    notes: "Buena base técnica, pendiente de entrevista final.",
    createdAt: new Date("2026-05-01T10:00:00Z"),
    updatedAt: new Date("2026-05-06T10:00:00Z"),
  },
  {
    id: "SP-2024-1524",
    candidateId: "C-2024-0453",
    vacancyId: "V-2024-0892",
    stage: "Hired",
    score: 95,
    notes: "Excelente match técnico y de seniority.",
    createdAt: new Date("2026-05-01T10:00:00Z"),
    updatedAt: new Date("2026-05-20T10:00:00Z"),
  },
];

const ranked = rankCandidatesForVacancy(sampleCandidates, sampleVacancy);
const sortedBySalary = sortCandidatesBySalary(sampleCandidates, "asc");
const firstCandidate = sampleCandidates[0];
const firstProcess = sampleProcesses[0];

if (firstCandidate) {
  console.log("Validate Candidate:", validateCandidate(firstCandidate));
}

console.log("Validate Vacancy:", validateVacancy(sampleVacancy));

if (firstProcess) {
  console.log("Validate SelectionProcess:", validateSelectionProcess(firstProcess));
}

console.log("Find Candidate By ID:", findCandidateById(sampleCandidates, "C-2024-0452"));
console.log(
  "Find Candidate By Email:",
  findCandidateByEmail(sampleCandidates, "CAROLINA.SILVA@email.com")
);
console.log("Binary Search Salary 6500:", binarySearchCandidateBySalary(sortedBySalary, 6500));

console.log(
  "Filter by Skills (TypeScript + Node.js):",
  filterCandidatesBySkills(sampleCandidates, ["typescript", "Node.js"])
);
console.log("Filter by Seniority (Senior):", filterCandidatesBySeniority(sampleCandidates, "Senior"));
console.log(
  "Filter by Availability:",
  filterCandidatesByAvailability(sampleCandidates, ["Immediate", "2 weeks"])
);

console.log("Sort by Experience Desc:", sortCandidatesByExperience(sampleCandidates, "desc"));
console.log(
  "Sort by multiple fields (seniority asc + salary desc):",
  sortByFields(sampleCandidates, [
    { field: "seniority", order: "asc" },
    { field: "expectedSalary", order: "desc" },
  ])
);

if (firstCandidate) {
  console.log(
    "Candidate score for first candidate:",
    calculateCandidateScore(firstCandidate, sampleVacancy)
  );
}
console.log("Ranking:", ranked);
console.log("Grouped by Seniority:", groupCandidatesBySeniority(sampleCandidates));
console.log("Count by Status:", countCandidatesByStatus(sampleCandidates));
console.log("Total Expected Salary:", calculateTotalExpectedSalary(sampleCandidates));
console.log("Average Salary:", calculateAverageSalary(sampleCandidates));
console.log("Max Expected Salary:", findMaxExpectedSalary(sampleCandidates));
console.log("Min Expected Salary:", findMinExpectedSalary(sampleCandidates));
console.log("Top Skills:", findTopSkills(sampleCandidates, 3));
console.log("Vacancy Fill Rate:", calculateVacancyFillRate(sampleProcesses));
console.log(
  "Generated report:",
  generateCandidateSelectionReport(sampleCandidates, sampleProcesses, 3)
);
