/**
 * Centralized NATS Subject Constants
 */
export const SUBJECTS = {
  // AI & Recommendations
  AI_RECOMMENDATION_REQUEST: "ai.recommendation.request",
  AI_RECOMMENDATION_RESPONSE: "ai.recommendation.response",
  
  // Access Requests
  ACCESS_REQUEST_CREATED: "access.request.created",
  ACCESS_REQUEST_REVIEWED: "access.request.reviewed",
  ACCESS_GRANTED: "access.granted",
  ACCESS_REVOKED: "access.revoked",
  
  // Audit
  AUDIT_LOG_CREATED: "audit.log.created",
  
  // Certification
  CERTIFICATION_TASK_CREATED: "certification.task.created",
  CERTIFICATION_TASK_COMPLETED: "certification.task.completed",
  
  // Timers & Expiry
  ACCESS_TIMER_STARTED: "events.access.timer.started",
  ACCESS_EXPIRING_SOON: "events.access.timer.expiring_soon",
  ACCESS_EXPIRED: "events.access.timer.expired",
  ACCESS_AUTO_REVOKED: "events.access.timer.auto_revoked",
  
  // Internal Infrastructure
  NOTIFY_EMAIL: "events.notify.email",
  LDAP_GRANT: "events.auth.ldap_grant",
  LDAP_REVOKE: "events.auth.ldap_revoke",
};
