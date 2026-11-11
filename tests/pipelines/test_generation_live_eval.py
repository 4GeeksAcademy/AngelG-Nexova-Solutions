"""Opt-in live checks for generated answers against retrieved Nexova evidence.

Run only with explicit opt-in; every case calls the configured retrieval and
text-generation providers and may incur usage charges:
RUN_LIVE_RAG_GENERATION_EVAL=1 DATABASE_URL='' \
PYTHONPATH="$PWD:$PWD/services/api" \
  uv run --directory services/api pytest -q \
  ../../tests/pipelines/test_generation_live_eval.py

This suite does not write to Qdrant or a database. It uses deterministic checks
for required business facts and numeric claims, not an LLM-as-judge score.
"""

import os
import re

import pytest

from data.pipelines.rag import generate_answer, retrieve

if os.getenv("RUN_LIVE_RAG_GENERATION_EVAL") == "1" and not os.getenv(
    "GENERATION_MODEL_ID"
):
    pytest.fail(
        "GENERATION_MODEL_ID debe configurarse para ejecutar la evaluación live "
        "de generación; no se consultó el proveedor de generación.",
        pytrace=False,
    )

CASES = [
    {
        "id": "discount-approval",
        "question": "¿Pueden bajar la tarifa estándar de headhunting del 22% al 15%?",
        "sources": {"objection-handling", "pricing-model"},
        "required": [r"Marcos\s+Ib[aá]ñez", r"aprobaci[oó]n"],
        "forbidden": [r"(?:ofrecemos|aplicamos|autorizamos|concedemos)\s+(?:el\s+)?(?:descuento|15\s*%)"],
    },
    {
        "id": "payment-terms",
        "question": "Soy cliente nuevo: ¿puedo pagar todo al final cuando empiece el candidato?",
        "sources": {"objection-handling", "pricing-model"},
        "required": [
            r"30\s*/\s*30\s*/\s*40|30\s*%\s+al\s+iniciar.{0,300}30\s*%\s+al\s+presentar.{0,300}40\s*%\s+(?:al|en)\s+(?:el\s+)?momento",
            r"(?:no\s+negociable|no\s+es\s+negociable|est[aá]ndar)",
        ],
        "forbidden": [r"(?:puedes|puede|podr[aí]as|podr[ií]a)\s+pagar\s+todo\s+al\s+final"],
    },
    {
        "id": "shortlist-objection",
        "question": "¿Qué pasa si no aceptamos a ningún candidato de la terna?",
        "sources": {"objection-handling"},
        "required": [
            r"(?:segunda\s+ronda|ronda\s+adicional|b[uú]squeda\s+adicional)",
            r"sin\s+costo|sin\s+coste|gratuit",
            r"feedback\s+espec[ií]fico",
        ],
        "forbidden": [],
    },
    {
        "id": "competitor-transparency",
        "question": "¿Trabajan con competidores directos y me lo ocultarían?",
        "sources": {"objection-handling"},
        "required": [
            r"transparen|comunicar|informar",
            r"conflicto\s+directo|conflicto\s+de\s+inter[eé]s|competencia\s+directa.{0,120}simult[aá]neamente|b[uú]squeda\s+paralela.{0,100}competidor\s+directo",
        ],
        "forbidden": [r"(?:nunca|jam[aá]s)\s+hemos\s+trabajado\s+con\s+competidores"],
    },
    {
        "id": "executive-timing",
        "question": "¿Garantizan una terna ejecutiva en ocho semanas?",
        "sources": {"hiring-process-sla"},
        "required": [
            r"8\s*semanas|ocho\s+semanas",
            r"promedio",
            r"no\s+(?:es\s+)?una\s+garant[ií]a|no\s+garantiza|no\s+de\s+una\s+garant[ií]a|no.{0,30}garant[ií]a\s+contractual|no\s+como\s+(?:una\s+)?garant[ií]a(?:\s+fija)?|no\s+puedo\s+ofrecer\s+plazos\s+garantizados",
        ],
        "forbidden": [r"garantizamos\s+(?:la\s+)?terna\s+en\s+(?:8|ocho)\s+semanas"],
    },
    {
        "id": "outsourcing-scope",
        "question": "¿Qué incluye el outsourcing de soporte al cliente?",
        "sources": {"service-lines"},
        "required": [
            r"supervisi[oó]n\s+de\s+calidad|monitoreo\s+continuo\s+de\s+la\s+calidad\s+del\s+servicio",
            r"reporting\s+mensual(?:\s+de\s+slas)?|informe\s+mensual(?:\s+de\s+slas)?|reportes?\s+mensuales?\s+de\s+cumplimiento\s+de\s+slas",
        ],
        "forbidden": [],
    },
    {
        "id": "training-price",
        "question": "¿Cuánto cuesta un programa de formación corporativa de ocho semanas para un grupo de hasta quince personas?",
        "sources": {"pricing-model"},
        "required": [r"6[.,]?200\s*(?:USD|d[oó]lares)|(?:USD|d[oó]lares)\s*6[.,]?200", r"15\s+personas|quince\s+personas"],
        "forbidden": [],
    },
    {
        "id": "replacement-guarantee",
        "question": "¿Qué garantía hay si el candidato deja el puesto poco después de contratarlo?",
        "sources": {"pricing-model", "objection-handling"},
        "required": [r"reemplazo", r"6\s*meses|seis\s+meses"],
        "forbidden": [r"garant[ií]a\s+de\s+(?:por\s+vida|12\s+meses)"],
    },
]

