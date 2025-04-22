import { useState } from "react";
import { Calendar, Download, BarChart, PieChart, LineChart, TrendingUp, Users, Building, DollarSign, Flag, Database, TableIcon, FileText, Loader2, Receipt, CreditCard, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Add hooks for each report type
function useCustomerBalances() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/customer-balances'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/reports/customer-balances');
        if (!response.ok) {
          throw new Error(`Error fetching customer balances: ${response.statusText}`);
        }
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error("Error fetching customer balances:", error);
        return [];
      }
    }
  });
}

function useVendorBalances() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/vendor-balances'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/reports/vendor-balances');
        if (!response.ok) {
          throw new Error(`Error fetching vendor balances: ${response.statusText}`);
        }
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error("Error fetching vendor balances:", error);
        return [];
      }
    }
  });
}

function useProfitByCustomer() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/profit-by-customer'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/reports/profit-by-customer');
        if (!response.ok) {
          throw new Error(`Error fetching profit by customer: ${response.statusText}`);
        }
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error("Error fetching profit by customer:", error);
        return [];
      }
    }
  });
}

function useProfitByVendor() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/profit-by-vendor'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/reports/profit-by-vendor');
        if (!response.ok) {
          throw new Error(`Error fetching profit by vendor: ${response.statusText}`);
        }
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error("Error fetching profit by vendor:", error);
        return [];
      }
    }
  });
}

