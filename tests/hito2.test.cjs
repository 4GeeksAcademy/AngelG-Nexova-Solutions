const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const buildDirectory = process.env.NEXOVA_HITO2_BUILD_DIR;
if (!buildDirectory) {
  throw new Error(
    "Set NEXOVA_HITO2_BUILD_DIR to the directory containing the compiled src/ files."
  );
}

const collections = require(path.join(buildDirectory, "utils", "collections.js"));
const search = require(path.join(buildDirectory, "utils", "search.js"));
const transformations = require(path.join(buildDirectory, "utils", "transformations.js"));
const {
  validateCandidate,
  validateVacancy,
  validateSelectionProcess,
  isValidEmail,
} = require(path.join(buildDirectory, "utils", "validations.js"));

function candidate(overrides = {}) {
  return {
    id: "C-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+1 555 0100",
    yearsOfExperience: 5,
    skills: ["TypeScript", "React"],
    englishLevel: "B2",
    seniority: "Senior",
    currentSalary: 5000,
    expectedSalary: 6000,
    availability: "Immediate",
    location: "Valencia",
    remoteOnly: false,
    status: "Active",
    ...overrides,
  };
}

function vacancy(overrides = {}) {
  return {
    id: "V-1",
    title: "Engineer",
    companyName: "Nexova",
    requiredSkills: ["TypeScript"],
    preferredSkills: ["React"],
    minYearsExperience: 3,
    maxYearsExperience: 8,
    requiredEnglishLevel: "B2",
    requiredSeniority: "Senior",
    salaryRangeMin: 5000,
    salaryRangeMax: 7000,
    isRemote: true,
    location: "Remote",
    status: "Open",
    ...overrides,
  };
}

