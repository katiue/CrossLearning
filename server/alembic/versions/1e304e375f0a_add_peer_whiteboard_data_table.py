"""add_peer_whiteboard_data_table

Revision ID: 1e304e375f0a
Revises: c9bcae62097e
Create Date: 2025-11-08 23:11:59.331958

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1e304e375f0a'
down_revision: Union[str, Sequence[str], None] = 'c9bcae62097e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'peer_whiteboard_data',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('peer_session_id', sa.String(), nullable=False),
        sa.Column('drawing_data', sa.JSON(), nullable=False),
        sa.Column('snapshot_url', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['peer_session_id'], ['peer_learning_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('peer_whiteboard_data')
