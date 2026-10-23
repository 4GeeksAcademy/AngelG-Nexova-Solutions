from datetime import datetime, timezone

from tinydb import Query

from database import db, notes_table, records_table


SEED_NAME = "talent-pipeline-demo-records-v1"
STATUSES = ["received", "in_progress", "selected", "discarded"]
STAGES = [
    "pending",
    "review",
    "personal_interview",
    "technical_interview",
    "offer_presented",
]


def build_demo_records(now: str) -> list[dict]:
    records = [
        {
            "id": "cand-001",
            "full_name": "Lucia Martinez",
            "email": "lucia.martinez@example.com",
            "phone": "+34 600 111 222",
            "position": "Executive Assistant",
            "linkedin_url": "https://linkedin.com/in/lucia-martinez",
            "cv_url": None,
            "status": "in_progress",
            "stage": "review",
            "experience_years": 5,
            "notes_count": 1,
            "applied_at": now,
            "updated_at": now,
        },
        {
            "id": "cand-002",
            "full_name": "Carlos Ruiz",
            "email": "carlos.ruiz@example.com",
            "phone": "+34 600 333 444",
            "position": "Executive Assistant",
            "linkedin_url": None,
            "cv_url": None,
            "status": "received",
            "stage": "pending",
            "experience_years": 3,
            "notes_count": 0,
            "applied_at": now,
            "updated_at": now,
        },
        {
            "id": "cand-003",
            "full_name": "Marina Santos",
            "email": "marina.santos@example.com",
            "phone": "+34 600 000 003",
            "position": "Executive Assistant",
            "linkedin_url": None,
            "cv_url": None,
            "status": "selected",
            "stage": "offer_presented",
            "experience_years": 7,
            "notes_count": 0,
            "applied_at": now,
            "updated_at": now,
        },
        {
            "id": "cand-004",
            "full_name": "Diego Navarro",
            "email": "diego.navarro@example.com",
            "phone": "+34 600 000 004",
            "position": "Executive Assistant",
            "linkedin_url": None,
            "cv_url": None,
            "status": "discarded",
            "stage": "personal_interview",
            "experience_years": 4,
            "notes_count": 0,
            "applied_at": now,
            "updated_at": now,
        },
        {
            "id": "cand-005",
            "full_name": "Paula Medina",
            "email": "paula.medina@example.com",
            "phone": "+34 600 000 005",
            "position": "Executive Assistant",
            "linkedin_url": None,
            "cv_url": None,
            "status": "in_progress",
            "stage": "technical_interview",
            "experience_years": 6,
            "notes_count": 0,
            "applied_at": now,
            "updated_at": now,
        },
    ]

    covered = {(record["status"], record["stage"]) for record in records}
    for status in STATUSES:
        missing_stages = [stage for stage in STAGES if (status, stage) not in covered]
        for index, stage in enumerate(missing_stages):
            record_id = f"demo-{status}-{stage}"
            records.append(
                {
                    "id": record_id,
                    "full_name": f"Demo {status} {stage}",
                    "email": f"{record_id}@example.com",
                    "phone": "+34 600 000 000",
                    "position": "Executive Assistant",
                    "linkedin_url": None,
                    "cv_url": None,
                    "status": status,
                    "stage": stage,
                    "experience_years": index + 1,
                    "notes_count": 0,
                    "applied_at": now,
                    "updated_at": now,
                }
            )

    return records


def main() -> None:
    seed_state = db.table("seed_state")
    seed_query = Query()
    if seed_state.contains(seed_query.name == SEED_NAME):
        return

    if records_table.all():
        seed_state.insert({"name": SEED_NAME, "status": "skipped_existing_records"})
        return

    now = datetime.now(timezone.utc).isoformat()
    records_table.insert_multiple(build_demo_records(now))
    notes_table.insert(
        {
            "id": "note-001",
            "record_id": "cand-001",
            "content": "Perfil solido para coordinacion ejecutiva.",
            "created_at": now,
        }
    )
    seed_state.insert({"name": SEED_NAME, "status": "seeded"})


if __name__ == "__main__":
    main()