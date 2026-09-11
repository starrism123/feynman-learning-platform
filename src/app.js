const express = require("express");
const cors = require("cors");
const { register, login } = require("./controllers/userController");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { userRoutes } = require("./routes/userRoutes");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

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

  app.use("/api/users", userRoutes);
  app.post("/api/register", register);
  app.post("/api/login", login);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
