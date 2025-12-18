// User and Authentication Types
export enum UserRole {
  COACH = 'coach',
  STAFF = 'staff',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  DELETED = 'deleted',
}

export interface User {
  user_id: number
  name: string
  email: string
  phone?: string
  birthdate?: string
  gender?: string
  address: string
  roles: string  // JSON string array of roles
  status: UserStatus
  coach_certification_number?: string
  coaching_fields?: string  // JSON string array of coaching fields
  created_at: string
  updated_at: string
  deleted_at?: string
}

// Project Types
export enum ProjectStatus {
  DRAFT = 'draft',              // 준비중
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
