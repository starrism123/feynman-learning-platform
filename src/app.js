const express = require("express");

function createApp() {
  const app = express();

  app.get("/", (req, res) => {
    res.send("Hello, Feynman Learner!");
  });

  app.get("/user", (req, res) => {
    res.json({
      name: process.env.STUDENT_NAME || "YourName",
      major: process.env.STUDENT_MAJOR || "YourMajor",
    });
  });

  app.get("/health", (req, res) => {
    res.json({ success: true, data: { status: "ok" } });
  });

  return app;
}

module.exports = { createApp };
