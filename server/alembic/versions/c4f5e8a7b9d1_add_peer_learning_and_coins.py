"""add peer learning and coins

Revision ID: c4f5e8a7b9d1
Revises: ad1ca8d676ab
Create Date: 2025-01-08 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c4f5e8a7b9d1'
down_revision = 'ad1ca8d676ab'
branch_labels = None
depends_on = None


def upgrade():
    # Add coins column to users table
    op.add_column('users', sa.Column('coins', sa.Integer(), nullable=False, server_default='0'))
    
    # Create peer_learning_sessions table
    op.create_table(
        'peer_learning_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('source_session_id', sa.String(), nullable=False),
        sa.Column('teacher_user_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('topic', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('max_students', sa.Integer(), nullable=True),
        sa.Column('average_rating', sa.Float(), nullable=True),
        sa.Column('total_ratings', sa.Integer(), nullable=True),
        sa.Column('upvotes', sa.Integer(), nullable=True),
        sa.Column('coins_earned', sa.Integer(), nullable=True),
        sa.Column('enrolled_student_ids', sa.JSON(), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['source_session_id'], ['teach_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['teacher_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create peer_session_messages table
    op.create_table(
        'peer_session_messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('peer_session_id', sa.String(), nullable=False),
        sa.Column('sender_id', sa.String(), nullable=False),
        sa.Column('sender_role', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('message_type', sa.String(), nullable=True),
        sa.Column('audio_duration', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['peer_session_id'], ['peer_learning_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create peer_session_ratings table
    op.create_table(
        'peer_session_ratings',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('peer_session_id', sa.String(), nullable=False),
        sa.Column('student_id', sa.String(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('upvoted', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['peer_session_id'], ['peer_learning_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    # Drop tables in reverse order
    op.drop_table('peer_session_ratings')
    op.drop_table('peer_session_messages')
    op.drop_table('peer_learning_sessions')
    
    # Remove coins column from users
    op.drop_column('users', 'coins')
