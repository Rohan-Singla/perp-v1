import type { collateral } from "../../types";
import { getBalance, setBalance } from "./lib";

export async function onramp(userId: string) {
    const collateral: collateral = await getBalance(userId);

    collateral.available += 10000;
    
    await setBalance(userId, collateral);
    return collateral;
}
