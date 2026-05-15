import type { Response, Request } from "express";
import { Types } from "mongoose";
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

const register = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const result = AccountZodObject.safeParse(req.body);

    if (!result.success) {
      logger.error(z.prettifyError(result.error));

      return res.status(400).json({
        status: 400,
        message: z.flattenError(result.error).fieldErrors,
      });
    }

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

    const mailer: Mailer = new Mailer();
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
    const result = emailVerificationObject.safeParse(req.body);

    if (!result.success) {
      logger.error(z.prettifyError(result.error));

      return res.status(400).json({
        status: 400,
        message: z.flattenError(result.error).fieldErrors,
      });
    }

    const { email }: { email: string } = result.data;

    const account = await AccountModel.findOne(
      { email },
      { __v: false, password: false },
    );

    if (!account) {
      logger.error({ message: "Account not found", account: email });

      return res.status(404).json({
        status: 404,
        message: "Account not found",
      });
    }

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

    const mailer: Mailer = new Mailer();
    await mailer.sendVerificationMail(email !== undefined ? email : "", code);

    return res.status(200).json({
      status: 200,
      message: "New verification code sent to email",
    });
  },
);

const verifyAccount = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    if (!req.body) {
      logger.warn("Body is undefined");

      return res.status(400).json({
        status: 400,
        message: "Body is undefined",
      });
    }

    const { code }: { code: string } = req.body;

    const account = await AccountModel.findOne(
      { verificationCode: code },
      { __v: false, password: false },
    );

    if (!account) {
      logger.error({ message: "Invalid verification", invalidCode: code });

      return res.status(400).json({
        status: 400,
        message: "Invalid verification code",
      });
    }

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

    return res.status(200).json({
      status: 200,
      message: "Verification successful",
    });
  },
);

const login = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const result = AccountZodObject.safeParse(req.body);

    if (!result.success) {
      logger.error(z.prettifyError(result.error));

      return res.status(400).json({
        status: 400,
        message: z.flattenError(result.error).fieldErrors,
      });
    }

    const {
      email,
      password,
    }: {
      email: string;
      password: string;
    } = result.data;

    const account = await AccountModel.findOne({ email }, { __v: false });

    if (!account) {
      logger.error("Account not found");
      return res.status(404).json({
        status: 404,
        message: "Account not found",
      });
    }

    if (!account.isVerified) {
      logger.warn({ message: "Account is not verified", account: email });

      return res.status(401).json({
        status: 401,
        message: "Account is not verified",
      });
    }

    const correctPassword: boolean = await bcrypt.compare(
      password ?? "",
      account.password,
    );

    if (!correctPassword) {
      logger.error({
        message: "Email or password are incorrect",
        account: email,
      });

      return res.status(401).json({
        status: 401,
        message: "Email or password are incorrect",
      });
    }

    const accessToken = jwt.sign(
      { email: email },
      process.env.JWT_SECRET ?? "",
      { expiresIn: "30m" },
    );

    const refreshTokenObj: { token: string; expiry: Date } = {
      token: uuidv4(),
      expiry: new Date(Date.now() + 30 * 24 * 60 * 1000),
    };

    account.refreshToken.push(refreshTokenObj);
    await account.save();

    res.cookie("Refresh-Token-Id", refreshTokenObj.token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    const accountData: {
      _id: Types.ObjectId;
      username: string;
      email: string;
    } = {
      _id: account._id,
      username: account.username,
      email: account.email,
    };

    return res.status(200).json({
      status: 200,
      message: "Logged in successfully",
      account: accountData,
      token: accessToken,
    });
  },
);

const logout = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const refreshToken = req.cookies["Refresh-Token-Id"];

    const uuidValidation = z.object({
      token: z.uuidv4("Invalid refresh token"),
    });

    const result = uuidValidation.safeParse({ token: refreshToken });

    if (!result.success) {
      logger.error({ message: z.prettifyError(result.error) });

      return res.status(400).json({
        status: 400,
        message: z.flattenError(result.error).fieldErrors,
      });
    }

    const account = await AccountModel.findOne(
      { "refreshToken.token": refreshToken },
      { __v: false, password: false },
    );

    for (let i: number = 0; i < account.refreshToken.length; i++) {
      let current: { token: String; expiry: Date } = account.refreshToken;

      if (current.token === refreshToken) {
        if (current.expiry < new Date(Date.now())) {
          logger.warn({
            message: "Session id already expired",
            account: account.email,
            id: refreshToken,
          });

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

export { register, verifyAccount, resendVerificationCode, login, logout };
