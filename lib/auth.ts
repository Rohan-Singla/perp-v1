import type { NextFunction, Request, Response } from "express";
import jwt from 'jsonwebtoken';

export interface TokenPayload {
    userId : string
}

export function middleware (req : Request,res : Response , next : NextFunction){
    const header = req.headers['authorization'];

    const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : undefined;

    if(!token){
        return res.status(401).json({error : "Invalid Token"})
    }

    try {
        
    const payload = jwt.verify(token,process.env.JWT_SECRET!) as TokenPayload;
    
    // @ts-ignore
    req.userId = payload.userId;

    next();

    } catch (error) {
        return res.status(401).json({error : error})
    }   

}   