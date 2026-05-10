import { randomBytes, randomUUID, createHash } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@offergo/db";
import { env } from "@offergo/shared";
import type { AuthenticatedAppUser } from "@offergo/auth/session";

const pollIntervalSeconds = 2;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createSecretToken(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

function createDisplayCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += alphabet[randomBytes(1)[0] % alphabet.length];
  }

  return code;
}

function toEmployee(user: Pick<AuthenticatedAppUser, "id" | "email" | "name">) {
  return {
    employeeId: user.id,
    email: user.email,
    displayName: user.name || user.email,
  };
}

@Injectable()
export class DesktopAuthService {
  async startExtensionLogin(user: AuthenticatedAppUser) {
    const requestId = randomUUID();
    const pollToken = createSecretToken();
    const expiresAt = new Date(
      Date.now() + env.DESKTOP_AUTH_REQUEST_TTL_MINUTES * 60_000,
    );
    let displayCode = createDisplayCode();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await prisma.desktopAuthRequest.findUnique({
        where: { displayCode },
        select: { id: true },
      });

      if (!existing) {
        break;
      }

      displayCode = createDisplayCode();
    }

    const sessionExpiresAt = new Date(
      Date.now() + env.DESKTOP_SESSION_TTL_DAYS * 24 * 60 * 60_000,
    );
    const accessToken = createSecretToken(32);

    await prisma.$transaction(async (tx) => {
      const device = await tx.desktopDevice.create({
        data: {
          userId: user.id,
          deviceName: "HH Copilot Extension",
          lastSeenAt: new Date(),
        },
      });
      const session = await tx.session.create({
        data: {
          userId: user.id,
          token: accessToken,
          expiresAt: sessionExpiresAt,
          userAgent: "OfferGO HH Copilot Extension",
        },
      });

      await tx.desktopAuthRequest.create({
        data: {
          requestId,
          pollTokenHash: sha256(pollToken),
          displayCode,
          deviceName: "HH Copilot Extension",
          status: "approved",
          userId: user.id,
          deviceId: device.id,
          sessionId: session.id,
          approvedAt: new Date(),
          expiresAt,
        },
      });
    });

