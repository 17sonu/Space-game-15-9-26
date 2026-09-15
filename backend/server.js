import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Score from "./models/Score.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://space-game-frontend.vercel.app",
    ],
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Space Shooter API is running",
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
    console.error("Fetch scores error:", error);
    res.status(500).json({
      message: "Failed to fetch scores",
    });
  }
});

app.post("/api/scores", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const score = Number(req.body.score);

    if (!name) {
      return res.status(400).json({
        message: "Player name is required",
      });
    }

    if (name.length > 20) {
      return res.status(400).json({
        message: "Player name must be 20 characters or less",
      });
    }

    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({
        message: "Valid score is required",
      });
    }

    const newScore = await Score.create({
      name,
      score: Math.floor(score),
    });

    res.status(201).json(newScore);
  } catch (error) {
    console.error("Save score error:", error);

    res.status(500).json({
      message: "Failed to save score",
    });
  }
});

// MongoDB connection
let mongoConnection;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (!mongoConnection) {
    mongoConnection = mongoose.connect(process.env.MONGO_URI);
  }

  await mongoConnection;
}

// Vercel serverless handler
export default async function handler(req, res) {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("Backend startup error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
}
