import { useState } from "react";
import { Calendar, Search, Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TransactionCard from "@/components/TransactionCard";
import SummaryCard from "@/components/SummaryCard";
import ChatInterface from "@/components/ChatInterface";
import DocumentProcessingModal from "@/components/DocumentProcessingModal";
import NewTransactionModal from "@/components/NewTransactionModal";
import useTransactions from "@/hooks/useTransactions";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { BusinessSummary } from "../../shared/schema";

export default function Dashboard() {
  const [showDocModal, setShowDocModal] = useState(false);
  const [showNewTransactionModal, setShowNewTransactionModal] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const { data: transactions, isLoading, isError } = useTransactions();
  const { data: summary, isLoading: isSummaryLoading } = useTransactions({ summary: true }) as { data: BusinessSummary | undefined, isLoading: boolean };

  const filteredTransactions = Array.isArray(transactions) 
    ? transactions.filter(
        (transaction) =>
          transaction.cheque_number?.includes(searchQuery) ||
          transaction.vendor?.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transaction.customer?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const toggleMobileChat = () => {
    setShowMobileChat(!showMobileChat);
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden md:flex-row">
      {/* Ledger View (Left Column) */}
      <div className={`flex h-full w-full flex-1 flex-col overflow-hidden border-r border-gray-200 md:w-3/5 ${showMobileChat && isMobile ? 'hidden' : ''}`}>
        {/* Tabs and Filters */}
        <div className="border-b border-gray-200 bg-white px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex space-x-4">
              <button className="border-b-2 border-primary px-1 py-2 text-sm font-medium text-primary">
                Transactions
              </button>
              <button className="px-1 py-2 text-sm font-medium text-gray-500">
                Customers
              </button>
              <button className="px-1 py-2 text-sm font-medium text-gray-500">
                Vendors
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search transactions..."
                  className="w-full"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="p-1.5"
              >
                <Filter className="h-4 w-4 text-gray-500" />
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title="Total Transactions"
            value={isSummaryLoading ? "Loading..." : summary?.totalTransactions.toString() || "0"}
            icon="transactions"
            trend={{ value: 12, label: "from last month" }}
          />
          <SummaryCard
            title="Total Profit"
            value={isSummaryLoading ? "Loading..." : `$${summary?.totalProfit || "0"}`}
            icon="profit"
            trend={{ value: 8.5, label: "from last month" }}
          />
          <SummaryCard
            title="Outstanding Balance"
            value={isSummaryLoading ? "Loading..." : `$${summary?.outstandingBalance || "0"}`}
            icon="balance"
            trend={{ value: -3.2, label: "from last month", negative: true }}
          />
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-200">
            {isLoading ? (
              <div className="flex h-40 w-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
                  <p className="text-sm text-gray-500">Loading transactions...</p>
                </div>
              </div>
            ) : isError ? (
              <div className="flex h-40 w-full items-center justify-center">
                <div className="text-center text-red-500">
                  <p>Error loading transactions</p>
                </div>
              </div>
            ) : filteredTransactions && filteredTransactions.length > 0 ? (
              filteredTransactions.map((transaction) => (
                <TransactionCard
                  key={transaction.transaction_id}
                  transaction={transaction}
                />
              ))
            ) : (
              <div className="flex h-40 w-full items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-gray-500">No transactions found</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Assistant (Right Column) */}
      <div className={`h-full w-full flex-col border-l border-gray-200 bg-white md:flex md:w-2/5 ${showMobileChat || !isMobile ? 'flex' : 'hidden'}`}>
        <ChatInterface onClose={isMobile ? toggleMobileChat : undefined} />
      </div>

      {/* Mobile Floating AI Assistant Button */}
      {isMobile && !showMobileChat && (
        <button
          onClick={toggleMobileChat}
          className="fixed bottom-20 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg md:hidden"
        >
          <i className="fa fa-robot text-xl"></i>
        </button>
      )}

      {/* Mobile Floating New Transaction Button */}
      <button
        onClick={() => setShowNewTransactionModal(true)}
        className="fixed bottom-4 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Document Processing Modal */}
      <DocumentProcessingModal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
      />

      {/* New Transaction Modal */}
      <NewTransactionModal
        isOpen={showNewTransactionModal}
        onClose={() => setShowNewTransactionModal(false)}
      />
    </div>
  );
}
