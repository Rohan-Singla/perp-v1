import express from "express";

const app = express();
app.use(express.json());

app.post("/signup", (req, res) => {

    const {username,password } = req.body;

    
    
});


app.post("/signin", (req, res) => {})
app.post("/onramp", (req, res) => {})
app.post("/order", (req, res) => {})
app.delete("/order", (req, res) => {})
app.get("/equity/available", (req, res) => {})
app.get("/positions/open/:marketId", (req, res) => {});
app.get("/positions/closed/:marketId", (req, res) => {});
app.get("/orders/open/:marketId", (req, res) => {})
app.get("/orders/:marketId", (req, res) => {})
app.get("/fills", (req, res) => {});

async function liqudationChecks(asset: string, price: number) {

}


async function onPriceUpdateFromBinance(asset: string, price: number) {
    liqudationChecks(asset, price);   
}
