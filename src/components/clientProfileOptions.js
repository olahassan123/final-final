import { getCategoryTreatments, serviceCatalog } from "../data/serviceCatalog";

export const CLIENT_GENDER_OPTIONS = [
  "נקבה",
  "זכר",
  "אחר / מעדיף/ה לא לציין",
];

const FALLBACK_TREATMENTS = [
  { value: "fallback-facial", label: "טיפול פנים", categoryName: "קוסמטיקה" },
  { value: "fallback-manicure", label: "מניקור / פדיקור", categoryName: "ציפורניים" },
  { value: "fallback-body", label: "טיפול גוף", categoryName: "גוף" },
  { value: "fallback-makeup", label: "איפור מקצועי", categoryName: "איפור" },
];

export function getClientTreatmentOptions() {
  const options = serviceCatalog.flatMap((category) =>
    getCategoryTreatments(category).map((treatment) => ({
      value: `${category.slug}:${treatment.slug}`,
      label: `${category.name} - ${treatment.name}`,
      categoryName: category.name,
      treatmentName: treatment.name,
    }))
  );

  return options.length ? options : FALLBACK_TREATMENTS;
}

export function labelsForTreatments(values = []) {
  const optionsByValue = new Map(
    getClientTreatmentOptions().map((option) => [option.value, option.label])
  );

  return values.map((value) => optionsByValue.get(value) || value);
}

export function categoriesForTreatments(values = []) {
  const optionsByValue = new Map(
    getClientTreatmentOptions().map((option) => [option.value, option])
  );
  const categories = values
    .map((value) => optionsByValue.get(value)?.categoryName)
    .filter(Boolean);
  return [...new Set(categories)];
}
