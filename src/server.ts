import express from "express";
import dotenv from "dotenv";

dotenv.config();

import { connectDB } from "./config/database";

connectDB();

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("SYNQ Backend Running 🚀");
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
});
