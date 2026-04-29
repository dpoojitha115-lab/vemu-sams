const mongoose = require("mongoose");

async function connectDB() {
  const nongoUri = process.env.MONGO_URL ||"mongo://127.0.0.1:27017/vemu-sams";
  /*const mongoUri = process.env.MONGO_URI;
  mongoose.set("strictQuery", true);*/
  mongoose.set("strictQuery",true);
  await mongoose.connect(mongoUri);
  return mongoose.connection;
}

module.exports = { connectDB };
