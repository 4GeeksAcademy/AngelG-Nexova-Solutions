"""Deterministic input and untrusted-content guardrails for the SDR agent."""

from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass
from threading import Lock


logger = logging.getLogger("agent.guardrails")

_event_counts: Counter[tuple[str, str]] = Counter()
_event_lock = Lock()


def emit_guardrail_event(category: str, reason: str) -> None:
    """Record one redacted, low-cardinality guardrail event."""
    if category not in {"structural", "content", "security", "redirect"}:
        raise ValueError("unsupported guardrail category")
    with _event_lock:
        _event_counts[(category, reason)] += 1
    logger.warning(
        "Agent guardrail activated",
        extra={"guardrail_category": category, "guardrail_reason": reason},
    )


def guardrail_event_summary() -> dict[str, dict[str, int]]:
    """Return process-local aggregate counts without request data."""
    with _event_lock:
        counts = dict(_event_counts)
    return {
        category: {
            reason: count
            for (event_category, reason), count in sorted(counts.items())
            if event_category == category
        }
        for category in ("structural", "content", "security", "redirect")
        if any(event_category == category for event_category, _ in counts)
    }


def reset_guardrail_event_summary() -> None:
    """Reset process-local counters; intended for isolated tests/tools."""
    with _event_lock:
        _event_counts.clear()

_INSTRUCTION_OVERRIDE_PATTERNS = (
    re.compile(r"\b(ignore|disregard|forget)\b.{0,50}\b(previous|prior|all)\b.{0,30}\b(instructions?|rules?)\b", re.I),
    re.compile(r"\b(ignora|olvida|desobedece)\b.{0,80}\b(instrucciones?|reglas?|que trabajas|que eres)\b", re.I),
    re.compile(r"\b(you are now|ahora eres|act as|actúa como)\b.{0,45}\b(no rules|sin reglas|unrestricted|otro asistente)\b", re.I),
    re.compile(r"\b(olvida|forget)\b.{0,50}\b(trabajas para|work for|eres el agente de)\b.{0,45}\b(nexova)\b", re.I),
    re.compile(r"\b(actúa como|actua como|act as|become)\b.{0,45}\b(otro asistente|another assistant|un asistente distinto)\b", re.I),
    re.compile(r"\b(revela|muestra|imprime|reveal|show|print)\b.{0,35}\b(prompt del sistema|system prompt|instrucciones internas|hidden instructions)\b", re.I),
)
_PERSONAL_TASK_PATTERNS = (
    re.compile(r"\b(university|college|school)\s+(homework|assignment|essay|paper)\b", re.I),
    re.compile(r"\b(tarea|deber|trabajo)\s+(de la universidad|universitari[oa]|escolar)\b", re.I),
    re.compile(r"\b(write|write me|help me write)\b.{0,35}\b(essay|homework|personal story)\b", re.I),
    re.compile(r"\b(escribe|redacta|hazme)\b.{0,35}\b(ensayo|tarea|código para mi (?:app|producto)|consejo personal)\b", re.I),
    re.compile(r"\b(ayúdame|ayudame)\b.{0,40}\b(escribir|redactar|hacer)\b.{0,50}\b(ensayo|tarea|deber|código|codigo)\b", re.I),
    re.compile(r"\b(escribe|redacta|hazme|write me|write)\b.{0,35}\b(poema|poetry|poem)\b.{0,25}\b(amor|love)\b", re.I),
    re.compile(r"\b(ayúdame|ayudame)\b.{0,35}\b(escribir|redactar)\b.{0,35}\b(poema|poetry|poem)\b.{0,25}\b(amor|love)\b", re.I),
    re.compile(r"\b(personal advice|relationship advice|consejo amoroso|consejo personal)\b", re.I),
)
_CROSS_ACCOUNT_PATTERNS = (
    re.compile(r"\b(another|other|different)\s+(client|customer|prospect|company)\b", re.I),
    re.compile(r"\b(otro|otra|demás|distinto|diferente)\s+(cliente|prospecto|empresa|cuenta)\b", re.I),
    re.compile(r"\b(what|tell me|show me|dime|muéstrame)\b.{0,50}\b(another client|other client|otro cliente|otra empresa|otro prospecto)\b", re.I),
)
_UNTRUSTED_INSTRUCTION_PATTERNS = (
    re.compile(r"\[\s*(system|developer|assistant)\s*\]", re.I),
    re.compile(r"\b(ignore|disregard|override)\b.{0,40}\b(previous|prior|system)\b.{0,25}\b(instructions?|rules?)\b", re.I),
    re.compile(r"\b(ignora|sobrescribe)\b.{0,40}\b(instrucciones?|reglas?)\b", re.I),
)
_SECRET_PATTERNS = (
    re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]{12,}", re.I),
    re.compile(r"\b(?:sk|rk|api)[-_][A-Za-z0-9_-]{16,}\b", re.I),
    re.compile(r"\b(?:password|passwd|token|secret|api[_ -]?key)\s*[:=]\s*\S+", re.I),
)
_SYSTEM_PROMPT_REQUEST = re.compile(
    r"\b(reveal|show|repeat|print|muestra|revela|repite|imprime)\b"
    r".{0,40}\b(system prompt|hidden instructions|prompt del sistema|instrucciones internas)\b",
    re.I,
)
_SMALL_TALK_PATTERNS = (
    re.compile(r"^(hi|hello|hey|good morning|good afternoon|good evening)[!. ]*$", re.I),
    re.compile(r"^(hola|buenos días|buenas tardes|buenas noches|buenas)[!. ]*$", re.I),
    re.compile(r"^(how are you|how's it going|what's up|thanks|thank you)[?.! ]*$", re.I),
    re.compile(r"^(¿?cómo estás|que tal|qué tal|gracias|muchas gracias)[?.! ]*$", re.I),
)
_GENERAL_TIME_QUESTION = re.compile(
    r"^(?:¿\s*)?(?:qué hora es|what time is it)(?:\s+(?:en|in)\s+(?:tokio|tokyo))?\??$",
    re.I,
)
_SENSITIVE_COMMERCIAL_TERMS = re.compile(
    r"\b(?:ofrecemos|aplicamos|autorizamos|concedemos|approved|grant(?:ed)?|"
    r"offer(?:ed)?|apply|applied)\b.{0,35}\b(?:descuento|discount|rebaja)\b|"
    r"\bpenalizaci[oó]n(?:es)?\s+(?:de\s+)?SLA\b|"
    r"\bSLA\s+(?:penalty|penalties|penalizado|penalizados)\b|"
    r"\bcontractual\s+terms\b",
    re.I,
)


