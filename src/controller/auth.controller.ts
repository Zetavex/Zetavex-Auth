import type { Response, Request } from "express";
import wrapper from "../middlewares/asyncWrapper.middleware.ts";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import * as z from "zod";
import "dotenv/config";

import AccountModel from "../model/account.ts";
import Mailer from "../config/mail.ts";
import AccountZodObject from "../global/zod.validation.object.ts";
import logger from "../middlewares/logger.ts";
import {
  accountNotFoundHandler,
  accountNotVerified,
  incorrectPassword,
  validationErrorHandler,
} from "../middlewares/constollers.error.handlers.ts";
import type { safeParseResult } from "../global/types.ts";

const mailer: Mailer = new Mailer();

const register = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const result: safeParseResult<{
      username?: string;
      email: string;
      password: string;
    }> = AccountZodObject.safeParse(req.body);

    if (!result.success) return validationErrorHandler(res, result);

    const {
      username,
      email,
      password,
    }: {
      username?: string;
      email: string;
      password: string;
    } = result.data;

    const salt: number = 10;
    const hashedPassword: string = await bcrypt.hash(
      password !== undefined ? password : "",
      salt,
    );

    const code: number = crypto.randomInt(100000, 999999);
    const expiry: Date = new Date(Date.now() + 10 * 60 * 1000);

    const user = {
      username: username?.trim(),
      email: email?.toLowerCase(),
      password: hashedPassword,
      verificationCode: code,
      verificationExpiry: expiry,
    };

    const newUser = new AccountModel(user);

    await newUser.save();

    await mailer.sendVerificationMail(email !== undefined ? email : "", code);

    return res.status(201).json({
      status: 201,
      message: "New verification code sent to email",
    });
  },
);

const resendVerificationCode = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const emailVerificationObject = AccountZodObject.pick({ email: true });
    const result: safeParseResult<{ email: string }> =
      emailVerificationObject.safeParse(req.body);

    if (!result.success) return validationErrorHandler(res, result);

    const email: string = result.data.email;

    const account = await AccountModel.findOne(
      { email },
      { __v: false, password: false },
    );

    if (!account) return accountNotFoundHandler(res, { email });

    if (account.isVerified) {
      logger.warn({ message: "Account already verified", account: email });

      return res.status(400).json({
        status: 400,
        message: "Account already verified",
      });
    }

    const code: number = crypto.randomInt(100000, 999999);
    const expiry: Date = new Date(Date.now() + 10 * 60 * 1000);

    account.verificationCode = code;
    account.verificationExpiry = expiry;

    await account.save();

    await mailer.sendVerificationMail(email !== undefined ? email : "", code);

    return res.status(200).json({
      status: 200,
      message: "New verification code sent to email",
    });
  },
);

const verifyAccount = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const codeValidation = z.object({
      code: z.coerce
        .number("Invalid verification code")
        .min(6, "Verification code too short"),
    });

    const result: safeParseResult<{ code: number }> = codeValidation.safeParse(
      req.body,
    );

    if (!result.success) return validationErrorHandler(res, result);

    const code: number = result.data.code;

    const account = await AccountModel.findOne(
      { verificationCode: code },
      { __v: false, password: false },
    );

    if (!account) return accountNotFoundHandler(res, { code });

    if (
      account.verificationExpiry &&
      account.verificationExpiry < new Date(Date.now())
    ) {
      logger.error("Verification code expired");

      return res.status(400).json({
        status: 400,
        message: "Verification code expired",
      });
    }

    account.verificationCode = null;
    account.verificationExpiry = null;
    account.isVerified = true;

    await account.save();

    logger.info({ message: "User verified", account: account.email });

    await mailer.sendWelcomeEmail(account.email, account.username);

    return res.status(200).json({
      status: 200,
      message: "Verification successful",
    });
  },
);

const login = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const result: safeParseResult<{ email: string; password: string }> =
      AccountZodObject.safeParse(req.body);

    if (!result.success) return validationErrorHandler(res, result);

    const {
      email,
      password,
    }: {
      email: string;
      password: string;
    } = result.data;

    const account = await AccountModel.findOne({ email }, { __v: false });

    if (!account) return accountNotFoundHandler(res, { email });

    if (!account.isVerified) return accountNotVerified(res, email);

    const correctPassword: boolean = await bcrypt.compare(
      password ?? "",
      account.password,
    );

    if (!correctPassword) return incorrectPassword(res, email);

    const accessToken = jwt.sign(
      { email: email },
      process.env.JWT_SECRET ?? "",
      { expiresIn: "30m" },
    );

    const refreshTokenObj: { token: string; expiry: Date } = {
      token: uuidv4(),
      expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    account.refreshToken.push(refreshTokenObj);
    await account.save();

    res.cookie("Refresh-Token-Id", refreshTokenObj.token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      status: 200,
      message: "Logged in successfully",
      token: accessToken,
    });
  },
);