    return {
      displayCode,
      expiresAt: expiresAt.toISOString(),
      intervalSeconds: pollIntervalSeconds,
    };
  }

  async pollExtensionLogin(displayCode: string) {
    const normalizedCode = displayCode.trim().toUpperCase();
    const authRequest = await prisma.desktopAuthRequest.findUnique({
      where: { displayCode: normalizedCode },
      include: {
        user: true,
        session: true,
      },
    });

    if (!authRequest || authRequest.deviceName !== "HH Copilot Extension") {
      throw new NotFoundException("Extension auth request was not found.");
    }

    if (authRequest.expiresAt.getTime() <= Date.now()) {
      await prisma.desktopAuthRequest.delete({
        where: { id: authRequest.id },
      });
      return { status: "expired" };
    }

    if (authRequest.status !== "approved" || !authRequest.user || !authRequest.session) {
      return { status: authRequest.status };
    }

    await prisma.desktopAuthRequest.delete({
      where: { id: authRequest.id },
    });

    return {
      status: "approved",
      accessToken: authRequest.session.token,
      expiresAt: authRequest.session.expiresAt.toISOString(),
      employee: toEmployee(authRequest.user),
    };
  }

  async logoutExtension(userId: string, token: string | null | undefined) {
    if (token) {
      await prisma.session.deleteMany({
        where: {
          token,
          userAgent: "OfferGO HH Copilot Extension",
        },
      });

      return { ok: true };
    }

    await prisma.session.deleteMany({
      where: {
        userId,
        userAgent: "OfferGO HH Copilot Extension",
      },
    });

    return { ok: true };
  }

  async startBrowserLogin(deviceName: string) {
    const requestId = randomUUID();
    const pollToken = createSecretToken();
    const expiresAt = new Date(
      Date.now() + env.DESKTOP_AUTH_REQUEST_TTL_MINUTES * 60_000,
    );
    let displayCode = createDisplayCode();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await prisma.desktopAuthRequest.findUnique({
        where: { displayCode },
        select: { id: true },
      });

      if (!existing) {
        break;
      }

      displayCode = createDisplayCode();
    }

    await prisma.desktopAuthRequest.create({
      data: {
        requestId,
        pollTokenHash: sha256(pollToken),
        displayCode,
        deviceName: deviceName.trim() || "Windows desktop app",
        expiresAt,
      },
    });

    const approveUrl = new URL("/desktop-auth/approve", env.APP_URL);
    approveUrl.searchParams.set("code", displayCode);

    return {
      requestId,
      pollToken,
      displayCode,
      approveUrl: approveUrl.toString(),
      expiresAt: expiresAt.toISOString(),
      intervalSeconds: pollIntervalSeconds,
    };
  }

  async pollBrowserLogin(requestId: string, pollToken: string) {
    const authRequest = await prisma.desktopAuthRequest.findUnique({
      where: { requestId },
      include: {
        user: true,
        session: true,
      },
    });

    if (!authRequest || authRequest.pollTokenHash !== sha256(pollToken)) {
      throw new NotFoundException("Desktop auth request was not found.");
    }

    if (
      authRequest.status === "pending" &&
      authRequest.expiresAt.getTime() <= Date.now()
    ) {
      await prisma.desktopAuthRequest.update({
        where: { id: authRequest.id },
        data: { status: "expired" },
      });

      return { status: "expired" };
    }

    if (authRequest.status !== "approved") {
      return { status: authRequest.status };
    }

    if (!authRequest.user || !authRequest.session) {
      throw new BadRequestException("Approved desktop auth request is incomplete.");
    }

    return {
      status: "approved",
      accessToken: authRequest.session.token,
      expiresAt: authRequest.session.expiresAt.toISOString(),
      employee: toEmployee(authRequest.user),
    };
  }

  async approveBrowserLogin(displayCode: string, user: AuthenticatedAppUser) {
    const authRequest = await prisma.desktopAuthRequest.findUnique({
      where: { displayCode: displayCode.trim().toUpperCase() },
    });

    if (!authRequest) {
      throw new NotFoundException("Desktop auth request was not found.");
    }

    if (authRequest.status !== "pending") {
      throw new BadRequestException("Desktop auth request is already resolved.");
    }

    if (authRequest.expiresAt.getTime() <= Date.now()) {
      await prisma.desktopAuthRequest.update({
        where: { id: authRequest.id },
        data: { status: "expired" },
      });
      throw new BadRequestException("Desktop auth request expired.");
    }

    const expiresAt = new Date(
      Date.now() + env.DESKTOP_SESSION_TTL_DAYS * 24 * 60 * 60_000,
    );
    const accessToken = createSecretToken(32);

    const approved = await prisma.$transaction(async (tx) => {
      const device = await tx.desktopDevice.create({
        data: {
          userId: user.id,
          deviceName: authRequest.deviceName,
          lastSeenAt: new Date(),
        },
      });
      const session = await tx.session.create({
        data: {
          userId: user.id,
          token: accessToken,
          expiresAt,
          userAgent: authRequest.deviceName,
        },
      });

      await tx.desktopAuthRequest.update({
        where: { id: authRequest.id },
        data: {
          status: "approved",
          userId: user.id,
          deviceId: device.id,
          sessionId: session.id,
          approvedAt: new Date(),
        },
      });

      return { device, session };
    });

    return {
      ok: true,
      displayCode: authRequest.displayCode,
      expiresAt: approved.session.expiresAt.toISOString(),
      employee: toEmployee(user),
    };
  }

  async logout(token: string | null | undefined) {
    if (!token) {
      return { ok: true };
    }

    await prisma.session.deleteMany({
      where: { token },
    });

    return { ok: true };
  }
}
