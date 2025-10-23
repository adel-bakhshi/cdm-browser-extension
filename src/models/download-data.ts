interface DownloadData {
  url: string;
  referer: string | null;
  pageAddress: string | null;
  isBrowserNative: boolean;
}

export type { DownloadData };
