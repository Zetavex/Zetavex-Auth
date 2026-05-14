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
import type { propriety } from "../global/types.ts";
import AccountZodObject from "../global/zod.validation.object.ts";
import logger from "../middlewares/logger.ts";

const register = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const {
      username,
      email,
      password,
    }: {
      username: propriety;
      email: propriety;
      password: propriety;
    } = req.body;

    const result = AccountZodObject.safeParse({ username, email, password });

    if (!result.success) {
      logger.error(result.error);

      return res.status(400).json({
        status: 400,
        message: result.error,
      });
    }

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

const verifyAccount = wrapper(
  async (req: Request, res: Response): Promise<Response> => {
    const { code }: { code: string } = req.body;

    const account = await AccountModel.findOne(
      { verificationCode: code },
      { __v: false, password: false },
    );

    if (!account) {
      logger.error({ message: "Invalid verification", invalidCode: code });
      return res.status(400).json({
        status: 400,
        message: "",
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
    const {
      email,
      password,
    }: { email: string | undefined; password: string | undefined } = req.body;

    const result = AccountZodObject.safeParse({ email, password });

    if (!result.success) {
      logger.error(z.prettifyError(result.error));

      return res.status(400).json({
        status: 400,
        message: z.flattenError(result.error).fieldErrors,
      });
    }

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

    const refreshToken: { token: string; expiry: Date } = {
      token: uuidv4(),
      expiry: new Date(Date.now() + 30 * 24 * 60 * 1000),
    };

    res.cookie("Refresh-Token-Id", refreshToken, {
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

export { register, verifyAccount, login };
