import { client } from "../../redis-client";
import type { collateral } from "../../types";

export async function fetchBalance(userId:string) {
    const userBalance = await client.get(`collateral:${userId}`);

    if(userBalance){

        const balance : collateral = JSON.parse(userBalance);

        return balance;

    }else{
        return {error : "No user balance found please go to /onramp"};
    }

}