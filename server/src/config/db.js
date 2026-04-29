/*const mongoose = require("mongoose");

async function connectDB() {
  const nongoUri = process.env.MONGO_URL;
  console.log("connecting to:", mongoUri); *///||"mongo://127.0.0.1:27017/vemu-sams";//
  /*const mongoUri = process.env.MONGO_URI;
  mongoose.set("strictQuery", true);*/
  /*mongoose.set("strictQuery",true);
  await mongoose.connect(mongoUri);
  return mongoose.connection;
}

module.exports = { connectDB };*/
/*const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

module.exports = connectDB;*/
/*const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI; //|| "mongodb://127.0.0.1:27017/vemu-sams";//
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  return mongoose.connection;
};

module.exports =  { connectDB };*/
const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  console.log("MONGO_URI:", mongoUri ? "found" : "undefined");
  if (!mongoUri) {
    throw new Error("MONGO_URI environment variable is not set");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected!");
  return mongoose.connection;
};

module.exports = { connectDB };
