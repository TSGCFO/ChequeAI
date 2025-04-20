import { ArrowDown, ArrowUp, DollarSign, FileText, AlertTriangle } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string;
  icon: "transactions" | "profit" | "balance";
  trend?: {
    value: number;
    label: string;
    negative?: boolean;
  };
}

export default function SummaryCard({ title, value, icon, trend }: SummaryCardProps) {
  const renderIcon = () => {
    switch (icon) {
      case "transactions":
        return (
          <div className="rounded-full bg-blue-100 p-2 text-primary">
            <FileText className="h-5 w-5" />
          </div>
        );
      case "profit":
        return (
          <div className="rounded-full bg-green-100 p-2 text-green-600">
            <DollarSign className="h-5 w-5" />
          </div>
        );
      case "balance":
        return (
          <div className="rounded-full bg-yellow-100 p-2 text-yellow-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        {renderIcon()}
      </div>
      {trend && (
        <div className="mt-2 flex items-center text-xs">
          <span
            className={trend.negative ? "text-red-500" : "text-green-600"}
          >
            {trend.negative ? (
              <ArrowDown className="mr-1 inline h-3 w-3" />
            ) : (
              <ArrowUp className="mr-1 inline h-3 w-3" />
            )}
            {Math.abs(trend.value)}%
          </span>
          <span className="ml-1 text-gray-500">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