function selectionProcess(overrides = {}) {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  return {
    id: "P-1",
    candidateId: "C-1",
    vacancyId: "V-1",
    stage: "Interview",
    score: 75,
    notes: "",
    createdAt,
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

test("email validation stays basic but rejects malformed @ and whitespace", () => {
  assert.equal(isValidEmail("person@example.com"), true);
  assert.equal(isValidEmail("person@@example.com"), false);
  assert.equal(isValidEmail("person name@example.com"), false);
  assert.equal(isValidEmail("person@example"), false);
  assert.equal(isValidEmail(null), false);
});

test("candidate validation reports malformed objects and non-finite numbers", () => {
  assert.equal(validateCandidate(null).valid, false);
  assert.equal(validateCandidate(candidate({ skills: null })).valid, false);
  assert.equal(validateCandidate(candidate({ yearsOfExperience: Number.NaN })).valid, false);
  assert.equal(validateCandidate(candidate({ currentSalary: Number.POSITIVE_INFINITY })).valid, false);
  assert.equal(validateCandidate(candidate({ expectedSalary: Number.NaN })).valid, false);
  assert.equal(validateCandidate(candidate()).valid, true);
});

test("vacancy validation handles malformed skills and non-finite ranges", () => {
  assert.equal(validateVacancy(undefined).valid, false);
  assert.equal(validateVacancy(vacancy({ requiredSkills: null })).valid, false);
  assert.equal(validateVacancy(vacancy({ preferredSkills: null })).valid, false);
  assert.equal(validateVacancy(vacancy({ minYearsExperience: Number.NaN })).valid, false);
  assert.equal(validateVacancy(vacancy({ salaryRangeMax: Number.POSITIVE_INFINITY })).valid, false);
  assert.equal(validateVacancy(vacancy()).valid, true);
});

test("skill matching counts unique normalized required and preferred skills", () => {
  const targetVacancy = vacancy({
    requiredSkills: ["TypeScript", "typescript"],
    preferredSkills: ["React", "react", "TypeScript"],
    requiredEnglishLevel: "C2",
  });
  const duplicatedSkillsScore = transformations.calculateCandidateScore(
    candidate({ skills: ["TypeScript", "typescript", "React", "react"], expectedSalary: 9000 }),
    targetVacancy
  );
  const uniqueSkillsScore = transformations.calculateCandidateScore(
    candidate({ skills: ["TypeScript", "React"], expectedSalary: 9000 }),
    targetVacancy
  );

  assert.equal(duplicatedSkillsScore, uniqueSkillsScore);
  assert.equal(duplicatedSkillsScore, 95);
});

test("top skills count each normalized skill at most once per candidate", () => {
  const results = transformations.findTopSkills(
    [
      candidate({ skills: ["TypeScript", " typescript ", "React"] }),
      candidate({ id: "C-2", skills: ["TYPESCRIPT"] }),
    ],
    2
  );

  assert.deepEqual(results, [
    { skill: "TypeScript", count: 2 },
    { skill: "React", count: 1 },
  ]);
});

test("average salary rounds only the final average", () => {
  assert.equal(
    transformations.calculateAverageSalary([
      candidate({ expectedSalary: 0.005 }),
      candidate({ id: "C-2", expectedSalary: 0.005 }),
      candidate({ id: "C-3", expectedSalary: 0.015 }),
    ]),
    0.01
  );
  assert.equal(transformations.calculateAverageSalary([]), 0);
});

test("candidate filters normalize skills, combine criteria and preserve input order", () => {
  const first = candidate({ skills: [" TypeScript ", "REACT"] });
  const second = candidate({ id: "C-2", skills: ["Python"], seniority: "Junior", availability: "2 weeks" });
  const third = candidate({ id: "C-3", skills: ["typescript", "React"], availability: "2 weeks" });
  const input = [first, second, third];

  assert.deepEqual(collections.filterCandidatesBySkills(input, [" TYPESCRIPT ", "react"]), [first, third]);
  assert.deepEqual(collections.filterCandidatesBySkills(input, []), input);
  assert.deepEqual(collections.filterCandidatesBySeniority(input, "Junior"), [second]);
  assert.deepEqual(collections.filterCandidatesByAvailability(input, ["2 weeks", "Immediate"]), input);
  assert.deepEqual(collections.filterCandidatesByAvailability(input, []), []);
  assert.deepEqual(collections.filterByCriteria(input, (item) => item !== second), [first, third]);
  assert.deepEqual(collections.filterByCriteria([], () => true), []);
});

test("field and candidate sorts handle both directions, multiple keys and do not mutate", () => {
  const input = [
    candidate({ id: "C-1", expectedSalary: 7000, yearsOfExperience: 5 }),
    candidate({ id: "C-2", expectedSalary: 5000, yearsOfExperience: 8 }),
    candidate({ id: "C-3", expectedSalary: 7000, yearsOfExperience: 2 }),
  ];
  const before = [...input];

  assert.deepEqual(collections.sortCandidatesBySalary(input, "asc").map((item) => item.id), ["C-2", "C-1", "C-3"]);
  assert.deepEqual(collections.sortCandidatesBySalary(input, "desc").map((item) => item.id), ["C-1", "C-3", "C-2"]);
  assert.deepEqual(collections.sortCandidatesByExperience(input, "asc").map((item) => item.id), ["C-3", "C-1", "C-2"]);
  assert.deepEqual(collections.sortByFields(input, [
    { field: "expectedSalary", order: "desc" },
    { field: "yearsOfExperience", order: "asc" },
  ]).map((item) => item.id), ["C-3", "C-1", "C-2"]);
  assert.deepEqual(collections.sortByField(input, "expectedSalary"), [...input].sort((a, b) => a.expectedSalary - b.expectedSalary));
  assert.deepEqual(collections.sortByFields(input, []), input);
  assert.deepEqual(collections.sortByField([], "expectedSalary"), []);
  assert.deepEqual(input, before);
});

test("candidate lookup supports ID, normalized email, empty and missing results", () => {
  const input = [candidate(), candidate({ id: "C-2", email: "Grace@Example.com" })];
  assert.equal(search.findCandidateById(input, "C-2"), input[1]);
  assert.equal(search.findCandidateById(input, "missing"), null);
  assert.equal(search.findCandidateByEmail(input, "  grace@example.COM "), input[1]);
  assert.equal(search.findCandidateByEmail(input, "missing@example.com"), null);
  assert.equal(search.findCandidateByEmail([], "ada@example.com"), null);
  assert.equal(search.linearSearchIndex([2, 4, 6], (value) => value === 4), 1);
  assert.equal(search.linearSearchIndex([2, 4, 6], (value) => value === 5), -1);
});

test("binary salary search finds exact values and returns -1 for missing or empty", () => {
  const sorted = [4000, 5000, 6000, 7000].map((expectedSalary, index) => candidate({ id: `C-${index}`, expectedSalary }));
  assert.equal(search.binarySearchCandidateBySalary(sorted, 4000), 0);
  assert.equal(search.binarySearchCandidateBySalary(sorted, 6000), 2);
  assert.equal(search.binarySearchCandidateBySalary(sorted, 8000), -1);
  assert.equal(search.binarySearchCandidateBySalary([], 4000), -1);
});

test("score applies required/preferred skills and experience thresholds", () => {
  const target = vacancy({
    requiredSkills: ["TypeScript", "React"],
    preferredSkills: ["Node", "SQL", "Docker"],
    minYearsExperience: 3,
    maxYearsExperience: 5,
    requiredEnglishLevel: "C2",
    requiredSeniority: "Senior",
  });
  const base = { skills: [], yearsOfExperience: 3, englishLevel: "A1", seniority: "Junior", expectedSalary: 9000 };
  assert.equal(transformations.calculateCandidateScore(candidate({ ...base, skills: ["TypeScript"], yearsOfExperience: 2 }), target), 30);
  assert.equal(transformations.calculateCandidateScore(candidate({ ...base, skills: ["TypeScript", "React", "Node", "SQL"] }), target), 80);
  assert.equal(transformations.calculateCandidateScore(candidate({ ...base, yearsOfExperience: 6 }), target), 10);
  assert.equal(transformations.calculateCandidateScore(candidate({ ...base, yearsOfExperience: 8 }), target), 0);
  assert.equal(transformations.calculateCandidateScore(candidate({ ...base, skills: ["TypeScript", "React"], yearsOfExperience: 3, englishLevel: "C2", seniority: "Senior", expectedSalary: 7000 }), target), 100);
});

test("score covers seniority, English and salary boundaries and caps at 100", () => {
  const target = vacancy({
    requiredSkills: ["TypeScript"], preferredSkills: ["React", "Node"],
    minYearsExperience: 3, maxYearsExperience: 8,
    requiredEnglishLevel: "B2", requiredSeniority: "Senior",
    salaryRangeMin: 5000, salaryRangeMax: 7000,
  });
  const score = (overrides) => transformations.calculateCandidateScore(
    candidate({ skills: ["TypeScript", "React", "Node"], yearsOfExperience: 5, ...overrides }), target
  );
  assert.equal(score({ seniority: "Senior", englishLevel: "C1", expectedSalary: 7000 }), 100);
  assert.equal(score({ seniority: "Semi-Senior", englishLevel: "B2", expectedSalary: 8400 }), 100);
  assert.equal(score({ seniority: "Junior", englishLevel: "B1", expectedSalary: 8401 }), 80);
  assert.equal(score({ seniority: "Executive", englishLevel: "Native", expectedSalary: 4000 }), 95);
});

test("ranking is descending by score and scoring leaves candidate order intact", () => {
  const input = [
    candidate({ id: "low", skills: [], yearsOfExperience: 0, seniority: "Junior", englishLevel: "A1", expectedSalary: 1000 }),
    candidate({ id: "high" }),
  ];
  const ranked = transformations.rankCandidatesForVacancy(input, vacancy());
  assert.deepEqual(ranked.map((row) => row.candidate.id), ["high", "low"]);
  assert.ok(ranked[0].score > ranked[1].score);
  assert.deepEqual(input.map((item) => item.id), ["low", "high"]);
});

test("seniority/status aggregation and salary statistics cover populated and empty data", () => {
  const people = [
    candidate({ status: "Active", seniority: "Senior", expectedSalary: 4000 }),
    candidate({ id: "C-2", status: "Hired", seniority: "Senior", expectedSalary: 6000 }),
    candidate({ id: "C-3", status: "Inactive", seniority: "Junior", expectedSalary: 5000 }),
  ];
  assert.deepEqual(transformations.countCandidatesByStatus(people), { Active: 1, "In process": 0, Hired: 1, Inactive: 1 });
  assert.deepEqual(transformations.countCandidatesBySeniority(people), { Junior: 1, "Semi-Senior": 0, Senior: 2, Lead: 0, Executive: 0 });
  const groups = transformations.groupCandidatesBySeniority(people);
  assert.deepEqual(groups.Senior, people.slice(0, 2));
  assert.deepEqual(groups.Junior, [people[2]]);
  assert.equal(transformations.calculateTotalExpectedSalary(people), 15000);
  assert.equal(transformations.calculateAverageSalary(people), 5000);
  assert.equal(transformations.findMaxExpectedSalary(people), 6000);
  assert.equal(transformations.findMinExpectedSalary(people), 4000);
  assert.equal(transformations.calculateTotalExpectedSalary([]), 0);
  assert.equal(transformations.findMaxExpectedSalary([]), 0);
  assert.equal(transformations.findMinExpectedSalary([]), 0);
  assert.deepEqual(transformations.countCandidatesByStatus([]), { Active: 0, "In process": 0, Hired: 0, Inactive: 0 });
});

test("top skills limits, deterministic ties and complete required-skill matching", () => {
  const people = [candidate({ skills: ["TypeScript", "React"] }), candidate({ id: "C-2", skills: ["Python", "React"] })];
  assert.deepEqual(transformations.findTopSkills(people, 0), []);
  assert.deepEqual(transformations.findTopSkills(people, -1), []);
  assert.deepEqual(transformations.findTopSkills([], 3), []);
  assert.deepEqual(transformations.findTopSkills(people, 2), [{ skill: "React", count: 2 }, { skill: "Python", count: 1 }]);
  assert.deepEqual(transformations.candidatesWithFullRequiredSkills(people, vacancy({ requiredSkills: ["typescript", " React "] })), [people[0]]);
  assert.deepEqual(transformations.candidatesWithFullRequiredSkills(people, vacancy({ requiredSkills: [] })), people);
});

test("fill rate and status coverage handle empty, partial and complete populations", () => {
  assert.equal(transformations.calculateVacancyFillRate([]), 0);
  assert.equal(transformations.calculateVacancyFillRate([selectionProcess(), selectionProcess({ id: "P-2", stage: "Hired" }), selectionProcess({ id: "P-3", stage: "Rejected" })]), 33.33);
  assert.equal(transformations.statusCoverage([]), 0);
  assert.equal(transformations.statusCoverage([candidate(), candidate({ id: "C-2", status: "Active" })]), 25);
  assert.equal(transformations.statusCoverage([
    candidate({ status: "Active" }), candidate({ id: "2", status: "In process" }),
    candidate({ id: "3", status: "Hired" }), candidate({ id: "4", status: "Inactive" }),
  ]), 100);
});

test("selection report combines candidate and process metrics", () => {
  const people = [candidate({ expectedSalary: 4000 }), candidate({ id: "C-2", status: "Hired", expectedSalary: 6000 })];
  const report = transformations.generateCandidateSelectionReport(people, [selectionProcess({ stage: "Hired" }), selectionProcess({ id: "P-2" })], 1);
  assert.deepEqual(report, {
    totalCandidates: 2,
    totalExpectedSalary: 10000,
    averageExpectedSalary: 5000,
    maxExpectedSalary: 6000,
    minExpectedSalary: 4000,
    topSkills: [{ skill: "React", count: 2 }],
    statusBreakdown: { Active: 1, "In process": 0, Hired: 1, Inactive: 0 },
    fillRate: 50,
  });
  assert.equal(transformations.generateCandidateSelectionReport([], []).totalCandidates, 0);
});

test("selection-process validation checks dates, stage, score range and chronology", () => {
  assert.equal(validateSelectionProcess(null).valid, false);
  assert.equal(validateSelectionProcess(selectionProcess()).valid, true);
  assert.equal(validateSelectionProcess(selectionProcess({ score: Number.NaN })).valid, false);
  assert.equal(validateSelectionProcess(selectionProcess({ score: 101 })).valid, false);
  assert.equal(validateSelectionProcess(selectionProcess({ stage: "unknown" })).valid, false);
  assert.equal(validateSelectionProcess(selectionProcess({ createdAt: new Date("invalid") })).valid, false);
  assert.equal(validateSelectionProcess(selectionProcess({ updatedAt: new Date("2025-01-01T00:00:00Z") })).valid, false);
});

test("candidate and vacancy validators reject invalid enum, range and required fields", () => {
  assert.equal(validateCandidate(candidate({ yearsOfExperience: -1 })).valid, false);
  assert.equal(validateCandidate(candidate({ skills: [" "] })).valid, false);
  assert.equal(validateCandidate(candidate({ seniority: "Intern" })).valid, false);
  assert.equal(validateVacancy(vacancy({ requiredSkills: [] })).valid, false);
  assert.equal(validateVacancy(vacancy({ maxYearsExperience: 2 })).valid, false);
  assert.equal(validateVacancy(vacancy({ salaryRangeMax: 4000 })).valid, false);
  assert.equal(validateVacancy(vacancy({ status: "Draft" })).valid, false);
});
