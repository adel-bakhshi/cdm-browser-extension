/**
 * Define error types.
 */
interface HttpError {
  status: number;
  message: string;
  data?: any;
  isHttpError?: boolean;
  isNetworkError?: boolean;
  isClientError?: boolean;
}

export type { HttpError };
