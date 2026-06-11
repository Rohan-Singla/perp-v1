# perps-v1-boilerplate

## Prerequisites

1. **Bun** — [bun.sh](https://bun.sh)
2. **Redis** — `brew install redis && brew services start redis` (or Docker: `docker run -d -p 6379:6379 redis`)
3. **PostgreSQL** — local or hosted
4. **`.env`** in project root:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/perps
JWT_SECRET=your-secret-key
```

## Setup (first time)

```bash
bun install
bunx prisma migrate dev
bunx prisma generate
```

## Run

```bash
bun run dev
```

You should see:

```
Server is running on port : 3000
Starting Binance price feed (REST polling every 1s)...
[Binance] SOL mark price: 65.04
[Binance] ETH mark price: ...
[Binance] BTC mark price: ...
```

## Verify Binance prices

**Terminal** — first price per market logs on startup (see above).

**HTTP** (no auth):

```bash
curl http://localhost:3000/market/SOL/price
```

**Redis**:

```bash
redis-cli GET orderbook:SOL
```

`indexPrice` should be non-zero and update over time.

## Test the full flow

```bash
# 1. Sign up
curl -X POST http://localhost:3000/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'

# 2. Sign in (save the token)
curl -X POST http://localhost:3000/signin \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'

# 3. Onramp collateral (+10000)
curl -X POST http://localhost:3000/onramp \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Place a limit order
curl -X POST http://localhost:3000/order \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"market":"SOL","type":"LONG","qty":1,"margin":100,"orderType":"limit","price":50}'

# 5. Check balance / positions
curl http://localhost:3000/equity/available -H "Authorization: Bearer YOUR_TOKEN"
curl http://localhost:3000/positions/open/SOL -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No price logs | Check internet; `curl https://fapi.binance.com/fapi/v1/premiumIndex?symbol=SOLUSDT` |
| Redis errors | Start Redis: `redis-cli ping` → `PONG` |
| DB errors | Check `DATABASE_URL`, run `bunx prisma migrate dev` |
| Port in use | Kill old server or change port in `src/index.ts` |
