export type Bid = {
    availableQty: number,
    openOrders: { userId: number, qty: number, filledQty: number, orderId: number, createdAt: Date }[]
}

export type Orderbook = {
    bids: Record<string, Bid>,
    asks: Record<string, Bid>,
    lastTradedPrice: number,
    indexPrice: number
}

export type User = {
    authUser : Authuser,
    tradingAccount : TradingAccount
}

export type Authuser = {
    userId ?: string,
    username : string,
    password : string,
}

export type TradingAccount = {
    collateral : collateral,
    positions : position[],
    orders : order[]
}

export type collateral = {
    available : number,
    locked : number,
}

export type position = {
    market : string,
    type : "LONG" | "SHORT",
    qty : number,
    margin : number,
    liquidationPrice : number,
    averagePrice : number
}

export type order = {
    orderId : string,
    market : string,
    type : "LONG" | "SHORT",
    qty : number,
    margin : number,
    orderType : "market" | "limit",
    price : number,
    status : "open" | "filled" | "cancelled"
}

export type Orderbooks = Record<string, Orderbook>