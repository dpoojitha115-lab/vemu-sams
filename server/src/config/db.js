const mongoose = require("mongoose");

async function connectDB() {
  
  const mongoUri = process.env.MONGO_URI;
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  return mongoose.connection;
}

module.exports = { connectDB };
