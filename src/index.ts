import express from "express";
import type { Authuser } from "../types";
import { prisma } from "../lib/prisma-client";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { middleware } from "../lib/auth";
import { onramp } from "./engine/onramp";
import { matchOrder } from "./engine/order";
import { fetchBalance } from "./engine/fetchBalance";

const app = express();
app.use(express.json());


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

    const token = jwt.sign(
        { username: username },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
    );

    const user: Authuser = await prisma.user.create({
        data: {
            username,
            password: hashedpassword
        }
    });

    return res.json({user : user, token : token});
});


app.post("/signin", async (req, res) => {

    const {username , password } = req.body;

    if(!username || !password){
        return res.status(401).json({error : "Username or Password is missing !!"});
    }

    const checkuser = await prisma.user.findUnique({
        where : {
            username : username
        }
    });

    if(!checkuser){
        return res.status(401).json({error : "User doesn't exist !"})
    };

    const iscorrect = await bcrypt.compare(password , checkuser.password);

    if(iscorrect){
        const token = jwt.sign(
            { username : username },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );

        return res.json({token : token})
    }else{
        return res.status(401).json({error : "Credentials are not correct !!"})
    }

 });

app.post("/onramp", middleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;

    const result = await onramp(userId);

    return res.json(result);
 });

app.post("/order", middleware, async (req, res) => { 
    // @ts-ignore
    const userId = req.userId;

    const orderData = req.body;

    const result =  await matchOrder(userId,orderData);

    return res.json(result);

});

app.delete("/order/:orderId",middleware, (req, res) => { 
    
})
app.get("/equity/available", middleware,async (req, res) => { 
    // @ts-ignore
    const userId  = req.userId;

    const result = await fetchBalance(userId);

    return res.json(result);

})
app.get("/positions/open/:marketId", middleware,(req, res) => { });
app.get("/positions/closed/:marketId", middleware,(req, res) => { });
app.get("/orders/open/:marketId", middleware,(req, res) => { })
app.get("/orders/:marketId", middleware,(req, res) => { })
app.get("/fills", middleware,(req, res) => { });

async function liqudationChecks(asset: string, price: number) {

}


async function onPriceUpdateFromBinance(asset: string, price: number) {
    liqudationChecks(asset, price);
}

app.listen(3000, () => {
    console.log(`Server is running on port : 3000`)
})