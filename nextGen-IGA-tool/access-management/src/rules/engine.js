import { db } from "../db/client.js";

const OPS = {
  eq: (a, b) => String(a) === String(b),
  neq: (a, b) => String(a) !== String(b),
  in: (a, b) => (Array.isArray(b) ? b : [b]).map(String).includes(String(a)),
  nin: (a, b) => !(Array.isArray(b) ? b : [b]).map(String).includes(String(a)),
  lte: (a, b) => Number(a) <= Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  gt: (a, b) => Number(a) > Number(b),
  contains: (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
  regex: (a, b) => new RegExp(b, "i").test(String(a)),
};

// ctx shape: { userId, resourceId, role, duration, justification, department? }
function evalCondition(cond, ctx) {
  const val = ctx[cond.field]; // e.g. ctx["role"], ctx["duration"]
  if (val === undefined) return false;
  const op = OPS[cond.op];
  if (!op) {
    console.warn("[rules] unknown op:", cond.op);
    return false;
  }
  return op(val, cond.value);
}

function evalRule(rule, ctx) {
  const { conditions, condition_logic } = rule;
  if (!conditions?.length) return false;

  return condition_logic === "OR"
    ? conditions.some((c) => evalCondition(c, ctx))
    : conditions.every((c) => evalCondition(c, ctx)); // default AND
}

/**
 * Evaluate all enabled rules against request context.
 * Returns first matching rule (by priority ASC) or null.
 *
 * @param {object} ctx - { userId, resourceId, role, duration, justification }
 * @returns {object|null} matched rule row, or null
 */
export async function evaluateRules(ctx) {
  const { rows } = await db.query(
    `SELECT rule_id, name, priority, condition_logic, conditions, action
     FROM access_rules
     WHERE enabled = true
     ORDER BY priority ASC`,
  );

  for (const rule of rows) {
    if (evalRule(rule, ctx)) {
      console.log(
        `[rules] matched: "${rule.name}" (priority ${rule.priority})`,
      );
      return rule;
    }
  }

  return null; // no match → manual review
}