const logout = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const refreshToken =
      req.cookies !== null ? req.cookies["Refresh-Token-Id"] : null;

    const uuidValidation = z.object({
      token: z.uuidv4("Invalid refresh token"),
    });

    const result: safeParseResult<{ token: string }> = uuidValidation.safeParse(
      { token: refreshToken },
    );

    if (!result.success) return validationErrorHandler(res, result);

    const account = await AccountModel.findOne(
      { "refreshToken.token": refreshToken },
      { __v: false, password: false },
    );

    if (!account) return accountNotFoundHandler(res, { token: refreshToken });

    if (!account.isVerified) return accountNotVerified(res, account.email);

    for (let i: number = 0; i < account.refreshToken.length; i++) {
      let current: {
        token?: string | null | undefined;
        expiry?: NativeDate | null | undefined;
      } = account.refreshToken[i];

      if (current.token === refreshToken) {
        if (current.expiry && current.expiry < new Date(Date.now())) {
          logger.warn({
            message: "Session id already expired",
            account: account.email,
            id: refreshToken,
          });

          account.refreshToken.pull({ token: refreshToken });
          await account.save();

          return res.status(400).json({
            status: 400,
            message: "Session id already expired",
          });
        }
      }
    }

    account.refreshToken.pull({ token: refreshToken });
    await account.save();

    return res.status(200).json({
      status: 200,
      message: "Session ended successfully",
    });
  },
);

const logoutAllRequest = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const refreshTokenValidation = z.object({
      token: z.uuidv4("Invalid refresh token"),
    });

    const result: safeParseResult<{ token: string }> =
      refreshTokenValidation.safeParse({
        token: req.cookies["Refresh-Token-Id"],
      });

    if (!result.success) return validationErrorHandler(res, result);

    const refreshToken = result.data.token;

    const account = await AccountModel.findOne(
      { "refreshToken.token": refreshToken },
      { __v: false, password: false },
    );

    if (!account) return accountNotFoundHandler(res, { token: refreshToken });

    if (!account.isVerified) return accountNotVerified(res, account.email);

    for (let i: number = 0; i < account.refreshToken.length; i++) {
      let current: {
        token?: string | null | undefined;
        expiry?: NativeDate | null | undefined;
      } = account.refreshToken[i];

      if (current.token === refreshToken) {
        if (current.expiry && current.expiry < new Date(Date.now())) {
          logger.warn({
            message: "Session id already expired",
            account: account.email,
            id: refreshToken,
          });

          account.refreshToken.pull({ token: refreshToken });
          await account.save();

          return res.status(400).json({
            status: 400,
            message: "Session id already expired",
          });
        }
      }
    }

    const code: number = crypto.randomInt(100000, 999999);
    const expiry: Date = new Date(Date.now() + 10 * 60 * 1000);

    account.verificationCode = code;
    account.verificationExpiry = expiry;
    await account.save();

    await mailer.sendLogoutAllVerificationMail(account.email, code);

    return res.status(200).json({
      status: 200,
      message: "Verification code sent to email",
    });
  },
);

const logoutAll = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const codeValidation = z.object({
      code: z.coerce.number().min(6, "Verification code too short"),
    });

    const result: safeParseResult<{ code: number }> = codeValidation.safeParse(
      req.body,
    );

    if (!result.success) return validationErrorHandler(res, result);

    const code: number = result.data.code;

    const account = await AccountModel.findOne(
      { verificationCode: code },
      { __v: false, password: false },
    );

    if (!account) return accountNotFoundHandler(res, { code });

    if (!account.isVerified) return accountNotVerified(res, account.email);

    if (
      account.verificationExpiry &&
      account.verificationExpiry < new Date(Date.now())
    ) {
      logger.warn({ message: "Verification code expired", code: code });

      account.verificationCode = null;
      account.verificationExpiry = null;
      await account.save();

      return res.status(400).json({
        status: 400,
        message: "Verification code expired",
      });
    }

    account.verificationCode = null;
    account.verificationExpiry = null;
    account.refreshToken = [] as any;
    await account.save();

    logger.info({
      message: "Logout all devices successfully",
      account: account.email,
    });

    return res.status(200).json({
      status: 200,
      message: "Logout all devices successfully",
    });
  },
);

