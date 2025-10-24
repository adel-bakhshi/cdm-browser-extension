/**
 * Cross-platform Download Manager (CDM) Extension - Background Script
 *
 * This script handles download interception, context menu actions,
 * and communication with the CDM desktop application.
 */

import * as utils from "./utils/utilities";
import appSettings from "./utils/app-settings";
import HttpClient from "./utils/http-client";
import Logger from "./utils/logger";
import BrowserType from "./utils/enums/browser-type";

import type { DownloadData } from "./models/download-data";

// Create a new instance of the Logger class
const globalLogger = new Logger("Service Worker");

// Track captured downloads to prevent duplicate processing.
const capturedDownloads = new Set<number>();
// Track ignored downloads to prevent failure processing.
const ignoredDownloads = new Set<string>();

// Get the current browser name.
const browserType = await utils.detectBrowser();
// Get the current browser name.
const browserName =
  browserType === BrowserType.Chromium ? "Chromium" : browserType === BrowserType.Firefox ? "Firefox" : "Unknown";

// Log the browser name.
globalLogger.logDebug("Extension running on " + browserName + " browser.");

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

/**
 * Download creation event handler - triggered when a download starts.
 */
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  globalLogger.logDebug("Download created with id: " + downloadItem.id);
  await utils.runWithDelayAsync(
    async () => {
      await handleDownload(downloadItem);
    },
    browserType === BrowserType.Chromium ? 500 : 100
  );
});

if (browserType === BrowserType.Chromium) {
  /**
   * Download filename determination event handler - allows intercepting downloads.
   * onDeterminingFilename not supported in Firefox.
   */
  chrome.downloads.onDeterminingFilename.addListener(async (downloadItem, suggest) => {
    globalLogger.logDebug("Download determining filename with id: " + downloadItem.id);
    await handleDownload(downloadItem, suggest);
  });
}

/**
 * Extension icon click event handler.
 */
chrome.action.onClicked.addListener(actionOnClickedAction);

/**
 * Message handling from content scripts and popup.
 */
chrome.runtime.onMessage.addListener(handleMessages);

/**
 * Context menu click event handler.
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "cdm-single-item": {
      await handleSingleItemContextMenuClick(info, tab);
      break;
    }

    case "cdm-multiple-items": {
      await handleMultipleItemsContextMenuClick(info, tab);
      break;
    }
  }
});

/**
 * Tab creation event handler - updates supported file types when new tab is created.
 */
chrome.tabs.onCreated.addListener(async () => await appSettings.updateSupportedFileTypes());

/**
 * Alarm event handler - handle keep-alive alarm.
 */
chrome.alarms.onAlarm.addListener((alarm) => onAlarmAction(alarm));

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Initializes the extension.
 */
async function initializeExtension() {
  try {
    globalLogger.logInfo("Initializing the extension...");

    // Update extension badge state
    globalLogger.logInfo("Updating extension badge state...");
    await changeBadgeState();

    // Add context menu items
    globalLogger.logInfo("Creating context menu items...");
    createContextMenus();

    // Keep-alive alarm
    globalLogger.logInfo("Creating keep-alive alarm...");
    await createKeepAliveAlarm();

    if (browserType === BrowserType.Chromium) {
      // Check for extension updates
      globalLogger.logInfo("Checking for extension updates...");
      await checkForExtensionUpdates();
    }
  } catch (error) {
    globalLogger.logError("An error occurred when trying to initialize the extension: ", error);
  }
}

/**
 * Creates context menu items for the extension.
 */
function createContextMenus() {
  try {
    // Check if context menu items already exist
    chrome.contextMenus.removeAll(() => {
      // Single menu item (for all types)
      chrome.contextMenus.create({
        id: "cdm-single-item",
        title: "Download with CDM",
        contexts: ["link", "image", "video", "audio"],
      });

      // Multiple menu item (just for links)
      chrome.contextMenus.create({
        id: "cdm-multiple-items",
        title: "Download all links with CDM",
        contexts: ["selection"],
        documentUrlPatterns: ["*://*/*"],
        targetUrlPatterns: ["*://*/*"],
      });

      // Check for last error
      checkLastError();
    });
  } catch (error) {
    globalLogger.logError("An error occurred when creating context menu items:", error);
  }
}

