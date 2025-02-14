let popup;
let popupHeader;
let popupMenu;

let closePopupButton;
let showHideMenuButton;

// Find all video and audio elements
function findMediaElementsAndGetSources() {
  const mediaElements = document.querySelectorAll("video, audio");

  // Get video and audio sources
  let sources = [];
  for (const element of mediaElements) {
    switch (element.tagName.toLowerCase()) {
      case "video":
      case "audio": {
        sources.push(element.currentSrc);
        const sourceElements = element.querySelectorAll("source");
        for (const sourceElement of sourceElements) {
          sources.push(sourceElement.src);
        }

        break;
      }
    }
  }

  // Distinct sources
  return sources.filter((item, index) => sources.indexOf(item) === index);
}

// Create popup
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

// Create menu items
function createMenuItems(sources) {
  // Clear menu
  popupMenu.innerHTML = "";

  // Create menu items
  sources.forEach((source, index) => {
    createMenuItem(source, index + 1);
  });
}

// Create menu item
function createMenuItem(source, row) {
  // Create list item
  const listItem = document.createElement("li");
  listItem.setAttribute("data-source", source);
  listItem.title = source;
  listItem.onclick = menuItemOnClick;

  // Create row number
  const rowNumber = document.createElement("span");
  rowNumber.classList.add("row-number");
  rowNumber.textContent = `${row}.`;

  // Create row text
  const rowText = document.createElement("span");
  rowText.textContent = getFileName(source) ?? source;

  // Add row number and text to list item
  listItem.appendChild(rowNumber);
  listItem.appendChild(rowText);

  // Find popup menu
  const popupMenu = document.getElementById("cdm-popup-menu");
  if (!popupMenu) {
    return;
  }

  // Add list item to popup menu
  popupMenu.appendChild(listItem);
}

// Menu item on click
async function menuItemOnClick(event) {
  // Get menu item
  let menuItem = event.target;
  while (menuItem && menuItem.tagName.toLowerCase() !== "li") {
    menuItem = menuItem.parentElement;
  }

  if (!menuItem) {
    return;
  }

  // Get source
  const source = menuItem.getAttribute("data-source");
  if (!source) {
    return;
  }

  // Send url to cdm for download
  await browser.runtime.sendMessage({
    type: "download_media",
    url: source,
  });

  // Hide popup menu
  showHideMenuButton.click();
}

// Get file name
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

function findElements() {
  // Find popup
  popup = document.getElementById("cdm-popup");
  popupHeader = document.getElementById("cdm-popup-header");
  popupMenu = document.getElementById("cdm-popup-menu");

  // Find popup buttons
  closePopupButton = document.getElementById("close-cdm-popup");
  showHideMenuButton = document.getElementById("show-hide-cdm-menu");

  // Close popup
  closePopupButton.addEventListener("click", function () {
    popup.classList.remove("show");

    // Set interval for removing popup  after 1 second
    const removePopup = setTimeout(function () {
      popup.remove();
      clearTimeout(removePopup);
    }, 1000);

    // Clear interval
    clearInterval(searchTimer);
  });

  // Show/Hide menu
  showHideMenuButton.addEventListener("click", function () {
    popupMenu.classList.toggle("show");
    this.classList.toggle("reverse");
  });
}

// Initialize popup
function initializePopup() {
  // Find media elements and get sources
  const sources = findMediaElementsAndGetSources();
  if (sources.length == 0) return;

  // Check if popup exists
  if (!popup) {
    // Create popup
    createPopup();
    // Find popup elements
    findElements();
  }

  // Create menu items
  createMenuItems(sources);

  // Show popup
  setTimeout(() => {
    popup.classList.add("show");
  }, 1000);
}

// Initialize popup
initializePopup();

// Search for media elements every 10 seconds
const searchTimer = setInterval(initializePopup, 10000);
