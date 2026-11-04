import { Order, OrderProcess } from "@/lib/types";
import { fetchScheduleFromNeonDB, syncScheduleToNeonDB } from "@/lib/db-service";

let inMemoryOrdersStore: Order[] = [];
let inMemoryProcessesStore: OrderProcess[] = [];

export async function handleGetOrdersApi(searchQuery?: string, tenantId?: string) {
  let orders = [...inMemoryOrdersStore];

  if (
    tenantId &&
    tenantId !== "tenant-default" &&
    tenantId !== "tenant-demo" &&
    process.env.NODE_ENV !== "test"
  ) {
    try {
      const dbRes = await fetchScheduleFromNeonDB(tenantId);
      if (dbRes.success && dbRes.data?.orders) {
        orders = dbRes.data.orders;
      }
    } catch {
      // fallback to memory
    }
  }

  let filtered = [...orders];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.orderId && o.orderId.toLowerCase().includes(q)) ||
        (o.material && o.material.toLowerCase().includes(q)),
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

export async function handlePostOrdersApi(
  body: { orders: Order[]; processes?: OrderProcess[] },
  tenantId?: string,
) {
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

  if (tenantId && tenantId !== "tenant-default") {
    try {
      await syncScheduleToNeonDB(tenantId, "API Synchronized Schedule", {
        orders: inMemoryOrdersStore,
        processes: inMemoryProcessesStore,
      });
    } catch (err) {
      console.warn("Could not sync orders to DB for tenant:", tenantId, err);
    }
  }

  return {
    success: true,
    data: {
      message: `Successfully synchronized ${body.orders.length} orders.`,
      ordersCount: inMemoryOrdersStore.length,
    },
  };
}

export async function handleDeleteOrderApi(orderId: string, tenantId?: string) {
  if (!orderId) {
    return {
      success: false,
      error: { code: "BAD_REQUEST", message: "Order ID parameter is required." },
    };
  }

  const initialCount = inMemoryOrdersStore.length;
  inMemoryOrdersStore = inMemoryOrdersStore.filter((o) => o.id !== orderId);
  inMemoryProcessesStore = inMemoryProcessesStore.filter((p) => p.orderId !== orderId);

  if (tenantId && tenantId !== "tenant-default") {
    try {
      await syncScheduleToNeonDB(tenantId, "API Synchronized Schedule", {
        orders: inMemoryOrdersStore,
        processes: inMemoryProcessesStore,
      });
    } catch (err) {
      console.warn("Could not sync order delete to DB for tenant:", tenantId, err);
    }
  }

  return {
    success: true,
    data: {
      message: `Order ${orderId} removed.`,
      removed: initialCount > inMemoryOrdersStore.length,
    },
  };
}
