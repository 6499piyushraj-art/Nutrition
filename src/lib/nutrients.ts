export type NutrientGroup = 'macro' | 'essential' | 'extended';
export type NutrientConfidence = 'database' | 'estimated' | 'mixed' | 'user-entered' | 'unknown';
export type NutrientStatus = 'complete' | 'partial' | 'unavailable' | 'no_food';

export const NUTRIENT_REFERENCE = {
  name: 'ICMR-NIN Expert Group on Nutrient Requirements for Indians, RDA and EAR 2020',
  year: 2020,
  sourceUrl: 'https://nin.res.in/rdabook/brief_note.pdf',
};

export const NUTRIENT_SPECS = [
  { key: 'calories', label: 'Energy', unit: 'kcal', group: 'macro', defaultTarget: null },
  { key: 'protein', label: 'Protein', unit: 'g', group: 'macro', defaultTarget: null, targetHint: 'When available, the reference is the ICMR-NIN Estimated Average Requirement (EAR), not a weight or body-size goal.' },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g', group: 'macro', defaultTarget: null },
  { key: 'fat', label: 'Total fat', unit: 'g', group: 'macro', defaultTarget: null },
  { key: 'fiber', label: 'Dietary fibre', unit: 'g', group: 'macro', defaultTarget: null, targetHint: 'No age-specific reference is set here. Leave blank unless you have a suitable reference.' },
  { key: 'omega3', label: 'Omega-3', unit: 'g', group: 'macro', defaultTarget: null },
  { key: 'omega6', label: 'Omega-6', unit: 'g', group: 'macro', defaultTarget: null },
  { key: 'calcium', label: 'Calcium', unit: 'mg', group: 'essential', defaultTarget: null },
  { key: 'iron', label: 'Iron', unit: 'mg', group: 'essential', defaultTarget: null },
  { key: 'zinc', label: 'Zinc', unit: 'mg', group: 'essential', defaultTarget: null },
  { key: 'vitamin_d', label: 'Vitamin D', unit: 'µg', group: 'essential', defaultTarget: null, targetHint: 'Values are stored in µg; 10 µg equals 400 IU.' },
  { key: 'b12', label: 'Vitamin B12', unit: 'µg', group: 'essential', defaultTarget: null },
  { key: 'folate', label: 'Folate (B9)', unit: 'µg', group: 'essential', defaultTarget: null, targetHint: 'FoodData Central may report dietary folate equivalents (DFE).' },
  { key: 'vitamin_c', label: 'Vitamin C', unit: 'mg', group: 'essential', defaultTarget: null },
  { key: 'vitamin_a', label: 'Vitamin A', unit: 'µg', group: 'essential', defaultTarget: null, targetHint: 'FoodData Central may report retinol activity equivalents (RAE).' },
  { key: 'iodine', label: 'Iodine', unit: 'µg', group: 'essential', defaultTarget: null },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'potassium', label: 'Potassium', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'sodium', label: 'Sodium', unit: 'mg', group: 'extended', defaultTarget: null, isLimit: true, targetHint: 'A reference limit is not set automatically for minors.' },
  { key: 'chloride', label: 'Chloride', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'copper', label: 'Copper', unit: 'µg', group: 'extended', defaultTarget: null },
  { key: 'manganese', label: 'Manganese', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'selenium', label: 'Selenium', unit: 'µg', group: 'extended', defaultTarget: null },
  { key: 'fluoride', label: 'Fluoride', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'chromium', label: 'Chromium', unit: 'µg', group: 'extended', defaultTarget: null },
  { key: 'molybdenum', label: 'Molybdenum', unit: 'µg', group: 'extended', defaultTarget: null },
  { key: 'vitamin_e', label: 'Vitamin E', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'vitamin_k', label: 'Vitamin K', unit: 'µg', group: 'extended', defaultTarget: null },
  { key: 'b1', label: 'Vitamin B1 (thiamine)', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'b2', label: 'Vitamin B2 (riboflavin)', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'b3', label: 'Vitamin B3 (niacin)', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'b5', label: 'Vitamin B5 (pantothenic acid)', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'b6', label: 'Vitamin B6', unit: 'mg', group: 'extended', defaultTarget: null },
  { key: 'biotin', label: 'Biotin (B7)', unit: 'µg', group: 'extended', defaultTarget: null },
] as const;

