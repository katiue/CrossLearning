"""update_peer_learning_remove_source_session_fk

Revision ID: 9815bd594e42
Revises: 7d12cd63ab9e
Create Date: 2025-11-08 16:01:08.713844

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9815bd594e42'
down_revision: Union[str, Sequence[str], None] = 'c4f5e8a7b9d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop the foreign key constraint to source_session_id
    op.drop_constraint('peer_learning_sessions_source_session_id_fkey', 'peer_learning_sessions', type_='foreignkey')
    
    # Drop the source_session_id column
    op.drop_column('peer_learning_sessions', 'source_session_id')
    
    # Add teacher_best_score column
    op.add_column('peer_learning_sessions', sa.Column('teacher_best_score', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Add back source_session_id column
    op.add_column('peer_learning_sessions', sa.Column('source_session_id', sa.String(), nullable=True))
    
    # Add back the foreign key constraint (nullable for downgrade)
    op.create_foreign_key(
        'peer_learning_sessions_source_session_id_fkey',
        'peer_learning_sessions',
        'teach_sessions',
        ['source_session_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    # Drop teacher_best_score column
    op.drop_column('peer_learning_sessions', 'teacher_best_score')
