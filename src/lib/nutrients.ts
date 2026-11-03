export type NutrientGroup = 'macro' | 'essential';
export type NutrientConfidence = 'database' | 'estimated' | 'mixed' | 'user-entered' | 'unknown';
export type NutrientStatus = 'complete' | 'partial' | 'unavailable' | 'no_food';

export const NUTRIENT_REFERENCE = {
  name: 'ICMR-NIN Expert Group on Nutrient Requirements for Indians, RDA and EAR 2020',
  year: 2020,
  sourceUrl: 'https://fssai.gov.in/upload/advisories/2022/03/62414c50d2342Direction_RDA_03_02_2022.pdf',
};

export const NUTRIENT_SPECS = [
  { key: 'calories', label: 'Energy', unit: 'kcal', group: 'macro', defaultTarget: 2400 },
  { key: 'protein', label: 'Protein', unit: 'g', group: 'macro', defaultTarget: 80 },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g', group: 'macro', defaultTarget: 300 },
  { key: 'fat', label: 'Total fat', unit: 'g', group: 'macro', defaultTarget: 75 },
  { key: 'omega3', label: 'Omega-3', unit: 'g', group: 'macro', defaultTarget: 1.6 },
  { key: 'fiber', label: 'Dietary fibre', unit: 'g', group: 'macro', defaultTarget: 30, targetHint: 'Reference depends on age and sex.' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', group: 'essential', defaultTarget: 1000 },
  { key: 'iron', label: 'Iron', unit: 'mg', group: 'essential', defaultTarget: 19 },
  { key: 'zinc', label: 'Zinc', unit: 'mg', group: 'essential', defaultTarget: 17 },
  { key: 'vitamin_d', label: 'Vitamin D', unit: 'µg', group: 'essential', defaultTarget: 15, targetHint: '15 µg equals 600 IU.' },
  { key: 'b12', label: 'Vitamin B12', unit: 'µg', group: 'essential', defaultTarget: 2.2 },
  { key: 'folate', label: 'Folate (B9)', unit: 'µg', group: 'essential', defaultTarget: 300 },
  { key: 'vitamin_c', label: 'Vitamin C', unit: 'mg', group: 'essential', defaultTarget: 80 },
  { key: 'vitamin_a', label: 'Vitamin A', unit: 'µg', group: 'essential', defaultTarget: 1000, targetHint: 'Database values may use retinol activity equivalents (RAE).' },
  { key: 'iodine', label: 'Iodine', unit: 'µg', group: 'essential', defaultTarget: 140 },
] as const;

export type NutrientKey = (typeof NUTRIENT_SPECS)[number]['key'];
export type NutrientTargets = Record<NutrientKey, number>;
export const DEFAULT_NUTRIENT_TARGETS: NutrientTargets = Object.fromEntries(
  NUTRIENT_SPECS.map((item) => [item.key, item.defaultTarget]),
) as NutrientTargets;

function ageAtDateOfBirth(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateOfBirth)) return null;
  const birth = new Date(dateOfBirth + 'T00:00:00');
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== dateOfBirth) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

function sexCode(value?: string | null): 'M' | 'F' | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'm' || normalized === 'male' || normalized === 'boy') return 'M';
  if (normalized === 'f' || normalized === 'female' || normalized === 'girl') return 'F';
  return null;
}

type ProfileForTargets = { dateOfBirth?: string | null; sex?: string | null } | null;

export function getNutrientReferenceMetadata(profile?: ProfileForTargets) {
  const age = ageAtDateOfBirth(profile?.dateOfBirth);
  const sex = sexCode(profile?.sex);
  let populationGroup = 'General starting values; age/sex-specific reference not selected';
  if (age !== null && age >= 13 && age <= 15 && sex) populationGroup = sex === 'M' ? 'Boys, 13–15 years' : 'Girls, 13–15 years';
  else if (age !== null && age >= 16 && age <= 18 && sex) populationGroup = sex === 'M' ? 'Boys, 16–18 years' : 'Girls, 16–18 years';
  else if (age !== null && age < 18) populationGroup = 'Adolescent; select a reference category with a trusted adult or qualified professional';
  return { ...NUTRIENT_REFERENCE, populationGroup };
}

export function getDefaultNutrientTargets(profile?: ProfileForTargets): NutrientTargets {
  const targets = { ...DEFAULT_NUTRIENT_TARGETS };
  const age = ageAtDateOfBirth(profile?.dateOfBirth);
  const sex = sexCode(profile?.sex);

  // Adolescent values below follow ICMR-NIN RDA/EAR 2020 summary tables.
  // These are population reference values, not personal prescriptions.
  if (sex && age !== null && age >= 13 && age <= 15) {
    targets.protein = sex === 'M' ? 45 : 43;
    targets.fiber = sex === 'M' ? 43 : 36;
    targets.calcium = 1000;
    targets.iron = sex === 'M' ? 22 : 30;
    targets.zinc = sex === 'M' ? 14.3 : 12.8;
    targets.vitamin_d = 15;
    targets.b12 = 2.2;
    targets.folate = sex === 'M' ? 285 : 245;
    targets.vitamin_c = sex === 'M' ? 70 : 65;
    targets.vitamin_a = sex === 'M' ? 930 : 890;
    targets.iodine = 140;
  } else if (sex && age !== null && age >= 16 && age <= 18) {
    targets.protein = sex === 'M' ? 55 : 46;
    targets.fiber = sex === 'M' ? 50 : 38;
    targets.calcium = 1050;
    targets.iron = sex === 'M' ? 26 : 32;
    targets.zinc = sex === 'M' ? 17.6 : 14.2;
    targets.vitamin_d = 15;
    targets.b12 = 2.2;
    targets.folate = sex === 'M' ? 340 : 330;
    targets.vitamin_c = sex === 'M' ? 85 : 75;
    targets.vitamin_a = sex === 'M' ? 1000 : 900;
    targets.iodine = 140;
  } else if (age !== null && age >= 19) {
    if (sex === 'F') targets.fiber = 25;
    else if (sex === 'M') targets.fiber = 30;
    else targets.fiber = 28;
  }
  return targets;
}
