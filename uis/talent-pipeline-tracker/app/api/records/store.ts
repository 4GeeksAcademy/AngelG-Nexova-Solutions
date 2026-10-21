import { Candidate } from "@/types/candidate";
import { Note } from "@/types/note";

const now = new Date().toISOString();

const initialCandidates: Candidate[] = [
  {
    id: "cand-001",
    full_name: "Lucia Martinez",
    email: "lucia.martinez@example.com",
    phone: "+34 600 111 222",
    position: "Executive Assistant",
    linkedin_url: "https://linkedin.com/in/lucia-martinez",
    cv_url: null,
    status: "in_progress",
    stage: "review",
    experience_years: 5,
    notes_count: 1,
    applied_at: now,
    updated_at: now,
  },
  {
    id: "cand-002",
    full_name: "Carlos Ruiz",
    email: "carlos.ruiz@example.com",
    phone: "+34 600 333 444",
    position: "Executive Assistant",
    linkedin_url: null,
    cv_url: null,
    status: "received",
    stage: "pending",
    experience_years: 3,
    notes_count: 0,
    applied_at: now,
    updated_at: now,
  },
  {
    id: "cand-003",
    full_name: "Marina Santos",
    email: "marina.santos@example.com",
    phone: "+34 600 000 003",
    position: "Executive Assistant",
    linkedin_url: null,
    cv_url: null,
    status: "selected",
    stage: "offer_presented",
    experience_years: 7,
    notes_count: 0,
    applied_at: now,
    updated_at: now,
  },
  {
    id: "cand-004",
    full_name: "Diego Navarro",
    email: "diego.navarro@example.com",
    phone: "+34 600 000 004",
    position: "Executive Assistant",
    linkedin_url: null,
    cv_url: null,
    status: "discarded",
    stage: "personal_interview",
    experience_years: 4,
    notes_count: 0,
    applied_at: now,
    updated_at: now,
  },
  {
    id: "cand-005",
    full_name: "Paula Medina",
    email: "paula.medina@example.com",
    phone: "+34 600 000 005",
    position: "Executive Assistant",
    linkedin_url: null,
    cv_url: null,
    status: "in_progress",
    stage: "technical_interview",
    experience_years: 6,
    notes_count: 0,
    applied_at: now,
    updated_at: now,
  },
];

const filterStatuses: Candidate["status"][] = [
  "received",
  "in_progress",
  "selected",
  "discarded",
];

const filterStages: Candidate["stage"][] = [
  "pending",
  "review",
  "personal_interview",
  "technical_interview",
  "offer_presented",
];

const coveredCombinations = new Set(
  initialCandidates.map(({ status, stage }) => `${status}:${stage}`),
);

const additionalCandidates = filterStatuses.flatMap((status) =>
  filterStages
    .filter((stage) => !coveredCombinations.has(`${status}:${stage}`))
    .map((stage, index) => {
      const id = `demo-${status}-${stage}`;
      return {
        id,
        full_name: `Demo ${status} ${stage}`,
        email: `${id}@example.com`,
        phone: "+34 600 000 000",
        position: "Executive Assistant",
        linkedin_url: null,
        cv_url: null,
        status,
        stage,
        experience_years: index + 1,
        notes_count: 0,
        applied_at: now,
        updated_at: now,
      };
    }),
);

initialCandidates.push(...additionalCandidates);

const initialNotes: Record<string, Note[]> = {
  "cand-001": [
    {
      id: "note-001",
      record_id: "cand-001",
      content: "Perfil solido para coordinacion ejecutiva.",
      created_at: now,
    },
  ],
  "cand-002": [],
  "cand-003": [],
  "cand-004": [],
  "cand-005": [],
  ...Object.fromEntries(additionalCandidates.map(({ id }) => [id, [] as Note[]])),
};

export const db = {
  candidates: initialCandidates,
  notesByRecord: initialNotes,
};
