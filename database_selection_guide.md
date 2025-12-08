# 코치협회 역량 DB - 데이터베이스 선택 가이드

## 1. 기술 스택 명확화

### FastAPI + PostgreSQL (권장)
```python
# FastAPI: 백엔드 웹 프레임워크
# PostgreSQL: 관계형 데이터베이스
# SQLAlchemy: ORM (Object-Relational Mapping)

FastAPI (웹 프레임워크)
    ↓
SQLAlchemy (ORM)
    ↓
PostgreSQL (데이터베이스)
```

### FastAPI + Firebase
```python
# FastAPI: 백엔드 웹 프레임워크
# Firebase: NoSQL DB + 인증 + 스토리지 통합 서비스

FastAPI (웹 프레임워크)
    ↓
Firebase Admin SDK
    ↓
Firestore (NoSQL DB)
```

---

## 2. 코치협회 시스템 요구사항 분석

| 요구사항 | 중요도 | 설명 |
|---------|--------|------|
| **복잡한 관계** | ⭐⭐⭐⭐⭐ | 프로젝트-지원서-역량-사용자 간 다대다 관계 |
| **트랜잭션** | ⭐⭐⭐⭐⭐ | 점수 계산, 상태 변경시 일관성 보장 필수 |
| **복잡한 쿼리** | ⭐⭐⭐⭐⭐ | 조건부 검색, 통계, 집계 |
| **데이터 무결성** | ⭐⭐⭐⭐⭐ | 참조 무결성, 중복 방지 |
| **실시간 동기화** | ⭐⭐ | 필수는 아님 |
| **빠른 프로토타이핑** | ⭐⭐⭐ | 중요하나 안정성이 우선 |

---

## 3. 상세 비교 분석

### 3.1 PostgreSQL (with SQLAlchemy) - 🏆 권장

#### 장점
```python
# 1. 복잡한 관계 모델링 우수
class Application(Base):
    __tablename__ = "applications"
    
    # 복잡한 JOIN 쿼리 가능
    user = relationship("User", back_populates="applications")
    project = relationship("Project", back_populates="applications")
    data = relationship("ApplicationData", back_populates="application")

# 2. 강력한 트랜잭션 지원
async with db.begin():
    application = await create_application()
    await calculate_score(application)
    await update_status(application)
    # 모두 성공하거나 모두 롤백

# 3. 복잡한 쿼리 지원
query = select(User).join(CoachCompetency)\
    .where(CoachCompetency.item_id == 'kca_cert')\
    .where(CoachCompetency.value == 'KSC')\
    .where(CoachCompetency.status == 'approved')

# 4. 집계 함수
stats = db.query(
    func.count(Application.id),
    func.avg(Application.final_score)
).filter(Application.project_id == 1).first()
```

#### 단점
- 초기 설정이 복잡
- 스키마 마이그레이션 관리 필요
- 백업/복구 직접 관리

#### 비용
- **오픈소스 무료**
- AWS RDS: $15-50/월 (관리형)
- 자체 서버: 서버 비용만

### 3.2 Firebase (Firestore)

#### 장점
```javascript
// 1. 빠른 시작
import { initializeApp } from 'firebase/app';
const app = initializeApp(firebaseConfig);

// 2. 실시간 동기화
onSnapshot(doc(db, "applications", appId), (doc) => {
    console.log("실시간 업데이트:", doc.data());
});

// 3. 인증/스토리지 통합
const user = await signInWithEmail(email, password);
const url = await uploadFile(file);

// 4. 자동 확장
// 트래픽 증가시 자동 스케일링
```

#### 단점 - 치명적 제약사항
```javascript
// 1. 복잡한 쿼리 불가능
// ❌ JOIN 불가능
// ❌ OR 조건 제한적
// ❌ 여러 필드 범위 쿼리 불가

// 2. 트랜잭션 제약
// 최대 500개 문서만 동시 처리
// 읽기 후 쓰기 패턴만 지원

// 3. 집계 어려움
// COUNT, SUM, AVG 직접 구현 필요
let total = 0;
await collection.get().then(snapshot => {
    snapshot.forEach(doc => total += doc.data().score);
});
const average = total / snapshot.size; // 비효율적

// 4. 데이터 모델링 제약
// NoSQL 특성상 정규화 어려움
// 데이터 중복 불가피
```

#### 비용 (함정 주의!)
- Spark Plan (무료): 매우 제한적
- Blaze Plan: **종량제 - 예측 불가**
  - 읽기: $0.06/100,000회
  - 쓰기: $0.18/100,000회
  - **월 $200-500 쉽게 초과**

