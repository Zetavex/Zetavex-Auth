import * as z from "zod";
import type { Response } from "express";

import logger from "./logger.ts";
import type { safeParseResult } from "../global/types.ts";

const validationErrorHandler = (
  res: Response,
  result: safeParseResult<unknown>,
): Response => {
  if (result.success) return res.status(200);

  logger.error(z.prettifyError(result.error!));

  return res.status(400).json({
    status: 400,
    message: z.flattenError(result.error!).fieldErrors,
  });
};

const accountNotFoundHandler = (
  res: Response,
  options: {
    email?: string;
    token?: string;
    code?: number;
  },
): Response => {
  if (options.email) {
    logger.error({ message: "Account not found", account: options.email });

    return res.status(404).json({
      status: 404,
      message: "Account not found",
    });
  }

  if (options.token) {
    logger.error({
      message: "Invalid cerdentials.",
      token: options.token,
    });

    return res.status(404).json({
      status: 404,
      message: "Invalid cerdentials.",
    });
  }

  if (options.code) {
    logger.error({
      message: "Invalid link. This code might be already used or expired.",
      code: options.code,
    });

    return res.status(404).json({
      status: 404,
      message: "Invalid link. This code might be already used or expired.",
    });
  }

  logger.error({
    message: "Account not found",
  });

  return res.status(404).json({
    status: 404,
    message: "Account not found",
  });
};

const accountNotVerified = (res: Response, email: string): Response => {
  logger.warn({ message: "Account is not verified", account: email });

  return res.status(401).json({
    status: 401,
    message: "Account is not verified",
  });
};

const incorrectPassword = (res: Response, email: string): Response => {
  logger.error({
    message: "Email or password are incorrect",
    account: email,
  });

  return res.status(401).json({
    status: 401,
    message: "Email or password are incorrect",
  });
};

export {
  validationErrorHandler,
  accountNotFoundHandler,
  accountNotVerified,
  incorrectPassword,
};
