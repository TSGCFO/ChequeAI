import { useState } from "react";
import { Calendar, Download, BarChart, PieChart, LineChart, TrendingUp, Users, Building, DollarSign, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Add hooks for each report type
function useCustomerBalances() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/customer-balances'],
    queryFn: async () => {
      const response = await apiRequest('/api/reports/customer-balances');
      return response || [];
    }
  });
}

function useVendorBalances() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/vendor-balances'],
    queryFn: async () => {
      const response = await apiRequest('/api/reports/vendor-balances');
      return response || [];
    }
  });
}

function useProfitByCustomer() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/profit-by-customer'],
    queryFn: async () => {
      const response = await apiRequest('/api/reports/profit-by-customer');
      return response || [];
    }
  });
}

function useProfitByVendor() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/profit-by-vendor'],
    queryFn: async () => {
      const response = await apiRequest('/api/reports/profit-by-vendor');
      return response || [];
    }
  });
}

function useProfitSummary(period: 'daily' | 'weekly' | 'monthly') {
  return useQuery<any[]>({
    queryKey: ['/api/reports/profit-summary', period],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/reports/profit-summary/${period}`);
        return response || [];
      } catch (error) {
        console.error(`Error fetching profit summary for ${period}:`, error);
        return [];
      }
    }
  });
}

function useOutstandingBalances() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/outstanding-balances'],
    queryFn: async () => {
      const response = await apiRequest('/api/reports/outstanding-balances');
      return response || [];
    }
  });
}

function useTransactionStatus() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/transaction-status'],
    queryFn: async () => {
      const response = await apiRequest('/api/reports/transaction-status');
      return response || [];
    }
  });
}

export default function Reports() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("financial");
  const [profitPeriod, setProfitPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  
  // Fetch report data
  const { data: customerBalances, isLoading: customerBalancesLoading } = useCustomerBalances();
  const { data: vendorBalances, isLoading: vendorBalancesLoading } = useVendorBalances();
  const { data: profitByCustomer, isLoading: profitByCustomerLoading } = useProfitByCustomer();
  const { data: profitByVendor, isLoading: profitByVendorLoading } = useProfitByVendor();
  const { data: profitSummary, isLoading: profitSummaryLoading } = useProfitSummary(profitPeriod);
  const { data: outstandingBalances, isLoading: outstandingBalancesLoading } = useOutstandingBalances();
  const { data: transactionStatus, isLoading: transactionStatusLoading } = useTransactionStatus();

  const handleDownloadReport = (reportType: string) => {
    // In a production app, we would generate a CSV or PDF here
    toast({
      title: "Report Download",
      description: `${reportType} report download initiated.`,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">View and generate business reports</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => handleDownloadReport("All")}
            className="flex items-center"
          >
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
          <Button 
            onClick={() => handleDownloadReport(selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1))}
            className="flex items-center"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Current Report
          </Button>
        </div>
      </div>

      <Tabs defaultValue="financial" onValueChange={setSelectedTab}>
        <TabsList className="mb-6 grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        
        {/* Financial Reports */}
        <TabsContent value="financial">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Financial Overview</h2>
            <Select value={profitPeriod} onValueChange={(value) => setProfitPeriod(value as 'daily' | 'weekly' | 'monthly')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Profit Summary</CardTitle>
                <TrendingUp className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardDescription className="px-6 text-sm text-gray-500">
                {profitPeriod.charAt(0).toUpperCase() + profitPeriod.slice(1)} profit breakdown
              </CardDescription>
              <CardContent className="pt-4">
                {profitSummaryLoading ? (
                  <p>Loading profit data...</p>
                ) : profitSummary && profitSummary.length > 0 ? (
                  <div className="max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{profitPeriod === 'daily' ? 'Date' : profitPeriod === 'weekly' ? 'Week' : 'Month'}</TableHead>
                          <TableHead>Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profitSummary.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{new Date(item.date || item.week || item.month).toLocaleDateString()}</TableCell>
                            <TableCell>${parseFloat(item.total_potential_profit || item.profit || "0").toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p>No profit data available for this period</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Outstanding Balances</CardTitle>
                <Flag className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardDescription className="px-6 text-sm text-gray-500">
                Pending payments and receivables
              </CardDescription>
              <CardContent className="pt-4">
                {outstandingBalancesLoading ? (
                  <p>Loading outstanding balances...</p>
                ) : outstandingBalances && outstandingBalances.length > 0 ? (
                  <div className="max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cheque #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Outstanding</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outstandingBalances.map((item: any) => (
                          <TableRow key={item.transaction_id}>
                            <TableCell>{item.cheque_number}</TableCell>
                            <TableCell>{item.customer_name}</TableCell>
                            <TableCell>{item.vendor_name}</TableCell>
                            <TableCell>
                              {parseFloat(item.customer_outstanding) > 0 ? 
                                `$${parseFloat(item.customer_outstanding).toFixed(2)} (to customer)` : 
                                `$${parseFloat(item.vendor_outstanding).toFixed(2)} (from vendor)`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p>No outstanding balances to display</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Profit by Source</CardTitle>
                <PieChart className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardDescription className="px-6 text-sm text-gray-500">
                Profit breakdown by customer and vendor
              </CardDescription>
              <CardContent className="pt-4">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-2">Top Customers by Profit</h3>
                  {profitByCustomerLoading ? (
                    <p>Loading...</p>
                  ) : profitByCustomer && profitByCustomer.length > 0 ? (
                    <div className="max-h-32 overflow-auto">
                      <Table>
                        <TableBody>
                          {profitByCustomer.slice(0, 5).map((item: any) => (
                            <TableRow key={item.customer_id}>
                              <TableCell>{item.customer_name}</TableCell>
                              <TableCell>${parseFloat(item.total_profit).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p>No customer profit data available</p>
                  )}
                </div>
                
                <div>
                  <h3 className="text-sm font-semibold mb-2">Top Vendors by Profit</h3>
                  {profitByVendorLoading ? (
                    <p>Loading...</p>
                  ) : profitByVendor && profitByVendor.length > 0 ? (
                    <div className="max-h-32 overflow-auto">
                      <Table>
                        <TableBody>
                          {profitByVendor.slice(0, 5).map((item: any) => (
                            <TableRow key={item.vendor_id}>
                              <TableCell>{item.vendor_name}</TableCell>
                              <TableCell>${parseFloat(item.total_profit).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p>No vendor profit data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Customer Reports */}
        <TabsContent value="customers">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Customer Reports</h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Customer Balances</CardTitle>
              <CardDescription>Outstanding and paid amounts by customer</CardDescription>
            </CardHeader>
            <CardContent>
              {customerBalancesLoading ? (
                <p>Loading customer balances...</p>
              ) : customerBalances && customerBalances.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Total Owed</TableHead>
                        <TableHead>Total Paid</TableHead>
                        <TableHead>Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerBalances.map((item: any) => (
                        <TableRow key={item.customer_id}>
                          <TableCell className="font-medium">{item.customer_name}</TableCell>
                          <TableCell>${parseFloat(item.total_owed || "0").toFixed(2)}</TableCell>
                          <TableCell>${parseFloat(item.total_paid || "0").toFixed(2)}</TableCell>
                          <TableCell>${parseFloat(item.remaining_balance || item.balance || "0").toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p>No customer balance data available</p>
              )}
            </CardContent>
          </Card>
          
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Profit by Customer</CardTitle>
                <CardDescription>Total profit generated from each customer</CardDescription>
              </CardHeader>
              <CardContent>
                {profitByCustomerLoading ? (
                  <p>Loading profit data...</p>
                ) : profitByCustomer && profitByCustomer.length > 0 ? (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Transactions</TableHead>
                          <TableHead>Total Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profitByCustomer.map((item: any) => (
                          <TableRow key={item.customer_id}>
                            <TableCell className="font-medium">{item.customer_name}</TableCell>
                            <TableCell>{item.transaction_count}</TableCell>
                            <TableCell>${parseFloat(item.total_profit).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p>No customer profit data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Vendor Reports */}
        <TabsContent value="vendors">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Vendor Reports</h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Vendor Balances</CardTitle>
              <CardDescription>Receivable and received amounts by vendor</CardDescription>
            </CardHeader>
            <CardContent>
              {vendorBalancesLoading ? (
                <p>Loading vendor balances...</p>
              ) : vendorBalances && vendorBalances.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Total Receivable</TableHead>
                        <TableHead>Total Received</TableHead>
                        <TableHead>Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorBalances.map((item: any) => (
                        <TableRow key={item.vendor_id}>
                          <TableCell className="font-medium">{item.vendor_name}</TableCell>
                          <TableCell>${parseFloat(item.total_to_receive || item.total_receivable || "0").toFixed(2)}</TableCell>
                          <TableCell>${parseFloat(item.total_received || "0").toFixed(2)}</TableCell>
                          <TableCell>${parseFloat(item.pending_amount || item.balance || "0").toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p>No vendor balance data available</p>
              )}
            </CardContent>
          </Card>
          
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Profit by Vendor</CardTitle>
                <CardDescription>Total profit generated from each vendor</CardDescription>
              </CardHeader>
              <CardContent>
                {profitByVendorLoading ? (
                  <p>Loading profit data...</p>
                ) : profitByVendor && profitByVendor.length > 0 ? (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Transactions</TableHead>
                          <TableHead>Total Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profitByVendor.map((item: any) => (
                          <TableRow key={item.vendor_id}>
                            <TableCell className="font-medium">{item.vendor_name}</TableCell>
                            <TableCell>{item.transaction_count}</TableCell>
                            <TableCell>${parseFloat(item.total_profit).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p>No vendor profit data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Transaction Reports */}
        <TabsContent value="transactions">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Transaction Status Report</h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Transaction Status</CardTitle>
              <CardDescription>Current status of all transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionStatusLoading ? (
                <p>Loading transaction status...</p>
              ) : transactionStatus && transactionStatus.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Cheque #</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Customer Payment</TableHead>
                        <TableHead>Vendor Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionStatus.map((item: any) => (
                        <TableRow key={item.transaction_id}>
                          <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                          <TableCell>{item.cheque_number}</TableCell>
                          <TableCell>${parseFloat(item.cheque_amount || item.amount || "0").toFixed(2)}</TableCell>
                          <TableCell>{item.customer_name}</TableCell>
                          <TableCell>{item.vendor_name}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs 
                              ${(item.status === 'completed' || item.status === 'Completed') ? 'bg-green-100 text-green-800' : 
                                (item.status === 'pending' || item.status === 'Pending') ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-red-100 text-red-800'}`}>
                              {typeof item.status === 'string' ? 
                                (item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()) : 
                                'Unknown'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs
                              ${(item.customer_payment_status === 'Fully Paid' || 
                                 parseFloat(item.customer_paid || "0") >= parseFloat(item.customer_amount || "0")) ? 
                                'bg-green-100 text-green-800' : 
                                'bg-yellow-100 text-yellow-800'}`}>
                              {item.customer_payment_status || 
                                (parseFloat(item.customer_paid || "0") >= parseFloat(item.customer_amount || "0") ? 
                                 'Fully Paid' : 'Partially Paid')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs
                              ${(item.vendor_payment_status === 'Fully Received' || 
                                 parseFloat(item.vendor_received || "0") >= parseFloat(item.vendor_amount || "0")) ? 
                                'bg-green-100 text-green-800' : 
                                'bg-yellow-100 text-yellow-800'}`}>
                              {item.vendor_payment_status || 
                                (parseFloat(item.vendor_received || "0") >= parseFloat(item.vendor_amount || "0") ? 
                                 'Fully Received' : 'Partially Received')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p>No transaction status data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}