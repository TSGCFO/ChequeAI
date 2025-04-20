import { useState } from "react";
import { Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import useTransactions from "@/hooks/useTransactions";
import { TransactionWithDetails } from "@shared/schema";

export default function Reports() {
  const { toast } = useToast();
  const { data: transactions, isLoading } = useTransactions() as { data: TransactionWithDetails[] | undefined, isLoading: boolean };
  const [selectedTab, setSelectedTab] = useState("transactions");

  const handleDownloadReport = (reportType: string) => {
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
            Export {selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1)}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="transactions" onValueChange={setSelectedTab}>
        <TabsList className="mb-6 grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
        </TabsList>
        
        <TabsContent value="transactions">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
                <Calendar className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardDescription className="px-6 text-sm text-gray-500">
                Last 30 days
              </CardDescription>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  {isLoading ? "Loading..." : transactions ? transactions.length : "0"}
                </div>
                <p className="text-sm text-gray-500">
                  {isLoading ? "" : transactions && transactions.length > 0 
                    ? `$${transactions.reduce((acc, t) => acc + Number(t.amount), 0).toFixed(2)} total`
                    : "No transactions to display"
                  }
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Pending Transactions</CardTitle>
                <Calendar className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardDescription className="px-6 text-sm text-gray-500">
                Awaiting processing
              </CardDescription>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  {isLoading 
                    ? "Loading..." 
                    : transactions 
                      ? transactions.filter(t => t.status === "pending").length 
                      : "0"
                  }
                </div>
                <p className="text-sm text-gray-500">
                  {isLoading 
                    ? "" 
                    : transactions && transactions.filter(t => t.status === "pending").length > 0
                      ? `$${transactions
                          .filter(t => t.status === "pending")
                          .reduce((acc, t) => acc + Number(t.amount), 0)
                          .toFixed(2)} pending`
                      : "No pending transactions"
                  }
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Completed Transactions</CardTitle>
                <Calendar className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardDescription className="px-6 text-sm text-gray-500">
                Successfully processed
              </CardDescription>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  {isLoading 
                    ? "Loading..." 
                    : transactions 
                      ? transactions.filter(t => t.status === "completed").length 
                      : "0"
                  }
                </div>
                <p className="text-sm text-gray-500">
                  {isLoading 
                    ? "" 
                    : transactions && transactions.filter(t => t.status === "completed").length > 0
                      ? `$${transactions
                          .filter(t => t.status === "completed")
                          .reduce((acc, t) => acc + Number(t.amount), 0)
                          .toFixed(2)} processed`
                      : "No completed transactions"
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="customers">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Customer Analytics</CardTitle>
                <Calendar className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardDescription className="px-6 text-sm text-gray-500">
                Customer report coming soon
              </CardDescription>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  -
                </div>
                <p className="text-sm text-gray-500">
                  This feature is under development
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="vendors">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Vendor Analytics</CardTitle>
                <Calendar className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardDescription className="px-6 text-sm text-gray-500">
                Vendor report coming soon
              </CardDescription>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  -
                </div>
                <p className="text-sm text-gray-500">
                  This feature is under development
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}