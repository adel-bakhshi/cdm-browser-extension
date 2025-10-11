import type { AxiosRequestConfig } from "axios";

/**
 * Generic response interface.
 */
interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: AxiosRequestConfig;
}

export type { ApiResponse };
