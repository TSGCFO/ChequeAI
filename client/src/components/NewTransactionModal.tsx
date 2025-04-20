import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export default function NewTransactionModal({ isOpen, onClose }: NewTransactionModalProps) {
  const [previewCalculations, setPreviewCalculations] = useState({
    customerFee: 0,
    netPayableToCustomer: 0,
    vendorFee: 0,
    amountFromVendor: 0,
    estimatedProfit: 0,
  });
  
  const { toast } = useToast();
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
    try {
      // Convert form data to match API expectations
      const apiData = {
        ...data,
        customer_id: parseInt(data.customer_id),
        cheque_amount: data.cheque_amount,
        date: new Date(data.date),
      };

      await apiRequest("POST", "/api/transactions", apiData);
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      
      toast({
        title: "Success",
        description: "Transaction created successfully",
      });
      
      form.reset(defaultValues);
      onClose();
    } catch (error) {
      console.error("Error creating transaction:", error);
      toast({
        title: "Error",
        description: "Failed to create transaction",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        form.reset(defaultValues);
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
        </DialogHeader>
        
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
                      defaultValue={field.value}
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
                      defaultValue={field.value}
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
                      defaultValue={field.value}
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
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                Create Transaction
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
