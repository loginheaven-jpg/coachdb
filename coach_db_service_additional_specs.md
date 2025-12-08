# 코치협회 역량 DB 서비스 - 설계 추가사항

**문서 버전**: 1.0  
**작성일**: 2025-11-02  
**문서 유형**: 설계서 보완 문서

---

## 1. Claude Code 개발을 위한 기술 스택 권장사항

### 1.1 권장 기술 스택 (Claude Code 최적화)

| 구분 | 권장 선택 | 선정 근거 |
|-----|----------|-----------|
| **프론트엔드** | **React + TypeScript** | • Claude Code의 컴포넌트 생성 능력 우수<br>• 풍부한 라이브러리 생태계<br>• TypeScript로 타입 안정성 확보<br>• AI 지원 코드 생성시 예측 정확도 높음 |
| **백엔드** | **Python (FastAPI)** | • Claude Code와 가장 호환성 좋음<br>• 빠른 개발 속도<br>• 자동 API 문서화 (Swagger)<br>• 비동기 처리 기본 지원<br>• Pydantic으로 데이터 검증 자동화 |
| **인프라** | **AWS (초기) → 자체 서버 (안정화 후)** | • 초기: AWS Free Tier 활용 (12개월)<br>• S3: 파일 저장<br>• RDS: PostgreSQL 관리형 DB<br>• 안정화 후 비용 절감 위해 이전 고려 |

### 1.2 상세 기술 구성

#### Frontend 스택
```javascript
{
  "framework": "React 18",
  "language": "TypeScript 5.x",
  "stateManagement": "Zustand", // Redux보다 단순, Claude Code 친화적
  "uiLibrary": "Ant Design 5", // 완성도 높은 컴포넌트
  "styling": "Tailwind CSS", // 빠른 스타일링
  "httpClient": "Axios + React Query", // API 통신 및 캐싱
  "formHandling": "React Hook Form + Zod", // 폼 검증
  "fileViewer": "react-pdf, react-image-viewer"
}
```

#### Backend 스택
```python
{
  "framework": "FastAPI 0.104+",
  "python": "3.11+",
  "orm": "SQLAlchemy 2.0", # 최신 async 지원
  "database": "PostgreSQL 15",
  "cache": "Redis 7",
  "taskQueue": "Celery + Redis", # 비동기 작업
  "fileStorage": "MinIO (자체) or S3 (클라우드)",
  "validation": "Pydantic V2",
  "auth": "FastAPI-Users + JWT",
  "cors": "FastAPI CORSMiddleware"
}
```

### 1.3 Claude Code 개발 시너지

#### 장점
1. **Python + FastAPI**
   - Claude Code가 Python 코드 생성에 매우 능숙
   - FastAPI의 타입 힌트가 AI 코드 생성 정확도 향상
   - 자동 문서화로 개발 효율성 증대

2. **React + TypeScript**
   - 컴포넌트 단위 개발로 Claude Code 활용 극대화
   - TypeScript 타입 정의로 오류 감소
   - 재사용 가능한 컴포넌트 라이브러리 구축 용이

3. **개발 순서 권장안**
```bash
# Claude Code 명령 예시
claude-code "Create FastAPI endpoint for project creation with Pydantic models"
claude-code "Generate React component for application form with TypeScript"
claude-code "Implement competency reuse logic with SQLAlchemy ORM"
```

---

## 2. 운영 정책 확정사항

### 2.1 선발 및 평가 정책

| 정책 항목 | 결정 사항 | 구현 방안 |
|-----------|----------|-----------|
| **점수 공개** | 비공개 | • 코치는 점수 조회 불가<br>• 관리자 화면에서만 표시<br>• API 응답에서 점수 필드 제외 |
| **선발 기준** | 비공개 | • 컷오프 점수 내부 관리<br>• 선발/탈락 결과만 통보 |
| **재지원** | 같은 프로젝트 재지원 불가 | • 프로젝트는 단일 기간 운영<br>• 다른 프로젝트 지원 가능<br>• DB 제약조건: UNIQUE(project_id, user_id) |

### 2.2 보안 정책

| 정책 항목 | 결정 사항 | 구현 방안 |
|-----------|----------|-----------|
| **중복 지원 방지** | 시스템적 차단 | • DB 유니크 제약조건으로 처리<br>• 프론트엔드 중복 체크 |
| **대리 지원 방지** | 별도 조치 없음 | • IP 추적 불필요<br>• 본인인증 Phase 2 |
| **세션 관리** | 30분 자동 로그아웃 | • JWT 토큰 만료 시간 설정<br>• Refresh Token 구현 |

---

## 3. UI/UX 구현 사양

### 3.1 확정 사양

| 항목 | 결정사항 | 구현 상세 |
|------|---------|-----------|
| **모바일 대응** | 반응형 웹 | • Bootstrap 그리드 or Tailwind<br>• 최소 지원: 375px (iPhone SE)<br>• 브레이크포인트: 768px, 1024px |
| **파일 미리보기** | 브라우저 내 표시 | • PDF: react-pdf or pdf.js<br>• 이미지: 라이트박스<br>• 최대 파일: 10MB |
| **자동저장** | 10분 주기 | • 로컬스토리지 임시 저장<br>• 포커스 이탈시 즉시 저장<br>• 저장 상태 표시 UI |

### 3.2 반응형 디자인 상세

