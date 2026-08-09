import { useCallback, useEffect, useState } from "react";
import { getJson } from "./api";
import { normalizeErrorMessage } from "./errors";
import type { ApiState } from "./types";

export function useApiResource<T>(path: string): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback((signal?: AbortSignal) => {
    setState({ data: null, loading: true, error: null });

    return getJson<T>(path, signal)
      .then((data) => {
        setState({ data, loading: false, error: null });
        return data;
      })
      .catch((error: unknown) => {
        if (signal?.aborted) return null;
        setState({
          data: null,
          loading: false,
          error: normalizeErrorMessage(error, "Өгөгдөл татахад алдаа гарлаа."),
        });
        return null;
      });
  }, [path]);

  useEffect(() => {
    const controller = new AbortController();

    void refetch(controller.signal);

    return () => controller.abort();
  }, [refetch]);

  return { ...state, refetch } as ApiState<T> & { refetch: () => Promise<T | null> };
}
