import { z } from "zod";

/*
 * =============================================================================
 * 1. Abstract `BackendClient` interface
 *
 * You can implement this however you like (e.g. HTTP, in-memory, WebSocket,
 * GraphQL, native mobile bridge, etc.). The front-end code never assumes HTTP:
 * it only calls methods on this interface.
 * =============================================================================
 */
export interface BackendClient {
  getAll(entity: string): Promise<unknown>;
  getOne(entity: string, id: string): Promise<unknown>;
  create(entity: string, data: unknown): Promise<unknown>;
  update(entity: string, data: unknown): Promise<unknown>;
  delete(entity: string, id: string): Promise<unknown>;
}

/*
 * =============================================================================
 * 2. A "client‐generator" utility to produce a typed JS API from any Zod schema
 *
 * - TSchema extends ZodTypeAny, so you can pass in e.g. `ProductSchema`.
 * - `entityName` is just a string key by which your backend client
 *   recognises that resource (e.g. "products").
 * - `client` is any object implementing `BackendClient`.
 *
 * The returned `typedClient` exposes:
 *   • getAll(): Promise<Entity[]>
 *   • getOne(id): Promise<Entity>
 *   • create(data): Promise<Entity>
 *   • update(data): Promise<Entity>
 *   • delete(id): Promise<{ success: boolean; id: string }>
 *
 * All responses are validated at runtime via Zod, and TypeScript infers
 * the correct types for you.
 * =============================================================================
 */
export function createClient<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  entityName: string,
  client: BackendClient
) {
  type Entity = z.infer<TSchema>;

  return {
    /**
     * Fetch all items of type `Entity`.
     * Returns a Promise<Entity[]> after runtime validation.
     */
    getAll: async (): Promise<Entity[]> => {
      const raw = await client.getAll(entityName);
      return z.array(schema).parse(raw);
    },

    /**
     * Fetch one item by its ID.
     * Returns a Promise<Entity> after runtime validation.
     */
    getOne: async (id: string): Promise<Entity> => {
      const raw = await client.getOne(entityName, id);
      return schema.parse(raw);
    },

    /**
     * Create a new item (excluding `id` in the payload).
     * Returns the created Entity, including its server‐assigned `id`.
     */
    create: async (data: Omit<Entity, "id">): Promise<Entity> => {
      const raw = await client.create(entityName, data);
      return schema.parse(raw);
    },

    /**
     * Update an existing item. Your `data` must include the `id`.
     * Returns the updated Entity.
     */
    update: async (data: Entity): Promise<Entity> => {
      const raw = await client.update(entityName, data);
      return schema.parse(raw);
    },

    /**
     * Delete an item by ID. Returns a `{ success: boolean; id: string }` object.
     */
    delete: async (id: string): Promise<{ success: boolean; id: string }> => {
      const raw = await client.delete(entityName, id);
      return z
        .object({ success: z.boolean(), id: z.string().uuid() })
        .parse(raw);
    },
  };
}

/*
 * =============================================================================
 * 3. In-Memory Backend Client Implementation
 *
 * A simple in-memory store for local development. In production, you would
 * swap this out for your actual backend client (HTTP, GraphQL, etc.).
 * =============================================================================
 */
export class InMemoryClient implements BackendClient {
  private database: Record<string, Record<string, any>> = {};

  async getAll(entity: string): Promise<unknown> {
    const store = this.database[entity] || {};
    return Object.values(store);
  }

  async getOne(entity: string, id: string): Promise<unknown> {
    const store = this.database[entity] || {};
    const item = store[id];
    if (!item) {
      throw new Error(`Entity "[${entity}]" with id "[${id}]" not found`);
    }
    return item;
  }

  async create(entity: string, data: unknown): Promise<unknown> {
    const store = this.database[entity] || {};
    // Generate a new UUID for the item
    const newItem = { ...(data as any), id: crypto.randomUUID() };
    store[newItem.id] = newItem;
    this.database[entity] = store;
    return newItem;
  }

  async update(entity: string, data: unknown): Promise<unknown> {
    const store = this.database[entity] || {};
    const payload = data as any;
    if (!store[payload.id]) {
      throw new Error(`Cannot update "${entity}": id "[${payload.id}]" missing`);
    }
    store[payload.id] = payload;
    return payload;
  }

  async delete(entity: string, id: string): Promise<unknown> {
    const store = this.database[entity] || {};
    if (!store[id]) {
      throw new Error(`Cannot delete "${entity}": id "[${id}]" missing`);
    }
    delete store[id];
    return { success: true, id };
  }
}

/*
 * =============================================================================
 * 4. Default client instance for development
 * =============================================================================
 */
export const defaultClient = new InMemoryClient();

// Add some sample data for development
if (typeof window !== "undefined") {
  // Only run in browser, not during SSR
  defaultClient.create("products", {
    name: "Wireless Headphones",
    description: "Premium wireless headphones with noise cancellation",
    price: 199.99,
    category: "Electronics",
    inStock: true,
  });

  defaultClient.create("products", {
    name: "Running Shoes",
    description: "Comfortable running shoes for all terrain",
    price: 89.99,
    category: "Sports",
    inStock: true,
  });

  defaultClient.create("products", {
    name: "Coffee Maker",
    description: "Automatic drip coffee maker with timer",
    price: 129.99,
    category: "Kitchen",
    inStock: false,
  });

  defaultClient.create("products", {
    name: "Laptop Stand",
    description: "Adjustable aluminum laptop stand",
    price: 49.99,
    category: "Electronics",
    inStock: true,
  });
}