export interface AccessRecommendation {
  userId: string;
  accessType: string;
  score: number;
  decision: "STRONGLY_RECOMMEND" | "RECOMMEND_WITH_CAUTION" | "DO_NOT_RECOMMEND";
  risk_level: "low" | "medium" | "high";
  confidence: string;
  breakdown: {
    same_manager: {
      total: number;
      with_access: number;
      percentage: string;
    };
    different_manager: {
      total: number;
      with_access: number;
      percentage: string;
    };
  };
  reason: string;
}

export interface ManagerReviewResult {
  user_id: string;
  access_type: string;
  status: "risky_access" | "recommended_to_grant";
  recommendation: AccessRecommendation;
}

export interface ManagerReviewResponse {
  success: boolean;
  manager_id: string;
  total_flagged: number;
  results: ManagerReviewResult[];
}

export interface ProactiveRecommendationResponse {
  success: boolean;
  proactiveRecommendation: AccessRecommendation;
}

export interface OverridePayload {
  override: boolean;
  override_reason: string;
  approved_by: string;
  timestamp: string;
}
