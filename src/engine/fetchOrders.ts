import { getUserOrders } from "./lib";

export async function fetchOpenOrders(userId: string, marketId: string | string[]) {
    const orders = await getUserOrders(userId);
    return orders.filter(
        (o) =>
            o.market === marketId &&
            (o.status === "open" || o.status === "partially-filled")
    );
}

export async function fetchOrders(userId: string, marketId: string | string[]) {
    const orders = await getUserOrders(userId);
    return orders.filter((o) => o.market === marketId);
}