/**
 * Creates a keep-alive alarm to keep the extension alive.
 * @returns A Promise that resolves when the keep-alive alarm is created.
 */
async function createKeepAliveAlarm() {
  try {
    // Check if keep-alive alarm already exists
    const keepAliveAlarm = await chrome.alarms.get("keep-alive");
    if (keepAliveAlarm) {
      globalLogger.logDebug("Keep-alive alarm already exists. Skipping creation...");
      return;
    }

    // Create keep-alive alarm
    await chrome.alarms.create("keep-alive", { periodInMinutes: 0.5 });
  } catch (error) {
    globalLogger.logError("An error occurred when creating keep-alive alarm:", error);
  }
}

/**
 * Handles download interception and processing.
 * @param downloadItem - The download item object from Chrome API.
 * @param suggest - Optional suggest function for filename determination.
 */
async function handleDownload(downloadItem: chrome.downloads.DownloadItem, suggest: Function | null = null) {
  try {
    // Make sure the extension is enabled
    if (!appSettings.isEnabled()) return;

    // Get download item url
    const downloadItemUrl = downloadItem.finalUrl ?? downloadItem.url;
    // Log download item url
    globalLogger.logDebug(`Download item url: ${downloadItemUrl ?? "Unknown"}`);

    // Check if the download is ignored
    if (ignoredDownloads.has(downloadItem.finalUrl) || ignoredDownloads.has(downloadItem.url)) {
      globalLogger.logDebug("Ignoring download...");
      return;
    }

    // Check if the download url is a blob
    if (utils.isUnsupportedProtocol(downloadItemUrl)) {
      globalLogger.logDebug("CDM does not support this protocol. Allowing download in browser...");
      return;
    }

    // Get file extension using multiple detection methods
    const fileExtension = getFileExtension(downloadItem);
    // Check if the file extension is supported by CDM
    if (!appSettings.isContainingFileType(fileExtension)) {
      globalLogger.logDebug(`${fileExtension} file type not supported with CDM. Allowing download in browser...`);
      return;
    }

    // Avoid download when onDeterminingFilename is fired
    if (suggest) {
      // Log that onDeterminingFilename is fired and we must cancel the download
      globalLogger.logDebug("Canceling and avoiding 'Save as' dialog for download with id: " + downloadItem.id);
      // Avoiding to show "Save as" if the download confirmed
      suggest({ filename: downloadItem.filename, conflictAction: "overwrite" });

      // Cancel the download in the browser
      await chrome.downloads.cancel(downloadItem.id);
      await chrome.downloads.erase({ id: downloadItem.id });

      // Check for last error
      checkLastError();
      // Add download item to captured downloads
      capturedDownloads.add(downloadItem.id);
      return;
    }

    // Log and suggest filename if the download is not already captured
    globalLogger.logDebug("Capturing download file and trying to download it in CDM. Download id: " + downloadItem.id);

    // Cancel the download when it'ss not cancelled in onDeterminingFilename event
    if (!capturedDownloads.has(downloadItem.id)) {
      await chrome.downloads.cancel(downloadItem.id);
      await chrome.downloads.erase({ id: downloadItem.id });

      // Check for last error
      checkLastError();
      // Add download item to captured downloads
      capturedDownloads.add(downloadItem.id);
    }

    // Create download data
    const data = await getDownloadData(downloadItem);
    // Send download link to CDM desktop application
    await downloadFile([data]);
  } catch (error) {
    globalLogger.logError("An error occurred while trying to capture download item.", error);
  } finally {
    // Remove download item from captured downloads
    await utils.runWithDelay(() => {
      try {
        if (capturedDownloads.has(downloadItem.id)) {
          capturedDownloads.delete(downloadItem.id);
        }
      } catch (error) {
        globalLogger.logError("An error occurred while trying to remove download item from captured downloads.", error);
      }
    }, 3000);
  }
}

/**
 * Gets download data from download item.
 * @param downloadItem - The download item object from Chrome API.
 * @returns A promise that resolves to an object containing the download data.
 */