function useProfitSummary(period: 'daily' | 'weekly' | 'monthly') {
  return useQuery<any[]>({
    queryKey: ['/api/reports/profit-summary', period],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/reports/profit-summary/${period}`);
        if (!response.ok) {
          throw new Error(`Error fetching profit summary: ${response.statusText}`);
        }
        const data = await response.json();
        return data || [];
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
      try {
        const response = await fetch('/api/reports/outstanding-balances');
        if (!response.ok) {
          throw new Error(`Error fetching outstanding balances: ${response.statusText}`);
        }
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error("Error fetching outstanding balances:", error);
        return [];
      }
    }
  });
}

function useTransactionStatus() {
  return useQuery<any[]>({
    queryKey: ['/api/reports/transaction-status'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/reports/transaction-status');
        if (!response.ok) {
          throw new Error(`Error fetching transaction status: ${response.statusText}`);
        }
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error("Error fetching transaction status:", error);
        return [];
      }
    }
  });
}

// Add hooks for database schema explorer
interface SchemaItem {
  table_name: string;
  table_type: string;
  table_schema: string;
}

interface Column {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface TableData {
  columns: Column[];
  data: any[];
  totalCount: number;
  limit: number;
  offset: number;
}

function useDatabaseSchema() {
  return useQuery<SchemaItem[]>({
    queryKey: ['/api/report/schema'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/report/schema');
      const data = await res.json();
      return data as SchemaItem[];
    },
  });
}

function useTableData(tableName: string | null, page: number, limit: number) {
  return useQuery<TableData | null>({
    queryKey: ['/api/report/data', tableName, page, limit],
    queryFn: async () => {
      if (!tableName) return null;
      const res = await apiRequest('GET', `/api/report/data/${tableName}?limit=${limit}&offset=${(page - 1) * limit}`);
      const data = await res.json();
      return data as TableData;
    },
    enabled: !!tableName,
  });
}

export default function Reports() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("financial");
  const [profitPeriod, setProfitPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  
  // Database explorer state
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [schemaTab, setSchemaTab] = useState('tables');
  
  // Fetch report data
  const { data: customerBalances, isLoading: customerBalancesLoading } = useCustomerBalances();
  const { data: vendorBalances, isLoading: vendorBalancesLoading } = useVendorBalances();
  const { data: profitByCustomer, isLoading: profitByCustomerLoading } = useProfitByCustomer();
  const { data: profitByVendor, isLoading: profitByVendorLoading } = useProfitByVendor();
  const { data: profitSummary, isLoading: profitSummaryLoading } = useProfitSummary(profitPeriod);
  const { data: outstandingBalances, isLoading: outstandingBalancesLoading } = useOutstandingBalances();
  const { data: transactionStatus, isLoading: transactionStatusLoading } = useTransactionStatus();
  
  // Database explorer queries
  const { data: schemaItems, isLoading: schemaLoading } = useDatabaseSchema();
  const { data: tableData, isLoading: tableLoading } = useTableData(selectedTable, page, limit);

  const handleDownloadReport = (reportType: string) => {
    // In a production app, we would generate a CSV or PDF here
    toast({
      title: "Report Download",
      description: `${reportType} report download initiated.`,
    });
  };

  // Function to get profit value from any possible API response format
  const getProfitValue = (item: any) => {
    return parseFloat(
      item.total_profit || 
      item.profit || 
      item.total_potential_profit ||
      item.total_realized_profit || 
      item.unrealized_profit || 
      "0"
    );
  };
  
  // Helper function to format cell values for display
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '<null>';
    }
    
    if (typeof value === 'object') {
      // Check if it's a date
      if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
        return new Date(value).toLocaleString();
      }
      
      // Otherwise stringify the object
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    
    return String(value);
  };

  // Helper function to filter schema items based on search term and tab
  const getFilteredSchemaItems = () => {
    if (!schemaItems) return [];
    
    return schemaItems.filter((item) => {
      const matchesSearch = searchTerm === '' || 
        item.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.table_schema.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTab = 
        (schemaTab === 'tables' && item.table_type === 'BASE TABLE') ||
        (schemaTab === 'views' && item.table_type === 'VIEW') ||
        (schemaTab === 'all');
      
      return matchesSearch && matchesTab;
    });
  };
  
  // Helper function to generate pagination items
  const generatePaginationItems = (currentPage: number, totalPages: number): (number | string)[] => {
    const items: (number | string)[] = [];
    
    if (totalPages <= 7) {
      // If we have 7 or fewer pages, show all page numbers
      for (let i = 1; i <= totalPages; i++) {
        items.push(i);
      }
    } else {
      // Always include the first page
      items.push(1);
      
      // Add ellipsis or page numbers around the current page
      if (currentPage > 3) {
        items.push('...');
      }
      
      // Calculate the starting and ending pages to show around the current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      // Add the page numbers around the current page
      for (let i = start; i <= end; i++) {
        items.push(i);
      }
      
      // Add ellipsis if needed
      if (currentPage < totalPages - 2) {
        items.push('...');
      }
      
      // Always include the last page
      items.push(totalPages);
    }
    
    return items;
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
        <TabsList className="mb-6 grid w-full grid-cols-5 lg:w-[750px]">
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="database">All Reports</TabsTrigger>
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
                          <TableRow key={`profit-summary-${index}-${item.date || item.week || item.month}`}>
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
                          <TableHead>Type</TableHead>
                          <TableHead>Entity</TableHead>
                          <TableHead>Outstanding Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outstandingBalances.map((item: any, index: number) => (
                          <TableRow key={`outstanding-balance-${index}`}>
                            <TableCell>{item.balance_type}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>${parseFloat(item.outstanding_amount || "0").toFixed(2)}</TableCell>
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
                    <>
                      <div className="max-h-32 overflow-auto">
                        <Table>
                          <TableBody>
                            {profitByCustomer
                              .sort((a, b) => getProfitValue(b) - getProfitValue(a))
                              .slice(0, 5)
                              .map((item: any) => (
                                <TableRow key={item.customer_id}>
                                  <TableCell>{item.customer_name}</TableCell>
                                  <TableCell>${getProfitValue(item).toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <p>No customer profit data available</p>
                  )}
                </div>
                
                <div>
                  <h3 className="text-sm font-semibold mb-2">Top Vendors by Profit</h3>
                  {profitByVendorLoading ? (
                    <p>Loading...</p>
                  ) : profitByVendor && profitByVendor.length > 0 ? (
                    <>
                      <div className="max-h-32 overflow-auto">
                        <Table>
                          <TableBody>
                            {profitByVendor
                              .sort((a, b) => getProfitValue(b) - getProfitValue(a))
                              .slice(0, 5)
                              .map((item: any) => (
                                <TableRow key={item.vendor_id}>
                                  <TableCell>{item.vendor_name}</TableCell>
                                  <TableCell>${getProfitValue(item).toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
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
                            <TableCell>${getProfitValue(item).toFixed(2)}</TableCell>
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
                            <TableCell>${getProfitValue(item).toFixed(2)}</TableCell>
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
                      {transactionStatus.map((item: any, index: number) => (
                        <TableRow key={`transaction-status-${index}-${item.transaction_id || item.cheque_number || ''}`}>
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

        {/* Database views as individual reports */}
        <TabsContent value="database">
          <div className="mb-4">
            <h2 className="text-xl font-bold">All Database Reports</h2>
            <p className="text-gray-500">Complete collection of all available reports</p>
          </div>
          
          {schemaLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2">Loading all available reports...</span>
            </div>
          ) : (
            <div>
              {schemaItems && schemaItems.filter(item => item.table_type === 'VIEW').length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {schemaItems
                    .filter(item => item.table_type === 'VIEW')
                    .map((view) => {
                      // Format the view name for display
                      const viewName = view.table_name;
                      const formattedName = viewName
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                        
                      // Get an appropriate icon based on the view name
                      let ViewIcon = FileText;
                      if (viewName.includes('customer')) ViewIcon = Users;
                      if (viewName.includes('vendor')) ViewIcon = Building;
                      if (viewName.includes('transaction')) ViewIcon = TableIcon;
                      if (viewName.includes('profit')) ViewIcon = TrendingUp;
                      if (viewName.includes('balance')) ViewIcon = DollarSign;
                      if (viewName.includes('summary')) ViewIcon = BarChart;
                      if (viewName.includes('payment')) ViewIcon = DollarSign;
                      if (viewName.includes('deposit')) ViewIcon = DollarSign;
                        
                      return (
                        <Card key={`${view.table_schema}.${view.table_name}`} className="overflow-hidden">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <ViewIcon className="h-5 w-5 text-primary" />
                              {formattedName}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pb-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full"
                              onClick={() => {
                                setSelectedTable(`${view.table_schema}.${view.table_name}`);
                                setPage(1);
                              }}
                            >
                              View Report Data
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No database views found.</p>
                </div>
              )}
            </div>
          )}
          
          {/* Display selected report data */}
          {selectedTable && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        {selectedTable.split('.')[1]
                          .split('_')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ')}
                      </CardTitle>
                      <CardDescription>
                        Detailed report data
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedTable(null)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Close Report
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => handleDownloadReport(selectedTable.split('.')[1])}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                    </div>
                  </div>
                  
                  {tableData && (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-2">
                      <div className="text-sm text-muted-foreground">
                        {tableData.totalCount} total records
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="report-limit">Rows per page:</Label>
                        <Select
                          value={limit.toString()}
                          onValueChange={(value) => {
                            setLimit(parseInt(value));
                            setPage(1);
                          }}
                        >
                          <SelectTrigger id="report-limit" className="w-[80px]">
                            <SelectValue placeholder="10" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </CardHeader>
                
                <CardContent>
                  {tableLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2">Loading report data...</span>
                    </div>
                  ) : tableData ? (
                    <>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {tableData.columns.map((column) => (
                                <TableHead key={column.column_name} className="text-left whitespace-nowrap">
                                  {column.column_name
                                    .split('_')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ')}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tableData.data.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={tableData.columns.length}
                                  className="h-24 text-center"
                                >
                                  No records found for this report
                                </TableCell>
                              </TableRow>
                            ) : (
                              tableData.data.map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                  {tableData.columns.map((column) => (
                                    <TableCell key={`${rowIndex}-${column.column_name}`} className="whitespace-nowrap">
                                      {formatCellValue(row[column.column_name])}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination */}
                      {tableData.totalCount > limit && (
                        <Pagination className="mt-4">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => page > 1 && setPage(page - 1)}
                                className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                              />
                            </PaginationItem>
                            
                            {generatePaginationItems(page, Math.ceil(tableData.totalCount / limit)).map((item, i) => (
                              item === '...' ? (
                                <PaginationItem key={`ellipsis-${i}`}>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              ) : (
                                <PaginationItem key={`page-${item}`}>
                                  <PaginationLink
                                    isActive={page === item}
                                    onClick={() => setPage(item as number)}
                                  >
                                    {item}
                                  </PaginationLink>
                                </PaginationItem>
                              )
                            ))}
                            
                            <PaginationItem>
                              <PaginationNext
                                onClick={() => page < Math.ceil(tableData.totalCount / limit) && setPage(page + 1)}
                                className={page >= Math.ceil(tableData.totalCount / limit) ? 'pointer-events-none opacity-50' : ''}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      Failed to load data for this report
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}