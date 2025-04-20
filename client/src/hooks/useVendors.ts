import { useQuery } from "@tanstack/react-query";
import type { Vendor } from "@shared/schema";

interface UseVendorsOptions {
  id?: string;
}

export default function useVendors(options: UseVendorsOptions = {}) {
  // Fetch a specific vendor by ID
  if (options.id) {
    return useQuery<Vendor>({
      queryKey: [`/api/vendors/${options.id}`],
    });
  }
  
  // Fetch all vendors
  return useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
  });
}
