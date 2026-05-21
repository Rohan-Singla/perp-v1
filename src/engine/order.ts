import { randomUUID } from "crypto"
import { client } from "../../redis-client"
import type { order, } from "../../types"
import { addToBook, loadOrderbook, saveOrderbook, updateBalance, updatePosition } from "./lib";


export async function matchOrder(userId: string, incomingOrder: order) {

    incomingOrder.orderId = randomUUID();

    incomingOrder.status = "pending"

    let orderbook = await loadOrderbook(incomingOrder.market)

    await updateBalance(userId, incomingOrder.margin)

    let remainingQty = incomingOrder.qty

    let oppositeBook = incomingOrder.type === "LONG"
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

            if (incomingOrder.type === "LONG"){
                return price <= incomingOrder.price
            } 
            
            return price >= incomingOrder.price

        })
    }

    for (let price of prices) {

        if (remainingQty <= 0) {

            break
        }
            
        let bucket = oppositeBook[price]

        if (!bucket){ continue }

        for (let existingOrder of bucket.openOrders) {

            if (remainingQty <= 0) break

            let remainingOrderQty = existingOrder.qty - existingOrder.filledQty

            if (remainingOrderQty <= 0) continue

            let executedQty = Math.min(remainingQty, remainingOrderQty)

            existingOrder.filledQty += executedQty

            if (existingOrder.filledQty === existingOrder.qty) {

                existingOrder.status = "filled"

            } else {

                existingOrder.status = "partially-filled"
                
            }

            remainingQty -= executedQty
            bucket.availableQty -= executedQty
            orderbook.lastTradedPrice = price

            await updatePosition(
                userId,
                incomingOrder.market,
                incomingOrder.type,
                executedQty,
                price,
                incomingOrder.margin
            )

            await updatePosition(
                existingOrder.userId,
                incomingOrder.market,
                incomingOrder.type === "LONG" ? "SHORT" : "LONG",
                executedQty,
                price,
                incomingOrder.margin
            )
        }

        // Remove filled orders
        bucket.openOrders = bucket.openOrders.filter(o => o.filledQty < o.qty)
        if (bucket.availableQty <= 0) {
            delete oppositeBook[price]
        }
    }

    let filledQty = incomingOrder.qty - remainingQty

    if (filledQty === 0) {

        if (incomingOrder.orderType === "market") {

            incomingOrder.status = "rejected"

        } else {

            incomingOrder.status = "open"

            addToBook(orderbook, incomingOrder, userId, remainingQty)
        }
    } else if (remainingQty > 0) {

        if (incomingOrder.orderType === "market") {
            
            incomingOrder.status = "partially-filled"

        } else {

            incomingOrder.status = "partially-filled"

            addToBook(orderbook, incomingOrder, userId, remainingQty)
        }
    } else {
        
        incomingOrder.status = "filled"

    }

    await saveOrderbook(incomingOrder.market, orderbook)
    
    await client.set(`order:${incomingOrder.orderId}`, JSON.stringify(incomingOrder))

    return {
        success: true,
        order: incomingOrder,
        filledQty,
        remainingQty,
        orderbook
    }
}