async function getDownloadData(downloadItem: chrome.downloads.DownloadItem): Promise<DownloadData> {
  // Get referer from download item
  const referer = downloadItem.referrer ?? (downloadItem as any)?.initiator ?? null;
  // Map download URL to tab ID
  const downloadUrl = downloadItem.finalUrl ?? downloadItem.url;

  // Get the active tab to find the page where the download was initiated
  const activeTab = await getActiveTab();
  const pageAddress = activeTab?.url ?? null;

  return {
    url: downloadUrl,
    referer,
    pageAddress,
    description: null,
    isBrowserNative: true,
  };
}

/**
 * Sends download request to CDM desktop application.
 * @param data - Array of download objects containing URLs.
 */
async function downloadFile(data: DownloadData[]) {
  try {
    // Send request to download the file via CDM API
    const client = new HttpClient({ baseURL: "http://localhost:5000" });
    const response = await client.post("/cdm/download/add/", data, {
      headers: { "Content-Type": "application/json" },
    });

    // Make sure that no error occurred
    if (!response.isSuccessful) {
      globalLogger.logInfo(response.message ?? "Failed to download file.");
      // Ignore download and start in browser if the error is related to the CDM desktop application.
      ignoreDownloadsAndStartInBrowser(data);
      return;
    }

    // Log that the download has started
    const message =
      data.length > 1 ? `Download files added or started in CDM.` : `Download file added or started in CDM.`;

    globalLogger.logInfo(response.message ?? message, data);
  } catch (error) {
    globalLogger.logError("CDM connection error:", error);
  }
}

/**
 * Handles extension icon click to toggle enabled state.
 */
async function actionOnClickedAction() {
  try {
    // Toggle enabled state
    await appSettings.set("enabled", !appSettings.isEnabled());
    // Update the extension badge
    await changeBadgeState();
  } catch (error) {
    globalLogger.logError("An error occurred while trying to toggle extension state.", error);
  }
}

/**
 * Updates the extension badge to show enabled/disabled state.
 */
async function changeBadgeState() {
  try {
    await chrome.action.setBadgeText({
      text: appSettings.isEnabled() ? "" : "Off",
    });

    globalLogger.logDebug(
      "Extension badge updated. Current state: " + (appSettings.isEnabled() ? "Enabled" : "Disabled")
    );
  } catch (error) {
    globalLogger.logError("Error while updating extension badge: ", error);
  }
}

/**
 * Handles messages from content scripts and popup.
 * @param message - The message object
 * @param sender - The sender information
 * @param sendResponse - Callback function to send response
 */
async function handleMessages(message: any, sender: any, sendResponse: any) {
  try {
    // Get message type
    const type = message?.type;

    // Handle message by type
    switch (type) {
      case "download_media": {
        if (!message.url) {
          sendResponse({ isSuccessful: false, message: "Url is not provided" });
          return;
        }

        sendResponse({ isSuccessful: true, message: "Message received" });

        // Get tab URL
        const tabUrl = sender.tab?.url ?? sender.url ?? null;
        // Get download data
        const data: DownloadData = {
          url: message.url,
          referer: tabUrl,
          pageAddress: tabUrl,
          description: null,
          isBrowserNative: false,
        };

        // Download the file
        await downloadFile([data]);
        break;
      }

      default: {
        sendResponse({ isSuccessful: false, message: "Invalid message type" });
        break;
      }
    }
  } catch (error) {
    globalLogger.logError("Error while handling message: ", error);
  }
}

/**
 * Handles single item context menu clicks.
 * @async
 * @param info - Context menu click information.
 * @param tab - The active tab object.
 */
async function handleSingleItemContextMenuClick(info: any, tab: any) {
  try {
    // Define data object to be sent to CDM
    const data: DownloadData = {
      url: "",
      referer: tab.url,
      pageAddress: tab.url,
      description: null,
      isBrowserNative: false,
    };

    if (info.mediaType) {
      // Define url variable
      let url = "";

      // Handle images, videos and audios
      switch (info.mediaType?.toLowerCase()) {
        case "image": {
          url = info.linkUrl;
          break;
        }

        case "video":
        case "audio": {
          url = info.srcUrl;
          break;
        }
      }

      // Set url in data object
      data.url = url;
    } else if (info.linkUrl) {
      // Set url in data object
      data.url = info.linkUrl;
    }

    // Check if there is a valid URL
    if (!data.url) {
      globalLogger.logDebug(`No valid URL found for ${info.mediaType}`);
      return;
    }

    // Get the description of the url
    data.description = await getLinkDescriptionFromPage(tab.id, data.url);

    // Download the file
    await downloadFile([data]);
  } catch (error) {
    globalLogger.logError("An error occurred while trying to handle single item context menu click: ", error);
  }
}

