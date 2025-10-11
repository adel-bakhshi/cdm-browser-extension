/**
 * Represents the application settings.
 */
interface ExtensionSettings {
  enabled: boolean;
  supportedFileTypes: string[];
  lastCheckForUpdates: number;
}

export type { ExtensionSettings };
