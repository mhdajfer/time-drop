import "dotenv/config";
import mongoose from "mongoose";

export const mongoUrl = process.env.MONGODB_URI;

if (!mongoUrl) {
  throw new Error("MONGODB_URI is not set. Add it to your .env file.");
}

export const dbName = new URL(mongoUrl).pathname.slice(1) || "time-drop";

// Vite re-runs this module on every change in development, so only connect once.
if (mongoose.connection.readyState === 0) {
  mongoose.connect(mongoUrl, { dbName }).catch((error) => {
    console.error("Failed to connect to MongoDB", error);
  });
}

export default mongoose;
