import { client } from "../../redis-client"
import type { order, Orderbook, position } from "../../types"


function getOrderbookKey(market: string) {
    return `orderbook:${market}`
}

function getPositionKey(userId: string) {
    return `positions:${userId}`
}

export async function loadOrderbook(market: string): Promise<Orderbook> {
    let data = await client.get(getOrderbookKey(market))
    if (!data) {
        return {
            bids: {},
            asks: {},
            lastTradedPrice: 0,
            indexPrice: 0
        }
    }
    return JSON.parse(data)
}

 export async function saveOrderbook(market: string, orderbook: Orderbook) {
    await client.set(getOrderbookKey(market), JSON.stringify(orderbook))
}

function getBalanceKey(userId: string) {
    return `balance:${userId}`
}

export async function getBalance(userId: string) {
    let data = await client.get(getBalanceKey(userId))
    if (!data) {
        let initial = { available: 100000, locked: 0 }
        await client.set(getBalanceKey(userId), JSON.stringify(initial))
        return initial
    }
    return JSON.parse(data)
}

 export async function updateBalance(userId: string, margin: number) {
    let balance = await getBalance(userId)
    if (balance.available < margin) {
        throw new Error("Insufficient balance")
    }
    balance.available -= margin
    balance.locked += margin
    await client.set(getBalanceKey(userId), JSON.stringify(balance))
}

 export async function getPositions(userId: string): Promise<position[]> {
    let data = await client.get(getPositionKey(userId))
    if (!data) return []
    return JSON.parse(data)
}

 export async function savePositions(userId: string, positions: position[]) {
    await client.set(getPositionKey(userId), JSON.stringify(positions))
}

 export async function updatePosition(
    userId: string,
    market: string,
    type: "LONG" | "SHORT",
    qty: number,
    executionPrice: number,
    margin: number
) {
    let positions = await getPositions(userId)
    let existing = positions.find((p) => p.market === market && p.type === type)
    if (!existing) {
        positions.push({
            market,
            type,
            qty,
            margin,
            liquidationPrice: 0,
            averagePrice: executionPrice
        })
    } else {
        let totalQty = existing.qty + qty
        existing.averagePrice = (
            existing.qty * existing.averagePrice +
            qty * executionPrice
        ) / totalQty
        existing.qty = totalQty
        existing.margin += margin
    }
    await savePositions(userId, positions)
}

// dude this adds orders to the book that dont fill
export function addToBook(orderbook: Orderbook, incomingOrder: order, userId: string, remainingQty: number) {
    let side = incomingOrder.type === "LONG"
        ? orderbook.bids
        : orderbook.asks
    let priceKey = incomingOrder.price.toString()

    if (!side[priceKey]) {
        side[priceKey] = {
            availableQty: 0,
            openOrders: []
        }
    }

    side[priceKey].availableQty += remainingQty

    side[priceKey].openOrders.push({
        userId,
        qty: remainingQty,
        filledQty: 0,
        orderId: incomingOrder.orderId!,
        createdAt: new Date(),
        status: "open"
    })
}