const refresh = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const cookieValidation = z.object({
      token: z.uuidv4("Invalid refresh token"),
    });

    const result: safeParseResult<{ token: string }> =
      cookieValidation.safeParse({
        token: req.cookies["Refresh-Token-Id"],
      });

    if (!result.success) return validationErrorHandler(res, result);

    const token: string = result.data.token;

    const account = await AccountModel.findOne(
      { "refreshToken.token": token },
      { __v: false, password: false },
    );

    if (!account) return accountNotFoundHandler(res, { token });

    if (!account.isVerified) return accountNotVerified(res, account.email);

    for (let i: number = 0; i < account.refreshToken.length; i++) {
      const current: {
        token?: string | null | undefined;
        expiry?: NativeDate | null | undefined;
      } = account.refreshToken[i];

      if (current.token === token) {
        if (current.expiry && current.expiry < new Date(Date.now())) {
          logger.warn({
            message: "Session id already expired",
            account: account.email,
            id: token,
          });

          account.refreshToken.pull({ token });
          await account.save();

          return res.status(400).json({
            status: 400,
            message: "Session id already expired",
          });
        }
      }
    }

    const accessToken = jwt.sign(
      { email: account.email },
      process.env.JWT_SECRET ?? "",
      { expiresIn: "30m" },
    );

    const newRefreshTokenObj: { token: string; expiry: Date } = {
      token: uuidv4(),
      expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    await AccountModel.updateOne(
      { "refreshToken.token": token },
      { $pull: { refreshToken: { token } } },
    );

    account.refreshToken.push(newRefreshTokenObj);
    await account.save();

    res.cookie("Refresh-Token-Id", newRefreshTokenObj.token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      status: 200,
      message: "Refreshed access token",
      token: accessToken,
    });
  },
);

const forgotPassword = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const zodEmailValidation = z.object({
      email: z.email("Invalid email address"),
    });

    const result: safeParseResult<{ email: string }> =
      zodEmailValidation.safeParse(req.body);

    if (!result.success) return validationErrorHandler(res, result);

    const { email }: { email: string } = result.data;

    const account = await AccountModel.findOne(
      { email },
      { __v: false, password: false },
    );

    if (!account) return accountNotFoundHandler(res, { email });

    if (!account.isVerified) return accountNotVerified(res, email);

    const code: number = crypto.randomInt(100000, 999999);
    const expiry: Date = new Date(Date.now() + 10 * 60 * 1000);

    account.resetCode = code;
    account.resetExpiry = expiry;
    await account.save();

    mailer.sendResetPasswordMail(email, code);

    return res.status(200).json({
      status: 200,
      message: "New password reset code has been sent",
    });
  },
);

const resetPasswordToken = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const codeValidation = z.object({
      code: z.coerce
        .number("Invalid reset code")
        .min(6, "Reset code too short"),
    });

    const result: safeParseResult<{ code: number }> = codeValidation.safeParse(
      req.body,
    );

    if (!result.success) return validationErrorHandler(res, result);

    const code: number = result.data.code;

    const account = await AccountModel.findOne(
      { resetCode: code },
      { __v: false },
    );

    if (!account) return accountNotFoundHandler(res, { code });

    if (!account.isVerified) return accountNotVerified(res, account.email);

    if (account.resetExpiry && account.resetExpiry < new Date(Date.now())) {
      logger.warn({
        message: "Reset code already expired",
        account: account.email,
        code: code,
      });

      account.resetCode = null;
      account.resetExpiry = null;
      await account.save();

      return res.status(400).json({
        status: 400,
        message: "Reset code already expired",
      });
    }

    if (account.resetCode !== code) {
      logger.error({
        message: "Invalid reset code",
        account: account.email,
        code: code,
      });

      return res.status(400).json({
        status: 400,
        message: "Invalid reset code",
      });
    }

    logger.info({ message: "Reset permitted", account: account.email });

    const resetCookie = uuidv4();

    res.cookie("Password-Reset-UUID", resetCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    account.resetToken = resetCookie;
    account.resetCode = null;
    account.resetExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000);
    await account.save();

    return res.status(200).json({
      status: 200,
      message: "Reset permitted",
    });
  },
);

