import { client } from "../../redis-client"
import type { collateral, Fill, order, Orderbook, position } from "../../types"

function getOrderbookKey(market: string) {
    return `orderbook:${market}`
}

function getPositionKey(userId: string) {
    return `positions:${userId}`
}

function getClosedPositionKey(userId: string) {
    return `closed_positions:${userId}`
}

export function getCollateralKey(userId: string) {
    return `collateral:${userId}`
}

function getUserOrdersKey(userId: string) {
    return `user_orders:${userId}`
}

function getUserFillsKey(userId: string) {
    return `fills:${userId}`
}

export async function loadOrderbook(market: string): Promise<Orderbook> {
    const data = await client.get(getOrderbookKey(market))
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

export async function getBalance(userId: string): Promise<collateral> {
    const data = await client.get(getCollateralKey(userId))
    if (!data) {
        return { available: 0, locked: 0 }
    }
    return JSON.parse(data)
}

export async function setBalance(userId: string, balance: collateral) {
    await client.set(getCollateralKey(userId), JSON.stringify(balance))
}

export async function updateBalance(userId: string, margin: number) {
    const balance = await getBalance(userId)
    if (balance.available < margin) {
        throw new Error("Insufficient balance")
    }
    balance.available -= margin
    balance.locked += margin
    await setBalance(userId, balance)
}

export async function unlockBalance(userId: string, margin: number) {
    const balance = await getBalance(userId)
    balance.locked = Math.max(0, balance.locked - margin)
    balance.available += margin
    await setBalance(userId, balance)
}

export async function getPositions(userId: string): Promise<position[]> {
    const data = await client.get(getPositionKey(userId))
    if (!data) return []
    return JSON.parse(data)
}

export async function savePositions(userId: string, positions: position[]) {
    await client.set(getPositionKey(userId), JSON.stringify(positions))
}

export async function getClosedPositions(userId: string): Promise<position[]> {
    const data = await client.get(getClosedPositionKey(userId))
    if (!data) return []
    return JSON.parse(data)
}

export async function saveClosedPositions(userId: string, positions: position[]) {
    await client.set(getClosedPositionKey(userId), JSON.stringify(positions))
}

export async function updatePosition(
    userId: string,
    market: string,
    type: "LONG" | "SHORT",
    qty: number,
    executionPrice: number,
    margin: number
) {
    const positions = await getPositions(userId)
    
    const existing = positions.find((p) => p.market === market && p.type === type)
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
        const totalQty = existing.qty + qty
        existing.averagePrice = (
            existing.qty * existing.averagePrice +
            qty * executionPrice
        ) / totalQty
        existing.qty = totalQty
        existing.margin += margin
    }
    await savePositions(userId, positions)
}

export function addToBook(orderbook: Orderbook, incomingOrder: order, userId: string, remainingQty: number) {
    const side = incomingOrder.type === "LONG"
        ? orderbook.bids
        : orderbook.asks
    const priceKey = incomingOrder.price.toString()

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

export async function saveOrder(order: order) {
    await client.set(`order:${order.orderId}`, JSON.stringify(order))
}

export async function getOrder(orderId: string): Promise<order | null> {
    const data = await client.get(`order:${orderId}`)
    if (!data) return null
    return JSON.parse(data)
}

export async function addUserOrder(userId: string, orderId: string) {
    const key = getUserOrdersKey(userId)
    const data = await client.get(key)
    const orderIds: string[] = data ? JSON.parse(data) : []
    if (!orderIds.includes(orderId)) {
        orderIds.push(orderId)
        await client.set(key, JSON.stringify(orderIds))
    }
}

export async function getUserOrderIds(userId: string): Promise<string[]> {
    const data = await client.get(getUserOrdersKey(userId))
    if (!data) return []
    return JSON.parse(data)
}

export async function getUserOrders(userId: string): Promise<order[]> {
    const orderIds = await getUserOrderIds(userId)
    const orders: order[] = []
    for (const orderId of orderIds) {
        const o = await getOrder(orderId)
        if (o) orders.push(o)
    }
    return orders
}

export async function recordFill(fill: Fill) {
    for (const userId of [fill.makerUserId, fill.takerUserId]) {
        const key = getUserFillsKey(userId)
        const data = await client.get(key)
        const fills: Fill[] = data ? JSON.parse(data) : []
        fills.push(fill)
        await client.set(key, JSON.stringify(fills))
    }
}

export async function getUserFills(userId: string): Promise<Fill[]> {
    const data = await client.get(getUserFillsKey(userId))
    if (!data) return []
    return JSON.parse(data)
}
