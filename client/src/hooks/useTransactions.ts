import { useQuery } from "@tanstack/react-query";
import type { ChequeTransaction, TransactionWithDetails, BusinessSummary } from "@shared/schema";

interface UseTransactionsOptions {
  id?: number;
  limit?: number;
  offset?: number;
  customerId?: number;
  vendorId?: string;
  status?: string;
  summary?: boolean;
}

export default function useTransactions(options: UseTransactionsOptions = {}) {
  // Fetch a specific transaction by ID
  if (options.id) {
    return useQuery<TransactionWithDetails>({
      queryKey: [`/api/transactions/${options.id}`],
    });
  }
  
  // Fetch business summary
  if (options.summary) {
    return useQuery<BusinessSummary>({
      queryKey: ['/api/summary'],
    });
  }
  
  // Build query string for filtered transaction list
  let queryParams = new URLSearchParams();
  
  if (options.limit) {
    queryParams.append('limit', options.limit.toString());
  }
  
  if (options.offset) {
    queryParams.append('offset', options.offset.toString());
  }
  
  if (options.customerId) {
    queryParams.append('customerId', options.customerId.toString());
  }
  
  if (options.vendorId) {
    queryParams.append('vendorId', options.vendorId);
  }
  
  if (options.status) {
    queryParams.append('status', options.status);
  }
  
  const queryString = queryParams.toString();
  const endpoint = `/api/transactions${queryString ? `?${queryString}` : ''}`;
  
  // Fetch transactions list with optional filters
  return useQuery<TransactionWithDetails[]>({
    queryKey: [endpoint],
  });
}
