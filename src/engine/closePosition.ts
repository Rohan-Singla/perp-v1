import type { closedPosition, position } from "../../types"
import {
    getBalance,
    getClosedPositions,
    getPositions,
    saveClosedPositions,
    savePositions,
    setBalance,
    syncMarketPositionIndex,
    unlockBalance,
} from "./lib"

export function calculateLiquidationPrice(
    pos: Pick<position, "type" | "qty" | "margin" | "averagePrice">
): number {
    if (pos.qty <= 0) return 0
    const marginPerUnit = pos.margin / pos.qty
    if (pos.type === "LONG") {
        return pos.averagePrice - marginPerUnit
    }
    return pos.averagePrice + marginPerUnit
}

function calculatePnl(
    type: "LONG" | "SHORT",
    averagePrice: number,
    closePrice: number,
    qty: number
): number {
    if (type === "LONG") {
        return (closePrice - averagePrice) * qty
    }
    return (averagePrice - closePrice) * qty
}

async function archiveClosedPosition(userId: string, closed: closedPosition) {
    const closedList = await getClosedPositions(userId)
    closedList.push(closed)
    await saveClosedPositions(userId, closedList)
}

export async function applyPositionFill(
    userId: string,
    market: string,
    fillType: "LONG" | "SHORT",
    qty: number,
    executionPrice: number,
    executionMargin: number,
    closeReason: "manual" | "liquidated" = "manual"
) {
    const positions = await getPositions(userId)
    const oppositeType = fillType === "LONG" ? "SHORT" : "LONG"
    const oppositeIdx = positions.findIndex(
        (p) => p.market === market && p.type === oppositeType
    )

    let remainingQty = qty
    let remainingMargin = executionMargin

    if (oppositeIdx >= 0) {
        const opposite = positions[oppositeIdx]!
        const closeQty = Math.min(remainingQty, opposite.qty)
        const marginReleased = (closeQty / opposite.qty) * opposite.margin
        const pnl = calculatePnl(opposite.type, opposite.averagePrice, executionPrice, closeQty)
        const closeMarginFromOrder = qty > 0 ? (closeQty / qty) * executionMargin : 0

        await archiveClosedPosition(userId, {
            market,
            type: opposite.type,
            qty: closeQty,
            margin: marginReleased,
            averagePrice: opposite.averagePrice,
            closePrice: executionPrice,
            pnl,
            closedAt: new Date(),
            closeReason,
        })

        await unlockBalance(userId, marginReleased + closeMarginFromOrder)

        const balance = await getBalance(userId)
        balance.available += pnl
        await setBalance(userId, balance)

        opposite.qty -= closeQty
        opposite.margin -= marginReleased

        if (opposite.qty <= 0) {
            positions.splice(oppositeIdx, 1)
        } else {
            opposite.liquidationPrice = calculateLiquidationPrice(opposite)
        }

        remainingQty -= closeQty
        remainingMargin -= closeMarginFromOrder
    }

    if (remainingQty > 0) {
        const sameIdx = positions.findIndex(
            (p) => p.market === market && p.type === fillType
        )

        if (sameIdx < 0) {
            const newPos: position = {
                market,
                type: fillType,
                qty: remainingQty,
                margin: remainingMargin,
                averagePrice: executionPrice,
                liquidationPrice: 0,
            }
            newPos.liquidationPrice = calculateLiquidationPrice(newPos)
            positions.push(newPos)
        } else {
            const existing = positions[sameIdx]!
            const totalQty = existing.qty + remainingQty
            existing.averagePrice =
                (existing.qty * existing.averagePrice + remainingQty * executionPrice) / totalQty
            existing.qty = totalQty
            existing.margin += remainingMargin
            existing.liquidationPrice = calculateLiquidationPrice(existing)
        }
    }

    await savePositions(userId, positions)
    await syncMarketPositionIndex(userId, market, positions)
}

export async function liquidatePosition(userId: string, pos: position, price: number) {
    const fillType = pos.type === "LONG" ? "SHORT" : "LONG"
    await applyPositionFill(userId, pos.market, fillType, pos.qty, price, 0, "liquidated")
}

export async function updatePosition(
    userId: string,
    market: string,
    type: "LONG" | "SHORT",
    qty: number,
    executionPrice: number,
    margin: number
) {
    await applyPositionFill(userId, market, type, qty, executionPrice, margin, "manual")
}
