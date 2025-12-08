# 템플릿 기반 설문 시스템 설계서

**프로젝트**: CoachDB - 과제 응모 설문 관리 시스템
**버전**: 1.0
**최종 업데이트**: 2025-11-05
**작성자**: AI Development Team

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [아키텍처](#2-아키텍처)
3. [데이터베이스 설계](#3-데이터베이스-설계)
4. [템플릿 시스템](#4-템플릿-시스템)
5. [백엔드 구현](#5-백엔드-구현)
6. [프론트엔드 구현](#6-프론트엔드-구현)
7. [데이터 플로우](#7-데이터-플로우)
8. [테스트 가이드](#8-테스트-가이드)
9. [알려진 이슈](#9-알려진-이슈)
10. [개발 가이드](#10-개발-가이드)

---

## 1. 시스템 개요

### 1.1 목적

코치 과제 응모 시 역량 평가를 위한 유연한 설문 시스템 구축:
- 과제별로 다른 역량 항목 조합 가능
- 동적 필드 렌더링 (템플릿 기반)
- 복수 입력 지원 (자격증, 경험 등)
- 100점 만점 배점 관리
- 증빙 자료 선택적/필수 관리

### 1.2 주요 기능

1. **통합 설문 구성** (SurveyBuilder)
   - 역량 항목 선택/해제
   - 배점 설정 (100점 검증)
   - 증빙 필요성 레벨 설정
   - 미리보기 기능

2. **동적 폼 렌더링** (DynamicFieldRenderer)
   - 템플릿별 필드 자동 생성
   - 복수 입력 항목 관리
   - 유효성 검증

3. **과제 응모** (ApplicationForm)
   - 카테고리별 그룹핑
   - 실시간 필수 항목 검증
   - 임시저장/최종제출

### 1.3 기술 스택

- **Backend**: FastAPI (Python 3.11), PostgreSQL, SQLAlchemy (Async)
- **Frontend**: React 18, TypeScript, Ant Design
- **Infrastructure**: Docker, Docker Compose

---

## 2. 아키텍처

### 2.1 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────┬───────────────────┬───────────────────────┤
│ SurveyBuilder   │DynamicFieldRenderer│ ApplicationForm      │
│ (설문 구성)      │ (필드 렌더링)       │ (응모 폼)             │
└─────────────────┴───────────────────┴───────────────────────┘
                          ↓ REST API
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
├─────────────────┬───────────────────┬───────────────────────┤
│ Projects API    │ Competency API    │ Application API       │
│ /projects       │ /competency       │ /applications         │
└─────────────────┴───────────────────┴───────────────────────┘
                          ↓ SQLAlchemy ORM
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
├───────────────┬─────────────────┬───────────────┬───────────┤
│competency_items│project_items   │applications   │app_data   │
│competency_item_│scoring_criteria│custom_questions│         │
│    fields      │                │                │           │
└───────────────┴─────────────────┴───────────────┴───────────┘
```

### 2.2 레이어 구조

```
Presentation Layer (React Components)
    ↓
Service Layer (TypeScript Services)
    ↓
API Layer (FastAPI Routers)
    ↓
Business Logic (Python Services)
    ↓
Data Access Layer (SQLAlchemy Models)
    ↓
Database (PostgreSQL)
```

---

## 3. 데이터베이스 설계

### 3.1 ERD (핵심 테이블)

```
┌──────────────────────┐
│ competency_items     │ (역량 항목 마스터)
├──────────────────────┤
│ PK item_id           │
│    item_name         │◄──┐
│    item_code (UK)    │   │
│    category          │   │
│    template (ENUM)   │   │ 1:N
│    is_repeatable     │   │
│    max_entries       │   │
└──────────────────────┘   │
         │                 │
         │ 1:N             │
         ↓                 │
┌──────────────────────┐   │
│competency_item_fields│   │
├──────────────────────┤   │
│ PK field_id          │   │
│ FK item_id           │───┘
│    field_name        │
│    field_label       │
│    field_type        │
│    field_options     │ (JSON)
│    is_required       │
│    display_order     │
│    placeholder       │
└──────────────────────┘

         ↓ M:N (project_items)

┌──────────────────────┐
│ projects             │
├──────────────────────┤
│ PK project_id        │◄──┐
│    project_name      │   │
│    status            │   │
│    recruitment_*_date│   │
└──────────────────────┘   │
                           │
         ↓                 │ 1:N
                           │
┌──────────────────────┐   │
│ project_items        │   │
├──────────────────────┤   │
│ PK project_item_id   │   │
│ FK project_id        │───┘
│ FK item_id           │───┐ (to competency_items)
│    is_required       │   │
│    proof_required_   │   │
│      level (ENUM)    │   │
│    max_score         │   │
│    display_order     │   │
└──────────────────────┘   │
         │                 │
         │ 1:N             │
         ↓                 │
┌──────────────────────┐   │
│ scoring_criteria     │   │
├──────────────────────┤   │
│ PK criteria_id       │   │
│ FK project_item_id   │───┘
│    matching_type     │
│    expected_value    │
│    score             │
└──────────────────────┘

┌──────────────────────┐
│ applications         │
├──────────────────────┤
│ PK application_id    │◄──┐
│ FK project_id        │   │
│ FK user_id           │   │
│    status            │   │
│    auto_score        │   │
│    final_score       │   │
└──────────────────────┘   │
                           │ 1:N
         ↓                 │
                           │
┌──────────────────────┐   │
│ application_data     │   │
├──────────────────────┤   │
│ PK data_id           │   │
│ FK application_id    │───┘
│ FK item_id           │
│    submitted_value   │ (JSON for template)
│    submitted_file_id │
│    verification_stat │
│    item_score        │
└──────────────────────┘
```

### 3.2 주요 테이블 스키마

#### competency_items (역량 항목 마스터)

```sql
CREATE TABLE competency_items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(200) NOT NULL,
    item_code VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    input_type VARCHAR(50), -- DEPRECATED
    is_active BOOLEAN DEFAULT true,

    -- Template System (New)
    template itemtemplate,  -- ENUM: text, number, select, multiselect, file, text_file, degree, coaching_history
    template_config TEXT,   -- JSON configuration
    is_repeatable BOOLEAN DEFAULT false,
    max_entries INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_competency_items_code ON competency_items(item_code);
CREATE INDEX idx_competency_items_active ON competency_items(is_active);
CREATE INDEX idx_competency_items_template ON competency_items(template) WHERE template IS NOT NULL;
```

#### competency_item_fields (템플릿 필드)

```sql
CREATE TABLE competency_item_fields (
    field_id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES competency_items(item_id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,      -- 'degree_level', 'major', 'proof'
    field_label VARCHAR(200) NOT NULL,     -- '학위', '전공명', '증빙업로드'
    field_type VARCHAR(50) NOT NULL,       -- 'text', 'select', 'number', 'file'
    field_options TEXT,                    -- JSON: ["박사", "석사", "학사"]
    is_required BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    placeholder VARCHAR(200)
);

-- 인덱스
CREATE INDEX idx_fields_item ON competency_item_fields(item_id);
CREATE INDEX idx_fields_order ON competency_item_fields(item_id, display_order);
```

#### project_items (과제별 항목 설정)

```sql
CREATE TABLE project_items (
    project_item_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES competency_items(item_id),
    is_required BOOLEAN DEFAULT false,
    proof_required_level proofrequiredlevel DEFAULT 'not_required',
        -- ENUM: 'not_required', 'optional', 'required'
    max_score NUMERIC(5,2),
    display_order INTEGER DEFAULT 0,

    UNIQUE(project_id, item_id)
);

-- 인덱스
CREATE INDEX idx_project_items_project ON project_items(project_id);
CREATE INDEX idx_project_items_order ON project_items(project_id, display_order);
```

#### application_data (응모 데이터)

```sql
CREATE TABLE application_data (
    data_id BIGSERIAL PRIMARY KEY,
    application_id BIGINT REFERENCES applications(application_id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES competency_items(item_id),

    -- Template-based data stored as JSON
    submitted_value TEXT,  -- JSON: {"degree_level": "석사", "major": "심리학"}
                          -- or array for repeatable: [{"name": "KAC", "proof": null}]
    submitted_file_id BIGINT REFERENCES files(file_id),

    verification_status VARCHAR(20) DEFAULT 'pending',
    item_score NUMERIC(5,2),
    reviewed_by BIGINT REFERENCES users(user_id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT
);

-- 인덱스
CREATE INDEX idx_app_data_application ON application_data(application_id);
CREATE INDEX idx_app_data_item ON application_data(item_id);
```

### 3.3 ENUM 타입

```sql
-- 템플릿 타입
CREATE TYPE itemtemplate AS ENUM (
    'text',            -- 단일 텍스트
    'number',          -- 단일 숫자
    'select',          -- 단일 선택
    'multiselect',     -- 다중 선택
    'file',            -- 단일 파일
    'text_file',       -- 텍스트 + 파일 (복수 가능)
    'degree',          -- 학위 (선택 + 텍스트 + 파일)
    'coaching_history' -- 코칭 이력 + 증빙
);

-- 증빙 필요성
CREATE TYPE proofrequiredlevel AS ENUM (
    'not_required',  -- 증빙 불필요
    'optional',      -- 증빙 선택 (보류 가능)
    'required'       -- 증빙 필수 (임시저장만 가능)
);

-- 매칭 타입 (채점 기준)
CREATE TYPE matchingtype AS ENUM (
    'exact',      -- 정확히 일치
    'contains',   -- 포함
    'range'       -- 범위
);
```

---

## 4. 템플릿 시스템

### 4.1 템플릿 타입 정의

#### ItemTemplate Enum

**위치**: `backend/app/models/competency.py:26-35`

```python
class ItemTemplate(str, enum.Enum):
    TEXT = "text"                      # 단일 텍스트 입력
    NUMBER = "number"                  # 단일 숫자 입력
    SELECT = "select"                  # 단일 선택
    MULTISELECT = "multiselect"        # 다중 선택
    FILE = "file"                      # 단일 파일
    TEXT_FILE = "text_file"            # 텍스트 + 파일 (자격증/경험)
    DEGREE = "degree"                  # 학위 (선택 + 텍스트 + 파일)
    COACHING_HISTORY = "coaching_history"  # 코칭 이력 + 증빙
```

### 4.2 템플릿별 필드 구성

| 템플릿 | 필드 구성 | is_repeatable | 사용 예시 |
|--------|-----------|---------------|-----------|
| TEXT | value (text) | ❌ | 전문 분야 |
| NUMBER | value (number) | ❌ | 총 코칭 경력, 누적 시간 |
| DEGREE | degree_level (select)<br>major (text)<br>proof (file) | ❌ | 최종학력 |
| TEXT_FILE | name (text)<br>proof (file) | ✅ | KCA 자격증<br>멘토링 경험 |
| COACHING_HISTORY | experience (text)<br>proof (file) | ❌ | 비즈니스코칭 이력 |

### 4.3 현재 구현된 역량 항목

**총 13개 템플릿 항목 + 21개 레거시 항목**

#### 템플릿 기반 항목 (13개)

1. **학력 항목 (DEGREE)**
   - `EDU_COACHING_FINAL`: 코칭/상담/심리 관련 최종학력
   - `EDU_OTHER_FINAL`: 기타분야 관련 최종학력

2. **자격증 항목 (TEXT_FILE, repeatable)**
   - `CERT_KCA`: KCA 코칭관련 자격증

3. **경험 항목 (TEXT_FILE, repeatable)**
   - `EXP_MENTORING`: 멘토링/수퍼비전 경험

4. **경력 항목 (NUMBER)**
   - `EXP_COACHING_YEARS`: 총 코칭 경력
   - `EXP_COACHING_HOURS`: 누적 코칭 시간

5. **코칭 분야 항목 (COACHING_HISTORY)**
   - `COACHING_BUSINESS`: 비즈니스코칭 이력
   - `COACHING_CAREER`: 커리어코칭 이력
   - `COACHING_YOUTH`: 청소년코칭 이력
   - `COACHING_YOUNG_ADULT`: 청년코칭 이력
   - `COACHING_FAMILY`: 가족코칭 이력
   - `COACHING_LIFE`: 라이프코칭 이력

6. **기타 항목 (TEXT)**
   - `SPECIALTY`: 전문 분야

### 4.4 필드 정의 예시

#### DEGREE 템플릿 (학위)

```python
{
    "item_name": "코칭/상담/심리 관련 최종학력",
    "item_code": "EDU_COACHING_FINAL",
    "template": ItemTemplate.DEGREE,
    "is_repeatable": False,
    "fields": [
        {
            "field_name": "degree_level",
            "field_label": "학위",
            "field_type": "select",
            "field_options": '["박사", "석사", "학사", "없음"]',
            "is_required": True,
            "display_order": 1
        },
        {
            "field_name": "major",
            "field_label": "전공명",
            "field_type": "text",
            "placeholder": "전공명을 입력하세요",
            "is_required": True,
            "display_order": 2
        },
        {
            "field_name": "proof",
            "field_label": "증빙업로드",
            "field_type": "file",
            "is_required": False,
            "display_order": 3
        }
    ]
}
```

#### TEXT_FILE 템플릿 (자격증)

```python
{
    "item_name": "KCA 코칭관련 자격증",
    "item_code": "CERT_KCA",
    "template": ItemTemplate.TEXT_FILE,
    "is_repeatable": True,  # 복수 입력 가능
    "max_entries": 5,
    "fields": [
        {
            "field_name": "name",
            "field_label": "자격증명",
            "field_type": "text",
            "placeholder": "예: KAC 전문코치",
            "is_required": True,
            "display_order": 1
        },
        {
            "field_name": "proof",
            "field_label": "증빙서류",
            "field_type": "file",
            "is_required": False,
            "display_order": 2
        }
    ]
}
```

### 4.5 응답 데이터 형식

#### 단일 항목 (DEGREE)

```json
{
  "degree_level": "석사",
  "major": "심리학",
  "proof": null
}
```

#### 복수 항목 (TEXT_FILE, repeatable)

```json
[
  {
    "name": "KAC 전문코치",
    "proof": null
  },
  {
    "name": "KAC 수석코치",
    "proof": null
  }
]
```

---

## 5. 백엔드 구현

### 5.1 모델 정의

#### CompetencyItem Model

**위치**: `backend/app/models/competency.py:50-70`

```python
class CompetencyItem(Base):
    __tablename__ = "competency_items"

    item_id = Column(Integer, primary_key=True)
    item_name = Column(String(200), nullable=False)
    item_code = Column(String(100), unique=True, nullable=False)
    category = Column(Enum(CompetencyCategory), nullable=False)
    input_type = Column(Enum(InputType), nullable=False)  # Deprecated
    is_active = Column(Boolean, default=True)

    # Template system
    template = Column(Enum(ItemTemplate), nullable=True)
    template_config = Column(Text, nullable=True)
    is_repeatable = Column(Boolean, default=False)
    max_entries = Column(Integer, nullable=True)

    # Relationships
    fields = relationship("CompetencyItemField",
                         back_populates="item",
                         cascade="all, delete-orphan")
    project_items = relationship("ProjectItem", back_populates="competency_item")
```

#### CompetencyItemField Model

**위치**: `backend/app/models/competency.py:72-92`

```python
class CompetencyItemField(Base):
    __tablename__ = "competency_item_fields"

    field_id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("competency_items.item_id",
                                        ondelete="CASCADE"))
    field_name = Column(String(100), nullable=False)
    field_label = Column(String(200), nullable=False)
    field_type = Column(String(50), nullable=False)
    field_options = Column(Text, nullable=True)  # JSON string
    is_required = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    placeholder = Column(String(200), nullable=True)

    # Relationships
    item = relationship("CompetencyItem", back_populates="fields")
```

#### ProjectItem Model

**위치**: `backend/app/models/competency.py:106-125`

```python
class ProjectItem(Base):
    __tablename__ = "project_items"

    project_item_id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.project_id",
                                           ondelete="CASCADE"))
    item_id = Column(Integer, ForeignKey("competency_items.item_id"))
    is_required = Column(Boolean, default=False)
    proof_required_level = Column(Enum(ProofRequiredLevel),
                                  default=ProofRequiredLevel.NOT_REQUIRED)
    max_score = Column(Numeric(5, 2), nullable=True)
    display_order = Column(Integer, default=0)

    # Relationships
    competency_item = relationship("CompetencyItem",
                                  back_populates="project_items")
    scoring_criteria = relationship("ScoringCriteria",
                                   cascade="all, delete-orphan")
```

### 5.2 스키마 정의

**위치**: `backend/app/schemas/competency.py`

```python
class CompetencyItemFieldResponse(BaseModel):
    field_id: int
    field_name: str
    field_label: str
    field_type: str
    field_options: Optional[str] = None
    is_required: bool
    display_order: int
    placeholder: Optional[str] = None

    class Config:
        from_attributes = True

class CompetencyItemResponse(BaseModel):
    item_id: int
    item_name: str
    item_code: str
    category: str
    template: Optional[ItemTemplate] = None
    template_config: Optional[str] = None
    is_repeatable: bool = False
    max_entries: Optional[int] = None
    fields: List[CompetencyItemFieldResponse] = []

    class Config:
        from_attributes = True

class ProjectItemCreate(BaseModel):
    item_id: int
    is_required: bool = False
    proof_required_level: ProofRequiredLevel = ProofRequiredLevel.NOT_REQUIRED
    max_score: Optional[Decimal] = Field(None, ge=0)
    display_order: int = Field(default=0, ge=0)
    scoring_criteria: List[ScoringCriteriaCreate] = []
```

### 5.3 API 엔드포인트

#### 역량 항목 조회 (Eager Loading)

**위치**: `backend/app/api/endpoints/competencies.py`

```python
@router.get("/items", response_model=List[CompetencyItemResponse])
async def get_competency_items(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    모든 활성 역량 항목 조회 (필드 포함)
    """
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.is_active == True)
        .options(selectinload(CompetencyItem.fields))  # Eager loading
        .order_by(CompetencyItem.item_id)
    )
    items = result.scalars().all()
    return items
```

#### 과제 항목 추가

**위치**: `backend/app/api/endpoints/projects.py:780-830`

```python
@router.post("/{project_id}/items", response_model=ProjectItemResponse)
async def add_project_item(
    project_id: int,
    item_data: ProjectItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    과제에 역량 항목 추가
    """
    # Verify project exists
    project = await get_project_or_404(db, project_id)

    # Create project item
    new_item = ProjectItem(
        project_id=project_id,
        item_id=item_data.item_id,
        is_required=item_data.is_required,
        proof_required_level=item_data.proof_required_level,
        max_score=item_data.max_score,
        display_order=item_data.display_order
    )

    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)

    # Load relationships
    await db.refresh(new_item, ["competency_item", "scoring_criteria"])

    return new_item
```

#### 과제 항목 수정 (증빙 레벨 변경 가능)

**위치**: `backend/app/api/endpoints/projects.py:860-900`

```python
@router.put("/{project_id}/items/{project_item_id}")
async def update_project_item(
    project_id: int,
    project_item_id: int,
    item_data: ProjectItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    """
    과제 항목 수정 (배점, 필수 여부, 증빙 레벨 등)
    """
    project_item = await db.get(ProjectItem, project_item_id)
    if not project_item or project_item.project_id != project_id:
        raise HTTPException(404, "항목을 찾을 수 없습니다")

    # Update fields
    project_item.is_required = item_data.is_required
    project_item.proof_required_level = item_data.proof_required_level  # 변경 가능
    project_item.max_score = item_data.max_score
    project_item.display_order = item_data.display_order

    await db.commit()
    return project_item
```

### 5.4 마이그레이션

**위치**: `backend/alembic/versions/2025_11_05_0100-f6g7h8i9j0k1_add_template_system_and_fields.py`

```python
def upgrade() -> None:
    # Create ItemTemplate ENUM
    item_template_enum = postgresql.ENUM(
        'text', 'number', 'select', 'multiselect', 'file',
        'text_file', 'degree', 'coaching_history',
        name='itemtemplate', create_type=True
    )
    item_template_enum.create(op.get_bind(), checkfirst=True)

    # Add template columns to competency_items
    op.add_column('competency_items',
        sa.Column('template', item_template_enum, nullable=True))
    op.add_column('competency_items',
        sa.Column('template_config', sa.Text(), nullable=True))
    op.add_column('competency_items',
        sa.Column('is_repeatable', sa.Boolean(),
                 nullable=False, server_default='false'))
    op.add_column('competency_items',
        sa.Column('max_entries', sa.Integer(), nullable=True))

    # Create competency_item_fields table
    op.create_table(
        'competency_item_fields',
        sa.Column('field_id', sa.Integer(), autoincrement=True,
                 nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('field_name', sa.String(100), nullable=False),
        sa.Column('field_label', sa.String(200), nullable=False),
        sa.Column('field_type', sa.String(50), nullable=False),
        sa.Column('field_options', sa.Text(), nullable=True),
        sa.Column('is_required', sa.Boolean(),
                 nullable=False, server_default='true'),
        sa.Column('display_order', sa.Integer(),
                 nullable=False, server_default='0'),
        sa.Column('placeholder', sa.String(200), nullable=True),
        sa.PrimaryKeyConstraint('field_id'),
        sa.ForeignKeyConstraint(['item_id'],
                               ['competency_items.item_id'],
                               ondelete='CASCADE')
    )

    # Create indexes
    op.create_index('ix_fields_item', 'competency_item_fields', ['item_id'])
```

### 5.5 Seed 데이터

**위치**: `backend/scripts/seed_template_competency_items.py`

스크립트 실행:
```bash
docker-compose exec backend python scripts/seed_template_competency_items.py
```

주요 동작:
1. 레거시 항목 삭제 (COACHING_FIELD, STRENGTH, EDU_BACHELOR 등)
2. 13개 템플릿 기반 항목 생성
3. 각 항목별 필드 생성 (총 23개 필드)

---

## 6. 프론트엔드 구현

### 6.1 타입 정의

**위치**: `frontend/src/services/projectService.ts`

```typescript
export enum ItemTemplate {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  FILE = 'file',
  TEXT_FILE = 'text_file',
  DEGREE = 'degree',
  COACHING_HISTORY = 'coaching_history'
}

export enum ProofRequiredLevel {
  NOT_REQUIRED = 'not_required',
  OPTIONAL = 'optional',
  REQUIRED = 'required'
}

export interface CompetencyItemField {
  field_id: number
  field_name: string
  field_label: string
  field_type: string
  field_options: string | null
  is_required: boolean
  display_order: number
  placeholder: string | null
}

export interface CompetencyItem {
  item_id: number
  item_name: string
  item_code: string
  category: string
  template: ItemTemplate | null
  template_config: string | null
  is_repeatable: boolean
  max_entries: number | null
  fields: CompetencyItemField[]
}

export interface ProjectItem {
  project_item_id: number
  project_id: number
  item_id: number
  is_required: boolean
  proof_required_level: ProofRequiredLevel
  max_score: number | null
  display_order: number
  competency_item: CompetencyItem | null
}
```

### 6.2 SurveyBuilder 컴포넌트

**위치**: `frontend/src/components/SurveyBuilder.tsx`

**목적**: 과제별 설문 구성 UI

**주요 기능**:
1. 항목 선택/해제 토글
2. 배점 설정 및 100점 검증
3. 필수/선택 설정
4. 증빙 필요성 레벨 설정 (not_required/optional/required)
5. 미리보기 기능

**사용법**:
```tsx
<SurveyBuilder
  projectId={projectId}
  visible={surveyBuilderVisible}
  onClose={() => setSurveyBuilderVisible(false)}
  onSave={() => {
    loadProjectItems()
    validateScore()
  }}
/>
```

**카테고리 그룹핑**:
```typescript
const groupItemsByCategory = (): GroupedItems => {
  const grouped: GroupedItems = {
    '기본 평가': [],
    '학력': [],
    '자격증/경험': [],
    '경력': [],
    '코칭 분야': [],
    '기타': []
  }

  selections.forEach(selection => {
    const item = selection.item

    if (item.item_code.startsWith('EVAL_')) {
      grouped['기본 평가'].push(selection)
    }
    else if (item.item_code.startsWith('EDU_')) {
      grouped['학력'].push(selection)
    }
    else if (item.item_code.startsWith('CERT_') ||
             item.item_code.startsWith('EXP_MENTORING')) {
      grouped['자격증/경험'].push(selection)
    }
    else if (item.item_code.includes('COACHING_YEARS') ||
             item.item_code.includes('COACHING_HOURS')) {
      grouped['경력'].push(selection)
    }
    else if (item.item_code.startsWith('COACHING_')) {
      grouped['코칭 분야'].push(selection)
    }
    else {
      grouped['기타'].push(selection)
    }
  })

  return grouped
}
```

**100점 검증**:
```typescript
const calculateTotalScore = (): number => {
  let total = 0
  selections.forEach(selection => {
    if (selection.included && selection.score) {
      total += Number(selection.score)
    }
  })
  customQuestions.forEach(q => {
    if (q.max_score) {
      total += Number(q.max_score)
    }
  })
  return total
}

const handleSave = async () => {
  const totalScore = calculateTotalScore()
  if (totalScore !== 100) {
    message.error(`총 배점이 100점이 아닙니다. 현재: ${totalScore}점`)
    return
  }
  // ... 저장 로직
}
```

### 6.3 DynamicFieldRenderer 컴포넌트

**위치**: `frontend/src/components/DynamicFieldRenderer.tsx`

**목적**: 템플릿 기반 동적 필드 렌더링

**주요 기능**:
1. 템플릿별 필드 타입 렌더링
2. 복수 입력 항목 관리 (add/remove)
3. max_entries 제한 적용

**필드 타입별 렌더링**:
```typescript
const renderField = (
  field: CompetencyItemField,
  entryValue: any,
  onFieldChange: (val: any) => void
) => {
  const commonProps = {
    disabled,
    placeholder: field.placeholder || undefined,
    style: { width: '100%' }
  }

  switch (field.field_type) {
    case 'text':
      return (
        <Input
          {...commonProps}
          value={entryValue}
          onChange={(e) => onFieldChange(e.target.value)}
        />
      )

    case 'number':
      return (
        <InputNumber
          {...commonProps}
          value={entryValue}
          onChange={onFieldChange}
        />
      )

    case 'select':
      const options = field.field_options ?
        JSON.parse(field.field_options) : []
      return (
        <Select
          {...commonProps}
          value={entryValue}
          onChange={onFieldChange}
        >
          {options.map((opt: string) => (
            <Select.Option key={opt} value={opt}>
              {opt}
            </Select.Option>
          ))}
        </Select>
      )

    case 'multiselect':
      const multiOptions = field.field_options ?
        JSON.parse(field.field_options) : []
      return (
        <Select
          {...commonProps}
          mode="multiple"
          value={entryValue}
          onChange={onFieldChange}
        >
          {multiOptions.map((opt: string) => (
            <Select.Option key={opt} value={opt}>
              {opt}
            </Select.Option>
          ))}
        </Select>
      )

    case 'file':
      return (
        <Upload
          disabled={disabled}
          maxCount={1}
          fileList={entryValue ? [entryValue] : []}
          onChange={(info) => onFieldChange(info.fileList[0])}
        >
          <Button icon={<UploadOutlined />} disabled={disabled}>
            {field.field_label}
          </Button>
        </Upload>
      )
  }
}
```

**복수 입력 관리**:
```typescript
const addEntry = () => {
  if (!isRepeatable) return
  onChange([...entries, {}])
}

const removeEntry = (index: number) => {
  if (!isRepeatable || entries.length <= 1) return
  const newEntries = entries.filter((_, i) => i !== index)
  onChange(newEntries)
}

// JSX
{isRepeatable && !disabled && (
  <Button
    type="dashed"
    icon={<PlusOutlined />}
    onClick={addEntry}
    block
    disabled={item.max_entries ? entries.length >= item.max_entries : false}
  >
    {item.item_name} 추가
    {item.max_entries && ` (${entries.length}/${item.max_entries})`}
  </Button>
)}
```

### 6.4 ApplicationForm 컴포넌트

**위치**: `frontend/src/components/ApplicationForm.tsx`

**목적**: 코치 과제 응모 폼

**주요 기능**:
1. 과제별 설문 항목 로드
2. 카테고리별 그룹핑 렌더링
3. 필수 항목 검증
4. 임시저장/최종제출

**응모 데이터 구조**:
```typescript
const handleSubmit = async (isDraft: boolean) => {
  const values = await form.validateFields()

  // Validate required fields
  for (const item of projectItems) {
    if (item.is_required && !values[item.item_id]) {
      message.error(`${item.competency_item?.item_name} 항목은 필수입니다.`)
      return
    }
  }

  const applicationData = {
    project_id: projectId,
    is_draft: isDraft,
    answers: Object.entries(values).map(([itemId, value]) => ({
      project_item_id: parseInt(itemId),
      answer_data: JSON.stringify(value)  // Template data as JSON
    }))
  }

  if (onSubmit) {
    onSubmit(applicationData)
  }
}
```

**카테고리별 렌더링**:
```typescript
const categoryNames: Record<string, string> = {
  'DETAIL': '기본 평가',
  'EVALUATION': '역량 항목',
  'EDUCATION': '학력',
  'ADDON': '추가 항목'
}

{Object.entries(groupedItems).map(([category, items]) => (
  <div key={category}>
    <Title level={4}>{categoryNames[category] || category}</Title>
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {items.map((projectItem) => {
        if (!projectItem.competency_item) return null

        return (
          <Form.Item
            key={projectItem.project_item_id}
            name={projectItem.item_id}
            rules={[{
              required: projectItem.is_required,
              message: `${projectItem.competency_item.item_name} 항목은 필수입니다.`
            }]}
          >
            <DynamicFieldRenderer
              item={projectItem.competency_item}
              value={formValues[projectItem.item_id]}
              onChange={(value) => {
                setFormValues({ ...formValues, [projectItem.item_id]: value })
                form.setFieldValue(projectItem.item_id, value)
              }}
              disabled={readOnly}
            />
          </Form.Item>
        )
      })}
    </Space>
  </div>
))}
```

### 6.5 ProjectDetailPage 통합

**위치**: `frontend/src/pages/ProjectDetailPage.tsx`

**SurveyBuilder 통합**:
```typescript
const [surveyBuilderVisible, setSurveyBuilderVisible] = useState(false)

// 설문 구성 버튼
<Button
  type="primary"
  icon={<EditOutlined />}
  onClick={() => setSurveyBuilderVisible(true)}
>
  설문 구성
</Button>

// SurveyBuilder 모달
<SurveyBuilder
  projectId={parseInt(projectId)}
  visible={surveyBuilderVisible}
  onClose={() => setSurveyBuilderVisible(false)}
  onSave={() => {
    loadProjectItems()
    validateScore()
  }}
/>
```

---

## 7. 데이터 플로우

### 7.1 설문 구성 플로우

```
1. Admin이 "설문 구성" 버튼 클릭
   ↓
2. SurveyBuilder 모달 오픈
   ↓
3. GET /api/competency/items (모든 역량 항목 + 필드 로드)
   ↓
4. GET /api/projects/{id}/items (기존 설정 로드)
   ↓
5. 카테고리별 그룹핑 및 렌더링
   ↓
6. Admin이 항목 선택/배점 설정
   ↓
7. 100점 검증 (프론트엔드)
   ↓
8. POST/PUT/DELETE /api/projects/{id}/items
   ↓
9. 과제 설문 구성 완료
```

### 7.2 응모 플로우

```
1. Coach가 과제 응모 페이지 접근
   ↓
2. ApplicationForm 컴포넌트 렌더링
   ↓
3. GET /api/projects/{id}/items (과제 설문 항목 로드)
   ↓
4. 카테고리별 그룹핑
   ↓
5. DynamicFieldRenderer가 각 템플릿별 필드 렌더링
   ↓
6. Coach가 폼 작성
   - 복수 항목은 추가/삭제 가능
   - 필수 항목 검증
   ↓
7. 임시저장 or 최종제출
   ↓
8. POST /api/applications
   {
     project_id: 1,
     is_draft: false,
     answers: [
       {
         project_item_id: 123,
         answer_data: '{"degree_level": "석사", "major": "심리학"}'
       },
       {
         project_item_id: 124,
         answer_data: '[{"name": "KAC", "proof": null}]'
       }
     ]
   }
   ↓
9. ApplicationData 레코드 생성
   ↓
10. 응모 완료
```

### 7.3 평가 플로우

```
1. Admin/Reviewer가 응모 목록 조회
   ↓
2. GET /api/applications/{id}
   ↓
3. ApplicationData와 함께 CompetencyItem, Fields 로드
   ↓
4. answer_data JSON 파싱하여 렌더링
   ↓
5. ScoringCriteria 기반 자동 채점 (optional)
   ↓
6. Reviewer가 수동 점수 입력/검증 상태 변경
   ↓
7. PUT /api/applications/{id}/data/{data_id}
   {
     item_score: 8.5,
     verification_status: 'approved'
   }
   ↓
8. 평가 완료
```

---

## 8. 테스트 가이드

### 8.1 테스트 데이터 생성

**스크립트 실행**:
```bash
docker-compose exec backend python scripts/create_test_data.py
```

**생성 내용**:
- 2개 테스트 과제 ("템플릿 테스트 과제 1", "템플릿 테스트 과제 2")
- 각 과제에 13개 템플릿 항목 포함
- 모든 항목: `proof_required_level = 'optional'`
- 모집 기간: 현재일 ~ 30일 후

**테스트 계정**:
- Browser Test (browsertest@test.com)
- Frontend Test (frontend-test@test.com)
- 최철영 (loginheaven@gmail.com)
- Test Coach (testcoach@test.com)

### 8.2 프론트엔드 수동 테스트

#### Test Case 1: 설문 구성 (Admin)

1. 관리자 계정으로 로그인
2. 과제 상세 페이지 이동
3. "설문 구성" 버튼 클릭
4. SurveyBuilder 모달 확인
5. 항목 선택/해제 토글 테스트
6. 배점 입력 (총 100점 검증)
7. 증빙 레벨 변경 (optional → required)
8. 미리보기 클릭하여 응모자 화면 확인
9. 저장

**검증 포인트**:
- ✅ 카테고리별 그룹핑 표시
- ✅ 100점 아닐 경우 저장 버튼 비활성화
- ✅ 미리보기에서 선택한 항목만 표시
- ✅ 증빙 레벨 Select 옵션 (불필요/선택/필수)

#### Test Case 2: 과제 응모 (Coach)

1. 코치 계정으로 로그인
2. 과제 목록에서 "템플릿 테스트 과제" 선택
3. "응모하기" 버튼 클릭
4. ApplicationForm 렌더링 확인

**각 템플릿 타입별 테스트**:

| 템플릿 | 테스트 내용 |
|--------|------------|
| DEGREE | SELECT (학위) + TEXT (전공) + FILE (증빙) 모두 표시 |
| TEXT_FILE | TEXT (명칭) + FILE (증빙) 표시<br>"추가" 버튼으로 복수 입력<br>"삭제" 버튼으로 항목 제거 |
| NUMBER | InputNumber 표시, 숫자만 입력 가능 |
| TEXT | Input 표시 |
| COACHING_HISTORY | TEXT (경험) + FILE (증빙) 표시 |

5. 필수 항목 미입력 시 제출 차단 확인
6. 임시저장 테스트
7. 최종제출 테스트

**검증 포인트**:
- ✅ 카테고리별 그룹핑
- ✅ 필수 항목에 * 표시
- ✅ 복수 입력 항목 add/remove 동작
- ✅ max_entries 제한 적용
- ✅ 임시저장/최종제출 구분

#### Test Case 3: 증빙 레벨 변경 (Admin)

1. 관리자로 "설문 구성" 재진입
2. 특정 항목의 증빙 레벨을 'required'로 변경
3. 저장
4. 코치 계정으로 응모 시도
5. 증빙 파일 미첨부 시 제출 차단 확인

**검증 포인트**:
- ✅ 증빙 레벨 변경 즉시 반영
- ✅ required 설정 시 파일 필드 필수로 변경
- ✅ 프론트엔드 검증 동작

### 8.3 데이터베이스 검증

```sql
-- 템플릿 항목 확인
SELECT item_name, template, is_repeatable,
       (SELECT COUNT(*) FROM competency_item_fields f
        WHERE f.item_id = ci.item_id) as field_count
FROM competency_items ci
WHERE template IS NOT NULL
ORDER BY item_id;

-- 과제별 항목 확인
SELECT p.project_name,
       COUNT(pi.*) as total_items,
       SUM(CASE WHEN pi.proof_required_level = 'optional' THEN 1 ELSE 0 END) as optional,
       SUM(CASE WHEN pi.proof_required_level = 'required' THEN 1 ELSE 0 END) as required
FROM projects p
JOIN project_items pi ON p.project_id = pi.project_id
GROUP BY p.project_id, p.project_name;

-- 응모 데이터 확인
SELECT a.application_id,
       u.name as coach_name,
       p.project_name,
       COUNT(ad.*) as answers_count,
       a.status
FROM applications a
JOIN users u ON a.user_id = u.user_id
JOIN projects p ON a.project_id = p.project_id
LEFT JOIN application_data ad ON a.application_id = ad.application_id
GROUP BY a.application_id, u.name, p.project_name, a.status;

-- 응답 JSON 확인
SELECT ci.item_name,
       ci.template,
       ad.submitted_value
FROM application_data ad
JOIN competency_items ci ON ad.item_id = ci.item_id
WHERE ad.application_id = 1;
```

### 8.4 API 테스트 (Postman/curl)

#### 역량 항목 조회

```bash
curl -X GET "http://localhost:8000/api/competency/items" \
  -H "Authorization: Bearer {token}"
```

**Expected Response**:
```json
[
  {
    "item_id": 38,
    "item_name": "코칭/상담/심리 관련 최종학력",
    "item_code": "EDU_COACHING_FINAL",
    "template": "DEGREE",
    "is_repeatable": false,
    "max_entries": null,
    "fields": [
      {
        "field_id": 1,
        "field_name": "degree_level",
        "field_label": "학위",
        "field_type": "select",
        "field_options": "[\"박사\", \"석사\", \"학사\", \"없음\"]",
        "is_required": true,
        "display_order": 1
      },
      {
        "field_id": 2,
        "field_name": "major",
        "field_label": "전공명",
        "field_type": "text",
        "is_required": true,
        "display_order": 2
      },
      {
        "field_id": 3,
        "field_name": "proof",
        "field_label": "증빙업로드",
        "field_type": "file",
        "is_required": false,
        "display_order": 3
      }
    ]
  }
]
```

#### 과제 항목 추가

```bash
curl -X POST "http://localhost:8000/api/projects/14/items" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 38,
    "is_required": true,
    "proof_required_level": "optional",
    "max_score": 10,
    "display_order": 1,
    "scoring_criteria": []
  }'
```

---

## 9. 알려진 이슈

### 9.1 SQLAlchemy Enum 값 vs 이름 이슈

**문제**:
- SQLAlchemy ORM이 Enum 객체를 직접 할당할 때 enum 이름(OPTIONAL)을 사용하려고 시도
- PostgreSQL은 enum 값(optional)을 기대
- 에러: `invalid input value for enum proofrequiredlevel: "OPTIONAL"`

**원인**:
```python
# 문제가 되는 코드
project_item.proof_required_level = ProofRequiredLevel.OPTIONAL  # 이름 사용

# DB에 전달되는 값: "OPTIONAL"
# DB가 기대하는 값: "optional"
```

**해결 방법 1**: Raw SQL with CAST
```python
from sqlalchemy import text

insert_sql = text("""
    INSERT INTO project_items (..., proof_required_level, ...)
    VALUES (..., CAST(:proof_required_level AS proofrequiredlevel), ...)
""")

await session.execute(insert_sql, {
    'proof_required_level': 'optional'  # 문자열로 전달
})
```

**해결 방법 2**: Enum 값 사용
```python
project_item.proof_required_level = ProofRequiredLevel.OPTIONAL.value  # 'optional'
```

**해결 방법 3**: 문자열 직접 사용
```python
project_item.proof_required_level = 'optional'
```

**적용 위치**:
- `backend/scripts/create_test_data.py:99-105` (Raw SQL 사용)
- API 엔드포인트에서는 Pydantic 스키마가 자동 변환하므로 문제 없음

### 9.2 N+1 쿼리 문제

**문제**:
- CompetencyItem 조회 시 fields를 lazy loading하면 N+1 쿼리 발생

**해결**:
```python
from sqlalchemy.orm import selectinload

result = await db.execute(
    select(CompetencyItem)
    .options(selectinload(CompetencyItem.fields))  # Eager loading
)
```

**적용 위치**:
- `backend/app/api/endpoints/competencies.py` (GET /items)

### 9.3 프론트엔드 Enum 매칭 이슈

**문제**:
- 백엔드 enum 값이 소문자 (optional)
- 프론트엔드 TypeScript enum이 대문자 (OPTIONAL)

**해결**:
- Select 컴포넌트에서 문자열 리터럴 직접 사용

```tsx
<Select.Option value="not_required">증빙 불필요</Select.Option>
<Select.Option value="optional">증빙 선택</Select.Option>
<Select.Option value="required">증빙 필수</Select.Option>
```

**적용 위치**:
- `frontend/src/components/SurveyBuilder.tsx:336-339`

---

## 10. 개발 가이드

### 10.1 새 템플릿 타입 추가

#### Step 1: Backend Enum 추가

`backend/app/models/competency.py`:
```python
class ItemTemplate(str, enum.Enum):
    # ... 기존 항목들
    NEW_TEMPLATE = "new_template"  # 새 템플릿 추가
```

#### Step 2: Migration 생성

```bash
docker-compose exec backend alembic revision --autogenerate -m "add new template type"
```

수동으로 ENUM 값 추가:
```python
def upgrade():
    op.execute("ALTER TYPE itemtemplate ADD VALUE 'new_template'")
```

#### Step 3: Frontend Enum 추가

`frontend/src/services/projectService.ts`:
```typescript
export enum ItemTemplate {
  // ... 기존 항목들
  NEW_TEMPLATE = 'new_template'
}
```

#### Step 4: DynamicFieldRenderer 확장

`frontend/src/components/DynamicFieldRenderer.tsx`:
- `renderField` 함수에 새 field_type 처리 추가 (필요시)

#### Step 5: Seed 데이터 추가

`backend/scripts/seed_template_competency_items.py`:
```python
{
    "item_name": "새 템플릿 항목",
    "item_code": "NEW_TEMPLATE_ITEM",
    "category": CompetencyCategory.ADDON,
    "template": ItemTemplate.NEW_TEMPLATE,
    "is_repeatable": False,
    "fields": [
        {
            "field_name": "field1",
            "field_label": "필드 1",
            "field_type": "text",
            "is_required": True,
            "display_order": 1
        }
    ]
}
```

### 10.2 새 역량 항목 추가

#### 방법 1: Seed 스크립트 수정

1. `seed_template_competency_items.py`의 `items_data` 배열에 추가
2. 스크립트 실행:
```bash
docker-compose exec backend python scripts/seed_template_competency_items.py
```

#### 방법 2: SQL 직접 실행

```sql
-- 1. 역량 항목 추가
INSERT INTO competency_items (
    item_name, item_code, category, input_type, is_active,
    template, is_repeatable, max_entries
) VALUES (
    '새 항목', 'NEW_ITEM', 'ADDON', 'text', true,
    'text_file', true, 5
);

-- 2. 필드 추가
INSERT INTO competency_item_fields (
    item_id, field_name, field_label, field_type,
    is_required, display_order
) VALUES
(
    (SELECT item_id FROM competency_items WHERE item_code = 'NEW_ITEM'),
    'field_name', '필드 레이블', 'text', true, 1
);
```

### 10.3 카테고리 그룹핑 수정

**Frontend**: `SurveyBuilder.tsx`와 `ApplicationForm.tsx`의 `groupItemsByCategory` 함수 수정

```typescript
const groupItemsByCategory = (): GroupedItems => {
  const grouped: GroupedItems = {
    '새 카테고리': [],  // 추가
    // ... 기존 카테고리들
  }

  selections.forEach(selection => {
    const item = selection.item

    if (item.item_code.startsWith('NEW_PREFIX_')) {
      grouped['새 카테고리'].push(selection)
    }
    // ... 기존 그룹핑 로직
  })

  return grouped
}
```

**categoryNames 매핑 추가**:
```typescript
const categoryNames: Record<string, string> = {
  'NEW_CATEGORY': '새 카테고리',
  // ... 기존 매핑들
}
```

### 10.4 채점 기준 (ScoringCriteria) 활용

**현재 상태**: 모델만 정의됨, UI 미구현

**Backend**: `ProjectItem`에 `scoring_criteria` 관계 정의됨

```python
class ProjectItem(Base):
    scoring_criteria = relationship("ScoringCriteria",
                                   cascade="all, delete-orphan")

class ScoringCriteria(Base):
    criteria_id = Column(Integer, primary_key=True)
    project_item_id = Column(Integer, ForeignKey("project_items.project_item_id"))
    matching_type = Column(Enum(MatchingType))  # EXACT, CONTAINS, RANGE
    expected_value = Column(String(200))
    score = Column(Numeric(5, 2))
```

**활용 예시**:
```python
# 자격증 이름이 "KAC"를 포함하면 5점
{
    "matching_type": "CONTAINS",
    "expected_value": "KAC",
    "score": 5.0
}

# 총 경력이 5년 이상이면 10점
{
    "matching_type": "RANGE",
    "expected_value": "5-999",
    "score": 10.0
}
```

**구현 TODO**:
1. SurveyBuilder에 채점 기준 설정 UI 추가
2. ApplicationData 저장 시 자동 채점 로직 구현
3. 평가 화면에서 자동/수동 점수 구분 표시

### 10.5 환경별 설정

#### Development (로컬)

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Database
docker-compose up postgres

# Run server
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

#### Production (Docker)

```bash
docker-compose up -d
```

**환경 변수**:
```env
# backend/.env
DATABASE_URL=postgresql+asyncpg://coachdb:password@postgres:5432/coachdb
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# frontend/.env
VITE_API_BASE_URL=http://localhost:8000
```

### 10.6 디버깅 팁

#### Backend 로그 확인

```bash
docker-compose logs -f backend
```

#### Database 접속

```bash
docker-compose exec postgres psql -U coachdb -d coachdb
```

#### SQL 쿼리 로깅

`backend/app/core/config.py`:
```python
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True  # SQL 쿼리 로깅
)
```

#### React DevTools

- Components 탭에서 Props/State 확인
- Network 탭에서 API 호출 확인

### 10.7 성능 최적화

#### Backend

1. **Eager Loading 사용**
```python
.options(selectinload(CompetencyItem.fields))
```

2. **인덱스 활용**
```sql
CREATE INDEX idx_project_items_project ON project_items(project_id);
```

3. **페이지네이션**
```python
.limit(20).offset(page * 20)
```

#### Frontend

1. **React.memo 사용**
```typescript
export default React.memo(DynamicFieldRenderer)
```

2. **useMemo로 계산 결과 캐싱**
```typescript
const groupedItems = useMemo(
  () => groupItemsByCategory(),
  [projectItems]
)
```

3. **Lazy Loading**
```typescript
const SurveyBuilder = lazy(() => import('./components/SurveyBuilder'))
```

---

## 부록 A: 파일 구조

### Backend

```
backend/
├── app/
│   ├── api/
│   │   └── endpoints/
│   │       ├── competencies.py        # 역량 항목 API
│   │       └── projects.py            # 과제 API (항목 관리 포함)
│   ├── models/
│   │   ├── competency.py              # CompetencyItem, ProjectItem, etc.
│   │   ├── application.py             # Application, ApplicationData
│   │   └── custom_question.py         # CustomQuestion
│   ├── schemas/
│   │   └── competency.py              # Pydantic schemas
│   └── core/
│       ├── config.py
│       └── database.py
├── alembic/
│   └── versions/
│       └── 2025_11_05_0100-*.py       # Template system migration
└── scripts/
    ├── seed_template_competency_items.py  # 템플릿 항목 Seed
    └── create_test_data.py                # 테스트 데이터 생성
```

### Frontend

```
frontend/
└── src/
    ├── components/
    │   ├── SurveyBuilder.tsx          # 설문 구성 UI
    │   ├── DynamicFieldRenderer.tsx   # 동적 필드 렌더링
    │   └── ApplicationForm.tsx        # 응모 폼
    ├── pages/
    │   └── ProjectDetailPage.tsx      # 과제 상세 (SurveyBuilder 통합)
    └── services/
        └── projectService.ts          # TypeScript types & API calls
```

---

## 부록 B: Quick Start 체크리스트

### 새 개발자 온보딩

- [ ] Docker, Docker Compose 설치
- [ ] 레포지토리 클론
- [ ] `docker-compose up -d` 실행
- [ ] `docker-compose exec backend alembic upgrade head` (마이그레이션)
- [ ] `docker-compose exec backend python scripts/seed_template_competency_items.py` (Seed)
- [ ] `docker-compose exec backend python scripts/create_test_data.py` (테스트 데이터)
- [ ] `http://localhost:3000` 접속 (Frontend)
- [ ] `http://localhost:8000/docs` 접속 (API Docs)
- [ ] 테스트 계정으로 로그인 (browsertest@test.com)
- [ ] "템플릿 테스트 과제" 확인
- [ ] "설문 구성" 버튼 테스트
- [ ] 응모 폼 테스트

### 작업 재개 시

1. **코드 확인**
   - `git pull origin main`
   - `docker-compose down && docker-compose up -d`

2. **DB 상태 확인**
   ```sql
   SELECT COUNT(*) FROM competency_items WHERE template IS NOT NULL;
   -- Expected: 13

   SELECT COUNT(*) FROM competency_item_fields;
   -- Expected: 23

   SELECT project_name, COUNT(pi.*)
   FROM projects p
   JOIN project_items pi ON p.project_id = pi.project_id
   WHERE project_name LIKE '%템플릿%'
   GROUP BY p.project_id, p.project_name;
   -- Expected: 각 과제당 13개 항목
   ```

3. **API 정상 동작 확인**
   - GET `/api/competency/items` → 13개 항목, fields 포함
   - GET `/api/projects/{id}/items` → 과제별 항목 조회

4. **Frontend 빌드 확인**
   ```bash
   docker-compose logs frontend | grep "ready in"
   # Expected: "ready in XXXms"
   ```

---

## 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2025-11-05 | 1.0 | 초안 작성 - 템플릿 시스템 완전 구현 |

---

**문서 종료**

이 설계서는 현재 구현된 모든 내용을 포함하며, 새로운 개발자가 시스템을 완전히 이해하고 작업을 계속할 수 있도록 작성되었습니다.
