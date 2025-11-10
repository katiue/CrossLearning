"""add_coins_column_to_users

Revision ID: 559bd4d3525c
Revises: 7d12cd63ab9e
Create Date: 2025-11-08 22:00:42.628212

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '559bd4d3525c'
down_revision: Union[str, Sequence[str], None] = '7d12cd63ab9e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
