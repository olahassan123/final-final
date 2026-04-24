import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowLeft } from "lucide-react";
import { serviceCatalog } from "../data/serviceCatalog";

export default function CategorySelectionPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-secondary px-6 py-12" dir="rtl">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-light px-4 py-1.5 text-sm font-bold text-primary">
            <Sparkles size={16} />
            <span>MeDay Beauty Center</span>
          </div>

          <h1 className="text-4xl font-serif font-bold text-gray-900">סוגי טיפולים</h1>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {serviceCatalog.map((category) => (
            <button
              key={category.slug}
              onClick={() => navigate(`/categories/${category.slug}`)}
              className="group flex items-center justify-between rounded-2xl border border-accent-light bg-white p-6 text-right transition-all hover:border-primary hover:shadow-lg"
            >
              <span className="text-xl font-bold text-gray-900 transition-colors group-hover:text-primary">
                {category.name}
              </span>

              <ArrowLeft className="h-5 w-5 text-primary transition-transform group-hover:-translate-x-1" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
