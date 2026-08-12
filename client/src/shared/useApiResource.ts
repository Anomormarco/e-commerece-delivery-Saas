import { useCallback, useEffect, useState } from "react";
import { getJson } from "./api";
import { normalizeErrorMessage } from "./errors";
import type { ApiState } from "./types";

const requestTimeoutMs = 12_000;
const defaultErrorMessage = "Өгөгдөл татахад алдаа гарлаа.";

type RefetchOptions = {
  signal?: AbortSignal;
  silent?: boolean;
};

export type ApiResourceState<T> = ApiState<T> & {
  refetch: (options?: AbortSignal | RefetchOptions) => Promise<T | null>;
};

export function useApiResource<T>(path: string): ApiResourceState<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback((options?: AbortSignal | RefetchOptions) => {
    const signal = options instanceof AbortSignal ? options : options?.signal;
    const silent = !(options instanceof AbortSignal) && Boolean(options?.silent);

    if (!silent) {
      setState({ data: null, loading: true, error: null });
    }

    return getJson<T>(path, signal)
      .then((data) => {
        setState({ data, loading: false, error: null });
        return data;
      })
      .catch((error: unknown) => {
        if (!silent) {
          setState({
            data: null,
            loading: false,
            error: normalizeErrorMessage(error, defaultErrorMessage),
          });
        }

        return null;
      });
  }, [path]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);

    void refetch(controller.signal).finally(() => window.clearTimeout(timeoutId));

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [refetch]);

  return { ...state, refetch };
}
