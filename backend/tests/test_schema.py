"""Schema rules from PRD 9.3, checked on real MySQL (P-049)."""

import re
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import Engine, delete, func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.db.models import Blob, Document, Project, User, Version

pytestmark = pytest.mark.integration

HASH_A = "a" * 64
HASH_B = "b" * 64
UUID4 = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")

DUPLICATE_KEY = 1062
CHECK_FAILED = 3819
ROW_IS_REFERENCED = 1451
NO_REFERENCED_ROW = 1452


@pytest.fixture
def session(migrated: Engine) -> Iterator[Session]:
    """Everything the test writes is rolled back afterwards."""
    connection = migrated.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    transaction.rollback()
    connection.close()


def mysql_error(info: pytest.ExceptionInfo[DBAPIError]) -> int:
    return int(info.value.orig.args[0])


def make_document(session: Session) -> Document:
    session.add(Blob(hash=HASH_A, size=5, content_type="text/markdown"))
    user = User(provider="github", provider_user_id="42", email="ada@example.com")
    session.add(user)
    session.flush()
    project = Project(user_id=user.id, name="Operating Systems Notes")
    session.add(project)
    session.flush()
    document = Document(project_id=project.id, path="Processes.md")
    session.add(document)
    session.flush()
    return document


def add_version(
    session: Session, document: Document, number: int, parent: Version | None = None
) -> Version:
    version = Version(
        document_id=document.id,
        number=number,
        content_hash=HASH_A,
        parent_version_id=parent.id if parent else None,
    )
    session.add(version)
    session.flush()
    return version


def test_public_ids_are_random_uuid4_strings(session: Session) -> None:
    first = User(provider="github", provider_user_id="1")
    second = User(provider="google", provider_user_id="1")
    session.add_all([first, second])
    session.flush()
    assert UUID4.fullmatch(first.public_id)
    assert UUID4.fullmatch(second.public_id)
    assert first.public_id != second.public_id


def test_created_at_is_set_by_mysql_in_utc(session: Session) -> None:
    user = User(provider="github", provider_user_id="7")
    session.add(user)
    session.flush()
    session.refresh(user)
    now = datetime.now(UTC).replace(tzinfo=None)
    # Wide enough for clock drift, far below any time-zone offset.
    assert abs(user.created_at - now) < timedelta(minutes=2)


def test_text_round_trips_as_utf8mb4(session: Session) -> None:
    name = "Notes 😀 中文 — ünïcode"
    user = User(provider="github", provider_user_id="8")
    session.add(user)
    session.flush()
    project = Project(user_id=user.id, name=name)
    session.add(project)
    session.flush()
    project_id = project.id
    session.expire_all()
    assert session.scalar(select(Project.name).where(Project.id == project_id)) == name


def test_a_provider_account_maps_to_one_user(session: Session) -> None:
    session.add(User(provider="github", provider_user_id="42"))
    session.flush()
    session.add(User(provider="github", provider_user_id="42"))
    with pytest.raises(DBAPIError) as info:
        session.flush()
    assert mysql_error(info) == DUPLICATE_KEY


def test_the_same_account_id_on_another_provider_is_another_user(session: Session) -> None:
    session.add_all(
        [
            User(provider="github", provider_user_id="42"),
            User(provider="google", provider_user_id="42"),
        ]
    )
    session.flush()


def test_public_ids_are_unique(session: Session) -> None:
    first = User(provider="github", provider_user_id="1")
    session.add(first)
    session.flush()
    session.add(User(provider="github", provider_user_id="2", public_id=first.public_id))
    with pytest.raises(DBAPIError) as info:
        session.flush()
    assert mysql_error(info) == DUPLICATE_KEY


def test_provider_must_be_github_or_google(session: Session) -> None:
    session.add(User(provider="gitlab", provider_user_id="1"))
    with pytest.raises(DBAPIError) as info:
        session.flush()
    assert mysql_error(info) == CHECK_FAILED


def test_version_numbers_are_unique_per_document(session: Session) -> None:
    document = make_document(session)
    add_version(session, document, 1)
    other = Document(project_id=document.project_id, path="Threads.md")
    session.add(other)
    session.flush()
    add_version(session, other, 1)  # another document may reuse the number
    with pytest.raises(DBAPIError) as info:
        add_version(session, document, 1)
    assert mysql_error(info) == DUPLICATE_KEY


def test_documents_may_share_a_path(session: Session) -> None:
    document = make_document(session)
    session.add(Document(project_id=document.project_id, path=document.path))
    session.flush()


def test_versions_must_point_at_a_stored_blob(session: Session) -> None:
    document = make_document(session)
    session.add(Version(document_id=document.id, number=1, content_hash=HASH_B))
    with pytest.raises(DBAPIError) as info:
        session.flush()
    assert mysql_error(info) == NO_REFERENCED_ROW


def test_a_blob_in_use_cannot_be_deleted(session: Session) -> None:
    add_version(session, make_document(session), 1)
    with pytest.raises(DBAPIError) as info:
        session.execute(delete(Blob).where(Blob.hash == HASH_A))
    assert mysql_error(info) == ROW_IS_REFERENCED


def test_deleting_a_version_clears_its_childs_parent(session: Session) -> None:
    document = make_document(session)
    first = add_version(session, document, 1)
    second = add_version(session, document, 2, parent=first)
    session.execute(delete(Version).where(Version.id == first.id))
    session.refresh(second)
    assert second.parent_version_id is None


def test_deleting_a_user_removes_their_projects_documents_and_versions(session: Session) -> None:
    document = make_document(session)
    add_version(session, document, 1)
    document_id, project_id = document.id, document.project_id
    user_id = session.scalar(select(Project.user_id).where(Project.id == project_id))

    session.execute(delete(User).where(User.id == user_id))

    def count(model: type, *where: object) -> int:
        return session.scalar(select(func.count()).select_from(model).where(*where)) or 0

    assert count(Project, Project.id == project_id) == 0
    assert count(Document, Document.id == document_id) == 0
    assert count(Version, Version.document_id == document_id) == 0
    assert count(Blob, Blob.hash == HASH_A) == 1  # blobs are shared; cleanup is separate
