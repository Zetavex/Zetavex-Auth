import "dotenv/config";
import express from "express";
import type { Express } from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";

import connect from "./config/db.ts";
import errorHandler from "./middlewares/error.middleware.ts";
import AuthRouter from "./routes/auth.routes.ts";
import logger from "./middlewares/logger.ts";
import { ServerError } from "./global/types.ts";

const app: Express = express();

app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

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
