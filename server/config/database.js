const mongoose = require("mongoose");

const connectDB = async() => {
    // 1. CLEAR LOG TO PROVE THE NEW CODE IS RUNNING
    console.log("🛰️  ATTEMPTING PRODUCTION DATABASE CONNECTION ENGINE...");

    // 2. HARDCODED BYPASS (Eliminates Render dashboard environment bugs completely)
    const productionURI =
        "mongodb+srv://eyobdesalegn37:1FhVX5MFZb4DASLL@ethiostudy.oa6toei.mongodb.net/ethiostudy?retryWrites=true&w=majority";

    try {
        const conn = await mongoose.connect(productionURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log(`✅ MongoDB connected successfully: ${conn.connection.host}`);

        mongoose.connection.on("disconnected", () => {
            console.warn("⚠️  MongoDB disconnected. Reconnecting...");
        });
    } catch (error) {
        console.error(`❌ MongoDB connection failed: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;