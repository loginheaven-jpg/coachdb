"""
Create test data for template-based survey system testing
"""
import asyncio
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models.project import Project, ProjectStatus
from app.models.competency import (
    CompetencyItem,
    ProjectItem,
    ProofRequiredLevel
)
from app.models.user import User


async def create_test_projects(async_session_maker):
    """Create 2 test projects with all template-based items"""
    print("Creating test projects...")

    async with async_session_maker() as session:
        async with session.begin():
            # Find an admin user to create projects
            result = await session.execute(
                select(User).where(User.roles.contains('"admin"')).limit(1)
            )
            admin_user = result.scalar_one()
            print(f"Using admin user: {admin_user.name} (ID: {admin_user.user_id})")

            # Create 2 test projects
            today = date.today()
            projects = []

            for i in range(1, 3):
                project = Project(
                    project_name=f"템플릿 테스트 과제 {i}",
                    description=f"템플릿 기반 설문 시스템 테스트를 위한 과제 {i}번입니다. 모든 템플릿 항목을 포함합니다.",
                    recruitment_start_date=today,
                    recruitment_end_date=today + timedelta(days=30),
                    project_start_date=today + timedelta(days=35),
                    project_end_date=today + timedelta(days=65),
                    status=ProjectStatus.RECRUITING,
                    max_participants=10,
                    created_by=admin_user.user_id
                )
                session.add(project)
                projects.append(project)

            await session.flush()
            print(f"Created projects with IDs: {[p.project_id for p in projects]}")

            # Get all template-based competency items
            result = await session.execute(
                select(CompetencyItem)
                .where(CompetencyItem.template.isnot(None))
                .where(CompetencyItem.is_active == True)
            )
            items = result.scalars().all()
            print(f"Found {len(items)} template-based items")

            # Add all items to both projects with 'optional' proof requirement
            # Use raw SQL to bypass SQLAlchemy Enum issues
            from sqlalchemy import text

            project_items_data = []
            for project in projects:
                display_order = 1
                for item in items:
                    # Calculate score based on item type
                    if 'EVAL' in item.item_code:
                        max_score = Decimal('15')
                    elif 'EDU' in item.item_code or 'CERT' in item.item_code:
                        max_score = Decimal('8')
                    elif 'COACHING' in item.item_code:
                        max_score = Decimal('6')
                    else:
                        max_score = Decimal('5')

                    project_items_data.append({
                        'project_id': project.project_id,
                        'item_id': item.item_id,
                        'is_required': True,
                        'proof_required_level': 'optional',
                        'max_score': max_score,
                        'display_order': display_order
                    })
                    display_order += 1

            # Insert using raw SQL (one at a time to ensure proper enum casting)
            insert_sql = text("""
                INSERT INTO project_items (project_id, item_id, is_required, proof_required_level, max_score, display_order)
                VALUES (:project_id, :item_id, :is_required, CAST(:proof_required_level AS proofrequiredlevel), :max_score, :display_order)
            """)

            for item_data in project_items_data:
                await session.execute(insert_sql, item_data)

            print(f"Created {len(project_items_data)} project items across {len(projects)} projects")

            return [p.project_id for p in projects]


async def list_available_coaches(async_session_maker):
    """List available coaches for manual application"""
    print("\nAvailable coaches for testing:")

    async with async_session_maker() as session:
        # Find coach users
        result = await session.execute(
            select(User)
            .where(User.roles.contains('"coach"'))
            .limit(5)
        )
        coaches = result.scalars().all()

        print(f"\nFound {len(coaches)} coach users:")
        for coach in coaches:
            print(f"  - {coach.name} (ID: {coach.user_id}, Email: {coach.email})")



async def verify_data(async_session_maker):
    """Verify the created data"""
    print("\n=== Verification ===")

    async with async_session_maker() as session:
        from sqlalchemy import text

        # Count projects using raw SQL
        result = await session.execute(
            text("SELECT project_id, project_name, status, recruitment_start_date, recruitment_end_date FROM projects WHERE project_name LIKE '%템플릿 테스트%'")
        )
        projects = result.fetchall()
        print(f"\nTest projects created: {len(projects)}")

        for project in projects:
            project_id, project_name, status, start_date, end_date = project

            # Count project items using raw SQL
            result = await session.execute(
                text("SELECT COUNT(*) as total, SUM(CASE WHEN is_required THEN 1 ELSE 0 END) as required_count, SUM(CASE WHEN proof_required_level = 'optional' THEN 1 ELSE 0 END) as optional_count FROM project_items WHERE project_id = :project_id"),
                {"project_id": project_id}
            )
            counts = result.fetchone()
            total, required_count, optional_count = counts

            print(f"\nProject: {project_name} (ID: {project_id})")
            print(f"  - Total Items: {total}")
            print(f"  - Required Items: {required_count}")
            print(f"  - Proof='optional': {optional_count}/{total}")
            print(f"  - Status: {status}")
            print(f"  - Recruitment: {start_date} ~ {end_date}")


async def main():
    """Main execution function"""
    print("Starting test data creation...\n")

    # Create async engine and session
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    try:
        # Create test projects with all template items
        project_ids = await create_test_projects(async_session_maker)

        # List available coaches for manual testing
        await list_available_coaches(async_session_maker)

        # Verify everything was created correctly
        await verify_data(async_session_maker)

        print("\n✅ Test data creation completed successfully!")
        print("\nNext Steps:")
        print("1. Login to the frontend with a coach account")
        print("2. Navigate to the projects page")
        print("3. Apply to one of the test projects")
        print("4. Fill out the application form using the template-based fields")
        print("5. Login as admin to verify the application and change proof_required_level")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
