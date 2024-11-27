import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import logger from "./utils/logger.js";

interface AppError extends Error {
  status?: number;
}

class Server {
  private app: Express;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;

    this.configureMiddleware();

    this.configureErrorHandling();
  }

  private configureMiddleware(): void {
    this.app.use(express.json());

    // Parse URL-encoded bodies (useful for form submissions)
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
        methods: ["POST", "GET", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    // Add security headers
    this.app.use(helmet());

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info("Incoming request", {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });
      next();
    });
  }

  private configureErrorHandling(): void {
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const error: AppError = new Error("Not Found");
      error.status = 404;
      next(error);
    });

    this.app.use(
      (error: AppError, req: Request, res: Response, next: NextFunction) => {
        logger.error("Server error", {
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method,
        });

        res.status(error.status || 500).json({
          error: {
            message: error.message || "Internal server error",
            status: error.status || 500,
          },
        });
      }
    );
  }

  /**
   * Adds a new route to the Express application
   * @param path - The URL path for the route
   * @param router - The Express router to handle the route
   */
  public addRoute(path: string, router: express.Router): void {
    this.app.use(path, router);
    logger.info(`Route added: ${path}`);
  }

  /**
   * Starts the server listening on the configured port
   * @returns Promise that resolves when the server is listening
   */
  public async start(): Promise<void> {
    try {
      await new Promise<void>((resolve) => {
        this.app.listen(this.port, () => {
          logger.info(`Server is running on port ${this.port}`);
          resolve();
        });
      });
    } catch (error) {
      logger.error("Failed to start server", {
        error: error instanceof Error ? error.message : "Unknown error",
        port: this.port,
      });
      throw error;
    }
  }
}

export default Server;
