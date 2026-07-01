import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DeliveryStatus } from "@/lib/scoring";

export type StatusFilterValue = "all" | DeliveryStatus;

export function StatusFilter({
  value,
  onChange,
}: {
  value: StatusFilterValue;
  onChange: (v: StatusFilterValue) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StatusFilterValue)}>
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os status</SelectItem>
        <SelectItem value="entregue">
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Entregue
          </span>
        </SelectItem>
        <SelectItem value="parcial">
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" /> Parcialmente Entregue
          </span>
        </SelectItem>
        <SelectItem value="nao-entregue">
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Não Entregue
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
