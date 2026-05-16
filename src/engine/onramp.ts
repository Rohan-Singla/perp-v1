import { client } from "../../redis-client";
import type { collateral } from "../../types";

export async function onramp(userId : string) {

    const key = `collateral:${userId}`

    const value = await client.get(key);

    let collateral : collateral;

    if(!value){

        collateral = {
            available : 0,
            locked : 0,
        }

    }else {
        collateral = JSON.parse(value);
    }

    collateral.available += 10000;

    await client.set(key,JSON.stringify(collateral));

    return collateral;

}