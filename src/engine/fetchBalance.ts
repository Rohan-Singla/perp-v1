import type { collateral } from "../../types";
import { getBalance } from "./lib";

export async function fetchBalance(userId: string) {
    const balance: collateral = await getBalance(userId);

    if (balance.available === 0 && balance.locked === 0) {
        return { error: "No user balance found please go to /onramp" };
    }

    return balance;
}
