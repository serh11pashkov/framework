import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    device: { type: String, required: true, trim: true },
    status: { type: String, required: true, enum: ["on", "off"] },
    room: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    image: { type: String, default: null },
    power: { type: String, default: null },
  },
  {
    versionKey: false,
    timestamps: false,
  },
);

export const createItemModel = () =>
  mongoose.models.Item ?? mongoose.model("Item", itemSchema);