/**
 * Handles multiple items context menu clicks (link selection).
 * @async
 * @param info - Context menu click information.
 * @param tab - The active tab object.
 */
async function handleMultipleItemsContextMenuClick(info: any, tab: any) {
  try {
    // Get selected links from the document
    const links = await extractLinksFromSelection(tab.id, info.selectionText);
    // Check if there are any links
    if (links.length > 0) {
      // Log the links data
      globalLogger.logDebug("Downloading multiple links:", links);
      // Convert links to data object format
      const result: DownloadData[] = links.map((link) => {
        return {
          url: link,
          referer: tab.url,
          pageAddress: tab.url,
          description: null,
          isBrowserNative: false,
        };
      });

      // Get the description of the links
      for (const data of result) {
        data.description = await getLinkDescriptionFromPage(tab.id, data.url);
      }

      // Download the files
      await downloadFile(result);
    }
  } catch (error) {
    globalLogger.logError("An error occurred while trying to handle multiple items context menu click: ", error);
  }
}

/**
 * Extracts links from selected text in the current tab
 * @async
 * @param tabId - The ID of the current tab
 * @param selectionText - The selected text content
 * @returns Array of extracted URLs
 */
async function extractLinksFromSelection(tabId: number, selectionText: string): Promise<string[]> {
  try {
    // Check if the selection text is a valid URL
    if (utils.isValidUrl(selectionText)) {
      return [selectionText];
    }

    // Extract links from document content using scripting API
    const links = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Run extractor script to extract links from selected content
        const selectedLinks: string[] = [];
        const selection = window.getSelection();

        if ((selection?.rangeCount ?? 0) > 0) {
          const range = selection!.getRangeAt(0);
          const ancestor = range.commonAncestorContainer;
          const parentElement = (
            ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor.parentElement
          ) as HTMLElement;

          if (parentElement) {
            // Find all anchor tags within the selected area
            ([...parentElement.querySelectorAll("a[href]")] as HTMLAnchorElement[]).forEach((a) => {
              if (selection!.containsNode(a, true)) {
                selectedLinks.push(a.href);
              }
            });
          }
        }

        return selectedLinks;
      },
    });

    return links[0].result || [];
  } catch (error) {
    globalLogger.logError("Error extracting links:", error);
    return [];
  }
}

/**
 * Gets the description of a link from the page.
 * @param tabId - The ID of the current tab.
 * @param url - The URL of the link.
 * @returns The description of the link, or null if not found.
 */
async function getLinkDescriptionFromPage(tabId: number, url: string): Promise<string | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      args: [url],
      func: (matchedUrl: string) => {
        function findElementByUrl() {
          // Searching for <a> tags
          const anchors = document.querySelectorAll<HTMLAnchorElement>("a[href]");
          for (const a of anchors) {
            // Check if the href attribute matches the matchedUrl
            if (a.href === matchedUrl) {
              return a.innerText?.trim() || a.getAttribute("title") || a.getAttribute("aria-label");
            }
          }

          // Searching for <img> tags
          const images = document.querySelectorAll<HTMLImageElement>("img[src]");
          for (const img of images) {
            // Check if the src attribute matches the matchedUrl
            if (img.src === matchedUrl) {
              return img.getAttribute("alt") || img.getAttribute("title");
            }
          }

          // Searching for <video> and <audio> tags
          const medias = document.querySelectorAll<HTMLVideoElement | HTMLAudioElement>("video[src], audio[src]");
          for (const media of medias) {
            // Check if the src attribute matches the matchedUrl
            if (media.src === matchedUrl) {
              return media.getAttribute("title") || media.getAttribute("aria-label");
            }
          }

          return null;
        }

        return findElementByUrl();
      },
    });

    return results[0].result ?? null;
  } catch (e) {
    globalLogger.logError("Failed to fetch link description:", e);
    return null;
  }
}

