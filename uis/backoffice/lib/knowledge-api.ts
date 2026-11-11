import { authRequest } from "@/lib/api-client";

export interface KnowledgeSource {
  document: string;
  section: string;
}

export interface KnowledgeAnswer {
  answer: string;
  sources: KnowledgeSource[];
}

export function askKnowledge(question: string): Promise<KnowledgeAnswer> {
  return authRequest<KnowledgeAnswer>("/knowledge/query", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}