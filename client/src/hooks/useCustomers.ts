import { useQuery } from "@tanstack/react-query";
import type { Customer } from "@shared/schema";

interface UseCustomersOptions {
  id?: number;
}

export default function useCustomers(options: UseCustomersOptions = {}) {
  // Fetch a specific customer by ID
  if (options.id) {
    return useQuery<Customer>({
      queryKey: [`/api/customers/${options.id}`],
    });
  }
  
  // Fetch all customers
  return useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });
}
