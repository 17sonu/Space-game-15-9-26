import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Score from "./models/Score.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || "https://space-game-frontend.vercel.app/"
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Space Shooter API is running"
  });
});

app.get("/api/scores", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 100);

    const scores = await Score.find()
      .sort({ score: -1, createdAt: 1 })
      .limit(limit)
      .lean();

    res.json(scores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch scores" });
  }
});

app.post("/api/scores", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const score = Number(req.body.score);

    if (!name) {
      return res.status(400).json({ message: "Player name is required" });
    }

    if (name.length > 20) {
      return res.status(400).json({ message: "Player name must be 20 characters or less" });
    }

    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({ message: "Valid score is required" });
    }

    const newScore = await Score.create({
      name,
      score: Math.floor(score)
    });

    res.status(201).json(newScore);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to save score" });
  }
});

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing. Create backend/.env from .env.example");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Startup error:", error.message);
    process.exit(1);
  }
}

startServer();
