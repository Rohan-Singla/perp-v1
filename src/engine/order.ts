import { randomUUID } from "crypto"
import type { order } from "../../types"
import {
    addToBook,
    addUserOrder,
    getOrder,
    loadOrderbook,
    recordFill,
    saveOrder,
    saveOrderbook,
    unlockBalance,
    updateBalance,
    updatePosition,
} from "./lib";


export async function matchOrder(userId: string, incomingOrder: order) {

    incomingOrder.orderId = randomUUID();
    incomingOrder.status = "pending"
    incomingOrder.filledQty = 0

    const orderbook = await loadOrderbook(incomingOrder.market)

    await updateBalance(userId, incomingOrder.margin)

    let remainingQty = incomingOrder.qty

    const oppositeBook = incomingOrder.type === "LONG"
        ? orderbook.asks
        : orderbook.bids

    let prices = Object.keys(oppositeBook).map(Number);

    prices.sort((a, b) => {
        if (incomingOrder.type === "LONG") {
            return a - b
        } else {
            return b - a
        }
    })

    if (incomingOrder.orderType === "limit") {
        prices = prices.filter(price => {
            if (incomingOrder.type === "LONG") {
                return price <= incomingOrder.price
            }
            return price >= incomingOrder.price
        })
    }

    const marginPerUnit = incomingOrder.margin / incomingOrder.qty

    for (const price of prices) {

        if (remainingQty <= 0) break

        const bucket = oppositeBook[price]

        if (!bucket) continue

        for (const existingOrder of bucket.openOrders) {

            if (remainingQty <= 0) break

            const remainingOrderQty = existingOrder.qty - existingOrder.filledQty

            if (remainingOrderQty <= 0) continue

            const executedQty = Math.min(remainingQty, remainingOrderQty)

            existingOrder.filledQty += executedQty

            if (existingOrder.filledQty === existingOrder.qty) {
                existingOrder.status = "filled"
            } else {
                existingOrder.status = "partially-filled"
            }

            remainingQty -= executedQty
            bucket.availableQty -= executedQty
            orderbook.lastTradedPrice = price

            const executionMargin = marginPerUnit * executedQty

            await updatePosition(
                userId,
                incomingOrder.market,
                incomingOrder.type,
                executedQty,
                price,
                executionMargin
            )

            const counterpartyType = incomingOrder.type === "LONG" ? "SHORT" : "LONG"
            
            await updatePosition(
                existingOrder.userId,
                incomingOrder.market,
                counterpartyType,
                executedQty,
                price,
                executionMargin
            )


            const longUserId = incomingOrder.type === "LONG" ? userId : existingOrder.userId;
            const shortUserId = incomingOrder.type === "SHORT" ? userId : existingOrder.userId;

            await recordFill({
                fillId: randomUUID(),
                market: incomingOrder.market,
                qty: executedQty,
                price,
                makerUserId: existingOrder.userId,  
                takerUserId: userId,             
                longUserId,
                shortUserId,
                createdAt: new Date(),
            });

            await updateMakerOrderRecord(existingOrder.orderId, executedQty);
        }

        bucket.openOrders = bucket.openOrders.filter(o => o.filledQty < o.qty);
        if (bucket.availableQty <= 0) {
            delete oppositeBook[price];
        }
    }

    const filledQty = incomingOrder.qty - remainingQty;
    incomingOrder.filledQty = filledQty;

    if (filledQty === 0) {
        if (incomingOrder.orderType === "market") {
            incomingOrder.status = "rejected";
            await unlockBalance(userId, incomingOrder.margin);
        } else {
            incomingOrder.status = "open";
            addToBook(orderbook, incomingOrder, userId, remainingQty);
        }
    } else if (remainingQty > 0) {
        incomingOrder.status = "partially-filled";
        if (incomingOrder.orderType === "limit") {
            addToBook(orderbook, incomingOrder, userId, remainingQty);
        }
    } else {
        incomingOrder.status = "filled";
    }

    await saveOrderbook(incomingOrder.market, orderbook);

    incomingOrder.userId = userId;
    
    await saveOrder(incomingOrder);

    await addUserOrder(userId, incomingOrder.orderId!);

    return {
        success: true,
        order: incomingOrder,
        filledQty,
        remainingQty,
        orderbook,
    };
}

async function updateMakerOrderRecord(orderId: string, executedQty: number) {
    const makerOrder = await getOrder(orderId);
    if (!makerOrder) return;

    makerOrder.filledQty = (makerOrder.filledQty ?? 0) + executedQty;
    if (makerOrder.filledQty >= makerOrder.qty) {
        makerOrder.status = "filled";
    } else {
        makerOrder.status = "partially-filled";
    }
    await saveOrder(makerOrder);
}