/**
 * Handles alarm action.
 * @param alarm - Alarm object.
 */
function onAlarmAction(alarm: chrome.alarms.Alarm) {
  if (alarm.name === "keep-alive") {
    // Keep-alive action
    globalLogger.logDebug("Service worker keep-alive...");
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extracts the file extension from a download item using multiple methods
 * @param downloadItem - The download item containing file information
 * @returns The file extension with dot prefix, empty string if not found
 */
function getFileExtension(downloadItem: chrome.downloads.DownloadItem) {
  const fileName = downloadItem.filename; // Get the filename from download item
  let extension = ""; // Initialize extension variable

  // First try to get extension from filename
  if (fileName) {
    // Extract substring after last dot, convert to lowercase and trim whitespace
    extension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase().trim();
  } else {
    // If no filename, extract file extension from final URL
    extension = extractFileExtensionFromUrl(downloadItem.finalUrl);

    // If the extension is empty or not supported, try the original URL
    if (!extension || !appSettings.isContainingFileType(extension)) {
      extension = extractFileExtensionFromUrl(downloadItem.url);
    }
  }

  // If still no valid extension, try to extract from MIME type
  if (!extension || !appSettings.isContainingFileType(extension)) {
    const mimeType = downloadItem.mime;
    if (mimeType && mimeType.includes("/")) {
      // Extract extension from MIME type (e.g., "image/png" -> ".png")
      extension = `.${mimeType.split("/")[1].toLowerCase()}`;
    }
  }

  return extension;
}

/**
 * Extracts the file extension from a given URL.
 * @param url - The URL from which to extract the file extension.
 * @returns The file extension in lowercase, with leading/trailing whitespace removed.
 */
function extractFileExtensionFromUrl(url: string) {
  // Return empty string if no URL provided
  if (!url) return "";

  // Find the last occurrence of "/" in the URL to get the file name part
  const lastSlashIndex = url.lastIndexOf("/");
  // Extract the file name from the URL
  const fileName = url.substring(lastSlashIndex + 1);

  // Check if the file name contains query parameters (indicated by "?")
  return fileName.includes("?")
    ? // If there are query parameters, extract the extension up to the query parameter
      fileName.substring(fileName.lastIndexOf("."), fileName.indexOf("?")).toLowerCase().trim()
    : // If there are no query parameters, extract the extension from the last dot to the end
      fileName.substring(fileName.lastIndexOf(".")).toLowerCase().trim();
}

/**
 * Checks for the last error and logs it if present.
 */
function checkLastError() {
  const lastError = chrome.runtime.lastError;
  if (lastError) globalLogger.logError("An error occurred while trying to cancel download item.", lastError);
}

/**
 * Gets the active tab in the current window.
 * @returns A promise that resolves to the active tab object or null.
 */
async function getActiveTab() {
  try {
    // Query for the active tab in the current window
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // tabs is an array, and with the query above, it should only contain one tab
    return tabs.length > 0 ? tabs[0] : null;
  } catch (error) {
    globalLogger.logError("Error getting active tab:", error);
    return null;
  }
}

/**
 * Checks for extension updates.
 * @returns A promise that resolves when the check is complete.
 */
async function checkForExtensionUpdates() {
  try {
    // Get the current time
    const now = Date.now();
    // Calculate 24 hours in milliseconds
    const twentyFourHours = 24 * 60 * 60 * 1000;
    // Check if the last update check was more than 24 hours ago
    if (now - appSettings.get("lastCheckForUpdates", 0) < twentyFourHours) {
      globalLogger.logDebug("Update check was performed recently, skipping...");
      return;
    }

    // Update last check time
    await appSettings.set("lastCheckForUpdates", now);

    // Get the manifest data
    const manifest = chrome.runtime.getManifest();
    if (!manifest) return;

    // Get the current version of the extension
    const currentVersion = manifest.version;
    globalLogger.logDebug("Current extension version: " + currentVersion);

    // Get the latest version from the server
    const client = new HttpClient({ baseURL: "https://cdmapp.netlify.app/api" });
    const response = await client.get("/extension-version");
    const latestVersion = response.version.replace("v", "");
    globalLogger.logDebug("Latest extension version: " + latestVersion);

    // Compare versions correctly
    if (compareVersions(currentVersion, latestVersion) >= 0) {
      globalLogger.logInfo("Extension is up to date.");
      return;
    }

    globalLogger.logInfo("New version available, downloading...");

    // Create notification
    const notificationId = `update-${Date.now()}`;
    chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: "images/icon-128.png",
      title: "Extension Update Available",
      message: `Update to version ${latestVersion} is available. Click to download the latest version.`,
      contextMessage: "CDM Browser Extension",
      buttons: [{ title: "Download Update" }, { title: "Not Now" }],
      priority: 2,
    });

    // Listen for button clicks
    chrome.notifications.onButtonClicked.addListener(async function onButtonClicked(
      clickedNotificationId,
      buttonIndex
    ) {
      if (clickedNotificationId !== notificationId) return;

      // Remove listener after first click
      chrome.notifications.onButtonClicked.removeListener(onButtonClicked);

      if (buttonIndex === 0) {
        // Download button
        await downloadLatestVersion(latestVersion);
      } else {
        globalLogger.logDebug("User postponed the download.");
      }

      // Clear notification
      chrome.notifications.clear(clickedNotificationId);
    });

    // Listen for notification click (when user clicks the notification body)
    chrome.notifications.onClicked.addListener(function onClicked(clickedNotificationId) {
      if (clickedNotificationId !== notificationId) return;

      chrome.notifications.onClicked.removeListener(onClicked);
      chrome.notifications.clear(clickedNotificationId);
    });
  } catch (e) {
    globalLogger.logError("Error checking for extension updates:", e);
  }
}

