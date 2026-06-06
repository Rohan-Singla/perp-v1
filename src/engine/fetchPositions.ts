import { getClosedPositions, getPositions } from "./lib";

export async function fetchOpenPositions(userId: string, marketId: string | string[]) {
    const positions = await getPositions(userId);
    return positions.filter(
        (p) => p.market === marketId && p.qty > 0
    );
}

export async function fetchClosedPositions(userId: string, marketId: string | string[]) {
    const positions = await getClosedPositions(userId);
    return positions.filter((p) => p.market === marketId);
}
