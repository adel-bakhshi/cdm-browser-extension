// Define popup elements
let popup;
let popupHeader;
let popupMenu;

// Define popup buttons
let closePopupButton;
let showHideMenuButton;

// Define timer for search
let searchTimer;

/**
 * Finds all media elements (video and audio) in the document and retrieves their sources.
 *
 * This function searches the document for all video and audio elements, collects their
 * current source URLs, and also checks for nested source elements within these media elements.
 * It then filters out duplicate sources to ensure each source is only listed once in the result.
 *
 * @returns {Array} An array of objects, each containing the 'source' URL and the corresponding 'element'.
 */
function findMediaElements() {
  // Select all video and audio elements in the document
  const mediaElements = document.querySelectorAll("video, audio");

  // Initialize an array to store the sources of the media elements
  const data = [];
  for (const element of mediaElements) {
    // Check the tag name of the element to determine if it's a video or audio element
    switch (element.tagName.toLowerCase()) {
      case "video":
      case "audio": {
        // Add the current source of the element to the data array
        data.push({ source: element.currentSrc, element: element });
        // Find all source elements within the current media element
        const sourceElements = element.querySelectorAll("source");
        for (const sourceElement of sourceElements) {
          // Add each source element's src attribute to the data array
          data.push({ source: sourceElement.src, element: element });
        }

        break;
      }
    }
  }

  // Initialize an array to store distinct sources
  const result = [];
  for (const item of data) {
    // Check if the source is already in the result array to avoid duplicates
    if (!result.some((el) => el.source === item.source)) {
      result.push(item);
    }
  }

  // Return the array of distinct sources
  return result;
}

/**
 * Creates a popup element with a header, menu, and action buttons.
 * The popup includes a logo, a message, a show/hide menu button, and a close button.
 * The show/hide button and close button use SVG icons for their visuals.
 */
function createPopup() {
  // Create popup
  const popupDiv = document.createElement("div");
  popupDiv.id = "cdm-popup";

  // Create header
  const popupHeaderDiv = document.createElement("div");
  popupHeaderDiv.id = "cdm-popup-header";

  // Create logo
  const logo = document.createElement("span");
  logo.className = "logo";
  logo.textContent = "CDM";

  // Create message
  const message = document.createElement("span");
  message.className = "message";
  message.textContent = "Media found";

  // Create actions
  const actions = document.createElement("div");
  actions.className = "actions";

  // Create show/hide menu button
  const showHideButton = document.createElement("button");
  showHideButton.type = "button";
  showHideButton.className = "cdm-button";
  showHideButton.id = "show-hide-cdm-menu";

  // Create show/hide menu SVG icon
  const showHideSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  showHideSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  showHideSVG.setAttribute("viewBox", "0 0 512 512");

  const showHidePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  showHidePath.setAttribute(
    "d",
    "M256 0a256 256 0 1 0 0 512A256 256 0 1 0 256 0zM135 241c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l87 87 87-87c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9L273 345c-9.4 9.4-24.6 9.4-33.9 0L135 241z"
  );

  // Add icon to show/hide button
  showHideSVG.appendChild(showHidePath);
  showHideButton.appendChild(showHideSVG);

  // Create close button
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "cdm-button";
  closeButton.id = "close-cdm-popup";

  // Create close SVG icon
  const closeSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  closeSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  closeSVG.setAttribute("viewBox", "0 0 512 512");

  const closePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  closePath.setAttribute(
    "d",
    "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z"
  );

  // Add icon to close button
  closeSVG.appendChild(closePath);
  closeButton.appendChild(closeSVG);

  // Add show/hide button, close button to actions
  actions.appendChild(showHideButton);
  actions.appendChild(closeButton);

  // Add logo, message, actions to header
  popupHeaderDiv.appendChild(logo);
  popupHeaderDiv.appendChild(message);
  popupHeaderDiv.appendChild(actions);

  // Create menu
  const popupMenuDiv = document.createElement("ul");
  popupMenuDiv.id = "cdm-popup-menu";

  // Add header, menu to popup
  popupDiv.appendChild(popupHeaderDiv);
  popupDiv.appendChild(popupMenuDiv);

  // Add popup to body
  document.body.appendChild(popupDiv);
}

/**
 * Creates menu items based on the provided media elements.
 *
 * @param {Array} mediaElements - An array of objects containing data for each media element.
 *   Each object should have properties that define the media element.
 * @example
 * // Example mediaElements array
 * const mediaElements = [
 *   { name: "Home", link: "#" },
 *   { name: "About", link: "#" },
 *   { name: "Contact", link: "#" }
 * ];
 *
 * This function will clear the existing menu items in the popupMenu element and create new menu items
 * based on the provided mediaElements array. Each menu item will be created using the createMenuItem
 * function, passing the element data and its index (plus one) as arguments.
 */
function createMenuItems(mediaElements) {
  // Clear menu
  popupMenu.innerHTML = "";

  // Create menu items
  mediaElements.forEach((elementData, index) => {
    createMenuItem(elementData, index + 1);
  });
}

/**
 * Creates a menu item for a given element data and row number.
 *
 * @param {Object} elementData - The data for the element, including the source and the element reference.
 * @param {number} row - The row number for the menu item.
 */
