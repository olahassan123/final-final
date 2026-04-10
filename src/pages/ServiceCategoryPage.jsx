import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, ArrowLeft, LayoutGrid, Sparkles } from "lucide-react";
import { getCategoryBySlug, getCategoryTreatments } from "../data/serviceCatalog";

function TreatmentLinkCard({ categorySlug, treatment, sectionTitle = null }) {
  return (
    <Link
      to={`/categories/${categorySlug}/${treatment.slug}`}
      className="group rounded-3xl border border-pink-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3 text-right">
          {sectionTitle ? (
            <span className="inline-flex rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-primary">
              {sectionTitle}
            </span>
          ) : null}

          <h3 className="text-2xl font-bold text-gray-900 transition-colors group-hover:text-primary">
            {treatment.name}
          </h3>

          <p className="text-sm leading-7 text-gray-600">
            {treatment.summary || "עמוד הטיפול מוכן למילוי פרטים נוספים."}
          </p>
        </div>

        <span className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-primary transition-all group-hover:bg-primary group-hover:text-white">
          <ArrowLeft size={20} />
        </span>
      </div>
    </Link>
  );
}

export default function ServiceCategoryPage() {
  const { categorySlug } = useParams();
  const category = getCategoryBySlug(categorySlug);

  if (!category) {
    return (
      <div className="min-h-screen bg-[#fffafa] px-6 py-16" dir="rtl">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-100 bg-white p-10 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">הקטגוריה לא נמצאה</h1>
          <p className="mt-4 text-gray-500">אפשר לחזור למסך הקטגוריות ולבחור טיפול אחר.</p>
          <Link
            to="/categories"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary/90"
          >
            <ArrowRight size={18} />
            חזרה לקטגוריות
          </Link>
        </div>
      </div>
    );
  }

  const treatments = getCategoryTreatments(category);
  const hasSectionLayout = Boolean(category.sections?.length);
  const shouldOpenSingleTreatment = !hasSectionLayout && treatments.length === 1;

  if (shouldOpenSingleTreatment) {
    return <Navigate to={`/categories/${category.slug}/${treatments[0].slug}`} replace />;
  }

  return (
    <div className="min-h-screen bg-[#fffafa] px-6 py-12" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/categories"
          className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-gray-500 transition-colors hover:text-primary"
        >
          <ArrowRight size={18} />
          חזרה לסוגי טיפולים
        </Link>

        <div className="rounded-[2rem] border border-pink-100 bg-white px-8 py-10 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-pink-100 px-4 py-1.5 text-sm font-bold text-primary">
                <Sparkles size={16} />
                <span>MeDay Beauty Center</span>
              </div>

              <div>
                <h1 className="text-4xl font-serif font-bold text-gray-900 md:text-5xl">
                  {category.name}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-gray-600">
                  {category.description}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-3 rounded-2xl bg-pink-50 px-5 py-4 text-primary">
              <LayoutGrid size={22} />
              <div className="text-right">
                <p className="text-2xl font-bold">{treatments.length}</p>
                <p className="text-xs font-semibold text-primary/80">עמודי טיפולים זמינים</p>
              </div>
            </div>
          </div>
        </div>

        {hasSectionLayout ? (
          <div className="mt-10 space-y-8">
            {category.sections.map((section) => (
              <section
                key={section.slug}
                className="rounded-[2rem] border border-pink-100 bg-white/90 p-8 shadow-sm"
              >
                <div className="mb-6">
                  <h2 className="text-3xl font-bold text-gray-900">{section.title}</h2>
                  {section.subtitle ? (
                    <p className="mt-2 text-sm font-medium text-primary">{section.subtitle}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {section.treatments.map((treatment) => (
                    <TreatmentLinkCard
                      key={treatment.slug}
                      categorySlug={category.slug}
                      treatment={treatment}
                      sectionTitle={section.title}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : treatments.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {treatments.map((treatment) => (
              <TreatmentLinkCard
                key={treatment.slug}
                categorySlug={category.slug}
                treatment={treatment}
              />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-[2rem] border border-dashed border-pink-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">הקטגוריה מוכנה למילוי</h2>
            <p className="mt-4 text-gray-600">
              ברגע שתשלחי את רשימת הטיפולים בקטגוריה הזאת, נוסיף לכל אחד מהם כרטיס או עמוד מרכזי עם חלוקה פנימית לפי הצורך.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
