import { Home, Users, Building, Settings, FileText, BarChart4 } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { name: "Dashboard", icon: Home, path: "/" },
    { name: "Customers", icon: Users, path: "/customers" },
    { name: "Vendors", icon: Building, path: "/vendors" },
    { name: "Reports", icon: BarChart4, path: "/reports" },
    { name: "Documents", icon: FileText, path: "/documents" },
    { name: "Settings", icon: Settings, path: "/settings" },
  ];

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <li key={item.name}>
                <Link 
                  to={item.path}
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-gray-100 text-primary"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
              <span className="text-xs font-medium">JD</span>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">John Doe</p>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
}
