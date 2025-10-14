import LogLevel from "../../utils/enums/log-level";
import Logger from "../../utils/logger";
import MediaFinder from "./media-finder";
import PopupManager from "./popup-manager";

// Create a new instance of the Logger class
const mediaPopupLogger = new Logger("Media Popup", LogLevel.Warning);

// Define required variables
let popupManager: PopupManager;
let searchTimer: any;

/**
 * Initializes the popup and manage it.
 * @returns A promise that resolves when the popup is initialized.
 */
async function initializePopup() {
  try {
    mediaPopupLogger.logInfo("Initializing popup...");

    // Find media elements on the page
    mediaPopupLogger.logInfo("Searching for media elements...");
    const mediaElements = MediaFinder.findMediaElements();
    // Check if any media elements were found
    if (mediaElements.length === 0) {
      mediaPopupLogger.logInfo("No media elements found.");
      return;
    }

    // Check if the popup manager is already initialized
    if (!popupManager) {
      mediaPopupLogger.logInfo("Initializing popup manager...");
      popupManager = new PopupManager(mediaPopupLogger);
      await popupManager.init();
    }

    // Update the popup menu with the found media elements
    mediaPopupLogger.logInfo("Updating popup menu...");
    await popupManager.updateMenu(mediaElements);
  } catch (error) {
    mediaPopupLogger.logError("Error initializing popup:", error);
  }
}

// Run the script
(async function () {
  // Initialize the popup
  await initializePopup();
  // Start the search timer
  searchTimer = setInterval(initializePopup, 60 * 1000);
})();
