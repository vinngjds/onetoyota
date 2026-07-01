import { createFileRoute, Link } from "@tanstack/react-router";
import { usePeriod, useSelectedStoreId } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import { ModuleSection } from "@/components/ModuleIndicatorsTable";

export const Route = createFileRoute("/_authenticated/modulo/$slug")({
  component: ModulePage,
});

function ModulePage() {
  const { slug } = Route.useParams();
  const period = usePeriod();
  const storeId = useSelectedStoreId();

  if (!storeId) return <div className="text-slate-500">Selecione uma loja.</div>;

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
      </Link>
      <ModuleSection storeId={storeId} moduleSlug={slug} year={period.year} month={period.month} />
    </div>
  );
}
