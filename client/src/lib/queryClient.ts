// client/src/lib/queryClient.ts
import { QueryClient, type QueryFunction, type QueryFunctionContext } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Swapped helper: richer errors with status/body and robust JSON/text handling
export async function apiRequest<T>(
  method: string,
  url: string,
  body?: any
): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include", // keep cookies/sessions
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await r.text();
  const isJSON = r.headers.get("content-type")?.includes("application/json");
  const data = isJSON && text ? JSON.parse(text) : text;

  if (!r.ok) {
    const err: any = new Error(
      (data && (data.message || data.error)) || r.statusText || "Request failed"
    );
    err.status = r.status; // <-- used by onError handlers
    err.body = data;
    throw err;
  }
  return data as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn =
  <T>(opts: { on401: UnauthorizedBehavior }): QueryFunction<T> =>
  async (ctx: QueryFunctionContext) => {
    const url = (ctx.queryKey as readonly (string | number)[]).join("/");
    const res = await fetch(url, { credentials: "include" });

    if (opts.on401 === "returnNull" && res.status === 401) {
      return null as unknown as T;
    }

    await throwIfResNotOk(res);
    return (await res.json()) as T;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: { retry: false },
  },
});
