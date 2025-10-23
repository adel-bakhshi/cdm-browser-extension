import BrowserType from "./enums/browser-type";

// Declaration for the `browser` object in Firefox.
declare const browser: any;

/**
 * Detects the browser type.
 * @returns A promise that resolves to the browser type.
 */
async function detectBrowser() {
  // In Firefox, the `browser` object is always available and has `getBrowserInfo`.
  if (typeof browser !== "undefined" && browser.runtime && browser.runtime.getBrowserInfo) {
    const info = await browser.runtime.getBrowserInfo();
    return info.name === "Firefox" ? BrowserType.Firefox : BrowserType.Unknown;
  }

  // In Chromium-based browsers, only `chrome` is available.
  if (typeof chrome !== "undefined" && chrome.runtime) {
    return BrowserType.Chromium;
  }

  return BrowserType.Unknown;
}

/**
 * Runs an asynchronous action with a delay.
 * @param action - The action to run.
 * @param delay - The delay in milliseconds.
 * @returns A promise that resolves after the delay.
 */
function runWithDelayAsync(action: () => Promise<void>, delay: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        await action();
        resolve();
      } catch (err) {
        reject(err);
      }
    }, delay);
  });
}

/**
 * Runs a asynchronous action with a delay.
 * @param action - The action to run.
 * @param delay - The delay in milliseconds.
 * @returns A promise that resolves after the delay.
 */
function runWithDelay(action: () => void, delay: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        action();
        resolve();
      } catch (err) {
        reject(err);
      }
    }, delay);
  });
}

/**
 * Validates if a string is a valid URL.
 * @param url - The string to validate.
 * @returns True if the string is a valid URL.
 */
function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Truncates a string to a specified maximum length.
 * @param str - The string to truncate.
 * @param maxLength - The maximum length of the string.
 * @returns The truncated string.
 */
function truncateString(str: string, maxLength: number) {
  if (str.length <= maxLength) {
    return str;
  }

  return str.substring(0, maxLength) + "...";
}

/**
 * Checks if an URL has an unsupported protocol.
 * @param url - The URL to check.
 * @returns True if the URL has an unsupported protocol.
 */
function isUnsupportedProtocol(url: string): boolean {
  const unsupportedProtocols = [
    "blob:",
    "data:",
    "mailto:",
    "tel:",
    "sms:",
    "file:",
    "ftp:",
    "chrome:",
    "edge:",
    "about:",
    "javascript:",
  ];

  return unsupportedProtocols.some((protocol) => url.startsWith(protocol));
}

export { detectBrowser, runWithDelayAsync, runWithDelay, isValidUrl, truncateString, isUnsupportedProtocol };
