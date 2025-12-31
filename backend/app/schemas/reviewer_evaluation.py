"""
Schemas for reviewer evaluations and scoring
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class ReviewerEvaluationCreate(BaseModel):
    """Create a reviewer evaluation"""
    motivation_score: int = Field(..., ge=0, le=10, description="지원동기 점수 (0-10)")
    expertise_score: int = Field(..., ge=0, le=10, description="전문성 점수 (0-10)")
    role_fit_score: int = Field(..., ge=0, le=10, description="역할적합성 점수 (0-10)")
    comment: Optional[str] = Field(None, description="종합 의견")
    recommendation: Optional[str] = Field(None, description="추천 여부: strongly_recommend, recommend, neutral, not_recommend")

    @field_validator('recommendation')
    @classmethod
    def validate_recommendation(cls, v):
        if v and v not in ['strongly_recommend', 'recommend', 'neutral', 'not_recommend']:
            raise ValueError('Invalid recommendation value')
        return v


class ReviewerEvaluationUpdate(BaseModel):
    """Update a reviewer evaluation"""
    motivation_score: Optional[int] = Field(None, ge=0, le=10)
    expertise_score: Optional[int] = Field(None, ge=0, le=10)
    role_fit_score: Optional[int] = Field(None, ge=0, le=10)
    comment: Optional[str] = None
    recommendation: Optional[str] = None

    @field_validator('recommendation')
    @classmethod
    def validate_recommendation(cls, v):
        if v and v not in ['strongly_recommend', 'recommend', 'neutral', 'not_recommend']:
            raise ValueError('Invalid recommendation value')
        return v


class ReviewerInfo(BaseModel):
    """Reviewer basic info"""
    user_id: int
    name: str
    email: str

    class Config:
        from_attributes = True


class ReviewerEvaluationResponse(BaseModel):
    """Response for a reviewer evaluation"""
    evaluation_id: int
    application_id: int
    reviewer_id: int
    reviewer: Optional[ReviewerInfo] = None
    motivation_score: int
    expertise_score: int
    role_fit_score: int
    total_score: Decimal
    comment: Optional[str] = None
    recommendation: Optional[str] = None
    evaluated_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReviewerEvaluationListResponse(BaseModel):
    """List of reviewer evaluations"""
    evaluations: List[ReviewerEvaluationResponse]
    average_score: Optional[Decimal] = None
    evaluation_count: int


# Scoring related schemas
class ScoreCalculationResult(BaseModel):
    """Result of score calculation"""
    project_id: int
    total_applications: int
    calculated_count: int
    error_count: int
    errors: List[dict] = []


class FinalScoreResult(BaseModel):
    """Result of final score calculation"""
    project_id: int
    total_applications: int
    finalized_count: int
    no_evaluation_count: int


class SelectionRecommendation(BaseModel):
    """Selection recommendation for an application"""
    application_id: int
    user_id: int
    applicant_name: str
    applicant_email: str
    applied_role: Optional[str] = None
    auto_score: Optional[Decimal] = None
    qualitative_score: Optional[Decimal] = None
    final_score: Optional[Decimal] = None
    evaluation_count: int = 0
    current_selection_result: str
    recommended: bool = False


class SelectionRecommendationResponse(BaseModel):
    """Response for selection recommendation"""
    project_id: int
    max_participants: int
    total_applications: int
    recommendations: List[SelectionRecommendation]
    cutoff_score: Optional[Decimal] = None


class SelectionDecision(BaseModel):
    """Individual selection decision"""
    selection_result: str = Field(..., description="selected or rejected")
    reason: Optional[str] = None

    @field_validator('selection_result')
    @classmethod
    def validate_selection_result(cls, v):
        if v not in ['selected', 'rejected']:
            raise ValueError('selection_result must be "selected" or "rejected"')
        return v


class BulkSelectionRequest(BaseModel):
    """Bulk selection request"""
    application_ids: List[int]


class BulkSelectionResponse(BaseModel):
    """Response for bulk selection"""
    project_id: int
    selected_count: int
    rejected_count: int
    errors: List[dict] = []


class ProjectWeightsUpdate(BaseModel):
    """Update project weights"""
    quantitative_weight: Decimal = Field(..., ge=0, le=100, description="정량평가 가중치 (0-100)")
    qualitative_weight: Decimal = Field(..., ge=0, le=100, description="정성평가 가중치 (0-100)")

    @field_validator('qualitative_weight')
    @classmethod
    def validate_weights_sum(cls, v, info):
        quant = info.data.get('quantitative_weight', 0)
        if quant + v != 100:
            raise ValueError('quantitative_weight + qualitative_weight must equal 100')
        return v
