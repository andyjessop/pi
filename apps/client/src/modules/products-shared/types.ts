// Shared types for products and product modules
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category?: string;
  imageUrl?: string;
  inStock?: boolean;
}

// Sample data - in real app, this would come from API
export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Wireless Headphones",
    description: "High-quality noise-canceling headphones with superior sound quality and comfort.",
    price: 299.99,
    category: "Audio",
    inStock: true,
  },
  {
    id: "2", 
    name: "Smart Watch",
    description: "Advanced fitness tracking and notifications with health monitoring features.",
    price: 399.99,
    category: "Wearables",
    inStock: true,
  },
  {
    id: "3",
    name: "Bluetooth Speaker",
    description: "Portable speaker with excellent sound quality and long battery life.",
    price: 89.99,
    category: "Audio",
    inStock: false,
  },
];

// Utility functions
export const findProductById = (id: string): Product | undefined => {
  return mockProducts.find(product => product.id === id);
};

export const formatPrice = (price: number): string => {
  return `$${price.toFixed(2)}`;
};