NUMBER_PATTERN = re.compile(r"\d+(?:[.,]\d+)*")


def _number_values(text: str) -> set[str]:
    """Normalize numeric claims, excluding ordered-list labels such as ``1.``."""
    text = re.sub(r"(?m)^\s*\d+[.)]\s+", "", text)
    return {match.group().replace(".", "").replace(",", "") for match in NUMBER_PATTERN.finditer(text)}


def _answer_issues(case: dict, answer: str, evidence: list[dict]) -> tuple[list[str], list[str], set[str]]:
    # Strip common Markdown emphasis so formatting such as ``**30%**`` does
    # not break otherwise valid business-fact patterns.
    plain_answer = re.sub(r"[*_`~]", "", answer)
    normalized_answer = " ".join(plain_answer.casefold().split())
    normalized_evidence = " ".join(str(item.get("text", "")) for item in evidence)

    missing = [
        pattern
        for pattern in case["required"]
        if re.search(pattern, normalized_answer, re.IGNORECASE) is None
    ]
    violations = [
        pattern
        for pattern in case["forbidden"]
        if re.search(pattern, normalized_answer, re.IGNORECASE) is not None
    ]
    # A response may repeat a proposed figure from the prospect's question
    # (for example, the requested 15% discount) to reject or qualify it.
    unsupported_numbers = (
        _number_values(answer)
        - _number_values(normalized_evidence)
        - _number_values(case["question"])
    )
    return missing, violations, unsupported_numbers


@pytest.mark.parametrize("case", CASES, ids=[case["id"] for case in CASES])
@pytest.mark.skipif(
    os.getenv("RUN_LIVE_RAG_GENERATION_EVAL") != "1",
    reason="opt-in: consulta embeddings/Qdrant y el proveedor de generación configurados",
)
def test_live_generated_answer_obeys_evidence_and_business_rules(case):
    evidence = retrieve(case["question"], k=3)
    retrieved_sources = {str(item.get("source_document", "")) for item in evidence}
    assert evidence, f"{case['id']}: retrieval no devolvió evidencia"
    assert retrieved_sources & case["sources"], (
        f"{case['id']}: fuentes esperadas {sorted(case['sources'])}, "
        f"recibidas {sorted(retrieved_sources)}"
    )

    answer = generate_answer(case["question"], evidence)
    missing, violations, unsupported_numbers = _answer_issues(case, answer, evidence)

    assert not missing, f"{case['id']}: faltan hechos requeridos {missing}. Respuesta: {answer}"
    assert not violations, f"{case['id']}: afirmaciones prohibidas {violations}. Respuesta: {answer}"
    assert not unsupported_numbers, (
        f"{case['id']}: números no respaldados por la evidencia: "
        f"{sorted(unsupported_numbers)}. Respuesta: {answer}"
    )


