import type { ReactNode } from "react";
import { Header } from "./Header";

interface LayoutProps {
  currentRoute: string | undefined;
  children: ReactNode;
}

export function Layout({ currentRoute, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header currentRoute={currentRoute} />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white shadow-sm border border-gray-200 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}