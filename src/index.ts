import express from "express";
import type { Authuser } from "../types";
import { prisma } from "../lib/prisma-client";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { middleware } from "../lib/auth";
import { onramp } from "./engine/onramp";
import { matchOrder } from "./engine/order";
import { fetchBalance } from "./engine/fetchBalance";
import { deleteOrder } from "./engine/deleteOrder";
import { fetchOpenPositions, fetchClosedPositions } from "./engine/fetchPositions";
import { fetchOpenOrders, fetchOrders } from "./engine/fetchOrders";
import { fetchFills } from "./engine/fetchFills";
import { startBinancePriceFeed } from "./engine/binancePriceFeed";
import { liquidationChecks } from "./engine/liquidation";
import { loadOrderbook, saveOrderbook } from "./engine/lib";

const app = express();
app.use(express.json());

function handleError(res : express.Response,error : unknown) {
    return res.status(400).json(
        { error: error }
    
    );
}

app.post("/signup", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: "Username or Password is missing"
        });
    }

    const already_exists = await prisma.user.findUnique({
        where: { username }
    });

    if (already_exists) {
        return res.status(400).json({
            error: "Username already exists !!"
        });
    }

    const hashedpassword = await bcrypt.hash(password, 10);

    const user: Authuser = await prisma.user.create({
        data: {
            username,
            password: hashedpassword
        }
    });

    const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
    );

    return res.json({ user, token });
});


app.post("/signin", async (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(401).json({ error: "Username or Password is missing !!" });
    }

    const checkuser = await prisma.user.findUnique({
        where: {
            username: username
        }
    });

    if (!checkuser) {
        return res.status(401).json({ error: "User doesn't exist !" })
    };

    const iscorrect = await bcrypt.compare(password, checkuser.password);

    if (iscorrect) {
        const token = jwt.sign(
            { userId: checkuser.id },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );

        return res.json({ token: token })
    } else {
        return res.status(401).json({ error: "Credentials are not correct !!" })
    }

});

app.post("/onramp", middleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;
    try {
        const result = await onramp(userId);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
});

app.post("/order", middleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;
    const orderData = req.body;

    try {
        const result = await matchOrder(userId, orderData);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
});

app.delete("/order/:orderId", middleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;
    const orderId = req.params.orderId;

    if (!orderId) {
        return res.status(400).json({
            error: "Order Id is missing"
        });
    }

    try {
        const result = await deleteOrder(userId, orderId);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
});

app.get("/equity/available", middleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;

    const result = await fetchBalance(userId);
    return res.json(result);
});

app.get("/positions/open/:marketId", middleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;
    const marketId = req.params.marketId;

    if (!marketId) {
        return res.status(400).json({ error: "marketId is required" });
    }

    try {
        if(marketId){
            const positions = await fetchOpenPositions(userId, marketId);
            return res.json(positions);
        }
    } catch (error) {
        return handleError(res, error);
    }
});

app.get("/positions/closed/:marketId", middleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;
    const marketId = req.params.marketId;
    if (!marketId) {
        return res.status(400).json({ error: "marketId is required" });
    }

    try {
        const positions = await fetchClosedPositions(userId, marketId);
        return res.json(positions);
    } catch (error) {
        return handleError(res, error);
    }
});

app.get("/orders/open/:marketId", middleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;
    const marketId = req.params.marketId;
    if (!marketId) {
        return res.status(400).json({ error: "marketId is required" });
    }

    try {
        const orders = await fetchOpenOrders(userId, marketId);
        return res.json(orders);
    } catch (error) {
        return handleError(res, error);
    }
});

app.get("/orders/:marketId", middleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;
    const marketId = req.params.marketId;
    if (!marketId) {
        return res.status(400).json({ error: "marketId is required" });
    }

    try {
        const orders = await fetchOrders(userId, marketId);
        return res.json(orders);
    } catch (error) {
        return handleError(res, error);
    }
});

app.get("/fills", middleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;

    try {
        const fills = await fetchFills(userId);
        return res.json(fills);
    } catch (error) {
        return handleError(res, error);
    }
});

app.get("/market/:marketId/price", async (req, res) => {
    const marketId = req.params.marketId;
    try {
        const orderbook = await loadOrderbook(marketId);
        return res.json({
            market: marketId,
            indexPrice: orderbook.indexPrice,
            lastTradedPrice: orderbook.lastTradedPrice,
        });
    } catch (error) {
        return handleError(res, error);
    }
});

async function onPriceUpdateFromBinance(market: string, price: number) {
    const orderbook = await loadOrderbook(market);
    orderbook.indexPrice = price;
    await saveOrderbook(market, orderbook);

    await liquidationChecks(market, price);
}

app.listen(3000, () => {
    console.log(`Server is running on port : 3000`);
    startBinancePriceFeed(onPriceUpdateFromBinance);
});
