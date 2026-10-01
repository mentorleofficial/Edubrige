import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Invoke an edge function and surface the *real* error it returned.
 *
 * `supabase.functions.invoke` rejects a 4xx/5xx with the opaque
 * "Edge Function returned a non-2xx status code". Our functions send a JSON
 * `{ error }` body with the actual reason, so this reads it back and throws an
 * Error carrying that message. Also handles the `{ error }`-in-a-200 pattern.
 */
export async function invokeFn<T = unknown>(
  name: string,
  options?: { body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, options as never);

  if (error) {
    const response = error instanceof FunctionsHttpError ? error.context : null;
    if (response instanceof Response) {
      const payload = await response.clone().json().catch(() => null);
      // Our functions reply { error }; the Supabase gateway itself (e.g. when a
      // function can't be reached) replies { message }. Surface either.
      const reason = payload && typeof payload === "object"
        ? (payload as { error?: unknown; message?: unknown }).error ?? (payload as { message?: unknown }).message
        : null;
      if (reason) throw new Error(String(reason));
    }
    throw error;
  }

  if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}
