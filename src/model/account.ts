import * as mongoose from "mongoose";
import validator from "validator";

const AccountSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "A username is required"],
      trim: true,
      unique: [true, "This username is already in use"],
      minLength: [4, "A username should contain 4 or more characters"],
    },
    email: {
      type: String,
      required: [true, "An email is required"],
      unique: [true, "This email is already in use"],
      validate: [validator.isEmail, "Invalid email"],
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "A password is required"],
      minLength: [6, "A password should be 6 characters or more"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: { type: Number },
    verificationExpiry: { type: Date },
    resetCode: { type: Number, default: null },
    resetExpiry: { type: Date, default: null },
    deleteAccountCode: { type: Number },
    deleteAccountExpiry: { type: Date },
    resetToken: { type: String },
    refreshToken: [
      {
        token: { type: String },
        expiry: { type: Date },
      },
    ],
  },
  { timestamps: true },
);

const AccountModel = mongoose.model("Id", AccountSchema);

export default AccountModel;
