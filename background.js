// Create settings if not exist
chrome.runtime.onInstalled.addListener(async () => {
  // Get the settings
  const { settings } = await chrome.storage.local.get("settings");

  // If settings not found, set default value and load settings again
  if (!settings) {
    await chrome.storage.local.set({
      settings: {
        enabled: true,
      },
    });
  }

  // Check if the extension is enabled
  const isEnabled = await checkIsEnabled();
  // Set the action badge to the new state
  chrome.action.setBadgeText({
    text: isEnabled ? "" : "Off",
  });
});

// Raise event when user want to download a file
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  // Capture the download URL
  const downloadUrl = downloadItem.url;

  try {
    // First pause the download on Chrome
    await pauseDownload(downloadItem);

    // Make sure extension is enabled
    const isEnabled = await checkIsEnabled();
    if (!isEnabled) {
      // Resume the download
      await resumeDownload(downloadItem);
      return;
    }

    // Send request to find if the file is supported by CDM
    const response = await fetch("http://localhost:5000/download/check/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: downloadUrl }),
    });

    // Get the response
    const data = await response.json();
    // Make sure the file is supported
    if (!data.isSuccessful) {
      console.log(data.message ?? "Failed to download file");

      // Resume the download
      await resumeDownload(downloadItem);
      return;
    }

    // Log response message
    console.log(data.message ?? "An error occurred when trying to get response message.");
    // Cancel the download in Chrome
    await cancelDownload(downloadItem);

    // Start download file in CDM
    await downloadFile(downloadUrl);
  } catch (error) {
    console.log(error);
    // Resume the download
    await resumeDownload(downloadItem);
  }
});

async function pauseDownload(downloadItem) {
  await chrome.downloads.pause(downloadItem.id);
  console.log("Download paused in Chrome:", downloadItem.url);
}

async function resumeDownload(downloadItem) {
  await chrome.downloads.resume(downloadItem.id);
  console.log("Download resumed in Chrome:", downloadItem.url);
}

async function cancelDownload(downloadItem) {
  await chrome.downloads.cancel(downloadItem.id);
  console.log("Download canceled in Chrome:", downloadItem.url);
}

async function downloadFile(downloadUrl) {
  try {
    // Send request to download the file
    const response = await fetch("http://localhost:5000/download/add/", {
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

async function checkIsEnabled() {
  try {
    // Get the settings and check if the extension is enabled
    const { settings } = await chrome.storage.local.get("settings");
    const isEnabled = settings.enabled;
    console.log(`Extension is ${isEnabled ? "enabled" : "disabled"}`);

    return isEnabled;
  } catch (error) {
    console.log(error);
    return false;
  }
}

chrome.action.onClicked.addListener(async () => {
  // Get the current state of the extension
  const isEnabled = await checkIsEnabled();
  console.log(isEnabled);

  // Toggle the extension state
  await chrome.storage.local.set({
    settings: {
      enabled: !isEnabled,
    },
  });

  // Set the action badge to the new state
  await chrome.action.setBadgeText({
    text: !isEnabled ? "" : "Off",
  });
});
