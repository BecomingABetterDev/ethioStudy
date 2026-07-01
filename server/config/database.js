const mongoose = require("mongoose");

const connectDB = async() => {
    // 1. Grab the raw value coming from Render or local fallback
    let uri = process.env.MONGODB_URI;

    if (!uri) {
        uri = "mongodb://localhost:27017/ethiostudy";
    } else {
        // 2. THE SANITIZATION SHIELD
        // Automatically strips hidden clipboard characters, quotes, or whitespace
        uri = uri.trim(); // Removes outer spaces, tabs, or newlines
        uri = uri.replace(/^["']|["']$/g, ""); // Removes accidental wrapping quotes
        uri = uri.replace(/[\u200B-\u200D\uFEFF]/g, ""); // Cleans invisible zero-width web characters
    }

    try {
        // 3. Connect using sanitized URI (Removed deprecated Mongoose v5 options)
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log(`✅ MongoDB connected: ${conn.connection.host}`);

        // Your original lifecycle listeners remain perfectly intact here:
        mongoose.connection.on("disconnected", () => {
            console.warn("⚠️  MongoDB disconnected. Attempting to reconnect...");
        });

        mongoose.connection.on("reconnected", () => {
            console.log("✅ MongoDB reconnected");
        });

        mongoose.connection.on("error", (err) => {
            console.error("MongoDB connection error:", err.message);
        });
    } catch (error) {
        console.error(`❌ MongoDB connection failed: ${error.message}`);
        console.error("Make sure MongoDB is running: mongod --dbpath /data/db");
        process.exit(1);
    }
};

module.exports = connectDB;