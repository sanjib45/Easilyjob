import multer from "multer";
import { env } from "../config/env.js";

export const notFoundHandler = (req, res) => {
  res.status(404).render("404", { title: "Page not found" });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong.";

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? `That file is too large. Max size is ${env.upload.maxSizeMb}MB.`
        : "There was a problem with your file upload.";
  } else if (!err.isOperational) {
    // Unexpected/programmer error: never leak internals to the client.
    console.error("Unexpected error:", err);
    if (statusCode < 400 || statusCode >= 500) statusCode = 500;
    message = env.isProd ? "Something went wrong on our end. Please try again later." : message;
  }

  if (res.headersSent) return;

  res.status(statusCode).render("error", {
    title: "Error",
    statusCode,
    message,
    stack: env.isProd ? null : err.stack,
  });
};
