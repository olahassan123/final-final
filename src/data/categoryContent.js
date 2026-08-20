// The shape the admin content editor writes and the category page reads.
//
// A category page renders with one of two templates:
//   sections — group bars, each holding treatment blocks (the Body Treatments look)
//   promo    — one centred text block (the Aesthetics look)
//
// The defaults still live in serviceCatalog.js. `defaultContentFor` lifts a
// catalog entry into the editable shape so the admin starts from the real page
// content, and `applyCategoryContent` folds a saved override back into the
// shape ServiceCategoryPage already knows how to render.

export const TEMPLATE_SECTIONS = "sections";
export const TEMPLATE_PROMO = "promo";

export const TEMPLATE_OPTIONS = [
  {
    value: TEMPLATE_SECTIONS,
    label: "קבוצות וטיפולים",
    description: "פס כותרת לכל קבוצה, ומתחתיו הטיפולים שלה עם תיאור וכפתור לתיאום תור.",
  },
  {
    value: TEMPLATE_PROMO,
    label: "עמוד טקסט",
    description: "כותרת גדולה ופסקאות טקסט במרכז העמוד, עם כפתור לתיאום תור בסוף.",
  },
];

/** Slugs become DOM ids the chatbot deep-links to, so they must be ASCII —
 *  Hebrew names can't produce them. New items get a stable random slug that
 *  survives every later save. */
function randomSlug(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}`;
}

export function newTreatment() {
  return { slug: randomSlug("trt"), name: "", summary: "", details: [] };
}

export function newSection() {
  return { slug: randomSlug("sec"), title: "", subtitle: "", treatments: [newTreatment()] };
}

/** The editable content a category starts from, taken from the static catalog. */
export function defaultContentFor(category) {
  if (!category) return null;

  const sections = (category.sections || []).map((section) => ({
    slug: section.slug || randomSlug("sec"),
    title: section.title || "",
    subtitle: section.subtitle || "",
    treatments: (section.treatments || []).map((treatment) => ({
      slug: treatment.slug || randomSlug("trt"),
      name: treatment.name || "",
      summary: treatment.summary || "",
      // The first detail line usually repeats the summary; the page filters
      // that duplicate out, so keep the lines as-is and let it do its job.
      details: [...(treatment.details || [])],
    })),
  }));

  // Categories with no sections keep their treatments in a flat list; the
  // editor only knows groups, so those become one unnamed group.
  if (!sections.length && category.treatments?.length) {
    sections.push({
      slug: randomSlug("sec"),
      title: category.name || "",
      subtitle: "",
      treatments: category.treatments.map((treatment) => ({
        slug: treatment.slug || randomSlug("trt"),
        name: treatment.name || "",
        summary: treatment.summary || "",
        details: [...(treatment.details || [])],
      })),
    });
  }

  return {
    template: category.promoHeading ? TEMPLATE_PROMO : TEMPLATE_SECTIONS,
    name: category.name || "",
    description: category.description || "",
    sections,
    promo: {
      heading: category.promoHeading || "",
      subheading: category.promoSubheading || "",
      paragraphs: [...(category.promoParagraphs || [])],
    },
  };
}

/** Folds a saved override onto a catalog category. Only the fields the chosen
 *  template needs are set — the other template's fields are cleared so the
 *  page can't render both. */
export function applyCategoryContent(category, content) {
  if (!category) return category;
  if (!content || !content.template) return category;

  const base = {
    ...category,
    name: content.name || category.name,
    description: content.description ?? category.description,
  };

  if (content.template === TEMPLATE_PROMO) {
    const promo = content.promo || {};
    return {
      ...base,
      sections: [],
      treatments: [],
      promoHeading: promo.heading || "",
      promoSubheading: promo.subheading || "",
      promoParagraphs: promo.paragraphs || [],
    };
  }

  return {
    ...base,
    sections: content.sections || [],
    treatments: [],
    promoHeading: "",
    promoSubheading: "",
    promoParagraphs: [],
  };
}
