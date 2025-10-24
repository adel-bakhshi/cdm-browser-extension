interface DownloadData {
  url: string;
  referer: string | null;
  pageAddress: string | null;
  description: string | null;
  isBrowserNative: boolean;
}

export type { DownloadData };