export type NutrientKey = (typeof NUTRIENT_SPECS)[number]['key'];
export type NutrientTargets = Record<NutrientKey, number | null>;
export const DEFAULT_NUTRIENT_TARGETS: NutrientTargets = Object.fromEntries(
  NUTRIENT_SPECS.map((item) => [item.key, item.defaultTarget]),
) as NutrientTargets;

function ageAtDateOfBirth(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateOfBirth)) return null;
  const birth = new Date(dateOfBirth + 'T00:00:00.000Z');
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== dateOfBirth) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
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
  let populationGroup = 'Age/sex-specific reference not selected';
  let targetBasis = 'Targets remain unset unless a suitable source or personal reference is selected.';
  if (age !== null && age >= 13 && age <= 15 && sex) {
    populationGroup = sex === 'M' ? 'Boys, 13–15 years' : 'Girls, 13–15 years';
    targetBasis = 'ICMR-NIN 2020 protein EAR only; micronutrient reference values in the brief note are adult values, so they are not copied to adolescents.';
  } else if (age !== null && age >= 16 && age <= 18 && sex) {
    populationGroup = sex === 'M' ? 'Boys, 16–18 years' : 'Girls, 16–18 years';
    targetBasis = 'ICMR-NIN 2020 protein EAR only; micronutrient reference values in the brief note are adult values, so they are not copied to adolescents.';
  } else if (age !== null && age < 18) {
    populationGroup = 'Adolescent; age/sex-specific reference is incomplete';
    targetBasis = 'Targets remain unset where an age-appropriate source value is not available.';
  } else if (age !== null && age >= 19 && sex) {
    populationGroup = sex === 'M' ? 'Adult men' : 'Adult women';
    targetBasis = 'Adult EAR values from ICMR-NIN 2020 are shown where the brief note publishes them. These are population references, not diagnoses or prescriptions.';
  }
  return { ...NUTRIENT_REFERENCE, populationGroup, targetBasis };
}

export function getDefaultNutrientTargets(profile?: ProfileForTargets): NutrientTargets {
  const targets = { ...DEFAULT_NUTRIENT_TARGETS };
  const age = ageAtDateOfBirth(profile?.dateOfBirth);
  const sex = sexCode(profile?.sex);

  // The ICMR-NIN 2020 brief note recommends EAR for individual diet planning.
  // For adolescents, its age-banded protein EAR values are the only age-specific
  // nutrient target applied here. Other adolescent micronutrient targets stay unset.
  if (sex && age !== null && age >= 13 && age <= 15) {
    targets.protein = sex === 'M' ? 36.4 : 34.7;
  } else if (sex && age !== null && age >= 16 && age <= 18) {
    targets.protein = sex === 'M' ? 45.1 : 37.3;
  } else if (age !== null && age >= 19 && sex) {
    const male = sex === 'M';
    targets.protein = male ? 42.9 : 36.3;
    targets.calcium = 800;
    targets.magnesium = male ? 370 : 310;
    targets.iron = male ? 11 : 15;
    targets.zinc = male ? 14 : 11;
    targets.iodine = 95;
    targets.b1 = male ? 1.5 : 1.4;
    targets.b2 = male ? 2.1 : 2.0;
    targets.b3 = male ? 15 : 12;
    targets.b6 = male ? 2.1 : 1.6;
    targets.folate = male ? 250 : 180;
    targets.b12 = 2;
    targets.vitamin_c = male ? 65 : 55;
    targets.vitamin_a = male ? 460 : 390;
    targets.vitamin_d = 10;
    targets.sodium = 2000;
    // The adult fatty-acid values below are reported in ICMR-NIN 2020
    // for the essential omega-3 and omega-6 fatty acids.
    targets.omega3 = 2.2;
    targets.omega6 = 6.6;
  }
  return targets;
}
