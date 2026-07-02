import { createFileRoute } from "@tanstack/react-router";
import { ClassificationRanking } from "@/components/ClassificationRanking";

export const Route = createFileRoute("/_authenticated/resumo")({
  head: () => ({
    meta: [
      { title: "Resumo — Kuruma Indicadores" },
      { name: "description", content: "Ranking macro de classificação das lojas: mês, acumulado e projetado." },
    ],
  }),
  component: ResumoPage,
});

function ResumoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resumo</h1>
        <p className="text-slate-500">
          Classificação macro das lojas no mês selecionado, no acumulado do ano e projetado.
        </p>
      </div>
      <ClassificationRanking />
    </div>
  );
}
