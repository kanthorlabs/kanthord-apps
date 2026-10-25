export const CAUSE_SUBCATEGORIES = {
  prompt: ["context_missing", "instruction_conflict", "rule_absent"],
  plan: [
    "criterion_unstated",
    "dependency",
    "verification_context",
    "verification_insufficient",
    "decomposition",
    "oversized",
  ],
  worker_action: ["gate_commit", "merge_base", "release_gate", "review_flow", "step_failed"],
  llm_provider: ["rate_limited", "quota_exhausted", "unavailable"],
  model: [
    "work_defect",
    "standard_violation",
    "verification_failed",
    "no_progress",
    "reply_invalid",
    "protocol_violation",
    "output_truncated",
    "budget_exhausted",
    "judgement_wrong",
  ],
  environment: [
    "setup_failed",
    "command_absent",
    "flaky_verification",
    "verification_hang",
    "repository_hook",
  ],
  infrastructure: ["verification_killed", "network", "execution_lost"],
  human: ["intervention", "configuration"],
  unattributed: [],
};

export const LABEL_CATEGORIES = Object.keys(CAUSE_SUBCATEGORIES).filter(
  (category) => category !== "unattributed",
);

export const causeAttributes = (cause) => ({
  "kanthord.cause.category": cause.category,
  "kanthord.cause.assigner": cause.assigner,
  ...(cause.subcategory === undefined ? {} : { "kanthord.cause.subcategory": cause.subcategory }),
  ...(cause.suspects === undefined ? {} : { "kanthord.cause.suspects": cause.suspects }),
});

export const causeOfAttributes = (attributes, assigner = attributes["kanthord.cause.assigner"]) => {
  const category = attributes["kanthord.cause.category"];
  if (category === undefined) return null;
  const subcategory = attributes["kanthord.cause.subcategory"];
  const suspects = attributes["kanthord.cause.suspects"];
  return {
    category,
    assigner,
    ...(subcategory === undefined ? {} : { subcategory }),
    ...(suspects === undefined ? {} : { suspects }),
  };
};
