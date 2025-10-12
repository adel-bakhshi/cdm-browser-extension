/**
 * Professional Logging Utility for CDM Extension
 * Supports levels: DEBUG, INFO, WARN, ERROR
 * Features: formatting, filtering, storage, rate limiting
 */

import LogLevel from "./enums/log-level";

/**
 * Logging class for handling log messages.
 */
class Logger {
  /**
   * Log levels for different types of log messages.
   */
  private _name: string;

  /**
   * Minimum log level to display.
   */
  private _minimumLogLevel: LogLevel;

  /**
   * Gets a value that indicates the name of the logger.
   */
  get name() {
    return this._name;
  }

  /**
   * Initializes the logger with a given name.
   * @param name - The name of the logger.
   */
  constructor(name: string, minimumLogLevel: LogLevel = LogLevel.Debug) {
    if (!name) throw new Error("Logger name is required");

    this._name = name;
    this._minimumLogLevel = minimumLogLevel;
  }

  /**
   * Gets the current timestamp in a formatted string.
   * @returns The current timestamp.
   */
  private _getCurrentTimestamp(): string {
    const now = new Date();
    const date = now.toISOString().split("T")[0].replace(/-/g, "-");
    const time = now.toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return `${date} ${time}`;
  }

  /**
   * Gets the string representation of a log level.
   * @param level - The log level to get the string for.
   * @returns The string representation of the log level.
   */
  private _getLevelStr(level: LogLevel) {
    switch (level) {
      case LogLevel.Debug:
        return "DBG";

      case LogLevel.Info:
        return "INF";

      case LogLevel.Warning:
        return "WARN";

      case LogLevel.Error:
        return "ERR";

      case LogLevel.Success:
        return "SUC";

      default:
        return "DBG";
    }
  }

  /**
   * Logs a message with a specified level.
   * @param level - The level of the log message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public log(level: LogLevel, message: string, ...args: any[]) {
    // Check if the log level is greater than or equal to the minimum log level
    if (level < this._minimumLogLevel) return;

    // Get the current timestamp
    const timestamp = this._getCurrentTimestamp();
    // Construct the log entry
    const logEntry = `[${this._name}] [${timestamp}] [${this._getLevelStr(level)}] - ${message}`;

    if (args.length > 0) {
      console.log(logEntry, ...args);
    } else {
      console.log(logEntry);
    }
  }

  /**
   * Logs a debug message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public logDebug(message: string, ...args: any[]) {
    this.log(LogLevel.Debug, message, ...args);
  }

  /**
   * Logs an informational message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public logInfo(message: string, ...args: any[]) {
    this.log(LogLevel.Info, message, ...args);
  }

  /**
   * Logs a success message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public logSuccess(message: string, ...args: any[]) {
    this.log(LogLevel.Success, message, ...args);
  }

  /**
   * Logs a warning message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public logWarning(message: string, ...args: any[]) {
    this.log(LogLevel.Warning, message, ...args);
  }

  /**
   * Logs an error message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public logError(message: string, ...args: any[]) {
    this.log(LogLevel.Error, message, ...args);
  }
}

// Export the Logging class as the default export
export default Logger;
