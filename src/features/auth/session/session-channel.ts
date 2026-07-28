import { z } from "zod";

const baseMessageSchema = z.object({
  version: z.literal(1),
  tabId: z.uuid(),
  generation: z.number().int().nonnegative(),
});

const tokenRequestSchema = baseMessageSchema.extend({
  type: z.literal("token-request"),
  requestId: z.uuid(),
});

const tokenUpdatedSchema = baseMessageSchema.extend({
  type: z.literal("token-updated"),
  requestId: z.uuid().optional(),
  accessToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
});

const eventSchema = baseMessageSchema.extend({
  type: z.enum([
    "logout",
    "session-expired",
    "csrf-updated",
    "organization-preference-updated",
  ]),
  organizationId: z.uuid().optional(),
});

export const sessionMessageSchema = z.discriminatedUnion("type", [
  tokenRequestSchema,
  tokenUpdatedSchema,
  eventSchema,
]);

export type SessionMessage = z.infer<typeof sessionMessageSchema>;
export type TokenUpdatedMessage = z.infer<typeof tokenUpdatedSchema>;

export interface SessionChannel {
  readonly available: boolean;
  post(message: SessionMessage): void;
  subscribe(listener: (message: SessionMessage) => void): () => void;
  close(): void;
}

export function createSessionChannel(
  name: string,
  Channel: typeof BroadcastChannel | undefined = typeof BroadcastChannel ===
  "undefined"
    ? undefined
    : BroadcastChannel,
): SessionChannel {
  if (!Channel) {
    return {
      available: false,
      post: () => undefined,
      subscribe: () => () => undefined,
      close: () => undefined,
    };
  }
  const channel = new Channel(name);
  const listeners = new Set<(message: SessionMessage) => void>();
  channel.addEventListener("message", (event: MessageEvent<unknown>) => {
    const parsed = sessionMessageSchema.safeParse(event.data);
    if (!parsed.success) return;
    for (const listener of listeners) listener(parsed.data);
  });
  return {
    available: true,
    post: (message) => channel.postMessage(message),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => channel.close(),
  };
}
