require("dotenv").config();
const app = require("./app");
const { connectDB } = require("./config/db");

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`SAMS API running on port ${PORT}`);
  });
}
/*app.get('/api/seed-now', async (req, res) => {
  try {
    const seedDatabase = require('./seed');
    await seedDatabase();
    res.json({ success: true, message: 'Seeded successfully!' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});*/
start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
