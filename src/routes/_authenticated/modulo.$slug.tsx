import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { usePeriod, useSelectedStoreId } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import { ModuleSection } from "@/components/ModuleIndicatorsTable";
import { StatusFilter, type StatusFilterValue } from "@/components/StatusFilter";

export const Route = createFileRoute("/_authenticated/modulo/$slug")({
  component: ModulePage,
});

function ModulePage() {
  const { slug } = Route.useParams();
  const period = usePeriod();
  const storeId = useSelectedStoreId();
  const [status, setStatus] = useState<StatusFilterValue>("all");

  if (!storeId) return <div className="text-slate-500">Selecione uma loja.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
        </Link>
        <StatusFilter value={status} onChange={setStatus} />
      </div>
      <ModuleSection
        storeId={storeId}
        moduleSlug={slug}
        year={period.year}
        month={period.month}
        statusFilter={status}
      />
    </div>
  );
}

