/**
 * Chrome Download Manager (CDM) Extension - Background Script
 *
 * This script handles download interception, context menu actions,
 * and communication with the CDM desktop application.
 */

// Extension settings with default values
const appSettings = {
  enabled: true,
  supportedFileTypes: [],
  lastCheckForUpdates: 0,
};

// Save last fetch time for supported file types (cache management)
let lastFetchTime = 0;

// Track captured downloads to prevent duplicate processing
let capturedDownloads = new Set();

// Map to store download tab information.
const urlToTabIdMap = new Map();

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

/**
 * Extension installed event handler
 */
chrome.runtime.onInstalled.addListener(onInstalledAction);

/**
 * Browser startup event handler
 */
chrome.runtime.onStartup.addListener(onStartupAction);

/**
 * Web request event handler - captures tabId for downloads.
 */
chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestAction, {
  urls: ["<all_urls>"],
});

/**
 * Download creation event handler - triggered when a download starts
 */
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  await handleDownload(downloadItem);
});

/**
 * Download filename determination event handler - allows intercepting downloads
 */
chrome.downloads.onDeterminingFilename.addListener(async (downloadItem, suggest) => {
  await handleDownload(downloadItem, suggest);
});

/**
 * Extension icon click event handler
 */
chrome.action.onClicked.addListener(actionOnClickedAction);

/**
 * Message handling from content scripts and popup
 */
chrome.runtime.onMessage.addListener(handleMessages);

/**
 * Context menu click event handler
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
 * Tab creation event handler - updates supported file types when new tab is created
 */
chrome.tabs.onCreated.addListener(async () => await updateSupportedFileTypes());

/**
 * Alarm event handler - handle keep-alive alarm
 */
chrome.alarms.onAlarm.addListener((alarm) => onAlarmAction(alarm));

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Handles extension installation
 * @async
 */
async function onInstalledAction() {
  try {
    // Create settings if not exist
    await createSettingsIfNotExists();
    // Load settings from storage
    await loadAppSettings();
    // Update supported file types from CDM
    await updateSupportedFileTypes();
    // Update extension badge state
    await changeBadgeState();

    // Add context menu items
    createContextMenu();

    // Keep-alive alarm
    await chrome.alarms.create("keep-alive", { periodInMinutes: 0.5 });

    // Check for extension updates
    await checkForExtensionUpdates();
  } catch (error) {
    console.error("An error occurred when the app installed:", error);
  }
}

/**
 * Creates context menu items for the extension
 */
function createContextMenu() {
  try {
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
  } catch (e) {
    console.error(e);
  }
}

/**
 * Handles browser startup
 * @async
 */
async function onStartupAction() {
  try {
    // Load settings from storage
    await loadAppSettings();
    // Update extension badge state
    await changeBadgeState();
    // Update supported file types from CDM
    await updateSupportedFileTypes();
  } catch (error) {
    console.error("An error occurred when the app started:", error);
  }
}

/**
 * Web request event handler - captures tabId for downloads.
 * @param {object} details - Web request details.
 */
function onBeforeRequestAction(details) {
  // Define relevant types for capturing tabId
  const relevantTypes = ["main_frame", "sub_frame", "other", "xmlhttprequest"];
  // Only store tabId for valid tabs (tabId > 0) and for main_frame, sub_frame, and other types.
  if (details.tabId > 0 && relevantTypes.includes(details.type)) {
    // Store the tabId for the given URL.
    urlToTabIdMap.set(details.url, details.tabId);

    // Remove the entry after a short period to avoid stale data.
    setTimeout(() => {
      if (urlToTabIdMap.has(details.url)) urlToTabIdMap.delete(details.url);
    }, 5000);
  }
}

/**
 * Handles download interception and processing
 * @async
 * @param {Object} downloadItem - The download item object from Chrome API
 * @param {Function} [suggest=null] - Optional suggest function for filename determination
 */
