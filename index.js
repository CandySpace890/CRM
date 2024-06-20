const express = require("express");
const app = express();
const createPool = require("./db"); // Import createPool function from db.js

// MySQL pool configuration
const db = createPool();

// Middleware to parse JSON bodies
app.use(express.json());

// Import API routes
const userRoutes = require("./services/login");
const feedbackRoutes = require("./services/feedback");
const fileUploadRoutes = require("./services/fileupload");

// Use API routes
app.use("/api", userRoutes);
app.use("/api", feedbackRoutes);
app.use("/api", fileUploadRoutes);

// Handle MySQL connection errors
db.on('error', (err) => {
    console.error('MySQL pool error:', err.message);
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
