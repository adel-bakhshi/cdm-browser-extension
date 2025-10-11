import HttpClient from "./http-client";
import Logger from "./logger";

import type { ExtensionSettings } from "./models/extension-settings";

// Create a new instance of Logger for AppSettings
const appSettingsLogger = new Logger("App Settings");

/**
 * AppSettings class to manage extension settings.
 */
class AppSettings {
  /**
   * The singleton instance of AppSettings.
   */
  private static _instance: AppSettings | null = null;

  /**
   * Define a variable that indicates the storage key for settings.
   */
  private readonly storageKey: string;

  /**
   * Define a variable that indicates the last fetch time for settings.
   * This is used to prevent frequent fetches.
   */
  private lastFetchTime: number;

  /**
   * Define a variable that indicates extension settings.
   */
  private _settings: ExtensionSettings;

  /**
   * Gets a value that indicates extension settings.
   */
  get settings() {
    return this._settings;
  }

  /**
   * Initializes a new instance of AppSettings.
   */
  constructor() {
    this._settings = {
      enabled: true,
      supportedFileTypes: [],
      lastCheckForUpdates: 0,
    };

    this.storageKey = "settings";
    this.lastFetchTime = 0;
  }

  /**
   * Get the singleton instance of AppSettings
   * @returns The singleton instance
   */
  public static async getInstance() {
    if (!AppSettings._instance) {
      AppSettings._instance = new AppSettings();

      // If not initialized, initialize the AppSettings
      await AppSettings._instance._initialize();
    }

    return AppSettings._instance;
  }

  /**
   * Initialize the AppSettings by loading settings from storage.
   */
  private async _initialize() {
    try {
      await this.updateSupportedFileTypes();
      await this._loadFromStorage();
      this._addChangeListener();
      appSettingsLogger.logSuccess("AppSettings initialized successfully");
    } catch (error) {
      appSettingsLogger.logError("Failed to initialize AppSettings:", error);
      throw error;
    }
  }

  /**
   * Loads settings from storage.
   */
  private async _loadFromStorage() {
    try {
      // Load settings from storage
      const result = await chrome.storage.local.get(this.storageKey);

      // Check if settings exist in storage,
      // Otherwise, use default settings and save them to storage.
      if (result[this.storageKey]) {
        this._settings = { ...this._settings, ...result[this.storageKey] };
        appSettingsLogger.logDebug("Settings loaded from storage:", this._settings);
      } else {
        appSettingsLogger.logDebug("No settings found in storage, using defaults");
        await this._saveToStorage();
      }
    } catch (error) {
      appSettingsLogger.logError("Error loading settings from storage:", error);
      throw error;
    }
  }

  /**
   * Fetches and updates supported file types from CDM application.
   */
  public async updateSupportedFileTypes() {
    try {
      // Get current time
      const now = Date.now();
      // Check if it's been more than 5 minutes since the last fetch (cache for 5 minutes)
      if (now - this.lastFetchTime < 5 * 60 * 1000) {
        appSettingsLogger.logDebug("Supported file types are still valid, no need to fetch again.");
        return;
      }

      // Update the last fetch time
      this.lastFetchTime = now;

      // Fetch the supported file types from the CDM API
      const client = new HttpClient({ baseURL: "http://localhost:5000" });
      const response = await client.get("/cdm/download/filetypes/");

      // Check if the response is successful
      if (!response.isSuccessful) {
        appSettingsLogger.logError(`Failed to fetch supported file types. Error: ${response.message}`);
        return;
      }

      // Update the supported file types in memory
      await this.set("supportedFileTypes", response.data);
      appSettingsLogger.logDebug("Supported file types updated.");
    } catch (error) {
      appSettingsLogger.logError("It's seems that the CDM is not running. Please start it and try again.", error);
    }
  }

  /**
   * Saves settings to storage.
   */
  private async _saveToStorage() {
    try {
      await chrome.storage.local.set({ [this.storageKey]: this._settings });
      appSettingsLogger.logDebug("Settings saved to storage:", this._settings);
    } catch (error) {
      appSettingsLogger.logError("Error saving settings to storage:", error);
      throw error;
    }
  }

  /**
   * Gets the value of a specific setting.
   * @param key - The key of the setting.
   * @param defaultValue - The default value to return if the setting is not found.
   * @returns The value of the setting.
   */
  public get<TResult>(key: string, defaultValue: TResult) {
    // Check if the key exists in the settings object
    const keys = Object.keys(this._settings);
    if (keys.includes(key)) {
      // Get the value of the key from the settings object
      const value = Object.values(this._settings)[keys.indexOf(key)];
      return value as TResult;
    }

    // Return the default value if the key is not found
    return defaultValue;
  }

  /**
   * Updates an existing value or sets a new value for a specific setting.
   * @param key - The key of the setting.
   * @param value - The new value to set.
   */
  public async set<TValue>(key: string, value: TValue | null) {
    // Check if the key exists in the settings object
    const keys = Object.keys(this._settings);
    const keyExists = keys.includes(key);
    if (!keyExists) {
      appSettingsLogger.logError(`Setting "${key}" does not exist.`);
      return;
    }

    const currentValue = Object.values(this._settings)[keys.indexOf(key)];
    if (currentValue !== value) {
      this._settings = { ...this._settings, [key]: value };
      await this._saveToStorage();
      appSettingsLogger.logInfo(`Setting "${key}" updated to: `, value);
    }
  }

  /**
   * Adds a listener for changes to the settings.
   */
  private _addChangeListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes[this.storageKey]) {
        const newSettings = changes[this.storageKey].newValue;
        this._settings = { ...this._settings, ...newSettings };
      }
    });

    appSettingsLogger.logDebug("Settings change listener added.");
  }

  /**
   * Returns whether the extension is enabled.
   * @returns Whether the extension is enabled.
   */
  public isEnabled() {
    return this.get<boolean>("enabled", true);
  }

  /**
   * Returns whether the extension supports a specific file type.
   * @param fileType - The file type to check.
   * @returns Whether the extension supports the file type.
   */
  public isContainingFileType(fileType: string) {
    return this.get<string[]>("supportedFileTypes", []).includes(fileType);
  }
}

// Create a singleton instance of AppSettings
const appSettings = await AppSettings.getInstance();
// Export the singleton instance
export default appSettings;
