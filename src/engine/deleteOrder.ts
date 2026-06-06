import type { order } from "../../types";
import {
    getOrder,
    loadOrderbook,
    saveOrder,
    saveOrderbook,
    unlockBalance,
} from "./lib";

export async function deleteOrder(
    userId: string,
    orderId: string | string[] | undefined
) {
    if (!orderId || Array.isArray(orderId)) {
        throw new Error("Invalid orderId");
    }

    const order = await getOrder(orderId);

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.userId !== userId) {
        throw new Error("Unauthorized");
    }

    if (
        order.status !== "open" &&
        order.status !== "partially-filled"
    ) {
        throw new Error("Order cannot be cancelled");
    }

    const orderbook = await loadOrderbook(order.market);

    const side =
        order.type === "LONG"
            ? orderbook.bids
            : orderbook.asks;

    const priceKey = order.price.toString();
    const bucket = side[priceKey];

    if (!bucket) {
        throw new Error("Order not found on book");
    }

    const bookOrder = bucket.openOrders.find((o) => o.orderId === orderId);
    if (!bookOrder) {
        throw new Error("Order not found on book");
    }

    const remainingQty = bookOrder.qty - bookOrder.filledQty;
    bucket.openOrders = bucket.openOrders.filter((o) => o.orderId !== orderId);
    bucket.availableQty -= remainingQty;

    if (bucket.availableQty <= 0 || bucket.openOrders.length === 0) {
        delete side[priceKey];
    }

    const filledQty = order.filledQty ?? 0;
    const unfilledQty = order.qty - filledQty;
    const marginToUnlock = (order.margin / order.qty) * unfilledQty;

    await unlockBalance(userId, marginToUnlock);
    await saveOrderbook(order.market, orderbook);

    order.status = "cancelled";
    await saveOrder(order);

    return {
        success: true,
        order,
    };
}
