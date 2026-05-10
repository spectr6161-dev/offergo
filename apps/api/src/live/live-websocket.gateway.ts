import type { IncomingMessage, Server as HttpServer } from "node:http";
import { Inject, Injectable } from "@nestjs/common";
import { WebSocketServer, WebSocket } from "ws";
import { getCurrentSessionFromHeaders, getCurrentUserFromSession } from "@offergo/auth/session";
import { env } from "@offergo/shared";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import type { ClientEnvelope } from "./live-protocol";
import { LiveSessionCoordinator } from "./live-session-coordinator.service";

function send(socket: WebSocket, type: string, payload: unknown) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({ type, payload }));
}

function getPath(request: IncomingMessage) {
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url ?? "/", `http://${host}`);

  return {
    pathname: url.pathname,
    token: url.searchParams.get("token"),
  };
}

@Injectable()
export class LiveWebSocketGateway {
  private server: WebSocketServer | null = null;

  constructor(
    @Inject(LiveSessionCoordinator)
    private readonly coordinator: LiveSessionCoordinator,
  ) {}

  attach(httpServer: HttpServer) {
    if (this.server) {
      return;
    }

    this.server = new WebSocketServer({ noServer: true });

    httpServer.on("upgrade", async (request, socket, head) => {
      const { pathname, token } = getPath(request);

      if (pathname !== env.LIVE_WEBSOCKET_PATH) {
        return;
      }

      const user = await this.authenticate(token);

      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      this.server?.handleUpgrade(request, socket, head, (webSocket) => {
        this.handleConnection(webSocket, request, user);
      });
    });
  }

  private async authenticate(token: string | null) {
    if (!token) {
      return null;
    }

    const headers = new Headers({
      authorization: `Bearer ${token}`,
    });
    const session = await getCurrentSessionFromHeaders(headers);

    if (!session) {
      return null;
    }

    return getCurrentUserFromSession(session);
  }

  private handleConnection(
    socket: WebSocket,
    _request: IncomingMessage,
    user: AuthenticatedAppUser,
  ) {
    const connection = {
      user,
      send: (type: string, payload: unknown) => send(socket, type, payload),
    };

    socket.on("message", async (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as ClientEnvelope;

        await this.handleClientMessage(connection, message);
      } catch (error) {
        send(socket, "warning", {
          code: "ws_message_error",
          message:
            error instanceof Error ? error.message : "Invalid websocket message.",
        });
      }
    });

    socket.on("close", () => {
      this.coordinator.closeAllForUser(user.id);
    });
  }

  private async handleClientMessage(
    connection: {
      user: AuthenticatedAppUser;
      send: (type: string, payload: unknown) => void;
    },
    message: ClientEnvelope,
  ) {
    switch (message.type) {
      case "session.start":
        await this.coordinator.start(connection, message.payload);
        return;
      case "session.configure":
        await this.coordinator.configure(connection, message.payload);
        return;
      case "audio.frame":
        await this.coordinator.onAudioFrame(connection, message.payload);
        return;
      case "audio.flush":
        this.coordinator.onAudioFlush(connection, message.payload);
        return;
      case "manual.prompt":
        await this.coordinator.onManualPrompt(connection, message.payload);
        return;
      case "answer.show":
      case "answer.dismiss":
        this.coordinator.onAnswerVisibility(connection, message.payload);
        return;
      case "session.stop":
        await this.coordinator.stop(connection, message.payload.sessionId);
        return;
      default:
        connection.send("warning", {
          code: "unknown_message",
          message: "Unknown websocket message type.",
        });
    }
  }
}
