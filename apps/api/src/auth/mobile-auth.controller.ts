import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { auth } from "@offergo/auth/core";
import { prisma } from "@offergo/db";
import { env, type AppRole } from "@offergo/shared";
import { ApiAuthGuard } from "./auth.guard";
import { CurrentUser } from "./current-user.decorator";
import type { AuthenticatedRequest } from "./authenticated-request";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import { validateYandexMobileAccessToken } from "./yandex-mobile-auth";
import {
  acceptUserConsents,
  assertAcceptedDocumentIds,
  getActiveRequiredDocuments,
  getConsentStatusForUser,
  toDocumentSummary,
} from "../legal/legal-consents";
import {
  MobileAuthResponseDto,
  MobileLogoutResponseDto,
  MobileSessionResponseDto,
  MobileSignInRequestDto,
  MobileSignUpRequestDto,
  MobileSocialSignInRequestDto,
  MobileSocialSignUpRequestDto,
} from "../docs/swagger.models";

const mobileSignInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const mobileSignUpSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(160).optional(),
  acceptedDocumentIds: z.array(z.string().trim().min(1)).min(1),
});

const mobileSocialSignInSchema = z.object({
  provider: z.string().trim().min(1),
  providerAccessToken: z.string().trim().min(1),
});

const mobileSocialSignUpSchema = mobileSocialSignInSchema.extend({
  acceptedDocumentIds: z.array(z.string().trim().min(1)).min(1),
});

type BetterAuthUserResult = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

type MobileSocialProvider = "yandex";

function getBearerToken(request: AuthenticatedRequest) {
  const header = request.headers.authorization;

  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

function getRequestUserAgent(request: Request) {
  const userAgent = request.headers["user-agent"];
  return typeof userAgent === "string" ? userAgent : null;
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

function createSessionExpiresAt() {
  return new Date(Date.now() + env.MOBILE_SESSION_TTL_DAYS * 24 * 60 * 60_000);
}

async function createMobileBearerSession(userId: string, request: Request) {
  const token = createSessionToken();
  const expiresAt = createSessionExpiresAt();
  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress: getClientIp(request),
      userAgent: getRequestUserAgent(request),
    },
    select: {
      token: true,
    },
  });

  return session.token;
}

function assertMobileSocialProvider(
  provider: string,
): asserts provider is MobileSocialProvider {
  if (provider !== "yandex") {
    throw new UnprocessableEntityException({
      code: "unsupported_provider",
      message: "Only yandex provider is supported for mobile social auth.",
    });
  }
}

function getAuthErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
}

function getAuthErrorStatus(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return null;
}

function mapSignInError(error: unknown): never {
  const status = getAuthErrorStatus(error);
  const message = getAuthErrorMessage(error);

  if (status === 400) {
    throw new BadRequestException(message ?? "Invalid mobile sign-in payload.");
  }

  throw new UnauthorizedException(message ?? "Invalid email or password.");
}

function mapSignUpError(error: unknown): never {
  const status = getAuthErrorStatus(error);
  const message = getAuthErrorMessage(error);

  if (
    status === 422 ||
    /already exists|use another email/i.test(message ?? "")
  ) {
    throw new ConflictException("User with this email already exists.");
  }

  if (status === 400) {
    throw new BadRequestException(message ?? "Invalid mobile sign-up payload.");
  }

  throw error;
}

async function getSessionExpiresAt(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    select: { expiresAt: true },
  });

  if (!session) {
    throw new UnauthorizedException("Session token was not created.");
  }

  return session.expiresAt;
}

async function getMobileUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      accounts: {
        orderBy: { createdAt: "asc" },
        select: {
          providerId: true,
          accountId: true,
        },
      },
      roleAssignments: {
        select: {
          role: true,
        },
      },
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    roles:
      user.roleAssignments.length > 0
        ? user.roleAssignments.map((entry) => entry.role)
        : (["user"] as AppRole[]),
    accounts: user.accounts,
  };
}

async function buildMobileAuthResponse(token: string, userId: string) {
  const [expiresAt, user, legal] = await Promise.all([
    getSessionExpiresAt(token),
    getMobileUser(userId),
    getConsentStatusForUser(userId),
  ]);

  return {
    accessToken: token,
    tokenType: "Bearer" as const,
    expiresAt: expiresAt.toISOString(),
    user,
    legal: {
      ok: legal.ok,
      missingDocuments: legal.missingDocuments.map(toDocumentSummary),
    },
  };
}