@pytest.mark.parametrize(
    ("case_id", "answer", "evidence_text"),
    [
        (
            "payment-terms",
            "El esquema de pago estándar es en tres momentos: 30% al iniciar la búsqueda, 30% al presentar la terna final y 40% en el momento de la contratación. No es negociable.",
            "El esquema de pago en tres momentos (30/30/40) es estándar y no es negociable para nuevos clientes.",
        ),
        (
            "payment-terms",
            'El esquema para nuevos clientes es estándar y no es negociable. Se estructura en tres hitos:\n\n1.  **30%** al iniciar la búsqueda.\n2.  **30%** al presentarte la terna final de candidatos.\n3.  **40%** en el momento de la contratación.',
            "El esquema de pago en tres momentos (30/30/40) es estándar y no es negociable para nuevos clientes.",
        ),
        (
            "shortlist-objection",
            "Si ninguno de los profesionales de la primera terna se ajusta, Nexova realiza una segunda ronda de búsqueda sin costo. Necesitamos feedback específico.",
            "Nexova ofrece una ronda adicional de búsqueda sin costo si el cliente da feedback específico.",
        ),
        (
            "executive-timing",
            "Para perfiles ejecutivos el tiempo promedio es de 8 semanas. Es un promedio, no de una garantía contractual.",
            "Perfil ejecutivo: 8 semanas promedio. Estos tiempos son promedios, no una garantía contractual estricta.",
        ),
        (
            "executive-timing",
            "Para un perfil ejecutivo, el tiempo promedio de entrega es de 8 semanas. Es un promedio, no como una garantía fija. El plazo real puede variar.",
            "Perfil ejecutivo: 8 semanas promedio. Estos tiempos son promedios, no una garantía contractual estricta.",
        ),
        (
            "outsourcing-scope",
            "Incluye supervisión de calidad y un informe mensual de SLAs.",
            "Incluye supervisión de calidad y reporting mensual de SLAs.",
        ),
        (
            "outsourcing-scope",
            "Se incluye monitoreo continuo de la calidad del servicio y reportes mensuales de cumplimiento de SLAs.",
            "Incluye supervisión de calidad y reporting mensual de SLAs.",
        ),
        (
            "outsourcing-scope",
            "1. **Equipo dedicado:** mínimo 5 agentes.\n2. **Gestión y supervisión:** monitoreo continuo de la calidad del servicio y reporting mensual de cumplimiento de SLAs.\n3. **Costos cubiertos:** tarifa de 1.800 a 2.400 USD. Contrato mínimo de 6 meses.",
            "El equipo mínimo es de 5 agentes; la tarifa mensual es de 1.800 a 2.400 USD. El contrato mínimo es de 6 meses e incluye supervisión de calidad y reporting mensual de SLAs.",
        ),
        (
            "competitor-transparency",
            "No trabajamos con dos empresas que sean competencia directa en el mismo proceso de selección simultáneamente. Es posible que hayamos trabajado con competidores en procesos anteriores y lo comunicamos con transparencia.",
            "No se acepta conflicto directo durante procesos simultáneos; comunicamos relaciones previas con competidores.",
        ),
        (
            "competitor-transparency",
            "No trabajamos con dos empresas que sean competencia directa en el mismo proceso de selección de forma simultánea. Eso sería un conflicto de interés y no lo hacemos. Si en el pasado hemos trabajado con alguna empresa de tu sector, te lo diremos abiertamente con total transparencia.",
            "No tomamos búsquedas paralelas para competidores directos por el mismo perfil. Comunicamos relaciones previas con competidores.",
        ),
    ],
    ids=[
        "payment-breakdown",
        "payment-numbered-markdown-list",
        "second-search-round",
        "average-not-contractual",
        "average-not-fixed-guarantee",
        "monthly-SLA-report",
        "monthly-SLA-compliance-reports",
        "outsourcing-numbered-list",
        "competitor-policy-paraphrase",
        "competitor-conflict-of-interest",
    ],
)
def test_live_rules_accept_grounded_paraphrases(case_id, answer, evidence_text):
    """Known good live paraphrases should not fail due to wording differences."""
    case = next(item for item in CASES if item["id"] == case_id)
    missing, violations, unsupported_numbers = _answer_issues(
        case, answer, [{"text": evidence_text}]
    )

    assert not missing
    assert not violations
    assert not unsupported_numbers


def test_live_rules_still_reject_false_commercial_claims_and_unsupported_numbers():
    payment_case = next(item for item in CASES if item["id"] == "payment-terms")
    missing, violations, unsupported_numbers = _answer_issues(
        payment_case,
        "Puedes pagar todo al final; el esquema es 20/30/50.",
        [{"text": "El esquema estándar es 30/30/40."}],
    )

    assert missing
    assert violations
    assert unsupported_numbers == {"20", "50"}
