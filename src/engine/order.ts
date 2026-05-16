import { randomUUID } from "crypto";
import type { order } from "../../types";
import { client } from "../../redis-client";

export async function matchOrder(userId  : string , order : order){
    const key = `order:${userId}`;

    let create_order : order = {
        orderId : randomUUID(),
        market : order.market,
        type : order.type,
        qty : order.qty,
        margin : order.margin,
        orderType : order.orderType,
        price : order.price,
        status : order.status
    };

    await client.set(key,JSON.stringify(create_order));

    return create_order;

}