"""merge teach_session and peer_learning branches

Revision ID: 7d12cd63ab9e
Revises: 893a61cd0e60, c4f5e8a7b9d1
Create Date: 2025-11-08 16:00:16.109881

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7d12cd63ab9e'
down_revision: Union[str, Sequence[str], None] = ('893a61cd0e60', '9815bd594e42')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
