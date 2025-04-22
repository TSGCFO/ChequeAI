import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Plus, User, LogOut, Settings, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "./Sidebar";
import NewTransactionModal from "./NewTransactionModal";
import { useAuth } from "@/hooks/use-auth";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Header() {
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNewTransactionModal, setShowNewTransactionModal] = useState(false);
  const { user, logoutMutation } = useAuth();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate("/auth");
      }
    });
  };

  const getUserInitials = () => {
    if (!user) return "U";
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.username.substring(0, 2).toUpperCase();
  };

  const getRoleColor = () => {
    if (!user) return "bg-gray-300";
    switch (user.role) {
      case "superuser":
        return "bg-red-100 text-red-700";
      case "admin":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-green-100 text-green-700";
    }
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
            {user ? (
              <>
                <Button
                  className="hidden md:flex"
                  onClick={() => setShowNewTransactionModal(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Transaction
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className={getRoleColor()}>
                        <AvatarFallback>{getUserInitials()}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.first_name} {user.last_name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                        <p className="text-xs font-semibold mt-1 capitalize">{user.role}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <UserCircle className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/settings")}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => navigate("/auth")}
              >
                Login
              </Button>
            )}
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