@ApiTags("mobile-auth")
@Controller("auth/mobile")
export class MobileAuthController {
  @Post("sign-up")
  @HttpCode(200)
  @ApiOperation({
    summary: "Native mobile registration by email and password",
    description:
      "Creates a Better Auth user/session for a native mobile app. The returned accessToken must be sent as Authorization: Bearer <token> to /api/v1 endpoints.",
  })
  @ApiBody({ type: MobileSignUpRequestDto })
  @ApiOkResponse({ type: MobileAuthResponseDto })
  @ApiBadRequestResponse({
    description: "Invalid payload.",
  })
  @ApiUnprocessableEntityResponse({
    description: "Not all active legal documents were accepted.",
  })
  @ApiConflictResponse({
    description: "User with this email already exists.",
  })
  @ApiResponse({ status: 429, description: "Auth rate limit exceeded." })
  async signUp(@Req() request: Request, @Body() body: unknown) {
    const parsed = mobileSignUpSchema.parse(body ?? {});
    const documents = await getActiveRequiredDocuments();

    assertAcceptedDocumentIds(documents, parsed.acceptedDocumentIds);

    let result: { token: string | null; user: BetterAuthUserResult };

    try {
      result = await auth.api.signUpEmail({
        body: {
          email: parsed.email,
          password: parsed.password,
          name: parsed.name ?? parsed.email,
          rememberMe: true,
        },
      });
    } catch (error) {
      mapSignUpError(error);
    }

    if (!result.token) {
      throw new UnauthorizedException("Mobile session token was not issued.");
    }

    await acceptUserConsents({
      userId: result.user.id,
      source: "mobile_register",
      request,
      documentIds: parsed.acceptedDocumentIds,
    });

    return buildMobileAuthResponse(result.token, result.user.id);
  }

  @Post("sign-in")
  @HttpCode(200)
  @ApiOperation({
    summary: "Native mobile login by email and password",
    description:
      "Authenticates a mobile client without opening a browser. If legal.ok=false, the app must show native legal acceptance before unlocking product screens.",
  })
  @ApiBody({ type: MobileSignInRequestDto })
  @ApiOkResponse({ type: MobileAuthResponseDto })
  @ApiBadRequestResponse({ description: "Invalid payload." })
  @ApiUnauthorizedResponse({ description: "Invalid email or password." })
  @ApiResponse({ status: 429, description: "Auth rate limit exceeded." })
  async signIn(@Body() body: unknown) {
    const parsed = mobileSignInSchema.parse(body ?? {});
    let result: { token: string; user: BetterAuthUserResult };

    try {
      result = await auth.api.signInEmail({
        body: {
          email: parsed.email,
          password: parsed.password,
          rememberMe: true,
        },
      });
    } catch (error) {
      mapSignInError(error);
    }

    if (!result.token) {
      throw new UnauthorizedException("Mobile session token was not issued.");
    }

    return buildMobileAuthResponse(result.token, result.user.id);
  }

  @Post("social/sign-in")
  @HttpCode(200)
  @ApiOperation({
    summary: "Native mobile social login",
    description:
      "Authenticates a native mobile app with a provider access token. The backend verifies the provider token and returns the same bearer session contract as email/password login.",
  })
  @ApiBody({ type: MobileSocialSignInRequestDto })
  @ApiOkResponse({ type: MobileAuthResponseDto })
  @ApiBadRequestResponse({ description: "Invalid payload." })
  @ApiUnauthorizedResponse({
    description:
      "Provider token is invalid, expired or was issued for another client.",
  })
  @ApiConflictResponse({
    description: "Provider account is not registered in OfferGO yet.",
  })
  @ApiUnprocessableEntityResponse({
    description: "Unsupported social provider.",
  })
  @ApiResponse({ status: 429, description: "Auth rate limit exceeded." })
  async socialSignIn(@Req() request: Request, @Body() body: unknown) {
    const parsed = mobileSocialSignInSchema.parse(body ?? {});
    assertMobileSocialProvider(parsed.provider);

    const profile = await validateYandexMobileAccessToken(
      parsed.providerAccessToken,
    );
    const providerId = parsed.provider;
    let userId: string | null = null;

    const existingAccount = await prisma.account.findUnique({
      where: {
        providerId_accountId: {
          providerId,
          accountId: profile.id,
        },
      },
      select: {
        userId: true,
      },
    });

    if (existingAccount) {
      userId = existingAccount.userId;

      if (profile.image) {
        await prisma.user.updateMany({
          where: {
            id: userId,
            image: null,
          },
          data: {
            image: profile.image,
          },
        });
      }
    } else {
      const existingUser = await prisma.user.findUnique({
        where: { email: profile.email },
        select: { id: true, image: true },
      });

      if (!existingUser) {
        throw new ConflictException({
          code: "account_not_registered",
          message: "Yandex account is not registered in OfferGO.",
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.account.create({
          data: {
            providerId,
            accountId: profile.id,
            userId: existingUser.id,
          },
        });

        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerified: true,
            ...(existingUser.image || !profile.image
              ? {}
              : { image: profile.image }),
          },
        });
      });