function createMenuItem(elementData, row) {
  // Get the name of the source
  const mediaName = (getFileName(elementData.source) ?? elementData.source)?.trim();
  if (!mediaName) return;

  // Create list item
  const listItem = document.createElement("li");
  listItem.setAttribute("data-source", elementData.source);
  listItem.title = elementData.source;
  listItem.onclick = menuItemOnClick;

  // Create row number
  const rowNumber = document.createElement("span");
  rowNumber.classList.add("row-number");
  rowNumber.textContent = `${row}.`;

  // Create row text
  const rowText = document.createElement("span");
  rowText.textContent = mediaName;

  // Create navigate to media element button
  const navigateButton = document.createElement("button");
  navigateButton.type = "button";
  navigateButton.className = "navigate-button";

  const navigateSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  navigateSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  navigateSVG.setAttribute("viewBox", "0 0 512 512");
  const navigatePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  navigatePath.setAttribute(
    "d",
    "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24l0 112c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-112c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"
  );

  // Add icon to navigate button
  navigateSVG.appendChild(navigatePath);
  navigateButton.appendChild(navigateSVG);

  // Add row number and text to list item
  listItem.appendChild(rowNumber);
  listItem.appendChild(rowText);
  listItem.appendChild(navigateButton);

  // Add event to navigate button
  navigateButton.addEventListener("click", (e) => {
    e.stopPropagation();
    // Scroll to media element
    elementData.element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });

  // Check if popup menu exists
  if (!popupMenu) {
    return;
  }

  // Add list item to popup menu
  popupMenu.appendChild(listItem);
}

/**
 * Handles the click event for a menu item.
 *
 * This function is triggered when a menu item is clicked. It retrieves the menu item,
 * extracts the source URL from it, sends a message to the Chrome runtime to initiate
 * a download, and then hides the popup menu.
 *
 * @param {Event} event - The click event triggered by the user.
 */
async function menuItemOnClick(event) {
  // Get menu item
  let menuItem = event.target;
  while (menuItem && menuItem.tagName.toLowerCase() !== "li") {
    menuItem = menuItem.parentElement;
  }

  // If no menu item is found, exit the function
  if (!menuItem) {
    return;
  }

  // Get source
  const source = menuItem.getAttribute("data-source");
  // If no source attribute is found, exit the function
  if (!source) {
    return;
  }

  // Send url to cdm for download
  await chrome.runtime.sendMessage({
    type: "download_media",
    url: source,
  });

  // Hide popup menu
  showHideMenuButton.click();
}

/**
 * Extracts the file name from a given source URL or path.
 *
 * @param {string} source - The source URL or path from which to extract the file name.
 * @returns {string} The extracted file name with any URL parameters and percent-encoded spaces removed.
 *
 * This function performs the following steps:
 * 1. Splits the source string by '/' and retrieves the last element (the file name).
 * 2. If the file name contains a '?', it splits the file name by '?' and takes the first part (removing URL parameters).
 * 3. Replaces any '%' characters in the file name with spaces (decoding percent-encoded spaces).
 */
function getFileName(source) {
  let fileName = source.split("/").pop();
  if (fileName.includes("?")) {
    fileName = fileName.split("?")[0];
  }

  while (fileName.includes("%")) {
    fileName = fileName.replace("%", " ");
  }

  return fileName;
}

/**
 * Function to find and manipulate elements related to a popup.
 * This function locates the popup, its header, and menu, as well as the buttons for closing and showing/hiding the menu.
 * It also sets up event listeners for these buttons to handle the popup's behavior.
 */
function findElements() {
  // Find popup elements
  popup = document.getElementById("cdm-popup");
  popupHeader = document.getElementById("cdm-popup-header");
  popupMenu = document.getElementById("cdm-popup-menu");

  // Find popup buttons
  closePopupButton = document.getElementById("close-cdm-popup");
  showHideMenuButton = document.getElementById("show-hide-cdm-menu");

  // Event listener for closing the popup
  closePopupButton.addEventListener("click", function () {
    popup.classList.remove("show");

    // Set interval for removing popup after 1 second
    const removePopup = setTimeout(function () {
      popup.remove();
      clearTimeout(removePopup);
    }, 1000);

    // Clear interval (if any) related to search functionality
    clearInterval(searchTimer);
  });

  // Event listener for showing/hiding the menu
  showHideMenuButton.addEventListener("click", function () {
    if (popupMenu.classList.contains("show")) {
      this.classList.remove("reverse");
      popupMenu.classList.remove("show");
      setTimeout(() => popup.classList.remove("expand"), 300);
    } else {
      this.classList.add("reverse");
      popup.classList.add("expand");
      setTimeout(() => popupMenu.classList.add("show"), 300);
    }
  });
}

/**
 * Initializes the popup menu with media elements.
 *
 * This function searches for media elements on the page, creates a popup if it doesn't exist,
 * populates the popup with menu items based on the found media elements, and displays the popup
 * if there are items to show.
 */
function initializePopup() {
  try {
    // Find media elements and get sources
    const mediaElements = findMediaElements();
    if (mediaElements.length == 0) return;

    // Check if popup exists
    if (!popup) {
      // Create popup
      createPopup();
      // Find popup elements
      findElements();
    }

    // Create menu items based on the found media elements
    createMenuItems(mediaElements);

    // Show popup if there are menu items
    var items = popupMenu.querySelectorAll("li");
    if (items.length > 0) {
      setTimeout(() => {
        popup.classList.add("show");
      }, 1000);
    }
  } catch (e) {
    console.error(e);
  }
}

// Initialize the popup when the content loaded successfully
(function () {
  // Initialize popup
  initializePopup();

  // Search for media elements every 1 minute
  searchTimer = setInterval(initializePopup, 60 * 1000);
})();
