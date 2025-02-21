// Create settings if not exist
browser.runtime.onInstalled.addListener(onInstalledAction);

// Check extension enable state when starting up
browser.runtime.onStartup.addListener(onStartupAction);

// Raise event when user want to download a file
browser.downloads.onCreated.addListener(async (downloadItem) => await downloadsOnCreatedAction(downloadItem));

// Toggle extension enable state
browser.action.onClicked.addListener(actionOnClickedAction);

// Listen to message events
browser.runtime.onMessage.addListener(handleMessages);

// Handle context menu click
browser.contextMenus.onClicked.addListener(handleContextMenuClick);

async function onInstalledAction() {
  try {
    // Get the settings
    const { settings } = await browser.storage.local.get("settings");

    // If settings not found, set default value and load settings again
    if (!settings) {
      await browser.storage.local.set({
        settings: {
          enabled: true,
        },
      });
    }

    // Check if the extension is enabled
    const isEnabled = await checkIsEnabled();
    // Set the action badge to the new state
    await changeBadgeState(isEnabled);

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

    browser.contextMenus.create(options);
  } catch (e) {
    console.error(e);
  }
}

async function onStartupAction() {
  // Check if the extension is enabled
  const isEnabled = await checkIsEnabled();
  // Set the action badge to the new state
  await changeBadgeState(isEnabled);
}

async function downloadsOnCreatedAction(downloadItem) {
  try {
    // First pause the download on FireFox
    await pauseDownload(downloadItem);

    // Get the download item again
    downloadItem = await findDownloadItemById(downloadItem.id);
    // Capture the download URL
    const downloadUrl = downloadItem.finalUrl;

    // Make sure extension is enabled
    const isEnabled = await checkIsEnabled();
    if (!isEnabled) {
      // Resume the download
      await resumeDownload(downloadItem);
      return;
    }

    // Cancel the download in FireFox
    await cancelDownload(downloadItem);

    // Start download file in CDM
    await downloadFile(downloadUrl);
  } catch (error) {
    console.log(error);
    // Resume the download
    await resumeDownload(downloadItem);
  }
}

async function pauseDownload(downloadItem) {
  await browser.downloads.pause(downloadItem.id);
  console.log("Download paused:", downloadItem);
}

async function resumeDownload(downloadItem) {
  await browser.downloads.resume(downloadItem.id);
  console.log("Download resumed:", downloadItem);
}

async function cancelDownload(downloadItem) {
  await browser.downloads.cancel(downloadItem.id);
  await browser.downloads.erase({ id: downloadItem.id });
  console.log("Download canceled:", downloadItem);
}

async function findDownloadItemById(downloadId) {
  const downloadItems = await browser.downloads.search({ id: downloadId });
  return downloadItems[0];
}

// Download file in CDM
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

// Check extension enable state
async function checkIsEnabled() {
  try {
    // Get the settings and check if the extension is enabled
    const { settings } = await browser.storage.local.get("settings");
    const isEnabled = settings.enabled;
    console.log(`Extension is ${isEnabled ? "enabled" : "disabled"}`);

    return isEnabled;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function actionOnClickedAction() {
  // Get the current state of the extension
  const isEnabled = await checkIsEnabled();
  console.log(isEnabled);

  // Toggle the extension enable state
  await browser.storage.local.set({
    settings: {
      enabled: !isEnabled,
    },
  });

  // Set the action badge to the new state
  await changeBadgeState(!isEnabled);
}

// Change badge state
async function changeBadgeState(isEnabled) {
  await browser.action.setBadgeText({
    text: isEnabled ? "" : "Off",
  });
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
