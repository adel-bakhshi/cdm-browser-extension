const appSettings = {
  enabled: true,
  supportedFileTypes: [],
};

// Save last fetch time
let lastFetchTime = 0;

// Subscribe to the onInstalled event
browser.runtime.onInstalled.addListener(onInstalledAction);

// Subscribe to the onStartup event
browser.runtime.onStartup.addListener(onStartupAction);

// Subscribe to the download create event
// onDeterminingFilename not supported in Firefox
browser.downloads.onCreated.addListener((downloadItem) => {
  setTimeout(async () => {
    try {
      // Make sure the extension is enabled
      if (!appSettings.enabled) return;

      // Get file extension
      const fileExtension = getFileExtension(downloadItem);
      // Check if the file extension is supported
      if (appSettings.supportedFileTypes.includes(fileExtension)) {
        // Cancel the download in the browser
        await browser.downloads.cancel(downloadItem.id);
        await browser.downloads.erase({ id: downloadItem.id });

        // Send download link to CDM
        await downloadFile([{ url: downloadItem.finalUrl ?? downloadItem.url }]);
      } else {
        // Allow the download in browser
        console.log("Download allowed in browser:", downloadItem.filename);
      }
    } catch (error) {
      console.error("An error occurred while trying to capture download item.", error);
    }
  }, 100);
});

// Subscribe to the onClick event
browser.action.onClicked.addListener(actionOnClickedAction);

// Handle messages
browser.runtime.onMessage.addListener(handleMessages);

// Handle context menu click
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

// Update supported file types when a new tab is created
browser.tabs.onCreated.addListener(async () => await updateSupportedFileTypes());

async function onInstalledAction() {
  try {
    // Create settings if not exist
    await createSettingsIfNotExists();
    // Load settings
    await loadAppSettings();
    // Update supported file types
    await updateSupportedFileTypes();
    // Set the action badge to the new state
    await changeBadgeState();

    // Add context menu
    createContextMenu();
  } catch (error) {
    console.error("An error occurred when the app installed:", error);
  }
}

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

async function onStartupAction() {
  try {
    // Load settings
    await loadAppSettings();
    // Set the action badge to the new state
    await changeBadgeState();
    // Update supported file types
    await updateSupportedFileTypes();
  } catch (error) {
    console.error("An error occurred when the app started:", error);
  }
}

async function downloadFile(data) {
  try {
    // Send request to download the file
    const response = await fetch("http://localhost:5000/cdm/download/add/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    // Get the response
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
    console.log(error);
  }
}

async function createSettingsIfNotExists() {
  try {
    const { settings } = await browser.storage.local.get("settings");
    if (settings) {
      return;
    }

    // Save the settings
    await saveAppSettings();
  } catch (error) {
    console.error(error);
  }
}

async function loadAppSettings() {
  // Load enabled state
  appSettings.enabled = await checkIsEnabled();
  // Load supported file types
  await updateSupportedFileTypes(false);
}

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

async function saveAppSettings() {
  try {
    // Save enabled state
    await browser.storage.local.set({
      settings: appSettings,
    });
  } catch (error) {
    console.error(error);
  }
}

async function actionOnClickedAction() {
  try {
    // Change enabled state
    appSettings.enabled = !appSettings.enabled;
    // Toggle the extension state
    await saveAppSettings();
    // Set the action badge to the new state
    await changeBadgeState();
  } catch (error) {
    console.error(error);
  }
}

async function changeBadgeState() {
  try {
    await browser.action.setBadgeText({
      text: appSettings.enabled ? "" : "Off",
    });
  } catch (error) {
    console.error(error);
  }
}

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

async function extractLinksFromSelection(tabId, selectionText) {
  try {
    // Check if the selection text is a valid URL
    if (isValidUrl(selectionText)) {
      return [selectionText];
    }

    // Extract links from document content
    const links = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Run extractor script to extract links
        const selectedLinks = [];
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const ancestor = range.commonAncestorContainer;
          const parentElement = ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor.parentElement;

          if (parentElement) {
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

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

async function updateSupportedFileTypes(saveSettings = true) {
  try {
    // Get current time
    const now = Date.now();
    // Check if it's been more than 5 minutes since the last fetch
    if (now - lastFetchTime < 5 * 60 * 1000) {
      return;
    }

    // Update the last fetch time
    lastFetchTime = now;
    // Fetch the supported file types from the CDM
    const response = await fetch("http://localhost:5000/cdm/download/filetypes/");
    const result = await response.json();
    // Check if the response is successful
    if (!result.isSuccessful) {
      console.error(`Failed to fetch supported file types. Error: ${result.message}`);
      return;
    }

    // Update the supported file types
    appSettings.supportedFileTypes = result.data;
    console.log("Supported file types updated");

    // Save settings
    if (saveSettings) await saveAppSettings();
  } catch (error) {
    console.error("An error occurred while trying to update supported file types", error);
  }
}

function getFileExtension(downloadItem) {
  const fileName = downloadItem.filename;
  if (fileName) {
    return fileName.substring(fileName.lastIndexOf(".")).toLowerCase().trim();
  } else {
    // Extract file extension from URL
    const url = downloadItem.finalUrl ?? downloadItem.url;
    const lastSlashIndex = url.lastIndexOf("/");
    const fileName = url.substring(lastSlashIndex + 1);

    return fileName.includes("?")
      ? fileName.substring(fileName.lastIndexOf("."), fileName.indexOf("?")).toLowerCase().trim()
      : fileName.substring(fileName.lastIndexOf(".")).toLowerCase().trim();
  }
}