/**
 * Compares two version strings.
 * @param versionA - The first version string.
 * @param versionB - The second version string.
 * @returns A negative number if versionA is less than versionB, a positive number if versionA is greater than versionB, and 0 if they are equal.
 */
function compareVersions(versionA: string, versionB: string) {
  // Split the version strings into parts
  const partsA = versionA.split(".").map((part) => parseInt(part, 10));
  const partsB = versionB.split(".").map((part) => parseInt(part, 10));

  // Get the maximum length of the two arrays
  const maxLength = Math.max(partsA.length, partsB.length);

  // Compare each part of the version strings
  for (let i = 0; i < maxLength; i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;

    if (partA > partB) return 1;
    if (partA < partB) return -1;
  }

  return 0;
}

/**
 * Downloads the latest version of the extension.
 * @param latestVersion - The latest version of the extension.
 */
async function downloadLatestVersion(latestVersion: string) {
  try {
    // Use the actual version in download URL
    const downloadUrl = `https://github.com/adel-bakhshi/cdm-browser-extension/releases/download/v${latestVersion}/chromium-extension.zip`;
    // Download the file
    await chrome.downloads.download({
      url: downloadUrl,
      filename: `chromium-extension-v${latestVersion}.zip`,
    });
  } catch (e) {
    globalLogger.logError("Error downloading the latest version:", e);
  }
}

/**
 * Ignores downloads that are failed in CDM and start them in the browser.
 * @param downloadItems - The download items to check.
 * @returns A promise that resolves when the downloads are ignored and started in the browser.
 */
async function ignoreDownloadsAndStartInBrowser(downloadItems: DownloadData[]) {
  // Filter out downloads that are browser native
  const nativeBrowserDownloads = downloadItems.filter((item) => item.isBrowserNative);
  // If there are no native browser downloads, return immediately
  if (nativeBrowserDownloads.length === 0) return;

  globalLogger.logInfo(
    "Ignoring downloads and starting them in the browser...",
    nativeBrowserDownloads.map((item) => item.url)
  );

  for (const downloadItem of nativeBrowserDownloads) {
    // Add download files to ignored downloads
    ignoredDownloads.add(downloadItem.url);
    // Open the download in the browser
    await chrome.tabs.create({ url: downloadItem.url });
  }
}

// ============================================================================
// INITIALIZE THE EXTENSION
// ============================================================================

await initializeExtension();
