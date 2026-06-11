import { liquidatePosition } from "./closePosition"
import { getPositions, getUsersWithOpenPositions } from "./lib"

export async function liquidationChecks(market: string, price: number) {
    const userIds = await getUsersWithOpenPositions(market)

    for (const userId of userIds) {
        const positions = await getPositions(userId)
        const openOnMarket = positions.filter(
            (p) => p.market === market && p.qty > 0
        )

        for (const pos of openOnMarket) {
            const shouldLiquidate =
                (pos.type === "LONG" && price <= pos.liquidationPrice) ||
                (pos.type === "SHORT" && price >= pos.liquidationPrice)

            if (shouldLiquidate) {
                await liquidatePosition(userId, pos, price)
                console.log(
                    `Liquidated ${pos.type} ${pos.qty} ${market} for user ${userId} at ${price}`
                )
            }
        }
    }
}
