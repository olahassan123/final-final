import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { getTreatmentBySlugs } from "../data/serviceCatalog";

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;

  return (
    <div className="flex items-start gap-3 border-b border-accent-light/30 py-4 last:border-b-0">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="space-y-1">
        <p className="text-sm font-bold text-gray-900">{label}</p>
        <p className="text-sm leading-7 text-gray-600">{value}</p>
      </div>
    </div>
  );
}

function VariantCard({ variant, treatmentName }) {
  return (
    <article className="rounded-[2rem] border border-accent-light bg-white p-7 shadow-sm">
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          {/* Variant Image */}
          {variant.image && (
            <div className="flex-shrink-0">
              <img
                src={variant.image}
                alt={variant.name}
                className="w-16 h-16 object-cover rounded-lg shadow-sm"
              />
            </div>
          )}

          <div className="flex-1">
            <h3 className="text-2xl font-bold text-[#4f8d98]">{variant.name}</h3>
            {variant.description ? (
              <p className="mt-4 text-base leading-8 text-gray-700">{variant.description}</p>
            ) : null}
          </div>
        </div>

        {variant.details?.length ? (
          <div className="space-y-2 text-gray-700">
            {variant.details.map((line, index) => (
              <p key={`${treatmentName}-${variant.name}-${index}`} className="leading-8">
                {line}
              </p>
            ))}
          </div>
        ) : null}

        <div className="rounded-3xl bg-accent-light/50 p-5">
          <div className="space-y-3">
            {variant.idealFor ? (
              <div>
                <p className="text-sm font-bold text-gray-900">למי זה מתאים</p>
                <p className="mt-1 text-sm leading-7 text-gray-600">{variant.idealFor}</p>
              </div>
            ) : null}

            {variant.results ? (
              <div>
                <p className="text-sm font-bold text-gray-900">תוצאות</p>
                <p className="mt-1 text-sm leading-7 text-gray-600">{variant.results}</p>
              </div>
            ) : null}

            {variant.aftercare ? (
              <div>
                <p className="text-sm font-bold text-gray-900">הנחיות לאחר טיפול</p>
                <p className="mt-1 text-sm leading-7 text-gray-600">{variant.aftercare}</p>
              </div>
            ) : null}

            {variant.frequency ? (
              <div>
                <p className="text-sm font-bold text-gray-900">תדירות / מסלול</p>
                <p className="mt-1 text-sm leading-7 text-gray-600">{variant.frequency}</p>
              </div>
            ) : null}

            {variant.consultation ? (
              <div>
                <p className="text-sm font-bold text-gray-900">הערה חשובה</p>
                <p className="mt-1 text-sm leading-7 text-gray-600">{variant.consultation}</p>
              </div>
            ) : null}
          </div>
        </div>

        <button className="rounded-xl border border-[#4f8d98] px-7 py-3 text-lg font-bold text-gray-900 transition hover:bg-[#4f8d98] hover:text-white">
          לתיאום תור
        </button>
      </div>
    </article>
  );
}

