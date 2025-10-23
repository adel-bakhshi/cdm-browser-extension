# Cross Platform Download Manager (CDM) 🚀

<!-- Logo -->
<p align="center">
    <img src="./assets/icons/icon-512.png" alt="Logo" width="256"/>
</p>

**Effortlessly capture download links directly from Google Chrome, Firefox, and other Chromium-Based Browsers with the Cross Platform Download Manager.** 💻🌐

---

## Table of Contents

- [About](#about) 📖
- [How It Works](#how-it-works) ⚙️
- [Key Features](#key-features) ✨
- [Installation](#installation) 🛠️
- [Known Issues & Reporting](#known-issues) ❗
- [Contributing](#contributing) 👷‍♂️
- [Changelog](#changelog) 📋
- [Seeking Help for Chrome Web Store Publication](#seeking-help-for-chrome-web-store-publication) 🚀
- [Support the Project](#support-the-project) ❤️
- [License](#license) 📜
- [Contact](#contact) 📧

---

## About 📖

The **Cross Platform Download Manager (CDM)** is a lightweight, privacy-friendly browser extension that helps you **intercept and manage download links** directly from your browser.  
It’s designed to integrate seamlessly with your desktop download manager, providing **one-click link capture** for Chrome, Firefox, Edge, and other Chromium-based browsers.

---

## How It Works ⚙️

CDM Browser Extension operates through a sophisticated mechanism:

1. **Download Interception**: Using browser APIs like `chrome.downloads.onCreated.addListener` (Chrome) and `browser.downloads.onCreated.addListener` (Firefox), the extension automatically detects when a download is initiated.

2. **Download Redirection**: When a download starts, the extension:

   - Immediately cancels the browser's native download process
   - Captures the download URL and metadata
   - Forwards this information to the CDM desktop application via HTTP protocol

3. **Content Script Integration**: The extension includes content scripts that inject into web pages, enabling users to capture:

   - Direct video and audio file links
   - Media streams (Note: Currently not functional on popular platforms like YouTube and Vimeo)

4. **Communication Protocol**: The CDM desktop application opens a dedicated port to receive download requests from the browser extension, ensuring seamless communication between the two components.

For more details about the CDM desktop application, visit: [CDM Github Page](https://github.com/adel-bakhshi/CrossPlatformDownloadManager)

---

## Key Features ✨

- **Cross-browser compatibility:** Works on Google Chrome, Firefox, Microsoft Edge, Brave, Vivaldi, Opera, and more. 🌟
- **Automatic download interception:** Captures and redirects downloads to CDM desktop application. 🎯
- **Content script integration:** Enables detection of media files on web pages. 🎬
- **Customizable settings:** Tailor the extension to fit your preferences. 🔧
- **Seamless integration:** Enhances your browsing experience without disrupting it. 🔄

---

## Installation 🛠️

### 🧭 Google Chrome / Chromium-Based Browsers

⚠️ **Important Note**: Currently, the extension is not available on the Chrome Web Store due to sanctions restrictions. However, you can safely install it manually using the steps below. Your security and privacy remain fully protected.

**Installation Steps:**

1. Download the extension `.zip` file from our [Releases page](https://github.com/adel-bakhshi/cdm-browser-extension/releases)
2. Extract the downloaded file to a folder on your computer
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer Mode** toggle (top-right corner)
5. Click **Load unpacked** button
6. Select the extracted extension folder
7. Confirm installation when prompted

✅ **Success!** The extension is now installed and ready to use.

For a visual guide with screenshots, visit our [installation tutorial](https://cdmapp.netlify.app/browser-extension).

### 🦊 Mozilla Firefox

Install directly from [Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/cdm-browser-extension/).

---

## Known Issues & Reporting ❗

Currently, there are no known critical issues with the extension. However, if you encounter any problems or have suggestions for improvement, please [report them](https://github.com/adel-bakhshi/cdm-browser-extension/issues). Your feedback helps us make CDM better! 🐛

---

## Contributing 👷‍♂️

We ❤️ open-source contributions! Whether it's fixing a typo or adding a new feature, every bit helps.

1. **Fork the repository:** Start by forking the [GitHub Repository](https://github.com/adel-bakhshi/cdm-browser-extension). 🍴
2. **Create a new branch:** Make your changes in a dedicated branch (e.g., `fix-bug` or `add-feature`). 🌱
3. **Submit a pull request:** Once your changes are ready, submit a pull request with a clear description of what you've done. 📝
4. **Follow coding standards:** Ensure your code aligns with the project's existing style and conventions. ✅

If you have questions or need clarification, feel free to open an issue on the [GitHub Repository](https://github.com/adel-bakhshi/cdm-browser-extension). 🤔

---

## Changelog 📋

For detailed information about changes in each version, please refer to our [CHANGELOG.md](CHANGELOG.md) file.

---

## Seeking Help for Chrome Web Store Publication 🚀

Due to sanctions policies against my country, I'm currently unable to publish the extension on the Google Chrome Web Store. If you can assist with publishing the extension on the Chrome Web Store, I would be extremely grateful.

**How you can help:**

- Publish the extension on your Chrome Developer account
- Assist with the review process and policy compliance
- Help maintain the store listing

If you're able to help, please contact me at: [adelbakhshi78@yahoo.com](mailto:adelbakhshi78@yahoo.com). Your support will make CDM accessible to millions of Chrome users worldwide!

---

## ❤️ Support the Project

If you find **Cross Platform Download Manager (CDM)** useful and would like to support its development, consider making a donation. Your contributions help cover development costs and ensure the continued improvement of the program.

<table class="table">
  <thead>
    <tr>
      <th scope="col" width="1000px">Donate via Bitcoin</th>
      <th scope="col" width="1000px">Donate via Ethereum</th>
      <th scope="col" width="1000px">Donate via Tether</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center">
        <img src="./assets/donate/Bitcoin.jpeg" width="200px" alt="Donate via Bitcoin">
        <br>
        Bitcoin Address:
        bc1qx3cyervg9wrrpqtr65ew5h7a9h2dnl5n7eul9k
      </td>
      <td align="center">
        <img src="./assets/donate/Ethereum.jpeg" width="200px" alt="Donate via Ethereum">
        <br>
        Ethereum Address:
        0x6D66BdD07EBA5876f1E4E96B96237C0F272c3F27
      </td>
      <td align="center">
        <img src="./assets/donate/Tether.jpeg" width="200px" alt="Donate via Tether">
        <br>
        Tether Address:
        TC7CtsRLgX1aWrKL1eVKMwc9TCXyBkNheu
      </td>
    </tr>
  </tbody>
</table>

Thank you for your support! Every contribution makes a difference and helps keep CDM free and open-source for everyone.

---

## License 📜

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Contact 📧

For questions, feedback, or support, please open an issue on the [GitHub Repository](https://github.com/adel-bakhshi/cdm-browser-extension) or reach out directly via email: [adelbakhshi78@yahoo.com](mailto:adelbakhshi78@yahoo.com).

Thank you for supporting **Cross Platform Download Manager (CDM)**! ❤️  
Your feedback and contributions make this project better every day.
