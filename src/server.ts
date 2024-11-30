// src/server.ts

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import logger from "./utils/logger.js";

interface AppError extends Error {
  status?: number;
}

/**
 * Server class provides the HTTP server functionality for our discovery system.
 * It handles incoming webhook requests and provides appropriate security measures.
 */
class Server {
  private app: Express;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.configureMiddleware();
  }

  /**
   * Configures Express middleware for security and request handling
   */
  private configureMiddleware(): void {
    // Parse JSON request bodies
    this.app.use(express.json());

    // Configure CORS for security
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
        methods: ["POST", "GET", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    // Add security headers
    this.app.use(helmet());

    // Log incoming requests
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

  /**
   * Configures error handling middleware
   */
  private configureErrorHandling(): void {
    // Handle 404 errors
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const error: AppError = new Error("Not Found");
      error.status = 404;
      next(error);
    });

    // Handle all other errors
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

  /**
   * Adds a new route handler to the server
   */
  public addRoute(path: string, router: express.Router): void {
    logger.info(`Adding route handler`, {
      path,
      timestamp: new Date().toISOString(),
    });

    // Add request logging for this route
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

  /**
   * Starts the server listening for requests
   */
  public async start(): Promise<void> {
    // Add error handling after all routes are configured
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
