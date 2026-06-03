import { getCategoryTreatments, serviceCatalog } from "../data/serviceCatalog";

export const CLIENT_GENDER_OPTIONS = [
  "נקבה",
  "זכר",
  "אחר / מעדיף לא לציין",
];

const FALLBACK_TREATMENTS = [
  { value: "fallback-facial", label: "טיפול פנים" },
  { value: "fallback-manicure", label: "מניקור / פדיקור" },
  { value: "fallback-body", label: "טיפול גוף" },
  { value: "fallback-makeup", label: "איפור מקצועי" },
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
