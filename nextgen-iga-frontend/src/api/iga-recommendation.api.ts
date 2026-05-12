import { igaRecommendationClient } from "../lib/axios";
import type { 
  ManagerReviewResponse, 
  ProactiveRecommendationResponse 
} from "../types/recommendation.types";

export const igaRecommendationApi = {
  getManagerReview: (managerId: string) =>
    igaRecommendationClient
      .post<ManagerReviewResponse>("/api/access-requests/manager-review", {
        manager_id: managerId,
      })
      .then((r) => r.data),

  getProactiveRecommendation: (userId: string, requestedRole: string, justification: string) =>
    igaRecommendationClient
      .post<ProactiveRecommendationResponse>("/api/access-requests/", {
        user_id: userId,
        requested_role: requestedRole,
        justification: justification,
      })
      .then((r) => r.data),
};
