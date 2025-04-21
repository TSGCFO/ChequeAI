import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import useCustomers from "@/hooks/useCustomers";
import useVendors from "@/hooks/useVendors";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ChequeTransaction } from "@shared/schema";
import { Loader2 } from "lucide-react";

const transactionSchema = z.object({
  date: z.string(),
  customer_id: z.string().min(1, "Customer is required"),
  cheque_number: z.string().min(1, "Cheque number is required"),
  cheque_amount: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  ),
  vendor_id: z.string().min(1, "Vendor is required"),
  status: z.string().default("pending"),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export default function EditTransaction() {
  const [match, params] = useRoute<{ id: string }>("/edit-transaction/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [transaction, setTransaction] = useState<ChequeTransaction | null>(null);
  const [previewCalculations, setPreviewCalculations] = useState({
    customerFee: 0,
    netPayableToCustomer: 0,
    vendorFee: 0,
    amountFromVendor: 0,
    estimatedProfit: 0,
  });
  
  const { data: customers, isLoading: isLoadingCustomers } = useCustomers();
  const { data: vendors, isLoading: isLoadingVendors } = useVendors();

  const defaultValues: TransactionFormValues = {
    date: format(new Date(), "yyyy-MM-dd"),
    customer_id: "",
    cheque_number: "",
    cheque_amount: "",
    vendor_id: "",
    status: "pending",
  };

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues,
  });

  // Fetch transaction data when component mounts
  useEffect(() => {
    if (!match || !params) {
      navigate("/");
      return;
    }

    const id = params.id;
    if (!id) {
      navigate("/");
      return;
    }

    const fetchTransaction = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/transactions/${id}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch transaction");
        }
        
        const transactionData = await response.json();
        setTransaction(transactionData);
        
        // Format date for the form
        const formattedDate = transactionData.date 
          ? format(new Date(transactionData.date), "yyyy-MM-dd") 
          : format(new Date(), "yyyy-MM-dd");
        
        // Set form values
        form.reset({
          date: formattedDate,
          customer_id: transactionData.customer_id.toString(),
          cheque_number: transactionData.cheque_number,
          cheque_amount: transactionData.cheque_amount?.toString() || "",
          vendor_id: transactionData.vendor_id,
          status: transactionData.status || "pending",
        });
      } catch (error) {
        console.error("Error fetching transaction:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load transaction data",
        });
        navigate("/");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransaction();
  }, [match, params, navigate, toast, form]);

  // Setup a subscription to watch form changes
  useEffect(() => {
    // Subscribe to form changes
    const subscription = form.watch((value, { name }) => {
      // Only recalculate if relevant fields change
      if (['customer_id', 'vendor_id', 'cheque_amount'].includes(name || '')) {
        const formValues = form.getValues();
        const customerId = parseInt(formValues.customer_id || '0');
        const vendorId = formValues.vendor_id;
        const chequeAmount = parseFloat(formValues.cheque_amount || '0');
        
        if (!customerId || !vendorId || isNaN(chequeAmount) || chequeAmount <= 0) {
          setPreviewCalculations({
            customerFee: 0,
            netPayableToCustomer: 0,
            vendorFee: 0,
            amountFromVendor: 0,
            estimatedProfit: 0,
          });
          return;
        }
        
        // Find the customer and vendor
        const customer = Array.isArray(customers) 
          ? customers.find(c => c.customer_id === customerId) 
          : null;
        const vendor = Array.isArray(vendors)
          ? vendors.find(v => v.vendor_id === vendorId)
          : null;
          
        if (!customer || !vendor) return;
        
        // Calculate fees
        const customerFeePercentage = parseFloat(customer.fee_percentage?.toString() || '0');
        const vendorFeePercentage = parseFloat(vendor.fee_percentage?.toString() || '0');
        
        const customerFee = chequeAmount * (customerFeePercentage / 100);
        const netPayableToCustomer = chequeAmount - customerFee;
        const vendorFee = chequeAmount * (vendorFeePercentage / 100);
        const amountFromVendor = chequeAmount - vendorFee;
        const estimatedProfit = customerFee - vendorFee;
        
        setPreviewCalculations({
          customerFee,
          netPayableToCustomer,
          vendorFee,
          amountFromVendor,
          estimatedProfit,
        });
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, customers, vendors]);

  const onSubmit = async (data: TransactionFormValues) => {
    if (!transaction) return;
    
    try {
      // Convert form data to match API expectations
      const apiData = {
        ...data,
        customer_id: parseInt(data.customer_id),
        cheque_amount: data.cheque_amount,
        date: new Date(data.date),
        // Calculate estimated profit and customer fee
        profit: previewCalculations.estimatedProfit,
        customer_fee: previewCalculations.customerFee
      };

      await apiRequest("PATCH", `/api/transactions/${transaction.transaction_id}`, apiData);
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      
      toast({
        title: "Success",
        description: "Transaction updated successfully",
      });
      
      navigate("/");
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update transaction",
      });
    }
  };

  if (isLoading || !transaction) {
    return (
      <div className="container mx-auto flex h-[70vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg font-medium">Loading transaction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Edit Transaction</h1>
          <p className="text-gray-500">Cheque #{transaction.cheque_number}</p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingCustomers ? (
                          <SelectItem value="loading" disabled>Loading customers...</SelectItem>
                        ) : customers && Array.isArray(customers) && customers.length > 0 ? (
                          customers.map((customer: any) => (
                            <SelectItem key={customer.customer_id} value={customer.customer_id.toString()}>
                              {customer.customer_name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-customers" disabled>No customers available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="cheque_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cheque Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter cheque number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="cheque_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cheque Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span className="text-gray-500">$</span>
                        </div>
                        <Input placeholder="0.00" {...field} className="pl-7" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="vendor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingVendors ? (
                          <SelectItem value="loading" disabled>Loading vendors...</SelectItem>
                        ) : vendors && Array.isArray(vendors) && vendors.length > 0 ? (
                          vendors.map((vendor: any) => (
                            <SelectItem key={vendor.vendor_id} value={vendor.vendor_id}>
                              {vendor.vendor_name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-vendors" disabled>No vendors available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="bounced">Bounced</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="rounded-md bg-gray-50 p-4">
              <h4 className="font-medium">Fee Calculation Preview</h4>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Customer Fee:</span>
                  <span className="ml-2 font-medium">${previewCalculations.customerFee.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Net Payable to Customer:</span>
                  <span className="ml-2 font-medium">${previewCalculations.netPayableToCustomer.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Vendor Fee:</span>
                  <span className="ml-2 font-medium">${previewCalculations.vendorFee.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Amount from Vendor:</span>
                  <span className="ml-2 font-medium">${previewCalculations.amountFromVendor.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Estimated Profit:</span>
                  <span className="ml-2 font-medium text-green-600">${previewCalculations.estimatedProfit.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Cancel
              </Button>
              <Button type="submit">
                Update Transaction
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}