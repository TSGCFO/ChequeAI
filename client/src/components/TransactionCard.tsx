import { useState } from "react";
import { Edit, File, MoreVertical, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { TransactionWithDetails } from "@shared/schema";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

// Extend the TransactionWithDetails type to include status
interface EnhancedTransaction extends TransactionWithDetails {
  status?: string;
}

interface TransactionCardProps {
  transaction: EnhancedTransaction;
}

export default function TransactionCard({ transaction }: TransactionCardProps) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Format the date
  const formattedDate = transaction.date 
    ? format(new Date(transaction.date), "MMM d, yyyy") 
    : "Unknown Date";

  const handleEdit = () => {
    // Navigate to edit page or show edit modal
    navigate(`/edit-transaction/${transaction.transaction_id}`);
  };

  const handleViewDetails = () => {
    setShowDetailsModal(true);
  };

  const handlePrint = () => {
    // Open a printable view in a new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Transaction ${transaction.cheque_number}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .details { margin-bottom: 20px; }
              .details div { margin-bottom: 5px; }
              .amount { font-size: 24px; font-weight: bold; }
              .footer { margin-top: 50px; border-top: 1px solid #ccc; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Transaction Receipt</h1>
              <p>Cheque #${transaction.cheque_number}</p>
            </div>
            <div class="details">
              <div><strong>Date:</strong> ${formattedDate}</div>
              <div><strong>Customer:</strong> ${transaction.customer?.customer_name || `Customer #${transaction.customer_id}`}</div>
              <div><strong>Vendor:</strong> ${transaction.vendor?.vendor_name || transaction.vendor_id}</div>
              <div><strong>Status:</strong> ${transaction.status || 'Pending'}</div>
              <div class="amount">Amount: $${parseFloat(transaction.cheque_amount?.toString() || "0").toFixed(2)}</div>
              <div><strong>Fee:</strong> $${parseFloat(transaction.customer_fee?.toString() || "0").toFixed(2)}</div>
              <div><strong>Profit:</strong> $${parseFloat(transaction.profit?.toString() || "0").toFixed(2)}</div>
            </div>
            <div class="footer">
              <p>Transaction ID: ${transaction.transaction_id}</p>
              <p>Printed on: ${new Date().toLocaleString()}</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not open print view. Please check your popup settings.",
      });
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await apiRequest("DELETE", `/api/transactions/${transaction.transaction_id}`);
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      
      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      });
      
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete transaction",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white p-4 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-primary">
            <File className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center">
              <p className="font-medium">{transaction.customer?.customer_name || `Customer #${transaction.customer_id}`}</p>
              {transaction.status && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                  transaction.status === 'bounced' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">Cheque #{transaction.cheque_number}</p>
            <div className="mt-1 flex flex-wrap items-center text-xs text-gray-500">
              <span className="mr-2 flex items-center">
                <Calendar className="mr-1 h-3 w-3" />
                {formattedDate}
              </span>
              <span className="flex items-center">
                <User className="mr-1 h-3 w-3" />
                Vendor: {transaction.vendor?.vendor_name || transaction.vendor_id}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">${parseFloat(transaction.cheque_amount?.toString() || "0").toFixed(2)}</p>
          <p className="text-xs text-green-600">
            Profit: ${parseFloat(transaction.profit?.toString() || "0").toFixed(2)}
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
          <Button variant="ghost" size="icon" onClick={handleEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleViewDetails}>
            <File className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleViewDetails}>View Details</DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>Print</DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowDeleteConfirm(true)} 
                className="text-red-500"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Transaction Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Cheque Number</p>
                <p className="font-medium">{transaction.cheque_number}</p>
              </div>
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium">{formattedDate}</p>
              </div>
              <div>
                <p className="text-gray-500">Customer</p>
                <p className="font-medium">{transaction.customer?.customer_name || `Customer #${transaction.customer_id}`}</p>
              </div>
              <div>
                <p className="text-gray-500">Vendor</p>
                <p className="font-medium">{transaction.vendor?.vendor_name || transaction.vendor_id}</p>
              </div>
              <div>
                <p className="text-gray-500">Amount</p>
                <p className="font-medium">${parseFloat(transaction.cheque_amount?.toString() || "0").toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <p className="font-medium">{transaction.status || 'Pending'}</p>
              </div>
              <div>
                <p className="text-gray-500">Customer Fee</p>
                <p className="font-medium">${parseFloat(transaction.customer_fee?.toString() || "0").toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Profit</p>
                <p className="font-medium text-green-600">${parseFloat(transaction.profit?.toString() || "0").toFixed(2)}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
            <Button onClick={handleEdit}>
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Are you sure you want to delete this transaction?</p>
            <p className="font-medium">Cheque #{transaction.cheque_number} - ${parseFloat(transaction.cheque_amount?.toString() || "0").toFixed(2)}</p>
            <p className="text-gray-500 text-sm">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
