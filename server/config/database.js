const mongoose = require("mongoose");

const connectDB = async() => {
    try {
        const conn = await mongoose.connect(
            process.env.MONGODB_URI || "mongodb://localhost:27017/ethiostudy", {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            }
        );

        console.log(`✅ MongoDB connected: ${conn.connection.host}`);

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