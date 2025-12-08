# Manual Setup Guide (Without Docker)

This guide will help you run the Coach Competency Database Service without Docker.

## Prerequisites

1. **Python 3.11+** - [Download](https://www.python.org/downloads/)
2. **Node.js 18+** - [Download](https://nodejs.org/)
3. **PostgreSQL 15** - [Download](https://www.postgresql.org/download/)
4. **Redis** (Optional) - [Download](https://redis.io/download/) or [Windows Build](https://github.com/microsoftarchive/redis/releases)

## Step 1: Setup PostgreSQL Database

### Option A: Install PostgreSQL Locally

1. Install PostgreSQL 15 from https://www.postgresql.org/download/windows/

2. During installation, remember your password for the `postgres` user

3. Open pgAdmin or command line and create the database:
   ```sql
   CREATE DATABASE coachdb;
   CREATE USER coachdb WITH ENCRYPTED PASSWORD 'coachdb123';
   GRANT ALL PRIVILEGES ON DATABASE coachdb TO coachdb;
   ```

### Option B: Use Cloud PostgreSQL (Free Tier)

**Supabase (Recommended for testing)**
1. Go to https://supabase.com/
2. Sign up for free
3. Create a new project
4. Copy the connection string from Project Settings > Database
5. Use this connection string in your `.env` file

**ElephantSQL (Free Tier)**
1. Go to https://www.elephantsql.com/
2. Sign up for free
3. Create a new instance (Tiny Turtle - Free)
4. Copy the connection URL

**Neon (Free Tier)**
1. Go to https://neon.tech/
2. Sign up for free
3. Create a new project
4. Copy the connection string

## Step 2: Setup Backend

1. **Navigate to backend directory**
   ```bash
   cd c:\dev\coachdb\backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment**
   ```bash
   # Windows Command Prompt
   venv\Scripts\activate.bat

   # Windows PowerShell
   venv\Scripts\Activate.ps1

   # If you get execution policy error in PowerShell, run:
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

4. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Create .env file**
   ```bash
   copy .env.example .env
   ```

6. **Edit .env file** (use Notepad or VS Code)

   Update the database URL with your PostgreSQL connection:
   ```env
   DATABASE_URL=postgresql+asyncpg://coachdb:coachdb123@localhost:5432/coachdb

   # Or if using cloud PostgreSQL, use their connection string
   # DATABASE_URL=postgresql+asyncpg://user:password@host:port/database

   # For file storage, use local for now
   FILE_STORAGE_TYPE=local
   FILE_STORAGE_PATH=./uploads

   # Generate a secure secret key (or use this for testing)
   SECRET_KEY=your-secret-key-change-in-production-min-32-chars-long-123456
   ```

7. **Create uploads directory**
   ```bash
   mkdir uploads
   ```

8. **Run database migrations**
   ```bash
   alembic upgrade head
   ```

9. **Start the backend server**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

10. **Verify backend is running**
    - Open browser: http://localhost:8000
    - You should see: `{"status":"ok","app":"Coach Competency Database Service","version":"1.0.0"}`
    - API Docs: http://localhost:8000/docs

## Step 3: Setup Frontend

1. **Open a NEW terminal** (keep backend running in the first terminal)

2. **Navigate to frontend directory**
   ```bash
   cd c:\dev\coachdb\frontend
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

   If you encounter errors, try:
   ```bash
   npm install --legacy-peer-deps
   ```

4. **Create .env file** (optional)
   ```bash
   echo VITE_API_URL=http://localhost:8000 > .env.local
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Verify frontend is running**
   - Open browser: http://localhost:5173
   - You should see the application homepage

## Step 4: Create Admin User (Optional)

You can create an admin user directly in the database:

```sql
-- Connect to your PostgreSQL database
psql -U coachdb -d coachdb

-- Or use pgAdmin GUI

-- Insert admin user (password: admin123)
INSERT INTO users (name, email, hashed_password, role, status, created_at)
VALUES (
  'Admin User',
  'admin@coachdb.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7YN5R5fJ6m',
  'admin',
  'active',
  NOW()
);

-- Insert test coach (password: coach123)
INSERT INTO users (name, email, hashed_password, role, status, created_at)
VALUES (
  'Test Coach',
  'coach@coachdb.com',
  '$2b$12$K8gZvKV3qXKRy5YF5aB9.OxYmBZQF3KdJqH8/3xMQJqhN8/LewY5N',
  'coach',
  'active',
  NOW()
);

-- Insert test staff (password: staff123)
INSERT INTO users (name, email, hashed_password, role, status, created_at)
VALUES (
  'Test Staff',
  'staff@coachdb.com',
  '$2b$12$M9hZvKV3qXKRy5YF5aB9.OxYmBZQF3KdJqH8/4yNQJqhN8/MfxZ6O',
  'staff',
  'active',
  NOW()
);
```

## Step 5: Seed Competency Items (Optional)

To populate the master competency items based on the evaluation criteria:

Create a file `backend/seed_competencies.py`:

```python
import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.competency import CompetencyItem, CompetencyCategory, InputType

async def seed_competencies():
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        result = await session.execute(select(CompetencyItem))
        if result.scalars().first():
            print("Competency items already seeded")
            return

        items = [
            # Information Items (No Score)
            CompetencyItem(item_name="이름", item_code="name", category=CompetencyCategory.INFO, input_type=InputType.TEXT, is_active=True),
            CompetencyItem(item_name="성별", item_code="gender", category=CompetencyCategory.INFO, input_type=InputType.SELECT, is_active=True),
            CompetencyItem(item_name="주소", item_code="address", category=CompetencyCategory.INFO, input_type=InputType.TEXT, is_active=True),
            CompetencyItem(item_name="생년월일", item_code="birthdate", category=CompetencyCategory.INFO, input_type=InputType.TEXT, is_active=True),
            CompetencyItem(item_name="코치자격번호", item_code="coach_cert_number", category=CompetencyCategory.INFO, input_type=InputType.TEXT, is_active=True),

            # Evaluation Items (With Scores)
            CompetencyItem(item_name="KCA 자격", item_code="kca_certification", category=CompetencyCategory.EVALUATION, input_type=InputType.SELECT, is_active=True),
            CompetencyItem(item_name="총 코칭시간", item_code="coaching_hours", category=CompetencyCategory.EVALUATION, input_type=InputType.NUMBER, is_active=True),
            CompetencyItem(item_name="관련 학위", item_code="related_degree", category=CompetencyCategory.EVALUATION, input_type=InputType.SELECT, is_active=True),
            CompetencyItem(item_name="진로 자격증", item_code="career_certification", category=CompetencyCategory.EVALUATION, input_type=InputType.SELECT, is_active=True),
            CompetencyItem(item_name="청소년 진로코칭 시간", item_code="youth_career_coaching_hours", category=CompetencyCategory.EVALUATION, input_type=InputType.NUMBER, is_active=True),
            CompetencyItem(item_name="그룹홈 경험", item_code="grouphome_experience", category=CompetencyCategory.EVALUATION, input_type=InputType.SELECT, is_active=True),
            CompetencyItem(item_name="특수대상 코칭 경험", item_code="special_needs_experience", category=CompetencyCategory.EVALUATION, input_type=InputType.SELECT, is_active=True),
            CompetencyItem(item_name="공공기관 코칭 경험", item_code="public_coaching_experience", category=CompetencyCategory.EVALUATION, input_type=InputType.SELECT, is_active=True),

            # Other Items
            CompetencyItem(item_name="지원동기", item_code="application_motivation", category=CompetencyCategory.OTHER, input_type=InputType.TEXT, is_active=True),
        ]

        session.add_all(items)
        await session.commit()
        print(f"Seeded {len(items)} competency items")

if __name__ == "__main__":
    asyncio.run(seed_competencies())
```

Run it:
```bash
cd backend
python seed_competencies.py
```

## Troubleshooting

### Backend won't start

1. **Check Python version**
   ```bash
   python --version  # Should be 3.11+
   ```

2. **Check if virtual environment is activated**
   - You should see `(venv)` in your command prompt

3. **Check PostgreSQL connection**
   ```bash
   # Test connection
   psql -U coachdb -d coachdb -h localhost
   ```

4. **Check if port 8000 is already in use**
   ```bash
   # Windows
   netstat -ano | findstr :8000
   ```

### Frontend won't start

1. **Check Node.js version**
   ```bash
   node --version  # Should be 18+
   npm --version
   ```

2. **Clear npm cache**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check if port 5173 is already in use**
   ```bash
   netstat -ano | findstr :5173
   ```

### Database migration errors

1. **Reset migrations**
   ```bash
   # Drop all tables (WARNING: deletes all data)
   # In PostgreSQL:
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO coachdb;

   # Then run migrations again
   alembic upgrade head
   ```

2. **Check database URL in .env**
   - Make sure the connection string is correct
   - Test connection with psql

### Module not found errors

```bash
# Make sure you're in the backend directory
cd backend

# Make sure virtual environment is activated
venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt
```

## Running in Production

For production deployment:

1. **Change DEBUG to False** in `.env`
   ```env
   DEBUG=False
   ```

2. **Generate secure SECRET_KEY**
   ```python
   import secrets
   print(secrets.token_urlsafe(32))
   ```

3. **Use production database** (not localhost)

4. **Use production WSGI server**
   ```bash
   pip install gunicorn
   gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
   ```

5. **Build frontend for production**
   ```bash
   cd frontend
   npm run build
   # Deploy the 'dist' folder to a web server
   ```

## Next Steps

Once both backend and frontend are running:

1. Open http://localhost:5173 in your browser
2. Try to access the API docs at http://localhost:8000/docs
3. Start implementing features (authentication, projects, etc.)

## Getting Help

If you encounter issues:
1. Check the logs in the terminal
2. Check the [README.md](README.md) for more information
3. Review the [SETUP_COMPLETE.md](SETUP_COMPLETE.md) for implementation guides