async function handleDownload(downloadItem, suggest = null) {
  try {
    // Make sure the extension is enabled
    if (!appSettings.enabled) return;

    // Make sure the download is not already captured
    if (capturedDownloads.has(downloadItem.id)) {
      // Avoiding to show "Save as" if the download confirmed
      if (suggest) suggest({ filename: downloadItem.filename, conflictAction: "overwrite" });
      // Ignore the download because it's already captured
      return;
    }

    // Capture and save download item id
    capturedDownloads.add(downloadItem.id);

    // Get file extension using multiple detection methods
    const fileExtension = getFileExtension(downloadItem);

    // Check if the file extension is supported by CDM
    if (appSettings.supportedFileTypes.includes(fileExtension)) {
      // Avoiding to show "Save as" if the download confirmed
      if (suggest) suggest({ filename: downloadItem.filename, conflictAction: "overwrite" });

      // Cancel the download in the browser
      await runWithDelayAsync(async () => {
        try {
          await chrome.downloads.cancel(downloadItem.id);
          await chrome.downloads.erase({ id: downloadItem.id });
        } catch (error) {
          console.error("Failed to cancel download:", error);
        }
      }, 100);

      // Check for last error
      checkLastError();

      // Create download data
      const data = await getDownloadData(downloadItem);
      // Send download link to CDM desktop application
      await downloadFile([data]);
    } else {
      // Allow the download in browser (unsupported file type)
      console.log("Download allowed in browser:", downloadItem.filename);
    }
  } catch (error) {
    console.error("An error occurred while trying to capture download item.", error);
  } finally {
    // Clean up captured downloads after 1 second to prevent memory leaks
    setTimeout(() => capturedDownloads.delete(downloadItem.id), 1000);
  }
}

/**
 * Gets download data from download item.
 * @param {Object} downloadItem - The download item object from Chrome API.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the download data.
 */
async function getDownloadData(downloadItem) {
  // Get referer from download item
  const referer = downloadItem.referrer ?? downloadItem.initiator ?? null;

  // Map download URL to tab ID
  const downloadUrl = downloadItem.finalUrl ?? downloadItem.url;
  const tabId = urlToTabIdMap.get(downloadUrl) || null;

  // Get page address if available
  let pageAddress = null;
  if (tabId && tabId > 0) {
    try {
      // Remove download URL from map
      urlToTabIdMap.delete(downloadUrl);

      // Get tab URL
      const tab = await chrome.tabs.get(tabId);
      pageAddress = tab.url;

      // Check for last error
      checkLastError();
    } catch (e) {
      console.error("Failed to get tab URL:", e);
      pageAddress = null;
    }
  }

  return createDownloadObject(downloadUrl, referer, pageAddress);
}

/**
 * Sends download request to CDM desktop application
 * @async
 * @param {Array} data - Array of download objects containing URLs
 */
async function downloadFile(data) {
  try {
    // Send request to download the file via CDM API
    const response = await fetch("http://localhost:5000/cdm/download/add/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    // Get the response from CDM
    const result = await response.json();

    // Make sure that no error occurred
    if (!result.isSuccessful) {
      console.log(result.message ?? "Failed to download file");
      return;
    }

    // Log that the download has started
    const message =
      data.length > 1 ? `Download files added or started in CDM.` : `Download file added or started in CDM.`;

    console.log(result.message ?? message, data);
  } catch (error) {
    console.log("CDM connection error:", error);
  }
}

/**
 * Creates default settings if they don't exist in storage
 * @async
 */
async function createSettingsIfNotExists() {
  try {
    const { settings } = await chrome.storage.local.get("settings");
    if (settings) {
      return;
    }

    // Save the default settings
    await saveAppSettings();
  } catch (error) {
    console.error(error);
  }
}

/**
 * Loads application settings from storage
 * @async
 */
async function loadAppSettings() {
  // Get the settings and check if the extension is enabled
  const { settings } = await chrome.storage.local.get("settings");

  // Load enabled state
  appSettings.enabled = settings.enabled;
  console.log(`Extension is ${appSettings.enabled ? "enabled" : "disabled"}`);

  // Load last check for updates
  appSettings.lastCheckForUpdates = settings.lastCheckForUpdates ?? 0;
  console.log(`Last check for updates: ${appSettings.lastCheckForUpdates}`);

  // Load supported file types (without saving to avoid overwriting)
  await updateSupportedFileTypes(false);
}

/**
 * Saves application settings to storage
 * @async
 */
async function saveAppSettings() {
  try {
    // Save enabled state and supported file types
    await chrome.storage.local.set({
      settings: appSettings,
    });
  } catch (error) {
    console.error(error);
  }
}

/**
 * Handles extension icon click to toggle enabled state
 * @async
 */
async function actionOnClickedAction() {
  try {
    // Toggle enabled state
    appSettings.enabled = !appSettings.enabled;
    // Save the new state
    await saveAppSettings();
    // Update the extension badge
    await changeBadgeState();
  } catch (error) {
    console.error(error);
  }
}

/**
 * Updates the extension badge to show enabled/disabled state
 * @async
 */
async function changeBadgeState() {
  try {
    await chrome.action.setBadgeText({
      text: appSettings.enabled ? "" : "Off",
    });
  } catch (error) {
    console.error(error);
  }
}

/**
 * Handles messages from content scripts and popup
 * @async
 * @param {Object} message - The message object
 * @param {Object} sender - The sender information
 * @param {Function} sendResponse - Callback function to send response
 */
async function handleMessages(message, sender, sendResponse) {
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
        const data = createDownloadObject(message.url, tabUrl, tabUrl);
        // Download the file
        await downloadFile([data]);
        break;
      }

      default: {
        sendResponse({ isSuccessful: false, message: "Invalid message type" });
        break;
      }
    }
  } catch (e) {
    console.error(e);
  }
}

