import { navigateTo } from "pi";
import { useAppDispatch } from "../hooks";

interface HeaderProps {
  currentRoute: string | undefined;
}

export function Header({ currentRoute }: HeaderProps) {
  const dispatch = useAppDispatch();
  
  const handleNavigation = (routeName: string) => {
    // Cast thunk for TypeScript - RTK pattern
    dispatch(navigateTo({ name: routeName }) as any);
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-gray-900">Pi Demo</h1>
            
            <nav className="flex space-x-6">
              <button
                onClick={() => handleNavigation("home")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  currentRoute === "home"
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Home
              </button>
              
              <button
                onClick={() => handleNavigation("about")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  currentRoute === "about"
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                About
              </button>
              
              <button
                onClick={() => handleNavigation("products")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  currentRoute === "products"
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Products
              </button>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}