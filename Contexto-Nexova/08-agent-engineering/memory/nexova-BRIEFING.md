# BRIEFING — Nexova

## Milestone 8 · Part 1 · Agent Memory and Self-Improvement

---

## Why this memory matters for Nexova

The target for this implementation is the **current SDR/sales agent** in `services/api/agent/graph.py`, which queries Nexova's commercial RAG to prepare prospect conversations. It is not the support assistant described in earlier versions of this briefing. Authentication provides a user but no trusted client/tenant, so the approved scope is limited to general response/presentation preferences owned by the authenticated user. No preferences, facts, or patterns attributable to clients or prospects may be stored.

## What IS worth remembering

- **General personal response preferences of the SDR**: e.g. concise answers or comparisons in bullet points. Memory may adapt presentation but must never alter commercial policy, facts, or limits.

## What must NEVER enter memory

- Any prospect, client, or company data (identifiers, needs, preferences, negotiations, pipeline, or notes), even if the user explicitly asks to remember it: there is no trusted tenant identity.
- Candidate personal data, salary/negotiation information, credentials, secrets, commercial data or policy (prices, discounts, SLAs/warranties, contractual terms). User memory must not reinterpret or replace the commercial RAG.
- One-off corrections, business operating instructions, or any fact that is not a general presentation preference of the user.

## Examples for your "Self-Evaluation" checklist

**May generate a memory proposal:**
1. "For future answers, I prefer a brief executive summary followed by details."
2. "When comparing options, use a table, but don't store prospect data."
3. "I prefer commercial answers to clearly separate sourced facts from open questions."

**Should NOT generate a proposal:**
1. "Prospect Acme has an €80,000 budget and wants a discount." (prospect and negotiation data).
2. "The standard fee changed to 18%; remember that." (commercial policy; consult the approved RAG).
3. "Summarize this opportunity for the CRM." (one-off task containing prospect data).

## Suggested consolidation

Memory is separate from RAG and contains only general presentation preferences for the authenticated user. It is not shared between users or attributed to clients. Commercial facts and policies remain exclusively in approved RAG sources.

## Company constraints

Nexova operates between Spain and Miami; if your agent supports bilingual operation, the memory proposal and confirmation must work in the chosen base language.
