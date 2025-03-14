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

// Subscribe to the onDeterminingFilename event
browser.downloads.onDeterminingFilename.addListener(async (downloadItem, suggest) => {
  try {
    // Make sure the extension is enabled
    if (!appSettings.enabled) return;

    // Get file extension
    const fileExtension = getFileExtension(downloadItem);
    // Check if the file extension is supported
    if (appSettings.supportedFileTypes.includes(fileExtension)) {
      // Avoiding to show "Save as" if the download confirmed
      suggest({ filename: downloadItem.filename, conflictAction: "overwrite" });

      // Cancel the download in the browser
      await browser.downloads.cancel(downloadItem.id);
      await browser.downloads.erase({ id: downloadItem.id });

      // Send download link to CDM
      await downloadFile(downloadItem.url);
    } else {
      // Allow the download in browser
      console.log("Download allowed in browser:", downloadItem.filename);
    }
  } catch (error) {
    console.error("An error occurred while trying to capture download item.", error);
  }
});

// Subscribe to the onClick event
browser.action.onClicked.addListener(actionOnClickedAction);

// Handle messages
browser.runtime.onMessage.addListener(handleMessages);

// Handle context menu click
browser.contextMenus.onClicked.addListener(handleContextMenuClick);

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
    const contexts = ["link", "image", "video", "audio"];
    const options = {
      contexts,
      id: "cdm-context-menu",
      title: "Download with CDM",
    };

    browser.contextMenus.create(options);
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

async function downloadFile(downloadUrl) {
  try {
    // Send request to download the file
    const response = await fetch("http://localhost:5000/cdm/download/add/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: downloadUrl }),
    });

    // Get the response
    const data = await response.json();
    // Make sure that no error occurred
    if (!data.isSuccessful) {
      console.log(data.message ?? "Failed to download file");
      return;
    }

    // Log that the download has started
    console.log(data.message ?? `Download started in CDM: ${downloadUrl}`);
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
        await downloadFile(message.url);
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

async function handleContextMenuClick(info, tab) {
  try {
    if (info.mediaType) {
      // Handle images, videos and audios
      switch (info.mediaType?.toLowerCase()) {
        case "image": {
          await downloadFile(info.linkUrl);
          break;
        }

        case "video":
        case "audio": {
          await downloadFile(info.srcUrl);
          break;
        }
      }
    } else if (info.linkUrl) {
      // Handle links
      await downloadFile(info.linkUrl);
    }
  } catch (e) {
    console.error(e);
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
    const url = downloadItem.url;
    const lastSlashIndex = url.lastIndexOf("/");
    const fileName = url.substring(lastSlashIndex + 1);

    return fileName.includes("?")
      ? fileName.substring(fileName.lastIndexOf("."), fileName.indexOf("?")).toLowerCase().trim()
      : fileName.substring(fileName.lastIndexOf(".")).toLowerCase().trim();
  }
}
