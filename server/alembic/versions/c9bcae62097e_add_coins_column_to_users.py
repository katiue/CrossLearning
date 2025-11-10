"""add_coins_column_to_users

Revision ID: c9bcae62097e
Revises: 559bd4d3525c
Create Date: 2025-11-08 22:00:56.335707

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9bcae62097e'
down_revision: Union[str, Sequence[str], None] = '559bd4d3525c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add coins column to users table with default value
    op.add_column('users', sa.Column('coins', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove coins column from users table
    op.drop_column('users', 'coins')
