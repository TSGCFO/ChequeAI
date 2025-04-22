import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type InsertCustomerDeposit } from "@shared/schema";

export default function useDeposits() {
  const { toast } = useToast();
  
  const createDeposit = useMutation({
    mutationFn: async (data: InsertCustomerDeposit) => {
      const response = await apiRequest("POST", "/api/deposits", data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      
      toast({
        title: "Success",
        description: "Customer deposit added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add deposit",
        variant: "destructive",
      });
    },
  });

  return { createDeposit };
}