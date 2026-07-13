const DEFAULT_SCORING_WEIGHTS = {
  roleFit: 20,
  availabilityFit: 15,
  workloadBalance: 15,
  fairness: 10,
  performance: 10,
  employmentTypeFit: 10,
  costEfficiency: 5,
  reliability: 5,
  fatiguePenalty: 20,
  overtimePenalty: 15,
  ruleRiskPenalty: 30,
};

const AVAILABILITY_CODES = new Set([
  "OUTSIDE_WORKING_DAYS",
  "PART_TIME_AVAILABILITY_REQUIRED",
  "OUTSIDE_SUBMITTED_AVAILABILITY",
  "FULL_TIME_UNAVAILABLE_EXCEPTION",
  "AVAILABILITY_PENDING_SUBMISSION",
  "LATE_AVAILABILITY_CHANGE_PENDING",
  "FIRST_WEEK_GRACE_MISSING_AVAILABILITY",
  "AVAILABILITY_VIOLATION",
]);

const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, Number(value || 0)));

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const finiteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function readScoringWeight(weights, key) {
  const fallback = DEFAULT_SCORING_WEIGHTS[key] ?? 0;
  const raw = weights?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

const normalizeSeverity = (value) => String(value || "warning").toLowerCase();

const getIssueRiskRatio = (issues = []) => {
  let ratio = 0;
  for (const issue of issues || []) {
    const severity = normalizeSeverity(issue?.severity);
    if (severity === "error" || severity === "risk" || severity === "high") {
      return 1;
    }
    if (severity === "warning" || severity === "medium") ratio = Math.max(ratio, 0.6);
    if (severity === "info" || severity === "low") ratio = Math.max(ratio, 0.2);
  }
  return ratio;
};

const isAvailabilityIssue = (issue) => {
  const code = String(issue?.code || "").toUpperCase();
  return AVAILABILITY_CODES.has(code) || code.includes("AVAILABILITY");
};

const getAvailabilityRatio = (issues = []) => {
  const availabilityIssues = (issues || []).filter(isAvailabilityIssue);
  if (!availabilityIssues.length) return 1;
  const riskRatio = getIssueRiskRatio(availabilityIssues);
  if (riskRatio >= 1) return 0;
  if (riskRatio >= 0.6) return 0.25;
  return 0.6;
};

const getWorkloadRatio = (weeklyHoursAfter, weeklyTarget) => {
  const target = Math.max(1, finiteNumber(weeklyTarget, 40));
  const hours = Math.max(0, finiteNumber(weeklyHoursAfter, 0));
  if (hours <= target * 0.5) return 1;
  if (hours <= target * 0.75) return 0.75;
  if (hours <= target) return 0.45;
  return 0.15;
};

export function estimateHourlyCost({ staff = {}, shiftHours = 0, weeklyTarget = 40 }) {
  const hourlyRate = finiteNumber(staff.hourlyRate, 0);
  if (hourlyRate > 0) return round2(hourlyRate);

  const baseSalary = finiteNumber(staff.baseSalary, 0);
  if (baseSalary <= 0) return null;

  const salaryType = String(staff.salaryType || "monthly").toLowerCase();
  if (salaryType === "shift") {
    const hours = Math.max(1, finiteNumber(shiftHours, 0));
    return round2(baseSalary / hours);
  }

  if (salaryType === "monthly") {
    const monthlyHours = Math.max(1, finiteNumber(weeklyTarget, 40) * 4.345);
    return round2(baseSalary / monthlyHours);
  }

  return null;
}

const getCostRatio = ({ estimatedHourlyCost, minHourlyCost, maxHourlyCost }) => {
  const cost = Number(estimatedHourlyCost);
  const min = Number(minHourlyCost);
  const max = Number(maxHourlyCost);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (!Number.isFinite(cost)) return 0;
  if (max <= min) return 1;
  return clamp((max - cost) / (max - min));
};

export function computeAutoScheduleCandidateScore({
  policy = {},
  staff = {},
  validation = {},
  afterPlanned = 0,
  rotationHours = 0,
  maxRotationHours = 0,
  requiredRole = "",
  roleFitRatio = 1,
  estimatedHourlyCost = null,
  minHourlyCost = null,
  maxHourlyCost = null,
  shiftHours = 0,
}) {
  const weights = policy.scoringWeights || {};
  const rules = policy.laborRules || {};
  const employmentType = String(staff.employmentType || "full_time").toLowerCase();
  const employmentPolicy =
    policy.employmentTypePolicy?.[employmentType] ||
    policy.employmentTypePolicy?.full_time ||
    {};
  const metrics = validation.metrics || {};
  const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];

  const weeklyTarget = finiteNumber(
    employmentPolicy.weeklyHoursTarget ?? rules.recommendedWeeklyHoursCap,
    40,
  );
  const recommendedWeeklyHoursCap = finiteNumber(
    rules.recommendedWeeklyHoursCap,
    weeklyTarget,
  );
  const maxConsecutiveWorkingDays = finiteNumber(
    employmentPolicy.maxConsecutiveWorkingDays ?? rules.maxConsecutiveWorkingDays,
    6,
  );

  const performanceRatio = clamp(finiteNumber(metrics.performanceScore, 75) / 100);
  const reliabilityRatio = clamp(finiteNumber(metrics.reliabilityScore, 75) / 100);
  const employmentTypeRatio = clamp(finiteNumber(employmentPolicy.priorityWeight, 1));
  const fairnessRatio =
    finiteNumber(maxRotationHours, 0) > 0
      ? clamp(1 - finiteNumber(rotationHours, 0) / finiteNumber(maxRotationHours, 1))
      : 1;
  const costRatio = getCostRatio({
    estimatedHourlyCost,
    minHourlyCost,
    maxHourlyCost,
  });

  const positiveRatios = {
    roleFit: requiredRole ? clamp(roleFitRatio) : 1,
    availabilityFit: getAvailabilityRatio(warnings),
    workloadBalance: getWorkloadRatio(afterPlanned, weeklyTarget),
    fairness: fairnessRatio,
    performance: performanceRatio,
    employmentTypeFit: employmentTypeRatio,
    costEfficiency: costRatio,
    reliability: reliabilityRatio,
  };

  const positiveComponents = {};
  let positiveScore = 0;
  let positiveCapacity = 0;
  for (const key of [
    "roleFit",
    "availabilityFit",
    "workloadBalance",
    "fairness",
    "performance",
    "employmentTypeFit",
    "costEfficiency",
    "reliability",
  ]) {
    const weight = readScoringWeight(weights, key);
    const ratio = positiveRatios[key];
    const applicable = ratio !== null;
    const contribution = applicable ? weight * ratio : 0;
    positiveComponents[key] = round2(contribution);
    positiveScore += contribution;
    if (applicable) positiveCapacity += weight;
  }

  const consecutiveWorkingDays = finiteNumber(metrics.consecutiveWorkingDays, 0);
  const fatigueRatio =
    maxConsecutiveWorkingDays > 0 && consecutiveWorkingDays >= maxConsecutiveWorkingDays
      ? 1
      : 0;
  const overtimeRatio =
    recommendedWeeklyHoursCap > 0 && finiteNumber(afterPlanned, 0) > recommendedWeeklyHoursCap
      ? 1
      : 0;
  const ruleRiskRatio = getIssueRiskRatio(warnings);

  const penaltyComponents = {
    fatiguePenalty: round2(readScoringWeight(weights, "fatiguePenalty") * fatigueRatio),
    overtimePenalty: round2(readScoringWeight(weights, "overtimePenalty") * overtimeRatio),
    ruleRiskPenalty: round2(readScoringWeight(weights, "ruleRiskPenalty") * ruleRiskRatio),
  };
  const penaltyScore = Object.values(penaltyComponents).reduce(
    (sum, value) => sum + finiteNumber(value, 0),
    0,
  );
  const rawScore = positiveScore - penaltyScore;
  const normalizedScore = positiveCapacity > 0
    ? clamp(rawScore / positiveCapacity) * 100
    : 0;

  return {
    score: Math.round(normalizedScore),
    rawScore: round2(rawScore),
    positiveCapacity: round2(positiveCapacity),
    positiveComponents,
    penaltyComponents,
    fairnessContribution: positiveComponents.fairness,
    estimatedHourlyCost:
      Number.isFinite(Number(estimatedHourlyCost)) ? round2(estimatedHourlyCost) : null,
    shiftHours: round2(shiftHours),
  };
}

export { DEFAULT_SCORING_WEIGHTS };
