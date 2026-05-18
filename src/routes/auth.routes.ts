import express from "express";
import type { Router } from "express";

import {
  register,
  verifyAccount,
  resendVerificationCode,
  login,
  logout,
  logoutAllRequest,
  logoutAll,
  refresh,
  forgotPassword,
  resetPasswordToken,
  resetPassword,
} from "../controller/auth.controller.ts";

const AuthRouter: Router = express.Router();

AuthRouter.post("/register", register);
AuthRouter.post("/verify", verifyAccount);
AuthRouter.post("/resend", resendVerificationCode);

AuthRouter.post("/login", login);
AuthRouter.post("/logout", logout);
AuthRouter.post("/request/logout-all", logoutAllRequest);
AuthRouter.post("/logout-all", logoutAll);

AuthRouter.post("/refresh", refresh);

AuthRouter.post("/forgot-password", forgotPassword);
AuthRouter.post("/reset-password-token", resetPasswordToken);
AuthRouter.post("/reset-password", resetPassword);

export default AuthRouter;
