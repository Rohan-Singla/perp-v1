import express from "express";
import type { Authuser } from "../types";
import { prisma } from "../lib/prisma-client";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
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

 })

app.post("/onramp", (req, res) => { })

app.post("/order", (req, res) => { })
app.delete("/order", (req, res) => { })
app.get("/equity/available", (req, res) => { })
app.get("/positions/open/:marketId", (req, res) => { });
app.get("/positions/closed/:marketId", (req, res) => { });
app.get("/orders/open/:marketId", (req, res) => { })
app.get("/orders/:marketId", (req, res) => { })
app.get("/fills", (req, res) => { });

async function liqudationChecks(asset: string, price: number) {

}


async function onPriceUpdateFromBinance(asset: string, price: number) {
    liqudationChecks(asset, price);
}

app.listen(3000, () => {
    console.log(`Server is running on port : 3000`)
})