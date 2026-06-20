"""add tournament type/scheduling fields and match status

Revision ID: a1b2c3d4e5f6
Revises: c1ab44651e79
Create Date: 2026-06-19 00:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "a1b2c3d4e5f6"
down_revision: str | None = "c1ab44651e79"
branch_labels: str | None = None
depends_on: str | None = None

tournament_type_enum = ENUM("GENERIC", "PICKLEBALL", name="tournament_type", create_type=True)
scheduling_mode_enum = ENUM("TIMED", "DYNAMIC", name="scheduling_mode", create_type=True)
match_status_enum = ENUM(
    "PENDING", "QUEUED", "PLAYING", "FINISHED", name="match_status", create_type=True
)


def upgrade() -> None:
    tournament_type_enum.create(op.get_bind(), checkfirst=True)
    scheduling_mode_enum.create(op.get_bind(), checkfirst=True)
    match_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "tournaments",
        sa.Column(
            "tournament_type",
            tournament_type_enum,
            server_default="GENERIC",
            nullable=False,
        ),
    )
    op.add_column(
        "tournaments",
        sa.Column(
            "scheduling_mode",
            scheduling_mode_enum,
            server_default="TIMED",
            nullable=False,
        ),
    )
    op.add_column(
        "tournaments",
        sa.Column("court_auto_advance", sa.Boolean(), server_default="t", nullable=False),
    )
    op.add_column(
        "tournaments",
        sa.Column("show_player_names", sa.Boolean(), server_default="f", nullable=False),
    )
    op.add_column(
        "matches",
        sa.Column("status", match_status_enum, server_default="PENDING", nullable=False),
    )
    op.add_column(
        "matches",
        sa.Column("walkover", sa.Boolean(), server_default="f", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("matches", "walkover")
    op.drop_column("matches", "status")
    op.drop_column("tournaments", "show_player_names")
    op.drop_column("tournaments", "court_auto_advance")
    op.drop_column("tournaments", "scheduling_mode")
    op.drop_column("tournaments", "tournament_type")
    match_status_enum.drop(op.get_bind())
    scheduling_mode_enum.drop(op.get_bind())
    tournament_type_enum.drop(op.get_bind())
