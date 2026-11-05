import "dotenv/config";
import mongoose from "mongoose";

export const mongoUrl = process.env.MONGODB_URI;

if (!mongoUrl) {
  throw new Error("MONGODB_URI is not set. Add it to your .env file.");
}

export const dbName = new URL(mongoUrl).pathname.slice(1) || "time-drop";

// Vite re-runs this module on every change in development, so only connect once.
if (mongoose.connection.readyState === 0) {
  mongoose
    .connect(mongoUrl, { dbName })
    .then(indexSessions)
    .catch((error) => {
      console.error("Failed to set up MongoDB", error);
    });
}

// Shopify's MongoDB session storage doesn't index its collection, but a session
// is looked up by id on every admin and app proxy request.
function indexSessions() {
  return mongoose.connection.collection("shopify_sessions").createIndexes([
    { key: { id: 1 }, unique: true },
    { key: { shop: 1 } },
  ]);
}

export default mongoose;
