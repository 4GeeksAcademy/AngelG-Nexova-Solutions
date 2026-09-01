from tinydb import Query

from database import (
    notes_table,
    password_reset_tokens_table,
    profiles_table,
    records_table,
    users_table
)


User = Query()
Profile = Query()
ResetToken = Query()
Record = Query()
Note = Query()


def get_user_by_id(user_id: str):
    return users_table.get(
        User.id == user_id
    )


def get_user_by_email(email: str):
    return users_table.get(
        User.email == email
    )


def get_all_users():
    return users_table.all()


def create_user(user: dict, profile: dict):
    users_table.insert(user)
    profiles_table.insert(profile)

    return user


def update_user(user_id: str, changes: dict):
    users_table.update(
        changes,
        User.id == user_id
    )

    return get_user_by_id(user_id)


def delete_user(user_id: str):
    users_table.remove(
        User.id == user_id
    )

    profiles_table.remove(
        Profile.user_id == user_id
    )


def get_profile_by_user_id(user_id: str):
    return profiles_table.get(
        Profile.user_id == user_id
    )


def update_profile(user_id: str, changes: dict):
    profiles_table.update(
        changes,
        Profile.user_id == user_id
    )

    return get_profile_by_user_id(user_id)


def invalidate_active_reset_tokens(user_id: str, used_at: str):
    # Evita que queden varios tokens de reset activos para el mismo usuario.
    password_reset_tokens_table.update(
        {"used_at": used_at},
        (ResetToken.user_id == user_id) & (ResetToken.used_at == None)  # noqa: E711
    )


def create_reset_token(token_record: dict):
    password_reset_tokens_table.insert(token_record)

    return token_record


def get_reset_token_by_hash(token_hash: str):
    return password_reset_tokens_table.get(
        ResetToken.token_hash == token_hash
    )


def consume_reset_token(token_hash: str, now_iso: str, used_at: str):
    # Update condicionado: solo marca como usado si sigue vigente y sin usar,
    # para minimizar la ventana de una condición de carrera con reset simultáneos.
    updated_ids = password_reset_tokens_table.update(
        {"used_at": used_at},
        (ResetToken.token_hash == token_hash)
        & (ResetToken.used_at == None)  # noqa: E711
        & (ResetToken.expires_at > now_iso)
    )

    return len(updated_ids) > 0


def get_records():
    return records_table.all()


def get_record_by_id(record_id: str):
    return records_table.get(
        Record.id == record_id
    )


def create_record(record: dict):
    records_table.insert(record)

    return record


def update_record(record_id: str, changes: dict):
    records_table.update(
        changes,
        Record.id == record_id
    )

    return get_record_by_id(record_id)


def get_notes_by_record(record_id: str):
    return notes_table.search(
        Note.record_id == record_id
    )


def create_note(note: dict):
    notes_table.insert(note)

    return note


def delete_note(record_id: str, note_id: str):
    notes_table.remove(
        (Note.id == note_id) & (Note.record_id == record_id)
    )


def set_record_notes_count(record_id: str, notes_count: int):
    records_table.update(
        {"notes_count": notes_count},
        Record.id == record_id
    )