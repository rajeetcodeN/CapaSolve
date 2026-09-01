import { Order, OrderProcess } from "@/lib/types";

let inMemoryOrdersStore: Order[] = [];
let inMemoryProcessesStore: OrderProcess[] = [];

export function handleGetOrdersApi(searchQuery?: string) {
  let filtered = [...inMemoryOrdersStore];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.orderId.toLowerCase().includes(q) ||
        o.material.toLowerCase().includes(q),
    );
  }
  return {
    success: true,
    data: {
      count: filtered.length,
      orders: filtered,
    },
  };
}

export function handlePostOrdersApi(body: { orders: Order[]; processes?: OrderProcess[] }) {
  if (!body || !Array.isArray(body.orders)) {
    return {
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "Payload must contain an array of orders.",
      },
    };
  }

  body.orders.forEach((newOrder) => {
    const idx = inMemoryOrdersStore.findIndex((o) => o.id === newOrder.id);
    if (idx >= 0) {
      inMemoryOrdersStore[idx] = newOrder;
    } else {
      inMemoryOrdersStore.push(newOrder);
    }
  });

  if (Array.isArray(body.processes)) {
    body.processes.forEach((newProc) => {
      const idx = inMemoryProcessesStore.findIndex(
        (p) => p.orderId === newProc.orderId && p.processId === newProc.processId,
      );
      if (idx >= 0) {
        inMemoryProcessesStore[idx] = newProc;
      } else {
        inMemoryProcessesStore.push(newProc);
      }
    });
  }

  return {
    success: true,
    data: {
      message: `Successfully synchronized ${body.orders.length} orders.`,
      ordersCount: inMemoryOrdersStore.length,
    },
  };
}

export function handleDeleteOrderApi(orderId: string) {
  if (!orderId) {
    return {
      success: false,
      error: { code: "BAD_REQUEST", message: "Order ID parameter is required." },
    };
  }

  const initialCount = inMemoryOrdersStore.length;
  inMemoryOrdersStore = inMemoryOrdersStore.filter((o) => o.id !== orderId);
  inMemoryProcessesStore = inMemoryProcessesStore.filter((p) => p.orderId !== orderId);

  return {
    success: true,
    data: {
      message: `Order ${orderId} removed.`,
      removed: initialCount > inMemoryOrdersStore.length,
    },
  };
}
