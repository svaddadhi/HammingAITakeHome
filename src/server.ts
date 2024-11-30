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
  }

  private configureMiddleware(): void {
    this.app.use(express.json());

    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
        methods: ["POST", "GET", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    this.app.use(helmet());

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info("Incoming request", {
        method: req.method,
        path: req.path,
        ip: req.ip,
        timestamp: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
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

  public addRoute(path: string, router: express.Router): void {
    logger.info(`Adding route handler`, {
      path,
      timestamp: new Date().toISOString(),
    });

    this.app.use(path, (req, res, next) => {
      logger.info(`Request received at ${path}`, {
        method: req.method,
        originalUrl: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
      next();
    });

    this.app.use(path, router);
  }

  public async start(): Promise<void> {
    this.configureErrorHandling();

    try {
      await new Promise<void>((resolve) => {
        this.app.listen(this.port, () => {
          logger.info("Server started", {
            port: this.port,
            timestamp: new Date().toISOString(),
          });
          resolve();
        });
      });
    } catch (error) {
      logger.error("Failed to start server", {
        error: error instanceof Error ? error.message : "Unknown error",
        port: this.port,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}

export default Server;
