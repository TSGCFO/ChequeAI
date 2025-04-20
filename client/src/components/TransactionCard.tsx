import { Edit, File, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { TransactionWithDetails } from "@shared/schema";
import { format } from "date-fns";

interface TransactionCardProps {
  transaction: TransactionWithDetails;
}

export default function TransactionCard({ transaction }: TransactionCardProps) {
  // Function to get the appropriate status badge
  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge className="bg-gray-100 text-gray-600">Unknown</Badge>;
    
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-600">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-600">Pending</Badge>;
      case "bounced":
        return <Badge className="bg-red-100 text-red-500">Bounced</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600">{status}</Badge>;
    }
  };

  // Format the date
  const formattedDate = transaction.date 
    ? format(new Date(transaction.date), "MMM d, yyyy") 
    : "Unknown Date";

  return (
    <div className="bg-white p-4 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-primary">
            <File className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center">
              <p className="font-medium">{transaction.customer?.customer_name || "Unknown Customer"}</p>
              <span className="ml-2">{getStatusBadge(transaction.status)}</span>
            </div>
            <p className="text-sm text-gray-500">Cheque #{transaction.cheque_number}</p>
            <div className="mt-1 flex flex-wrap items-center text-xs text-gray-500">
              <span className="mr-2 flex items-center">
                <Calendar className="mr-1 h-3 w-3" />
                {formattedDate}
              </span>
              <span className="flex items-center">
                <User className="mr-1 h-3 w-3" />
                Vendor: {transaction.vendor?.vendor_name || "Unknown Vendor"}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">${parseFloat(transaction.cheque_amount?.toString() || "0").toFixed(2)}</p>
          <p className={`text-xs ${transaction.status === "bounced" ? "text-red-500" : "text-green-600"}`}>
            {transaction.status === "bounced" 
              ? `Fee Reversal: -$${parseFloat(transaction.customer_fee?.toString() || "0").toFixed(2)}`
              : `Profit: $${parseFloat(transaction.profit?.toString() || "0").toFixed(2)}`
            }
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <div>
          <p className="text-gray-500">
            Fee: <span>${parseFloat(transaction.customer_fee?.toString() || "0").toFixed(2)}</span> 
            {transaction.customer_fee && transaction.cheque_amount ? 
              ` (${(parseFloat(transaction.customer_fee.toString()) / parseFloat(transaction.cheque_amount.toString()) * 100).toFixed(1)}%)`
              : ""
            }
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="ghost" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <File className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem>Print</DropdownMenuItem>
              <DropdownMenuItem className="text-red-500">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// Import these components at the top of the file for the icons in the transaction card
function Calendar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function User(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