      userId = existingUser.id;
    }

    const token = await createMobileBearerSession(userId, request);

    return buildMobileAuthResponse(token, userId);
  }

  @Post("social/sign-up")
  @HttpCode(200)
  @ApiOperation({
    summary: "Native mobile social registration",
    description:
      "Registers a native mobile user with a verified provider access token and accepted legal document version IDs.",
  })
  @ApiBody({ type: MobileSocialSignUpRequestDto })
  @ApiOkResponse({ type: MobileAuthResponseDto })
  @ApiBadRequestResponse({ description: "Invalid payload." })
  @ApiUnauthorizedResponse({
    description:
      "Provider token is invalid, expired or was issued for another client.",
  })
  @ApiConflictResponse({
    description: "Provider account or email is already registered.",
  })
  @ApiUnprocessableEntityResponse({
    description:
      "Unsupported provider or not all active legal documents were accepted.",
  })
  @ApiResponse({ status: 429, description: "Auth rate limit exceeded." })
  async socialSignUp(@Req() request: Request, @Body() body: unknown) {
    const parsed = mobileSocialSignUpSchema.parse(body ?? {});
    assertMobileSocialProvider(parsed.provider);

    const documents = await getActiveRequiredDocuments();
    assertAcceptedDocumentIds(documents, parsed.acceptedDocumentIds);

    const profile = await validateYandexMobileAccessToken(
      parsed.providerAccessToken,
    );
    const providerId = parsed.provider;
    const expiresAt = createSessionExpiresAt();
    const token = createSessionToken();

    const created = await prisma.$transaction(async (tx) => {
      const [existingAccount, existingUser] = await Promise.all([
        tx.account.findUnique({
          where: {
            providerId_accountId: {
              providerId,
              accountId: profile.id,
            },
          },
          select: { id: true },
        }),
        tx.user.findUnique({
          where: { email: profile.email },
          select: { id: true },
        }),
      ]);

      if (existingAccount || existingUser) {
        throw new ConflictException({
          code: "account_already_registered",
          message: "Yandex account or email is already registered in OfferGO.",
        });
      }

      const user = await tx.user.create({
        data: {
          email: profile.email,
          emailVerified: true,
          name: profile.name,
          image: profile.image,
          accounts: {
            create: {
              providerId,
              accountId: profile.id,
            },
          },
          sessions: {
            create: {
              token,
              expiresAt,
              ipAddress: getClientIp(request),
              userAgent: getRequestUserAgent(request),
            },
          },
        },
        select: { id: true },
      });

      return user;
    });

    await acceptUserConsents({
      userId: created.id,
      source: "mobile_social_register",
      request,
      documentIds: parsed.acceptedDocumentIds,
    });

    return buildMobileAuthResponse(token, created.id);
  }

  @Get("session")
  @UseGuards(ApiAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Current native mobile session",
    description:
      "Returns the authenticated user and legal consent status for the bearer token.",
  })
  @ApiOkResponse({ type: MobileSessionResponseDto })
  @ApiUnauthorizedResponse({
    description: "Missing, expired or invalid bearer token.",
  })
  async getSession(
    @CurrentUser() user: AuthenticatedAppUser,
    @Req() request: AuthenticatedRequest,
  ) {
    const token = getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Bearer token is required.");
    }

    return buildMobileAuthResponse(token, user.id);
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(ApiAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Logout current native mobile session",
    description: "Invalidates the current Better Auth bearer session token.",
  })
  @ApiOkResponse({ type: MobileLogoutResponseDto })
  @ApiUnauthorizedResponse({
    description: "Missing, expired or invalid bearer token.",
  })
  async logout(@Req() request: AuthenticatedRequest) {
    const token = getBearerToken(request);

    if (token) {
      await prisma.session.deleteMany({
        where: { token },
      });
    }

    return { ok: true };
  }
}
