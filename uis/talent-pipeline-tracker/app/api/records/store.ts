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
];

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
};

export const db = {
  candidates: initialCandidates,
  notesByRecord: initialNotes,
};
