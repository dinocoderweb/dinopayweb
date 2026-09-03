export type Category = { id: string; name: string; description: string; icon: string; color: string };
export type Listing = { id: string; name: string; category: string; description: string; price: string; rating: number; image: string; kind: "Product" | "Service"; badge?: string };
