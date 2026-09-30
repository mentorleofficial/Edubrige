import { toast } from "@/hooks/use-toast";
import { endDeactivatedSession, isDeactivatedError } from "./session";

/**
 * Standardized error handler — surfaces a toast and logs to console.
 * Pass a friendly fallback message for when the error has no usable message.
 */
export function handleError(error: unknown, fallback = "Something went wrong") {
  if (isDeactivatedError(error)) {
    endDeactivatedSession();
    return "Your account has been deactivated";
  }
  const message = extractMessage(error) ?? fallback;
  // eslint-disable-next-line no-console
  console.error("[app-error]", error);
  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  });
  return message;
}

function extractMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return null;
}
