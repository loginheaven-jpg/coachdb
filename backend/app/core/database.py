from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator

from app.core.config import settings

# Create async engine (use async_database_url for Railway compatibility)
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.DATABASE_ECHO,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Create base class for models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting async database sessions.
    Usage: db: AsyncSession = Depends(get_db)
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database - run migrations and create all tables"""
    import subprocess
    import os
    from sqlalchemy import text

    # First, fix any missing enum values (must be done outside transaction)
    # This is needed because ALTER TYPE ADD VALUE cannot run in a transaction
    try:
        # Use a raw connection with autocommit for enum fixes
        from sqlalchemy import create_engine
        # Convert async URL to sync URL
        sync_url = settings.DATABASE_URL
        if "+asyncpg" in sync_url:
            sync_url = sync_url.replace("postgresql+asyncpg://", "postgresql://")
        sync_engine = create_engine(sync_url, isolation_level="AUTOCOMMIT")

        with sync_engine.connect() as conn:
            # ProjectStatus enum uses lowercase values (draft, pending, approved, etc.)
            # These already exist in the database, no need to add them

            # Add missing proofrequiredlevel enum values
            # SQLAlchemy sends uppercase enum names, so we need both cases
            proof_values = ['NOT_REQUIRED', 'OPTIONAL', 'REQUIRED', 'not_required', 'optional', 'required']
            for value in proof_values:
                try:
                    conn.execute(text(f"ALTER TYPE proofrequiredlevel ADD VALUE IF NOT EXISTS '{value}'"))
                    print(f"[DB] Added enum value '{value}' to proofrequiredlevel")
                except Exception as e:
                    if "already exists" not in str(e).lower():
                        print(f"[DB] Could not add enum value '{value}': {e}")

            # Add missing matchingtype enum values
            matching_values = ['EXACT', 'CONTAINS', 'RANGE', 'exact', 'contains', 'range']
            for value in matching_values:
                try:
                    conn.execute(text(f"ALTER TYPE matchingtype ADD VALUE IF NOT EXISTS '{value}'"))
                    print(f"[DB] Added enum value '{value}' to matchingtype")
                except Exception as e:
                    if "already exists" not in str(e).lower():
                        print(f"[DB] Could not add enum value '{value}': {e}")

        sync_engine.dispose()
        print(f"[DB] Enum fixes completed")
    except Exception as e:
        print(f"[DB] Enum fix skipped: {e}")

    # Run alembic migrations
    try:
        # Get the backend directory (where alembic.ini is located)
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        print(f"[DB] Running alembic migrations from {backend_dir}...")

        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            print(f"[DB] Alembic migrations completed successfully")
            if result.stdout:
                print(f"[DB] Migration output: {result.stdout}")
        else:
            print(f"[DB] Alembic migration warning: {result.stderr}")
    except Exception as e:
        print(f"[DB] Alembic migration skipped or failed: {e}")

    # Also ensure all tables exist (fallback)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Close database connection"""
    await engine.dispose()
