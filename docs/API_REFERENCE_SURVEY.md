# Survey System API Reference

**설문 시스템 API 빠른 레퍼런스**

---

## Base URL

```
http://localhost:8000/api
```

## Authentication

모든 API는 JWT Bearer Token 인증 필요:

```http
Authorization: Bearer {access_token}
```

---

## 1. 역량 항목 관리 (Competency Items)

### GET /competency/items

**모든 활성 역량 항목 조회 (필드 포함)**

#### Request

```http
GET /api/competency/items
Authorization: Bearer {token}
```

#### Response

```json
[
  {
    "item_id": 38,
    "item_name": "코칭/상담/심리 관련 최종학력",
    "item_code": "EDU_COACHING_FINAL",
    "category": "EDUCATION",
    "input_type": "text",
    "is_active": true,
    "template": "DEGREE",
    "template_config": null,
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
        "display_order": 1,
        "placeholder": null
      },
      {
        "field_id": 2,
        "field_name": "major",
        "field_label": "전공명",
        "field_type": "text",
        "field_options": null,
        "is_required": true,
        "display_order": 2,
        "placeholder": "전공명을 입력하세요"
      },
      {
        "field_id": 3,
        "field_name": "proof",
        "field_label": "증빙업로드",
        "field_type": "file",
        "field_options": null,
        "is_required": false,
        "display_order": 3,
        "placeholder": null
      }
    ]
  },
  {
    "item_id": 40,
    "item_name": "KCA 코칭관련 자격증",
    "item_code": "CERT_KCA",
    "category": "ADDON",
    "template": "TEXT_FILE",
    "is_repeatable": true,
    "max_entries": 5,
    "fields": [
      {
        "field_id": 10,
        "field_name": "name",
        "field_label": "자격증명",
        "field_type": "text",
        "is_required": true,
        "display_order": 1,
        "placeholder": "예: KAC 전문코치"
      },
      {
        "field_id": 11,
        "field_name": "proof",
        "field_label": "증빙서류",
        "field_type": "file",
        "is_required": false,
        "display_order": 2
      }
    ]
  }
]
```

#### Status Codes

- `200 OK`: 성공
- `401 Unauthorized`: 인증 실패
- `403 Forbidden`: 권한 없음

---

## 2. 과제 항목 관리 (Project Items)

### GET /projects/{project_id}/items

**특정 과제의 설문 항목 조회**

#### Request

```http
GET /api/projects/14/items
Authorization: Bearer {token}
```

#### Response

```json
[
  {
    "project_item_id": 123,
    "project_id": 14,
    "item_id": 38,
    "is_required": true,
    "proof_required_level": "optional",
    "max_score": 10.00,
    "display_order": 1,
    "competency_item": {
      "item_id": 38,
      "item_name": "코칭/상담/심리 관련 최종학력",
      "template": "DEGREE",
      "fields": [...]
    },
    "scoring_criteria": []
  }
]
```

### POST /projects/{project_id}/items

**과제에 역량 항목 추가**

#### Request

```http
POST /api/projects/14/items
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "item_id": 38,
  "is_required": true,
  "proof_required_level": "optional",
  "max_score": 10,
  "display_order": 1,
  "scoring_criteria": []
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| item_id | integer | ✅ | CompetencyItem ID |
| is_required | boolean | ❌ (default: false) | 필수 항목 여부 |
| proof_required_level | string | ❌ (default: "not_required") | 증빙 필요성: "not_required", "optional", "required" |
| max_score | decimal | ❌ | 최대 점수 (0-100) |
| display_order | integer | ❌ (default: 0) | 표시 순서 |
| scoring_criteria | array | ❌ (default: []) | 채점 기준 |

#### Response

```json
{
  "project_item_id": 124,
  "project_id": 14,
  "item_id": 38,
  "is_required": true,
  "proof_required_level": "optional",
  "max_score": 10.00,
  "display_order": 1,
  "competency_item": {...},
  "scoring_criteria": []
}
```

#### Status Codes

- `201 Created`: 항목 추가 성공
- `400 Bad Request`: 잘못된 요청 (이미 존재하는 항목 등)
- `403 Forbidden`: 권한 없음 (admin/staff만 가능)
- `404 Not Found`: 과제 또는 역량 항목 없음

### PUT /projects/{project_id}/items/{project_item_id}

**과제 항목 수정 (배점, 증빙 레벨 등)**

#### Request

```http
PUT /api/projects/14/items/123
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "item_id": 38,
  "is_required": true,
  "proof_required_level": "required",
  "max_score": 15,
  "display_order": 1,
  "scoring_criteria": []
}
```

#### Response

```json
{
  "project_item_id": 123,
  "project_id": 14,
  "item_id": 38,
  "is_required": true,
  "proof_required_level": "required",
  "max_score": 15.00,
  "display_order": 1
}
```

#### Status Codes

- `200 OK`: 수정 성공
- `403 Forbidden`: 권한 없음 (admin만 가능)
- `404 Not Found`: 항목 없음

### DELETE /projects/{project_id}/items/{project_item_id}

**과제에서 항목 제거**

#### Request

```http
DELETE /api/projects/14/items/123
Authorization: Bearer {admin_token}
```

#### Response

```json
{
  "message": "항목이 삭제되었습니다"
}
```

#### Status Codes

- `200 OK`: 삭제 성공
- `403 Forbidden`: 권한 없음
- `404 Not Found`: 항목 없음

---

## 3. 과제 응모 (Applications)

### POST /applications

**과제 응모 제출**

#### Request

```http
POST /api/applications
Authorization: Bearer {coach_token}
Content-Type: application/json