/**
 * Handles single item context menu clicks
 * @async
 * @param {Object} info - Context menu click information
 * @param {Object} tab - The active tab object
 */
async function handleSingleItemContextMenuClick(info, tab) {
  try {
    // Define data object to be sent to CDM
    const data = createDownloadObject("", tab.url, tab.url);

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
      console.log(`No valid URL found for ${info.mediaType}`);
      return;
    }

    // Download the file
    await downloadFile([data]);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Handles multiple items context menu clicks (link selection)
 * @async
 * @param {Object} info - Context menu click information
 * @param {Object} tab - The active tab object
 */
async function handleMultipleItemsContextMenuClick(info, tab) {
  try {
    // Get selected links from the document
    const links = await extractLinksFromSelection(tab.id, info.selectionText);
    // Check if there are any links
    if (links.length > 0) {
      // Log the links data
      console.log("Downloading multiple links:", links);
      // Convert links to data object format
      const result = links.map((link) => createDownloadObject(link, tab.url, tab.url));
      // Download the files
      await downloadFile(result);
    }
  } catch (e) {
    console.error("An error occurred while trying to handle multiple items context menu click: ", e);
  }
}

/**
 * Extracts links from selected text in the current tab
 * @async
 * @param {number} tabId - The ID of the current tab
 * @param {string} selectionText - The selected text content
 * @returns {Array} Array of extracted URLs
 */
async function extractLinksFromSelection(tabId, selectionText) {
  try {
    // Check if the selection text is a valid URL
    if (isValidUrl(selectionText)) {
      return [selectionText];
    }

    // Extract links from document content using scripting API
    const links = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Run extractor script to extract links from selected content
        const selectedLinks = [];
        const selection = window.getSelection();

        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const ancestor = range.commonAncestorContainer;
          const parentElement = ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor.parentElement;

          if (parentElement) {
            // Find all anchor tags within the selected area
            parentElement.querySelectorAll("a[href]").forEach((a) => {
              if (selection.containsNode(a, true)) {
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
    console.error("Error extracting links:", error);
    return [];
  }
}

/**
 * Validates if a string is a valid URL
 * @param {string} string - The string to validate
 * @returns {boolean} True if the string is a valid URL
 */
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Fetches and updates supported file types from CDM application
 * @async
 * @param {boolean} [saveSettings=true] - Whether to save settings after update
 */
async function updateSupportedFileTypes(saveSettings = true) {
  try {
    // Get current time
    const now = Date.now();
    // Check if it's been more than 5 minutes since the last fetch (cache for 5 minutes)
    if (now - lastFetchTime < 5 * 60 * 1000) {
      return;
    }

    // Update the last fetch time
    lastFetchTime = now;

    // Fetch the supported file types from the CDM API
    const response = await fetch("http://localhost:5000/cdm/download/filetypes/");
    const result = await response.json();

    // Check if the response is successful
    if (!result.isSuccessful) {
      console.error(`Failed to fetch supported file types. Error: ${result.message}`);
      return;
    }

    // Update the supported file types in memory
    appSettings.supportedFileTypes = result.data;
    console.log("Supported file types updated");

    // Save settings to storage if requested
    if (saveSettings) await saveAppSettings();
  } catch (error) {
    console.log("It's seems that the CDM is not running. Please start it and try again.", error);
  }
}

/**
 * Handles alarm action
 * @param {any} alarm - Alarm object
 */
function onAlarmAction(alarm) {
  if (alarm.name === "keep-alive") {
    // Keep-alive action
    console.log("Service worker keep-alive...");
  }
}

// ============================================================================
// FILE EXTENSION UTILITY FUNCTIONS
// ============================================================================

/**
 * Extracts the file extension from a download item using multiple methods
 * @param {Object} downloadItem - The download item containing file information
 * @returns {string} The file extension with dot prefix, empty string if not found
 */
function getFileExtension(downloadItem) {
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
    if (!extension || !appSettings.supportedFileTypes.includes(extension)) {
      extension = extractFileExtensionFromUrl(downloadItem.url);
    }
  }

  // If still no valid extension, try to extract from MIME type
  if (!extension || !appSettings.supportedFileTypes.includes(extension)) {
    const mimeType = downloadItem.mime;
    if (mimeType && mimeType.includes("/")) {
      // Extract extension from MIME type (e.g., "image/png" -> ".png")
      extension = `.${mimeType.split("/")[1].toLowerCase()}`;
    }
  }

  return extension;
}

/**
 * Extracts the file extension from a given URL
 * @param {string} url - The URL from which to extract the file extension
 * @returns {string} The file extension in lowercase, with leading/trailing whitespace removed
 */
function extractFileExtensionFromUrl(url) {
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
 * Runs an action with a delay.
 * @param {function} action - The action to run.
 * @param {number} delay - The delay in milliseconds.
 * @returns {Promise} A promise that resolves after the delay.
 */
function runWithDelayAsync(action, delay) {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const result = await action();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }, delay);
  });
}

/**
 * Checks for the last error and logs it if present.
 */
function checkLastError() {
  const lastError = chrome.runtime.lastError;
  if (lastError) console.error("An error occurred while trying to cancel download item.", lastError);
}

/**
 * Creates the download data object to be sent to CDM.
 * @param {string} url - The URL of the file to be downloaded.
 * @param {string} referer - The referer URL.
 * @param {string} pageAddress - The page address.
 * @returns {Object} The download data object.
 */
function createDownloadObject(url, referer, pageAddress) {
  return {
    url,
    referer,
    pageAddress,
  };
}

/**
 * Checks for extension updates.
 * @returns {Promise} A promise that resolves when the check is complete.
 */
async function checkForExtensionUpdates() {
  try {
    // Get the current time
    const now = Date.now();
    // Calculate 24 hours in milliseconds
    const twentyFourHours = 24 * 60 * 60 * 1000;
    // Check if the last update check was more than 24 hours ago
    if (now - appSettings.lastCheckForUpdates < twentyFourHours) {
      console.log("Update check was performed recently, skipping...");
      return;
    }

    // Update last check time
    appSettings.lastCheckForUpdates = now;
    await saveAppSettings();

    // Get the manifest data
    const manifest = chrome.runtime.getManifest();
    if (!manifest) return;

    // Get the current version of the extension
    const currentVersion = manifest.version;
    console.log("Current extension version: " + currentVersion);

    // Get the latest version from the server
    const response = await fetch("https://cdmapp.netlify.app/api/extension-version");
    const result = await response.json();
    const latestVersion = result.version.replace("v", "");
    console.log("Latest extension version: " + latestVersion);

    // Compare versions correctly
    if (compareVersions(currentVersion, latestVersion) >= 0) {
      console.log("Extension is up to date");
      return;
    }

    console.log("New version available, downloading...");

    // Create notification
    const notificationId = `update-${Date.now()}`;
    await chrome.notifications.create(notificationId, {
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
        console.log("User postponed the download");
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
    console.error("Error checking for extension updates:", e);
  }
}

/**
 * Compares two version strings.
 * @param {String} versionA - The first version string.
 * @param {String} versionB - The second version string.
 * @returns {Number} - A negative number if versionA is less than versionB, a positive number if versionA is greater than versionB, and 0 if they are equal.
 */
function compareVersions(versionA, versionB) {
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
 * @param {String} latestVersion - The latest version of the extension.
 */
async function downloadLatestVersion(latestVersion) {
  try {
    // Use the actual version in download URL
    const downloadUrl = `https://github.com/adel-bakhshi/cdm-browser-extension/releases/download/v${latestVersion}/chromium-extension.zip`;
    // Download the file
    await chrome.downloads.download({
      url: downloadUrl,
      filename: `chromium-extension-v${latestVersion}.zip`,
    });
  } catch (e) {
    console.error("Error downloading the latest version:", e);
  }
}
