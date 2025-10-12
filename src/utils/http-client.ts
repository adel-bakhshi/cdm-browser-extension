import axios from "axios";
import Logger from "./logger";

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from "axios";
import type { HttpError } from "./models/http-error";
import type { ApiResponse } from "./models/api-response";

// Create a new logger instance for the HttpClient
const httpClientLogger = new Logger("Http Client");

/**
 * HttpClient class for handling HTTP requests using Axios
 */
class HttpClient {
  /**
   * Axios instance for making HTTP requests
   */
  private readonly _client: AxiosInstance;

  /**
   * @param config - Axios configuration
   */
  constructor(config: AxiosRequestConfig = {}) {
    httpClientLogger.logInfo("Initializing HttpClient...");

    // Create Axios instance with provided configuration
    httpClientLogger.logInfo("Creating Axios instance...");
    this._client = axios.create({
      baseURL: config.baseURL || "",
      timeout: config.timeout || 10000,
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
    });

    // Add request interceptor
    this._client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        httpClientLogger.logDebug(`Making ${config.method?.toUpperCase()} request to: ${config.url}`);
        return config;
      },
      (error: AxiosError) => {
        httpClientLogger.logError("Request interceptor error:", error.message);
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    this._client.interceptors.response.use(
      (response: AxiosResponse) => {
        httpClientLogger.logDebug(`Response received: ${response.status} ${response.statusText}`);
        return response;
      },
      (error: AxiosError) => {
        httpClientLogger.logError(`Request failed:`, error.message);
        return this._handleError(error);
      }
    );
  }

  /**
   * Handle HTTP errors.
   * @param error - The error object.
   * @throws Throws a custom HttpError object.
   */
  private _handleError(error: AxiosError): never {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      const errorMessage = (data as any)?.message || `HTTP Error ${status}`;

      throw {
        status,
        message: errorMessage,
        data: data,
        isHttpError: true,
      } as HttpError;
    } else if (error.request) {
      // Request made but no response received
      throw {
        status: 0,
        message: "Network error: No response received",
        isNetworkError: true,
      } as HttpError;
    } else {
      // Something else happened
      throw {
        status: -1,
        message: error.message,
        isClientError: true,
      } as HttpError;
    }
  }

  /**
   * Perform GET request.
   * @param url - The URL to request.
   * @param params - Query parameters.
   * @param config - Additional axios config.
   * @returns A promise that resolves to the response data.
   */
  public async get<TResult = any>(
    url: string,
    params: Record<string, any> = {},
    config: AxiosRequestConfig = {}
  ): Promise<TResult> {
    try {
      const response: AxiosResponse<TResult> = await this._client.get(url, {
        params,
        ...config,
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform POST request.
   * @param url - The URL to request.
   * @param data - The data to send.
   * @param config - Additional axios config.
   * @returns A promise that resolves to the response data.
   */
  public async post<TResult = any, TData = any>(
    url: string,
    data: TData = {} as TData,
    config: AxiosRequestConfig = {}
  ): Promise<TResult> {
    try {
      const response: AxiosResponse<TResult> = await this._client.post(url, data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform PUT request.
   * @param url - The URL to request.
   * @param data - The data to send.
   * @param config - Additional axios config.
   * @returns A promise that resolves to the response data.
   */
  public async put<TResult = any, TData = any>(
    url: string,
    data: TData = {} as TData,
    config: AxiosRequestConfig = {}
  ): Promise<TResult> {
    try {
      const response: AxiosResponse<TResult> = await this._client.put(url, data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform PATCH request.
   * @param url - The URL to request.
   * @param data - The data to send.
   * @param config - Additional axios config.
   * @returns A promise that resolves to the response data.
   */
  public async patch<TResult = any, TData = any>(
    url: string,
    data: TData = {} as TData,
    config: AxiosRequestConfig = {}
  ): Promise<TResult> {
    try {
      const response: AxiosResponse<TResult> = await this._client.patch(url, data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform DELETE request.
   * @param url - The URL to request.
   * @param config - Additional axios config.
   * @returns A promise that resolves to the response data.
   */
  public async delete<TResult = any>(url: string, config: AxiosRequestConfig = {}): Promise<TResult> {
    try {
      const response: AxiosResponse<TResult> = await this._client.delete(url, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform HEAD request.
   * @param url - The URL to request.
   * @param config - Additional axios config.
   * @returns A promise that resolves to the response data.
   */
  public async head(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    try {
      return await this._client.head(url, config);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform OPTIONS request.
   * @param url - The URL to request.
   * @param config - Additional axios config.
   * @returns A promise that resolves to the response data.
   */
  public async options(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    try {
      return await this._client.options(url, config);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Make a custom request.
   * @param config - Axios request config.
   * @returns A promise that resolves to the response data.
   */
  public async request<TResult = any>(config: AxiosRequestConfig): Promise<AxiosResponse<TResult>> {
    try {
      return await this._client.request<TResult>(config);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set default headers.
   * @param headers - Headers to set.
   */
  public setHeaders(headers: Record<string, string>) {
    this._client.defaults.headers.common = {
      ...this._client.defaults.headers.common,
      ...headers,
    } as any;
  }

  /**
   * Set authentication token.
   * @param token - The authentication token.
   */
  public setAuthToken(token: string | null) {
    if (token) {
      this._client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete this._client.defaults.headers.common["Authorization"];
    }
  }

  /**
   * Set base URL.
   * @param baseURL - The base URL.
   */
  public setBaseURL(baseURL: string) {
    this._client.defaults.baseURL = baseURL;
  }

  /**
   * Set request timeout.
   * @param timeout - Timeout in milliseconds.
   */
  public setTimeout(timeout: number) {
    this._client.defaults.timeout = timeout;
  }
}

export default HttpClient;
export type { HttpError, ApiResponse };
