const express = require("express");
const path = require("path");
const session = require("express-session");
require("dotenv").config();

const app = express();

// Middleware
// Set up session management
app.use(
  session({
    secret: "xiutao-dogwalk-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  }),
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "/public")));

// Routes
const walkRoutes = require("./routes/walkRoutes");
const userRoutes = require("./routes/userRoutes");

app.use("/api/walks", walkRoutes);
app.use("/api/users", userRoutes);

// Export the app instead of listening here
module.exports = app;