---

## 4. 코치협회 시스템 적합성 평가

### 4.1 PostgreSQL이 적합한 이유

| 기능 | PostgreSQL 구현 | Firebase 구현 | 승자 |
|-----|---------------|--------------|------|
| **역량 재사용** | FK로 간단히 연결 | 문서 복사 필요 | PostgreSQL ✅ |
| **동시 검토** | 행 수준 잠금 | 낙관적 잠금만 | PostgreSQL ✅ |
| **점수 자동계산** | 트리거/저장프로시저 | Cloud Functions | PostgreSQL ✅ |
| **복잡한 검색** | SQL로 모든 조건 가능 | 제한적 | PostgreSQL ✅ |
| **통계/리포트** | SQL 집계함수 | 수동 계산 | PostgreSQL ✅ |
| **데이터 일관성** | ACID 보장 | 최종 일관성 | PostgreSQL ✅ |

### 4.2 실제 쿼리 예시

```sql
-- PostgreSQL: 그룹홈 경험있는 KSC 자격 코치 검색 (간단!)
SELECT DISTINCT u.* 
FROM users u
JOIN coach_competencies c1 ON u.user_id = c1.user_id
JOIN coach_competencies c2 ON u.user_id = c2.user_id
WHERE c1.item_id = 'kca_certification' 
  AND c1.value = 'KSC'
  AND c1.status = 'approved'
  AND c2.item_id = 'grouphome_experience'
  AND c2.value = '예'
  AND c2.status = 'approved';

-- Firebase: 같은 쿼리 구현 불가능
// 각각 쿼리 후 클라이언트에서 조합 필요 (비효율적)
```

---

## 5. 최종 권장사항

### 🏆 PostgreSQL + SQLAlchemy 선택

#### 구체적 구성
```python
# 기술 스택
- Database: PostgreSQL 15
- ORM: SQLAlchemy 2.0
- Migration: Alembic
- Connection Pool: asyncpg
- Cache: Redis (선택사항)

# 개발 환경
- Local: Docker PostgreSQL
- Test: SQLite (단위테스트용)
- Production: AWS RDS or 자체서버
```

#### 초기 설정 (claude-code 친화적)
```bash
# 1. Docker로 PostgreSQL 실행
docker run -d \
  --name coach-postgres \
  -e POSTGRES_DB=coach_db \
  -e POSTGRES_USER=coach_user \
  -e POSTGRES_PASSWORD=coach_pass \
  -p 5432:5432 \
  postgres:15

# 2. FastAPI 프로젝트 설정
pip install fastapi sqlalchemy alembic asyncpg

# 3. Claude Code로 모델 생성
claude-code "Create SQLAlchemy models for coach competency system"
```

### Firebase를 고려할 수 있는 경우 (해당 없음)
- 실시간 채팅이 핵심 기능
- 모바일 앱이 주력
- 관계가 단순한 경우
- 쿼리가 단순한 경우

---

## 6. 마이그레이션 전략 (만약 Firebase 선택시)

### NoSQL 설계 (비권장)
```javascript
// Firestore 구조 (비정규화 필요)
{
  "applications": {
    "app_001": {
      "userId": "user_001",
      "projectId": "proj_001",
      "userName": "김코치", // 중복 저장
      "projectName": "2025 청소년", // 중복 저장
      "competencies": { // 내장
        "kca_cert": {
          "value": "KSC",
          "status": "approved"
        }
      }
    }
  }
}
```

**문제점**:
1. 데이터 중복으로 일관성 문제
2. 업데이트시 여러 문서 수정 필요
3. 복잡한 쿼리 불가능

---

## 7. 결론

### PostgreSQL 선택 이유 요약
1. **관계형 데이터**: 코치-역량-프로젝트 복잡한 관계
2. **트랜잭션**: 점수계산, 상태변경 일관성
3. **복잡한 쿼리**: 역량 검색, 통계
4. **비용 예측가능**: 오픈소스 무료
5. **성숙한 생태계**: ORM, 마이그레이션 도구
6. **Claude Code 호환**: SQLAlchemy 코드 생성 우수

### 즉시 시작 가능한 설정
```python
# database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "postgresql+asyncpg://coach_user:coach_pass@localhost/coach_db"

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession)
Base = declarative_base()

# 이후 Claude Code 명령
# "Create complete database models for coach competency system"
```

**결론: PostgreSQL이 이 프로젝트에 압도적으로 적합하다.**
