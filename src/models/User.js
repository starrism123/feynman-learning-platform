const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

userSchema.set("toJSON", {
  transform(doc, result) {
    delete result.password;
    delete result.__v;
    return result;
  },
});

module.exports = mongoose.model("User", userSchema);