```css
/* 브레이크포인트 정의 */
- Mobile: 375px - 767px
- Tablet: 768px - 1023px  
- Desktop: 1024px+

/* 주요 화면별 대응 */
- 코치 대시보드: 카드 레이아웃 → 세로 스택
- 지원서 작성: 2컬럼 → 1컬럼
- 검토 화면: 3패널 → 탭 전환
```

### 3.3 파일 뷰어 구현

```typescript
// PDF 뷰어 컴포넌트
interface FileViewerProps {
  fileUrl: string;
  fileType: 'pdf' | 'image';
  maxHeight?: number;
}

const FileViewer: React.FC<FileViewerProps> = ({ fileUrl, fileType }) => {
  if (fileType === 'pdf') {
    return (
      <PDFViewer
        file={fileUrl}
        scale={1.2}
        pageNumber={1}
        onLoadSuccess={handleLoadSuccess}
      />
    );
  }
  
  return (
    <ImageLightbox
      src={fileUrl}
      alt="증빙서류"
      enableZoom={true}
    />
  );
};
```

### 3.4 자동저장 로직

```typescript
// 자동저장 Hook
const useAutoSave = (data: FormData, interval: number = 600000) => {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    const timer = setInterval(async () => {
      if (hasChanges(data)) {
        setSaving(true);
        await saveToLocalStorage(data);
        await saveToServer(data);
        setLastSaved(new Date());
        setSaving(false);
      }
    }, interval);
    
    // 포커스 이탈시 즉시 저장
    const handleBlur = () => {
      if (hasChanges(data)) {
        saveToLocalStorage(data);
      }
    };
    
    window.addEventListener('blur', handleBlur);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('blur', handleBlur);
    };
  }, [data, interval]);
  
  return { lastSaved, saving };
};
```

---

## 4. 개발 환경 구성

### 4.1 Claude Code 프로젝트 구조

```
coach-competency-system/
├── frontend/
│   ├── src/
│   │   ├── components/     # 재사용 컴포넌트
│   │   ├── pages/         # 페이지 컴포넌트
│   │   ├── hooks/         # 커스텀 훅
│   │   ├── services/      # API 통신
│   │   ├── stores/        # 상태 관리
│   │   └── types/         # TypeScript 타입
│   ├── package.json
│   └── tsconfig.json
│
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI 라우터
│   │   ├── models/        # SQLAlchemy 모델
│   │   ├── schemas/       # Pydantic 스키마
│   │   ├── services/      # 비즈니스 로직
│   │   ├── core/          # 설정, 보안
│   │   └── utils/         # 유틸리티
│   ├── alembic/           # DB 마이그레이션
│   ├── tests/
│   └── requirements.txt
│
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.frontend
│   └── Dockerfile.backend
│
└── docs/
    ├── api/               # API 문서
    └── deployment/        # 배포 가이드
```

### 4.2 초기 개발 명령어

```bash
# Backend 초기 설정
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install fastapi uvicorn sqlalchemy alembic psycopg2-binary redis pydantic python-jose

# Frontend 초기 설정
cd frontend
npm create vite@latest . -- --template react-ts
npm install @ant-design/pro-components axios react-query zustand
npm install -D @types/react tailwindcss

# Docker 환경 실행
docker-compose up -d

# Claude Code로 빠른 개발
claude-code "Generate FastAPI CRUD endpoints for Project model"
claude-code "Create React form component for competency input"
```

---

## 5. 성능 최적화 가이드

### 5.1 Frontend 최적화

```typescript
// 1. 코드 스플리팅
const ProjectManagement = lazy(() => import('./pages/ProjectManagement'));

// 2. 이미지 최적화
<img src={imageSrc} loading="lazy" alt="" />

// 3. React Query 캐싱
const { data } = useQuery({
  queryKey: ['competencies', userId],
  queryFn: fetchCompetencies,
  staleTime: 5 * 60 * 1000, // 5분
  cacheTime: 10 * 60 * 1000, // 10분
});
```

### 5.2 Backend 최적화

```python
# 1. 데이터베이스 쿼리 최적화
from sqlalchemy.orm import selectinload

# N+1 문제 해결
applications = db.query(Application)\
    .options(selectinload(Application.user))\
    .options(selectinload(Application.data))\
    .all()

# 2. Redis 캐싱
@cache(expire=600)  # 10분 캐싱
async def get_project_stats(project_id: int):
    return await calculate_stats(project_id)

# 3. 비동기 처리
@app.post("/api/notifications/send")
async def send_notification(notification: NotificationSchema):
    # Celery 태스크로 비동기 처리
    send_email_task.delay(notification.dict())
    return {"status": "queued"}
```

---

## 6. 모니터링 및 로깅

### 6.1 필수 모니터링 지표

```python
# 1. API 응답시간
@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# 2. 에러 로깅
import logging
logger = logging.getLogger(__name__)

try:
    result = process_application(data)
except Exception as e:
    logger.error(f"Application processing failed: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="Internal server error")
```

---

## 7. 배포 체크리스트

### Phase 1 배포 준비

- [ ] 환경변수 설정 (.env 파일)
- [ ] 데이터베이스 초기화 스크립트
- [ ] Nginx 설정 (리버스 프록시)
- [ ] SSL 인증서 설정 (Let's Encrypt)
- [ ] 백업 스크립트 설정
- [ ] 모니터링 도구 설치 (Prometheus/Grafana)
- [ ] 로그 수집 설정 (ELK or CloudWatch)
- [ ] 성능 테스트 (K6 or JMeter)


---

*본 문서는 메인 설계서의 보완 문서로, 기술적 구현 사항을 상세히 정의합니다.*
