const mongoose = require("mongoose");

async function connectDB() {
  const fallbackMongoUri = process.env.MONGO_URI_LOCAL || "mongodb://127.0.0.1:27017/vemu-sams";
  const mongoUri = process.env.MONGO_URI || fallbackMongoUri;
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  return mongoose.connection;
}

module.exports = { connectDB };