{
  "project_id": 14,
  "is_draft": false,
  "motivation": "지원 동기...",
  "answers": [
    {
      "project_item_id": 123,
      "answer_data": "{\"degree_level\": \"석사\", \"major\": \"심리학\", \"proof\": null}"
    },
    {
      "project_item_id": 124,
      "answer_data": "[{\"name\": \"KAC 전문코치\", \"proof\": null}, {\"name\": \"KAC 수석코치\", \"proof\": null}]"
    },
    {
      "project_item_id": 125,
      "answer_data": "{\"value\": 5}"
    }
  ]
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| project_id | integer | ✅ | 과제 ID |
| is_draft | boolean | ❌ (default: false) | 임시저장 여부 |
| motivation | string | ❌ | 지원 동기 |
| answers | array | ✅ | 응답 데이터 배열 |
| answers[].project_item_id | integer | ✅ | ProjectItem ID |
| answers[].answer_data | string | ✅ | JSON 문자열 (템플릿별 구조) |

#### answer_data 형식

**단일 항목 (DEGREE)**:
```json
{
  "degree_level": "석사",
  "major": "심리학",
  "proof": null
}
```

**복수 항목 (TEXT_FILE, repeatable)**:
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

**숫자 항목 (NUMBER)**:
```json
{
  "value": 5
}
```

**텍스트 항목 (TEXT)**:
```json
{
  "value": "강점 코칭 및 경력 전환 코칭"
}
```

**코칭 이력 (COACHING_HISTORY)**:
```json
{
  "experience": "3년간 경영진 대상 비즈니스 코칭 수행",
  "proof": null
}
```

#### Response

```json
{
  "application_id": 456,
  "project_id": 14,
  "user_id": 7,
  "status": "SUBMITTED",
  "is_draft": false,
  "auto_score": null,
  "final_score": null,
  "submitted_at": "2025-11-05T10:30:00Z"
}
```

#### Status Codes

- `201 Created`: 응모 성공
- `400 Bad Request`: 필수 항목 누락 등
- `403 Forbidden`: 이미 응모함 또는 권한 없음
- `404 Not Found`: 과제 없음

### GET /applications/{application_id}

**응모 상세 조회**

#### Request

```http
GET /api/applications/456
Authorization: Bearer {token}
```

#### Response

```json
{
  "application_id": 456,
  "project_id": 14,
  "user_id": 7,
  "status": "SUBMITTED",
  "auto_score": null,
  "final_score": null,
  "submitted_at": "2025-11-05T10:30:00Z",
  "application_data": [
    {
      "data_id": 1001,
      "application_id": 456,
      "item_id": 38,
      "submitted_value": "{\"degree_level\": \"석사\", \"major\": \"심리학\"}",
      "submitted_file_id": null,
      "verification_status": "pending",
      "item_score": null,
      "competency_item": {
        "item_id": 38,
        "item_name": "코칭/상담/심리 관련 최종학력",
        "template": "DEGREE",
        "fields": [...]
      }
    }
  ]
}
```

---

## 4. 커스텀 질문 (Custom Questions)

### POST /projects/{project_id}/questions

**과제에 커스텀 질문 추가**

#### Request

```http
POST /api/projects/14/questions
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "question_text": "귀하의 코칭 철학은 무엇입니까?",
  "question_type": "LONG_TEXT",
  "is_required": true,
  "max_score": 10,
  "display_order": 100
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| question_text | string | ✅ | 질문 내용 |
| question_type | string | ✅ | SHORT_TEXT, LONG_TEXT, SELECT, MULTISELECT |
| options | array | ❌ | SELECT/MULTISELECT인 경우 선택지 |
| is_required | boolean | ❌ | 필수 여부 |
| max_score | decimal | ❌ | 최대 점수 |
| display_order | integer | ❌ | 표시 순서 |

#### Response

```json
{
  "question_id": 789,
  "project_id": 14,
  "question_text": "귀하의 코칭 철학은 무엇입니까?",
  "question_type": "LONG_TEXT",
  "is_required": true,
  "max_score": 10.00,
  "display_order": 100
}
```

---

## 5. 점수 검증

### 100점 만점 검증

프론트엔드에서 검증하지만, 백엔드에서도 검증 가능:

```typescript
// Frontend validation
const calculateTotalScore = (): number => {
  let total = 0

  // ProjectItems 점수
  projectItems.forEach(item => {
    if (item.max_score) {
      total += Number(item.max_score)
    }
  })

  // CustomQuestions 점수
  customQuestions.forEach(q => {
    if (q.max_score) {
      total += Number(q.max_score)
    }
  })

  return total
}

if (calculateTotalScore() !== 100) {
  throw new Error('총 배점이 100점이 아닙니다')
}
```

---

## 6. 에러 코드

### HTTP Status Codes

| Code | Message | Description |
|------|---------|-------------|
| 200 | OK | 요청 성공 |
| 201 | Created | 리소스 생성 성공 |
| 400 | Bad Request | 잘못된 요청 (필수 파라미터 누락 등) |
| 401 | Unauthorized | 인증 실패 (토큰 없음/만료) |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 409 | Conflict | 충돌 (이미 존재하는 리소스) |
| 422 | Unprocessable Entity | 검증 실패 (Pydantic validation) |
| 500 | Internal Server Error | 서버 오류 |

### Error Response Format

```json
{
  "detail": "에러 메시지"
}
```

또는 검증 오류 시:

```json
{
  "detail": [
    {
      "loc": ["body", "item_id"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## 7. 테스트용 cURL 예제

### 역량 항목 조회

```bash
curl -X GET "http://localhost:8000/api/competency/items" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 과제 항목 추가

```bash
curl -X POST "http://localhost:8000/api/projects/14/items" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 38,
    "is_required": true,
    "proof_required_level": "optional",
    "max_score": 10,
    "display_order": 1
  }'
```

### 증빙 레벨 변경

```bash
curl -X PUT "http://localhost:8000/api/projects/14/items/123" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 38,
    "is_required": true,
    "proof_required_level": "required",
    "max_score": 10,
    "display_order": 1
  }'
```

### 과제 응모

```bash
curl -X POST "http://localhost:8000/api/applications" \
  -H "Authorization: Bearer {coach_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 14,
    "is_draft": false,
    "answers": [
      {
        "project_item_id": 123,
        "answer_data": "{\"degree_level\": \"석사\", \"major\": \"심리학\"}"
      }
    ]
  }'
```

---

## 8. Postman Collection

**Import URL**:
```
http://localhost:8000/openapi.json
```

Postman에서:
1. Import → Link 선택
2. 위 URL 입력
3. Import 클릭
4. Environment 설정:
   - `base_url`: http://localhost:8000
   - `access_token`: {로그인 후 받은 토큰}

---

## 9. 권한 요구사항

| Endpoint | Method | Required Role |
|----------|--------|---------------|
| GET /competency/items | GET | 모든 사용자 |
| GET /projects/{id}/items | GET | 모든 사용자 |
| POST /projects/{id}/items | POST | admin, staff |
| PUT /projects/{id}/items/{item_id} | PUT | admin |
| DELETE /projects/{id}/items/{item_id} | DELETE | admin |
| POST /applications | POST | coach |
| GET /applications/{id} | GET | 본인 또는 admin |
| POST /projects/{id}/questions | POST | admin, staff |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-11-05 | API Reference 초안 작성 |
