"""Initial schema: users, projects, documents, versions, blobs (PRD 9.2).

Revision ID: 0001
Revises:
Create Date: 2026-10-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE_OPTIONS = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_0900_ai_ci",
}


def created_at() -> sa.Column[mysql.DATETIME]:
    return sa.Column(
        "created_at",
        mysql.DATETIME(fsp=6),
        server_default=sa.text("CURRENT_TIMESTAMP(6)"),
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "blobs",
        sa.Column("hash", mysql.CHAR(length=64), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        created_at(),
        sa.PrimaryKeyConstraint("hash", name=op.f("pk_blobs")),
        **TABLE_OPTIONS,
    )
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("provider", sa.String(length=16), nullable=False),
        sa.Column("provider_user_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        created_at(),
        sa.CheckConstraint("provider IN ('github', 'google')", name=op.f("ck_users_provider")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint(
            "provider", "provider_user_id", name=op.f("uq_users_provider_provider_user_id")
        ),
        sa.UniqueConstraint("public_id", name=op.f("uq_users_public_id")),
        **TABLE_OPTIONS,
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        created_at(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_projects_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
        sa.UniqueConstraint("public_id", name=op.f("uq_projects_public_id")),
        **TABLE_OPTIONS,
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("path", sa.String(length=1024), nullable=False),
        created_at(),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_documents_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_documents")),
        sa.UniqueConstraint("public_id", name=op.f("uq_documents_public_id")),
        **TABLE_OPTIONS,
    )
    op.create_table(
        "versions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("document_id", sa.BigInteger(), nullable=False),
        sa.Column("parent_version_id", sa.BigInteger(), nullable=True),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("content_hash", mysql.CHAR(length=64), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=True),
        created_at(),
        sa.ForeignKeyConstraint(
            ["content_hash"],
            ["blobs.hash"],
            name=op.f("fk_versions_content_hash_blobs"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_versions_document_id_documents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["parent_version_id"],
            ["versions.id"],
            name=op.f("fk_versions_parent_version_id_versions"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_versions")),
        sa.UniqueConstraint("document_id", "number", name=op.f("uq_versions_document_id_number")),
        sa.UniqueConstraint("public_id", name=op.f("uq_versions_public_id")),
        **TABLE_OPTIONS,
    )


def downgrade() -> None:
    op.drop_table("versions")
    op.drop_table("documents")
    op.drop_table("projects")
    op.drop_table("users")
    op.drop_table("blobs")
