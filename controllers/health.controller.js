import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const live = (req, res) => {
  res.status(200).json({ status: "ok" });
};

export const ready = asyncHandler(async (req, res) => {
  await prisma.$runCommandRaw({ ping: 1 });
  res.status(200).json({ status: "ok", database: "mongodb" });
});
