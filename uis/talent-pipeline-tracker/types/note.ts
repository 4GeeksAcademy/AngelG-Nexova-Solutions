export interface Note {
  id: string;
  record_id: string;
  content: string;
  created_at: string;
}

export interface NotesResponse {
  data: Note[];
  meta: {
    total: number;
  };
}

export interface AddNotePayload {
  content: string;
}
