const appSettings = {
  enabled: true,
};

// Create settings if not exist
chrome.runtime.onInstalled.addListener(onInstalledAction);

// Check extension enable state when starting up
chrome.runtime.onStartup.addListener(onStartupAction);

// Raise event when user want to download a file
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  // Check extension is enabled
  if (!appSettings.enabled) {
    return;
  }

  // Avoid for showing Save As dialog
  suggest({ filename: downloadItem.filename, conflictAction: "overwrite" });

  // Cancel download
  chrome.downloads.cancel(downloadItem.id);
  chrome.downloads.erase({ id: downloadItem.id });

  // Send download link to CDM
  downloadFile(downloadItem.finalUrl);

  return false;
});

// Toggle extension enable state
chrome.action.onClicked.addListener(actionOnClickedAction);

// Listen to message events
chrome.runtime.onMessage.addListener(handleMessages);

// Handle context menu click
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

async function onInstalledAction() {
  try {
    // Create settings if not exist
    await createSettingsIfNotExists();
    // Load settings
    await loadAppSettings();
    // Set the action badge to the new state
    await changeBadgeState();

    // Add context menu
    createContextMenu();
  } catch (e) {
    console.error(e);
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

    chrome.contextMenus.create(options);
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
  } catch (error) {
    console.error(error);
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
    const { settings } = await chrome.storage.local.get("settings");
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
}

async function checkIsEnabled() {
  try {
    // Get the settings and check if the extension is enabled
    const { settings } = await chrome.storage.local.get("settings");
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
    await chrome.storage.local.set({
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
    await chrome.action.setBadgeText({
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