@dataclass(frozen=True)
class InputDecision:
    """A safe, low-cardinality decision for one user message."""

    blocked: bool
    reason: str | None = None


def assess_input(question: str) -> InputDecision:
    """Block explicit instruction attacks, personal tasks, and cross-account asks."""
    for reason, patterns in (
        ("instruction_override", _INSTRUCTION_OVERRIDE_PATTERNS),
        ("personal_task", _PERSONAL_TASK_PATTERNS),
        ("cross_account_request", _CROSS_ACCOUNT_PATTERNS),
    ):
        if any(pattern.search(question) for pattern in patterns):
            category = "security" if reason in {
                "instruction_override", "cross_account_request"
            } else "content"
            emit_guardrail_event(category, reason)
            return InputDecision(blocked=True, reason=reason)
    return InputDecision(blocked=False)


def is_small_talk(question: str) -> bool:
    """Recognize only short, explicit greetings and pleasantries."""
    normalized = " ".join(question.strip().split())
    return bool(normalized) and any(pattern.fullmatch(normalized) for pattern in _SMALL_TALK_PATTERNS)


def redirect_for_small_talk(question: str) -> str:
    """Respond briefly to small talk and redirect to the SDR domain."""
    normalized = " ".join(question.strip().split()).casefold().strip("!?¿¡. ")
    spanish = any(char in question.casefold() for char in "áéíóúñ") or normalized in {
        "hola", "buenas", "buenos días", "buenas tardes", "buenas noches",
        "gracias", "muchas gracias", "cómo estás", "qué tal", "que tal"
    }
    if normalized in {"thanks", "thank you", "gracias", "muchas gracias"}:
        acknowledgement = "¡De nada!" if spanish else "You're welcome!"
    elif normalized in {"how are you", "how's it going", "what's up", "cómo estás", "qué tal", "que tal"}:
        acknowledgement = "¡Muy bien, gracias!" if spanish else "I'm doing well, thanks!"
    else:
        acknowledgement = "¡Hola!" if spanish else "Hello!"
    if spanish:
        return f"{acknowledgement} ¿En qué puedo ayudarte con información comercial de Nexova?"
    return f"{acknowledgement} How can I help with Nexova commercial information?"


