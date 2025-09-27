/**
 * Firefox Download Manager (CDM) Extension - Background Script
 *
 * This script handles download interception, context menu actions,
 * and communication with the CDM desktop application.
 */

// Extension settings with default values
const appSettings = {
  enabled: true,
  supportedFileTypes: [],
};

// Save last fetch time for supported file types (cache management)
let lastFetchTime = 0;

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

/**
 * Extension installed event handler
 */
browser.runtime.onInstalled.addListener(onInstalledAction);

/**
 * Browser startup event handler
 */
browser.runtime.onStartup.addListener(onStartupAction);

/**
 * Download creation event handler - triggered when a download starts
 * onDeterminingFilename not supported in Firefox
 */
browser.downloads.onCreated.addListener((downloadItem) => {
  setTimeout(async () => await handleDownload(downloadItem), 50);
});

/**
 * Extension icon click event handler
 */
browser.action.onClicked.addListener(actionOnClickedAction);

/**
 * Message handling from content scripts and popup
 */
browser.runtime.onMessage.addListener(handleMessages);

/**
 * Context menu click event handler
 */
browser.contextMenus.onClicked.addListener(async (info, tab) => {
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
browser.tabs.onCreated.addListener(async () => await updateSupportedFileTypes());

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
    browser.contextMenus.create({
      id: "cdm-single-item",
      title: "Download with CDM",
      contexts: ["link", "image", "video", "audio"],
    });

    // Multiple menu item (just for links)
    browser.contextMenus.create({
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
 * Handles download interception and processing
 * @async
 * @param {Object} downloadItem - The download item object from Browser API
 */
async function handleDownload(downloadItem) {
  try {
    // Make sure the extension is enabled
    if (!appSettings.enabled) return;

    // Get file extension using multiple detection methods
    const fileExtension = getFileExtension(downloadItem);

    // Check if the file extension is supported by CDM
    if (appSettings.supportedFileTypes.includes(fileExtension)) {
      // Cancel the download in the browser
      await browser.downloads.cancel(downloadItem.id);
      await browser.downloads.erase({ id: downloadItem.id });

      // Send download link to CDM desktop application
      await downloadFile([{ url: downloadItem.finalUrl ?? downloadItem.url }]);
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
    const { settings } = await browser.storage.local.get("settings");
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
  // Load enabled state
  appSettings.enabled = await checkIsEnabled();
  // Load supported file types (without saving to avoid overwriting)
  await updateSupportedFileTypes(false);
}

/**
 * Checks if the extension is enabled from storage
 * @async
 * @returns {boolean} True if extension is enabled
 */
async function checkIsEnabled() {
  try {
    // Get the settings and check if the extension is enabled
    const { settings } = await browser.storage.local.get("settings");
    console.log(`Extension is ${settings.enabled ? "enabled" : "disabled"}`);

    return settings.enabled;
  } catch (error) {
    console.error(error);
    return false;
  }
}

/**
 * Saves application settings to storage
 * @async
 */
async function saveAppSettings() {
  try {
    // Save enabled state and supported file types
    await browser.storage.local.set({
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
    await browser.action.setBadgeText({
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
        await downloadFile([{ url: message.url }]);
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
    if (info.mediaType) {
      // Handle images, videos and audios
      switch (info.mediaType?.toLowerCase()) {
        case "image": {
          await downloadFile([{ url: info.linkUrl }]);
          break;
        }

        case "video":
        case "audio": {
          await downloadFile([{ url: info.srcUrl }]);
          break;
        }
      }
    } else if (info.linkUrl) {
      // Handle links
      await downloadFile([{ url: info.linkUrl }]);
    }
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
    if (links.length > 0) {
      console.log("Downloading multiple links:", links);
      const result = links.map((link) => ({ url: link }));
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
    const links = await browser.scripting.executeScript({
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
