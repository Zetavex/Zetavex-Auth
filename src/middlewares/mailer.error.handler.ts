import { ServerError } from "../global/types.ts";
import logger from "./logger.ts";

const mailerError = (err: unknown): void => {
  if (err instanceof ServerError) {
    logger.error({ status: err.statusCode, message: err.message });
    return;
  }

  if (err instanceof Error) {
    logger.error(err.message);
    return;
  }

  logger.error({ message: "An error occured", errorMessage: err });
};

export default mailerError;
