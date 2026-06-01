import "dotenv/config";
import express from "express";
import type { Express } from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import connect from "./config/db.ts";
import errorHandler from "./middlewares/error.middleware.ts";
import AuthRouter from "./routes/auth.routes.ts";
import logger from "./middlewares/logger.ts";
import { ServerError } from "./global/types.ts";

const app: Express = express();

const ENV = process.env.NODE_ENV;

const devOrigins: string[] = ["http://localhost:5173", "http://127.0.0.1:5173"];
const prodOrigins: string[] = [];

const allowedOrigins = ENV !== "prod" ? devOrigins : prodOrigins;

app.use(
  cors({
    origin: (origin: any, callback: any): void => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(
  rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 150,
    message: {
      status: 429,
      message: "Too many requests sent. Rate limit reached",
    },
    statusCode: 429,
    legacyHeaders: false,
    standardHeaders: "draft-8",
  }),
);
app.use(helmet());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/auth", AuthRouter);
app.use(errorHandler);

async function start(): Promise<void> {
  const PORT: number = Number(process.env.PORT) ?? 5000;

  try {
    app.listen(PORT, (): void => {
      logger.info(`Server listening on port ${PORT}`);
    });

    await connect();
  } catch (err: unknown) {
    if (err instanceof ServerError || err instanceof Error) {
      logger.error(err.message);
    }

    logger.error(err);
  }
}

start();