export default function ServiceTreatmentDetailsPage() {
  const { categorySlug, treatmentSlug } = useParams();
  const { category, treatment } = getTreatmentBySlugs(categorySlug, treatmentSlug);

  useEffect(() => {
    if (!treatment) return;

    window.dispatchEvent(
      new CustomEvent("treatmentSelected", {
        detail: { id: `${categorySlug}:${treatment.slug}`, name: treatment.name },
      })
    );
  }, [categorySlug, treatment?.name, treatment?.slug]);

  if (!category || !treatment) {
    return (
      <div className="min-h-screen bg-secondary px-6 py-16" dir="rtl">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-100 bg-white p-10 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">דף הטיפול לא נמצא</h1>
          <p className="mt-4 text-gray-500">אפשר לחזור לקטגוריה ולבחור טיפול אחר.</p>
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

  const openChatAboutTreatment = () => {
    window.dispatchEvent(
      new CustomEvent("openChatWithQuestion", {
        detail: `אני רוצה לשאול על טיפול ${treatment.name}`,
      })
    );
  };

  return (
    <div className="min-h-screen bg-secondary px-6 py-12" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <Link
          to={`/categories/${category.slug}`}
          className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-gray-500 transition-colors hover:text-primary"
        >
          <ArrowRight size={18} />
          חזרה ל-{category.name}
        </Link>

        <div className="rounded-[2.5rem] border border-accent-light bg-white px-8 py-10 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent-light px-4 py-1.5 text-sm font-bold text-primary">
            <Sparkles size={16} />
            <span>{category.name}</span>
          </div>

          <h1 className="mt-6 text-4xl font-serif font-bold text-gray-900 md:text-5xl">
            {treatment.name}
          </h1>

          <p className="mt-6 max-w-4xl text-base leading-8 text-gray-600">
            {treatment.description || treatment.summary}
          </p>

          {/* Treatment Image */}
          {treatment.image && (
            <div className="mt-8 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/20 rounded-2xl"></div>
              <img
                src={treatment.image}
                alt={treatment.name}
                className="relative w-full max-w-2xl mx-auto rounded-2xl shadow-lg object-cover border-4 border-white"
                style={{ maxHeight: '400px' }}
              />
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-xl p-4">
                <p className="text-sm font-medium text-primary text-center">
                  טיפול מקצועי במרכז היופי MeDay
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[1.8fr_0.95fr]">
          <div className="space-y-8">
            <section className="rounded-[2rem] border border-accent-light bg-white p-8 shadow-sm">
              <h2 className="mb-5 text-2xl font-bold text-gray-900">על הטיפול</h2>

              <div className="space-y-3 text-gray-700">
                {(treatment.details || []).map((line, index) => (
                  <p key={`${treatment.slug}-line-${index}`} className="leading-8">
                    {line}
                  </p>
                ))}
              </div>

              <div className="mt-8">
                <InfoRow icon={Stethoscope} label="למי זה מתאים" value={treatment.idealFor} />
                <InfoRow icon={Sparkles} label="תוצאות" value={treatment.results} />
                <InfoRow icon={ShieldCheck} label="הנחיות לאחר טיפול" value={treatment.aftercare} />
                <InfoRow icon={Clock} label="תדירות מומלצת" value={treatment.frequency} />
              </div>
            </section>

            {treatment.variants?.length ? (
              <section className="rounded-[2rem] border border-accent-light bg-white/90 p-8 shadow-sm">
                <h2 className="text-3xl font-bold text-gray-900">הסוגים בתוך הטיפול</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
                  כל האפשרויות של {treatment.name} מרוכזות כאן בתוך אותו עמוד, לפי המבנה שביקשת.
                </p>

                <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {treatment.variants.map((variant) => (
                    <VariantCard
                      key={`${treatment.slug}-${variant.name}`}
                      variant={variant}
                      treatmentName={treatment.name}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] bg-primary-dark p-8 text-white shadow-xl">
              <h3 className="text-2xl font-bold">MeDay Tip</h3>
              <p className="mt-4 text-sm leading-7 text-gray-300">
                {treatment.consultation || "נוכל להוסיף כאן המלצת ייעוץ או הערה חשובה לגבי הטיפול."}
              </p>

              <div className="mt-6 space-y-3">
                <button className="w-full rounded-full bg-primary py-3 font-bold text-white transition hover:bg-white hover:text-primary">
                  תיאום תור
                </button>

                <button
                  onClick={openChatAboutTreatment}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  <MessageCircle size={18} />
                  שאלי את הבוט על הטיפול
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-accent-light bg-white p-8 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900">שאלות נפוצות</h3>

              {treatment.faq?.length ? (
                <div className="mt-5 space-y-4">
                  {treatment.faq.map((item) => (
                    <div key={item.question} className="rounded-2xl bg-accent-light/40 p-4">
                      <p className="font-bold text-gray-900">{item.question}</p>
                      <p className="mt-2 text-sm leading-7 text-gray-600">{item.answer}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-gray-500">
                  עדיין אין שאלות נפוצות לטיפול הזה. אפשר להוסיף אותן כשנמלא את התוכן.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
