"""support Google sign-in accounts

Revision ID: 9e4c37ab1d02
Revises: c3e799d7eb44
Create Date: 2026-10-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9e4c37ab1d02"
down_revision: str | Sequence[str] | None = "c3e799d7eb44"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("password_hash", existing_type=sa.String(length=255), nullable=True)
        batch_op.add_column(sa.Column("google_subject", sa.String(length=255), nullable=True))
        batch_op.create_index("ix_users_google_subject", ["google_subject"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("ix_users_google_subject")
        batch_op.drop_column("google_subject")
        batch_op.alter_column("password_hash", existing_type=sa.String(length=255), nullable=False)