const resetPassword = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const cookieValidation = z.object({
      token: z.uuidv4("Invalid reset token"),
    });

    const result: safeParseResult<{ token: string }> =
      cookieValidation.safeParse({
        token: req.cookies["Password-Reset-UUID"],
      });

    if (!result.success) return validationErrorHandler(res, result);

    const resetCookie = result.data.token;

    const account = await AccountModel.findOne(
      { resetToken: resetCookie },
      { __v: false },
    );

    if (!account) return accountNotFoundHandler(res, { token: resetCookie });

    if (!account.isVerified) return accountNotVerified(res, account.email);

    if (account.resetExpiry && account.resetExpiry < new Date(Date.now())) {
      logger.warn({ message: "Reset token expired", account: account.email });

      account.resetToken = null;
      account.resetExpiry = null;
      await account.save();

      return res.status(400).json({
        status: 400,
        message: "Reset token expired",
      });
    }

    const bodyValidation = z.object({
      password: z.string().min(6, "Password too short (6 or more characters)"),
    });

    const bodyResult: safeParseResult<{ password: string }> =
      bodyValidation.safeParse(req.body);

    if (!bodyResult.success) return validationErrorHandler(res, bodyResult);

    const hashedPassword: string = await bcrypt.hash(
      bodyResult.data.password,
      10,
    );

    account.password = hashedPassword;
    account.resetCode = null;
    account.resetExpiry = null;
    account.resetToken = null;
    await account.save();

    logger.info({
      message: "Password reset successfully",
      account: account.email,
    });

    mailer.sendPasswrodChangedMail(account.email);

    return res.status(200).json({
      status: 200,
      message: "Password reset successfully",
    });
  },
);

const deleteAccountRequest = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const accountVerification = AccountZodObject.pick({
      email: true,
      password: true,
    });

    const result: safeParseResult<{ email: string; password: string }> =
      accountVerification.safeParse(req.body);

    if (!result.success) return validationErrorHandler(res, result);

    const { email, password }: { email: string; password: string } =
      result.data;

    const account = await AccountModel.findOne({ email }, { __v: false });

    if (!account) return accountNotFoundHandler(res, { email });

    if (!account.isVerified) return accountNotVerified(res, account.email);

    const correctPassword: boolean = await bcrypt.compare(
      password ?? "",
      account.password,
    );

    if (!correctPassword) return incorrectPassword(res, email);

    const code: number = crypto.randomInt(100000, 999999);
    const expiry: Date = new Date(Date.now() + 10 * 60 * 1000);

    account.deleteAccountCode = code;
    account.deleteAccountExpiry = expiry;
    await account.save();

    await mailer.sendDeleteAccountRequestMail(account.email, code);

    return res.status(200).json({
      status: 200,
      message: "New verification code sent to email",
    });
  },
);

const deleteAccount = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const codeValidation = z.object({
      code: z.coerce
        .number("Invalid verification code")
        .min(6, "Verification code too short"),
    });

    const result: safeParseResult<{ code: number }> = codeValidation.safeParse(
      req.body,
    );

    if (!result.success) return validationErrorHandler(res, result);

    const code: number = result.data.code;

    const account = await AccountModel.findOne(
      { deleteAccountCode: code },
      { __v: false },
    );

    if (!account) return accountNotFoundHandler(res, { code });

    if (
      account.deleteAccountExpiry &&
      account.deleteAccountExpiry < new Date(Date.now())
    ) {
      logger.warn({
        message: "Reset code already expired",
        account: account.email,
        code: code,
      });

      account.deleteAccountCode = null;
      account.deleteAccountExpiry = null;
      await account.save();

      return res.status(400).json({
        status: 400,
        message: "Reset code already expired",
      });
    }

    await AccountModel.findOneAndDelete({
      email: account.email,
      deleteAccountCode: code,
    });

    logger.info({ message: "Account deleted", account: account.email });

    mailer.sendAccountDeletedMail(account.email, account.username);

    return res.status(204);
  },
);

const me = wrapper(async (req: Request, res: Response): Promise<Response> => {
  const tokenValidation = z.object({
    token: z.jwt("Invalid access token"),
  });

  const result: safeParseResult<{ token: string }> = tokenValidation.safeParse({
    token: req.headers.authorization?.split(" ")[1],
  });

  if (!result.success) return validationErrorHandler(res, result);

  const accessToken: string = result.data.token;

  const decoded: string = String(
    jwt.verify(accessToken, process.env.JWT_SECRET ?? ""),
  );
  const obj: { email: string } = JSON.parse(decoded);

  const email: string = obj.email;

  const account = await AccountModel.findOne(
    { email },
    { __v: false, password: false },
  );

  if (!account) return accountNotFoundHandler(res, { token: accessToken });

  if (!account.isVerified) return accountNotVerified(res, email);

  const accountData: {
    username: string;
    email: string;
  } = {
    username: account.username,
    email: account.email,
  };

  return res.status(200).json({
    status: 200,
    message: "Retrieved data for account",
    account: accountData,
  });
});

export {
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
  deleteAccountRequest,
  deleteAccount,
  me,
};
