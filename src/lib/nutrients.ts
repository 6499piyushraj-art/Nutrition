export type NutrientGroup = 'macro' | 'essential';
export type NutrientConfidence = 'database' | 'estimated' | 'mixed' | 'user-entered' | 'unknown';
export type NutrientStatus = 'complete' | 'partial' | 'unavailable' | 'no_food';

export const NUTRIENT_SPECS = [
  { key: 'calories', label: 'Calories', unit: 'kcal', group: 'macro', defaultTarget: 2400 },
  { key: 'protein', label: 'Protein', unit: 'g', group: 'macro', defaultTarget: 80 },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g', group: 'macro', defaultTarget: 300 },
  { key: 'fat', label: 'Total fat', unit: 'g', group: 'macro', defaultTarget: 75 },
  { key: 'omega3', label: 'Omega-3', unit: 'g', group: 'macro', defaultTarget: 1.6 },
  { key: 'fiber', label: 'Dietary fiber', unit: 'g', group: 'macro', defaultTarget: 30, targetHint: 'Configurable starting point; age/sex details may adjust the initial default.' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', group: 'essential', defaultTarget: 1300 },
  { key: 'iron', label: 'Iron', unit: 'mg', group: 'essential', defaultTarget: 11 },
  { key: 'zinc', label: 'Zinc', unit: 'mg', group: 'essential', defaultTarget: 11 },
  { key: 'vitamin_d', label: 'Vitamin D', unit: 'µg', group: 'essential', defaultTarget: 25, targetHint: 'Reference range: 20–25 µg (800–1,000 IU).' },
  { key: 'b12', label: 'Vitamin B12', unit: 'µg', group: 'essential', defaultTarget: 2.4 },
  { key: 'folate', label: 'Folate (B9)', unit: 'µg', group: 'essential', defaultTarget: 400 },
  { key: 'vitamin_c', label: 'Vitamin C', unit: 'mg', group: 'essential', defaultTarget: 75 },
  { key: 'vitamin_a', label: 'Vitamin A', unit: 'µg', group: 'essential', defaultTarget: 900, targetHint: 'Database values may use retinol activity equivalents (RAE).' },
  { key: 'iodine', label: 'Iodine', unit: 'µg', group: 'essential', defaultTarget: 150 },
] as const;

export type NutrientKey = (typeof NUTRIENT_SPECS)[number]['key'];
export type NutrientTargets = Record<NutrientKey, number>;
export const DEFAULT_NUTRIENT_TARGETS: NutrientTargets = Object.fromEntries(
  NUTRIENT_SPECS.map((item) => [item.key, item.defaultTarget]),
) as NutrientTargets;

function ageAtDateOfBirth(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth + 'T00:00:00');
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

export function getDefaultNutrientTargets(profile?: { dateOfBirth?: string | null; sex?: string | null } | null): NutrientTargets {
  const targets = { ...DEFAULT_NUTRIENT_TARGETS };
  const age = ageAtDateOfBirth(profile?.dateOfBirth);
  const sex = profile?.sex?.toUpperCase();
  // Configurable reference starting points; not personalized medical prescriptions.
  if (age !== null) {
    if (age >= 14 && age <= 18) targets.fiber = sex === 'F' ? 26 : sex === 'M' ? 38 : 30;
    else if (age >= 9 && age <= 13) targets.fiber = sex === 'F' ? 22 : sex === 'M' ? 31 : 26;
    else if (age >= 4 && age <= 8) targets.fiber = 25;
    else if (age >= 19) targets.fiber = sex === 'F' ? 25 : sex === 'M' ? 38 : 30;
  }
  return targets;
}
