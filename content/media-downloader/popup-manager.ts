import { truncateString } from "../../utils/utilities";
import Logger from "../../utils/logger";

import type { MediaData } from "./models/media-data";

/**
 * Manages the popup UI and its interactions.
 */
export default class PopupManager {
  /**
   * The logger instance.
   */
  private readonly _logger: Logger;

  /**
   * The list of media data to be displayed in the popup.
   */
  private readonly _mediaData: MediaData[] = [];

  /**
   * The popup element.
   */
  public popup: HTMLElement | null;

  /**
   * The popup menu element.
   */
  public popupMenu: HTMLElement | null;

  /**
   * The close button element.
   */
  public closeButton: HTMLElement | null;

  /**
   * The toggle button element.
   */
  public toggleButton: HTMLElement | null;

  /**
   * Initializes the popup manager.
   * @param logger The logger instance.
   */
  constructor(logger: Logger) {
    this.popup = null;
    this.popupMenu = null;
    this.closeButton = null;
    this.toggleButton = null;
    this._logger = logger;
  }

  /**
   * Initialize the popup manager.
   */
  public async init() {
    // Getting the HTML template
    const url = chrome.runtime.getURL("/templates/popup-template.html");
    const html = await fetch(url).then((response) => response.text());
    this._logger.logDebug("Popup template loaded. Template content: " + truncateString(html, 10));

    // Creating the HTML DOM
    const template = document.createElement("div");
    template.innerHTML = html;
    this.popup = template.firstElementChild as HTMLElement;
    this._logger.logDebug("Popup DOM created.");

    // Adding to the document
    document.body.appendChild(this.popup);
    this._logger.logDebug("Popup added to the document.");

    // Getting the elements
    this.popupMenu = document.getElementById("cdm-popup-menu");
    this.closeButton = document.getElementById("close-cdm-popup");
    this.toggleButton = document.getElementById("show-hide-cdm-menu");
    this._logger.logDebug("Popup elements retrieved.");

    // Adding event listeners
    this._setupEventListeners();
  }

  /**
   * Setups event listeners for the popup.
   */
  private _setupEventListeners() {
    this._logger.logDebug("Setting up event listeners for the popup.");

    // Adding event listener for close button
    this.closeButton!.addEventListener("click", () => this.hide());

    // Adding event listener for toggle menu button
    this.toggleButton!.addEventListener("click", () => {
      this.toggleMenu();
    });

    // Using event delegation for the menu
    this.popupMenu!.addEventListener("click", (e) => {
      // Find the closest navigate button
      const navigateButton = (e.target as HTMLElement)?.closest(".navigate-button");
      // If navigate button is found, scroll to the media element and stop propagation
      if (navigateButton) {
        e.stopPropagation();
        const source = navigateButton.closest("li")?.getAttribute("data-source") ?? "";
        const data = this._mediaData.find((media) => media.source === source);
        if (data) {
          this._logger.logDebug("Scrolling to media element...", data.element);
          data.element.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        return;
      }

      // Find closest menu item and download the media
      const menuItem = (e.target as HTMLElement)?.closest("li");
      if (menuItem) {
        const source = menuItem.getAttribute("data-source");
        if (source) {
          this._downloadMedia(source);
        }
      }
    });
  }

  /**
   * Shows the popup.
   */
  public show() {
    this._logger.logDebug("Showing the popup...");
    this.popup!.classList.add("show");
  }

  /**
   * Hides the popup.
   */
  public hide() {
    this._logger.logDebug("Hiding the popup...");
    this.popup!.classList.remove("show");
    setTimeout(() => this.popup!.remove(), 1000);
  }

  /**
   * Toggles the popup menu.
   */
  public toggleMenu() {
    this._logger.logDebug("Toggling the popup menu...");

    // If popup is already expanded, hide it
    // Otherwise, show it
    if (this.popupMenu!.classList.contains("show")) {
      this.toggleButton!.classList.remove("reverse");
      this.popupMenu!.classList.remove("show");
      setTimeout(() => this.popup!.classList.remove("expand"), 300);
    } else {
      this.toggleButton!.classList.add("reverse");
      this.popup!.classList.add("expand");
      setTimeout(() => this.popupMenu!.classList.add("show"), 300);
    }
  }

  /**
   * Updates the popup menu with the given media elements.
   * @param mediaElements - Array of media elements to be displayed in the popup menu.
   */
  public async updateMenu(mediaElements: MediaData[]) {
    this._logger.logDebug("Updating the popup menu...");

    // Clear the current menu
    this.popupMenu!.innerHTML = "";
    // Clear old media data
    this._mediaData.splice(0);

    // Load the list item template
    const url = chrome.runtime.getURL("./templates/list-item-template.html");
    const template = await fetch(url).then((response) => response.text());

    mediaElements.forEach((data, index) => {
      // Get the file name
      const fileName = this._getFileName(data.source);
      // If file name is not available, skip this element
      if (!fileName) return;

      // Create the list item
      const listItem = document.createElement("li");
      listItem.setAttribute("data-source", data.source);

      // Set the list item content
      listItem.innerHTML = template.replace("{{ rowNumber }}", `${index + 1}.`).replace("{{ fileName }}", fileName);

      // Add the list item to the menu
      this.popupMenu!.appendChild(listItem);
      // Add media to the list
      this._mediaData.push(data);
    });

    // Show the popup if there are any media elements
    if (this._mediaData.length > 0) {
      setTimeout(() => this.show(), 1000);
    }
  }

  /**
   * Extracts the file name from the given source URL.
   * @param source - The source URL of the media file.
   * @returns The extracted file name.
   */
  private _getFileName(source: string): string {
    // Get the last part of the URL as the file name
    let fileName = source.split("/").pop();
    if (!fileName) {
      return "";
    }

    // Remove query parameters from the file name
    if (fileName.includes("?")) {
      fileName = fileName.split("?")[0];
    }

    // Replace % with space
    while (fileName.includes("%")) {
      fileName = fileName.replace("%", " ");
    }

    return fileName;
  }

  /**
   * Downloads the media file from the given URL.
   * @param url - The URL of the media file to be downloaded.
   */
  private async _downloadMedia(url: string): Promise<void> {
    this._logger.logDebug(`Downloading media from ${url}...`);

    // Send a message to the background script to download the media
    await chrome.runtime.sendMessage({
      type: "download_media",
      url: url,
    });

    // Toggle the menu
    this.toggleMenu();
  }
}
