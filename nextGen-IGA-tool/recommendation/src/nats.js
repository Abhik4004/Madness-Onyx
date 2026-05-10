const { connect, JSONCodec } = require('nats');
const { query } = require('./db/pool');
const logger = require('./utils/logger');
const { logActivity } = require('./utils/activityLogger');

const NATS_URL = process.env.NATS_URL || "nats://54.224.250.252:4222";
const jc = JSONCodec();

async function startNats() {
  try {
    const nc = await connect({ servers: NATS_URL });
    logger.info(`Recommendation connected to NATS: ${nc.getServer()}`);

    const sub = nc.subscribe("ai.recommendation.request");
    (async () => {
      for await (const msg of sub) {
        try {
          const { userId, resourceId, itemId, certificationId } = jc.decode(msg.data);
          logger.info(`Recommendation request for user:${userId} resource:${resourceId} item:${itemId}`);

          // Decouple recommendation logic to the service layer
          const { getSingleRecommendation } = require('./services/recommendationService');
        
          const result = await getSingleRecommendation({ 
            userId, 
            accessType: resourceId, 
            context: 'CERTIFICATION',
            mode: 'PEER_ANALYSIS'
          });

        // Publish result back to NATS
        const response = {
          itemId,
          recommendation: (result.decision === 'STRONGLY_RECOMMEND' || result.decision === 'RECOMMEND_WITH_CAUTION') ? 'RETAIN' : 'REVIEW',
          confidenceScore: result.score, // Already 0 to 1
          insights: result.reason
        };

          // If it's a certification task, publish async update
          if (itemId && certificationId) {
            nc.publish("certification.recommendation.generated", jc.encode(response));
          }

          // Persist recommendation event to system_logs
          await logActivity("RECOM_GENERATED", "SYSTEM_AI", "Recommendation Engine", userId, {
            resourceId,
            itemId,
            certificationId,
            score: result.score,
            decision: result.decision
          });

          msg.respond(jc.encode({
            ok: true,
            status: 200,
            data: result
          }));
        } catch (err) {
          logger.error("Recommendation handler error:", err.message);
          msg.respond(jc.encode({ ok: false, status: 500, message: err.message }));
        }
      }
    })();

    // ─── Onboarding Suggestions ────────────────────────────────
    const onboardingSub = nc.subscribe("recommendation.onboarding");
    (async () => {
      for await (const msg of onboardingSub) {
        try {
          const envelope = jc.decode(msg.data);
          // Better extraction: handle potential trailing slashes
          const pathParts = (envelope.path || "").split('/').filter(Boolean);
          const userId = pathParts[pathParts.length - 1];
          
          if (!userId) throw new Error("Could not extract userId from path: " + envelope.path);
          
          const { getOnboardingRecommendations } = require('./services/recommendationService');
          const results = await getOnboardingRecommendations(userId);
          
          msg.respond(jc.encode({
            ok: true,
            status: 200,
            data: results
          }));
        } catch (err) {
          logger.error(`Onboarding handler error for ${msg.subject}: ${err.message}`, { stack: err.stack });
          msg.respond(jc.encode({ ok: false, status: 500, message: err.message }));
        }
      }
    })();

    // ─── Team Onboarding Suggestions ───────────────────────────
    const teamSub = nc.subscribe("recommendation.team");
    (async () => {
      for await (const msg of teamSub) {
        try {
          const envelope = jc.decode(msg.data);
          const pathParts = (envelope.path || "").split('/').filter(Boolean);
          const managerId = pathParts[pathParts.length - 1];
          
          if (!managerId) throw new Error("Could not extract managerId from path: " + envelope.path);
          
          const { getTeamOnboardingRecommendations } = require('./services/recommendationService');
          const results = await getTeamOnboardingRecommendations(managerId);
          
          msg.respond(jc.encode({
            ok: true,
            status: 200,
            data: results
          }));
        } catch (err) {
          logger.error(`Team onboarding handler error: ${err.message}`, { stack: err.stack });
          msg.respond(jc.encode({ ok: false, status: 500, message: err.message }));
        }
      }
    })();

  } catch (err) {
    logger.error("NATS connection failed:", err.message);
  }
}

module.exports = { startNats };
