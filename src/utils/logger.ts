import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Write all logs with importance level of 'info' or less to combined.log
    new winston.transports.File({ filename: "logs/combined.log" }),
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    // Write to console during development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export default logger;
