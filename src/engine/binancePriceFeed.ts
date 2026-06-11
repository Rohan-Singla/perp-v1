import { MARKET_TO_SYMBOL } from "./markets"

const POLL_INTERVAL_MS = 1000
const loggedMarkets = new Set<string>()

async function fetchMarkPrice(symbol: string): Promise<number | null> {
    const res = await fetch(
        `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol.toUpperCase()}`
    )
    if (!res.ok) {
        throw new Error(`Binance API ${res.status} for ${symbol}`)
    }
    const data = (await res.json()) as { markPrice?: string }
    const price = Number(data.markPrice)
    return Number.isFinite(price) ? price : null
}

export function startBinancePriceFeed(
    onPrice: (market: string, price: number) => void | Promise<void>
) {
    console.log("Starting Binance price feed (REST polling every 1s)...")

    async function poll() {
        for (const [market, symbol] of Object.entries(MARKET_TO_SYMBOL)) {
            try {
                const price = await fetchMarkPrice(symbol)
                if (price === null) continue

                if (!loggedMarkets.has(market)) {
                    console.log(`[Binance] ${market} mark price: ${price}`)
                    loggedMarkets.add(market)
                }

                await Promise.resolve(onPrice(market, price)).catch((err) => {
                    console.error(`Price handler error for ${market}:`, err)
                })
            } catch (err) {
                console.error(`Failed to fetch ${market} price:`, err)
            }
        }
    }

    void poll()
    setInterval(() => {
        void poll()
    }, POLL_INTERVAL_MS)
}
