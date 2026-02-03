// User and Authentication Types
export enum UserRole {
  // New role system
  SUPER_ADMIN = 'SUPER_ADMIN',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  VERIFIER = 'VERIFIER',
  REVIEWER = 'REVIEWER',
  COACH = 'COACH',
  // Legacy roles (for backward compatibility)
  admin = 'admin',
  staff = 'staff',
  coach = 'coach',
}

export enum UserStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  DELETED = 'deleted',
}

export interface User {
  user_id: number
  name: string
  email: string
  phone?: string
  birth_year?: number  // 4-digit year (was: birthdate)
  gender?: string
  address: string
  organization?: string  // 소속
  in_person_coaching_area?: string  // 대면코칭 가능지역
  roles: string  // JSON string array of roles
  status: string  // string to accept backend values
  coach_certification_number?: string
  coaching_fields?: string  // JSON string array of coaching fields
  introduction?: string  // 자기소개
  created_at: string
  updated_at?: string
  deleted_at?: string
}

// Project Types
export enum ProjectStatus {
  DRAFT = 'draft',              // 초안 (임시저장, 비공개)
  PENDING = 'pending',          // 승인대기 (SUPER_ADMIN 승인 필요)
  REJECTED = 'rejected',        // 반려됨 (수정 후 재상신 가능)
  APPROVED = 'approved',        // 승인완료 (SUPER_ADMIN 승인됨, 모집개시 전)
  READY = 'ready',              // 모집개시 (과제관리자가 모집 시작)
  RECRUITING = 'recruiting',    // 접수중
  REVIEWING = 'reviewing',      // 심사중
  IN_PROGRESS = 'in_progress',  // 과제진행중
  EVALUATING = 'evaluating',    // 과제평가중
  COMPLETED = 'completed',      // (레거시)
  CLOSED = 'closed',            // 종료
}

export interface Project {
  project_id: number
  project_name: string
  description?: string
  recruitment_start_date: string
  recruitment_end_date: string
  status: ProjectStatus
  max_participants: number
  created_by: number
  created_at: string
  updated_at?: string
}

// Competency Types (백엔드 CompetencyCategory enum과 일치)
export enum CompetencyCategory {
  // Primary categories (aligned with survey grouping)
  BASIC = 'BASIC',                   // 기본정보 (User 테이블에서 직접)
  CERTIFICATION = 'CERTIFICATION',   // 자격증
  EDUCATION = 'EDUCATION',           // 학력
  EXPERIENCE = 'EXPERIENCE',         // 역량이력
  OTHER = 'OTHER',                   // 기타 (자기소개, 전문분야 등)
  // Legacy categories (deprecated, for backward compatibility)
  DETAIL = 'DETAIL',                 // Deprecated
  ADDON = 'ADDON',                   // Deprecated
  COACHING = 'COACHING',             // Deprecated
}

export enum InputType {
  TEXT = 'text',
  SELECT = 'select',
  NUMBER = 'number',
  FILE = 'file',
}

export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUPPLEMENTED = 'supplemented',
}

export interface CompetencyItem {
  item_id: number
  item_name: string
  item_code: string
  category: CompetencyCategory
  input_type: InputType
  is_active: boolean
}

export interface CoachCompetency {
  competency_id: number
  user_id: number
  item_id: number
  value?: string
  file_id?: number
  verification_status: VerificationStatus
  verified_by?: number
  verified_at?: string
  rejection_reason?: string
  is_anonymized: boolean
  created_at: string
  updated_at?: string
}

// Application Types
export enum ApplicationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  REVIEWING = 'reviewing',
  COMPLETED = 'completed',
}

export enum SelectionResult {
  PENDING = 'pending',
  SELECTED = 'selected',
  REJECTED = 'rejected',
}

export enum ScoreVisibility {
  ADMIN_ONLY = 'admin_only',
  PUBLIC = 'public',
}

export interface Application {
  application_id: number
  project_id: number
  user_id: number
  status: ApplicationStatus
  auto_score?: number
  final_score?: number
  score_visibility: ScoreVisibility
  can_submit: boolean
  selection_result: SelectionResult
  submitted_at?: string
  last_updated?: string
}

export interface ApplicationData {
  data_id: number
  application_id: number
  item_id: number
  competency_id?: number
  submitted_value?: string
  submitted_file_id?: number
  verification_status: VerificationStatus
  item_score?: number
  reviewed_by?: number
  reviewed_at?: string
  rejection_reason?: string
}

// File Types
export enum UploadPurpose {
  PROOF = 'proof',
  PROFILE = 'profile',
  OTHER = 'other',
}

export interface FileRecord {
  file_id: number
  original_filename: string
  stored_filename: string
  file_path: string
  file_size: number
  mime_type: string
  uploaded_by: number
  upload_purpose: UploadPurpose
  uploaded_at: string
  scheduled_deletion_date?: string
}

// API Response Types
export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface SubmissionStatus {
  canSubmit: boolean
  reason?: string
  missingItems: string[]
  completedItems: number
  totalRequired: number
}
