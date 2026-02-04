import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app=express();
app.use(express.json());
app.get("/",(req,res)=>{
    res.send("LLMObservatory backend running successfully");
});

app.listen(3000,()=>{
    console.log("Server is running on port 3000"); 
});