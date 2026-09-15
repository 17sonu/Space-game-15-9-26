import mongoose from "mongoose";

const scoreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 20
    },
    score: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Score", scoreSchema);