def is_supported_general_question(question: str) -> bool:
    """Recognize a narrow, harmless general query with a safe fixed response."""
    normalized = " ".join(question.strip().split())
    return bool(_GENERAL_TIME_QUESTION.fullmatch(normalized))


def respond_to_general_question(question: str) -> str:
    """Avoid inventing dynamic facts and redirect back to the SDR domain."""
    spanish = any(char in question.casefold() for char in "áéíóúñ") or "qué" in question.casefold()
    if spanish:
        return (
            "No puedo consultar la hora en tiempo real. ¿En qué puedo ayudarte "
            "con información comercial de Nexova?"
        )
    return "I can't check the live time. How can I help with Nexova commercial information?"


def redirect_for_input(decision: InputDecision) -> str:
    """Return a fixed refusal without echoing adversarial user content."""
    if decision.reason == "cross_account_request":
        return (
            "No puedo revelar información de otros clientes o prospectos. "
            "Puedo ayudarte con información comercial autorizada y respaldada por las fuentes disponibles."
        )
    if decision.reason == "unscoped_data_access":
        return OUTPUT_BLOCK_MESSAGE
    return (
        "No puedo cambiar mis instrucciones ni ayudar con esa solicitud fuera del "
        "ámbito del asistente comercial de Nexova. Puedo ayudarte con información "
        "comercial autorizada, servicios o preparación de conversaciones con prospectos."
    )


def sanitize_untrusted_text(value: str) -> str:
    """Remove instruction-like or credential-like lines from retrieved/tool text."""
    safe_lines = []
    removed = False
    for line in value.splitlines():
        if any(pattern.search(line) for pattern in (*_UNTRUSTED_INSTRUCTION_PATTERNS, *_SECRET_PATTERNS)):
            removed = True
            continue
        safe_lines.append(line)
    if removed:
        emit_guardrail_event("security", "untrusted_content_removed")
    return "\n".join(safe_lines).strip()


def sanitize_evidence(evidence: list[dict[str, object]]) -> list[dict[str, object]]:
    """Copy evidence and quarantine hostile or secret-bearing text lines."""
    safe_evidence: list[dict[str, object]] = []
    for item in evidence:
        safe_item = dict(item)
        for key in ("text", "content", "page_content"):
            value = safe_item.get(key)
            if isinstance(value, str):
                safe_item[key] = sanitize_untrusted_text(value)
        if any(
            isinstance(safe_item.get(key), str) and safe_item[key].strip()
            for key in ("text", "content", "page_content")
        ):
            safe_evidence.append(safe_item)
    return safe_evidence


def validate_answer(answer: str) -> bool:
    """Reject empty output and obvious secret or hidden-prompt disclosure."""
    if not answer.strip() or len(answer) > 12000:
        emit_guardrail_event("structural", "invalid_answer_shape")
        return False
    if any(pattern.search(answer) for pattern in _SECRET_PATTERNS):
        emit_guardrail_event("security", "secret_disclosure")
        return False
    if _SYSTEM_PROMPT_REQUEST.search(answer):
        emit_guardrail_event("security", "prompt_disclosure")
        return False
    if _SENSITIVE_COMMERCIAL_TERMS.search(answer):
        emit_guardrail_event("content", "sensitive_commercial_disclosure")
        return False
    return True


OUTPUT_BLOCK_MESSAGE = (
    "No puedo proporcionar esa respuesta de forma segura. Puedo ayudarte con "
    "información comercial autorizada y respaldada por las fuentes disponibles."
)