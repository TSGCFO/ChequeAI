import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "./Sidebar";
import NewTransactionModal from "./NewTransactionModal";

export default function Header() {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNewTransactionModal, setShowNewTransactionModal] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <>
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center space-x-2">
            {isMobile && (
              <button
                onClick={toggleMobileMenu}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <Menu className="h-6 w-6" />
              </button>
            )}
            <Link href="/" className="flex items-center space-x-2">
                <svg
                  className="h-8 w-8 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 12V8H6C4.89543 8 4 7.10457 4 6V18C4 19.1046 4.89543 20 6 20H20V16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 16L18 12L14 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h1 className="text-xl font-semibold text-primary">Cheque Ledger Pro</h1>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              className="hidden md:flex"
              onClick={() => setShowNewTransactionModal(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Transaction
            </Button>
            <div className="relative">
              <button className="flex items-center rounded-full bg-gray-100 p-1">
                <div className="h-8 w-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={toggleMobileMenu}>
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
              <h2 className="text-lg font-semibold text-primary">Cheque Ledger Pro</h2>
              <button
                onClick={toggleMobileMenu}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}

      <NewTransactionModal
        isOpen={showNewTransactionModal}
        onClose={() => setShowNewTransactionModal(false)}
      />
    </>
  );
}
