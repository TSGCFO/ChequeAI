import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import Vendors from "@/pages/Vendors";
import Reports from "@/pages/Reports";
import Documents from "@/pages/Documents";
import Settings from "@/pages/Settings";
import EditTransaction from "@/pages/EditTransaction";
import Layout from "@/components/Layout";
import { useEffect } from "react";

function Router() {
  useEffect(() => {
    document.title = "Cheque Ledger Pro - AI-Powered Ledger Management";
  }, []);

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/customers" component={Customers} />
        <Route path="/vendors" component={Vendors} />
        <Route path="/reports" component={Reports} />
        <Route path="/documents" component={Documents} />
        <Route path="/settings" component={Settings} />
        <Route path="/edit-transaction/:id" component={EditTransaction} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
