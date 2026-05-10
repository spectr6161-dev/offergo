import type { INestApplication } from "@nestjs/common";
import AdminJS, { type CurrentAdmin, type ResourceWithOptions } from "adminjs";
import AdminJSExpress from "@adminjs/express";
import { Database, Resource, getModelByName } from "@adminjs/prisma";
import { verifyPassword } from "better-auth/crypto";
import connectPgSimple from "connect-pg-simple";
import type { Express } from "express";
import session, { type SessionOptions } from "express-session";
import { prisma, Prisma, prismaClientModule } from "@offergo/db";
import { env, type AppRole } from "@offergo/shared";

const rootPath = "/adminjs";
const adminRoles = new Set<AppRole>(["admin"]);
const useSecureCookies = new URL(env.API_URL).protocol === "https:";
const PgSessionStore = connectPgSimple(session);

const navigationByModel: Record<string, string> = {
  User: "Access",
  Session: "Access",
  Account: "Access",
  Verification: "Access",
  Jwks: "Access",
  PasswordResetToken: "Access",
  RoleAssignment: "Access",
  Plan: "Billing",
  Payment: "Billing",
  Entitlement: "Billing",
  Resume: "Product",
  ResumeVersion: "Product",
  Question: "Product",
  QuestionTag: "Product",
  TrainerSession: "Product",
  TrainerMessage: "Product",
  LiveAiPrompt: "AI / WPF",
  LegalDocumentVersion: "Legal",
  UserConsentAcceptance: "Legal",
  UserPrivacyRequest: "Legal",
  FileAsset: "Files",
  Job: "Queue",
  JobAttempt: "Queue",
  AuditLog: "Audit",
};

const sensitivePropertiesByModel: Record<string, string[]> = {
  Account: ["accessToken", "refreshToken", "idToken", "password"],
  Session: ["token"],
  Verification: ["value"],
  Jwks: ["privateKey"],
  PasswordResetToken: ["token"],
};

const readOnlyModelNames = new Set([
  "User",
  "Session",
  "Account",
  "Verification",
  "Jwks",
  "PasswordResetToken",
  "RoleAssignment",
  "Payment",
  "Entitlement",
  "UserConsentAcceptance",
]);

const readOnlyActions = {
  new: { isAccessible: false },
  edit: { isAccessible: false },
  delete: { isAccessible: false },
  bulkDelete: { isAccessible: false },
};

function buildHiddenProperties(modelName: string) {
  return Object.fromEntries(
    (sensitivePropertiesByModel[modelName] ?? []).map((propertyName) => [
      propertyName,
      {
        isVisible: {
          list: false,
          filter: false,
          show: false,
          edit: false,
        },
      },
    ]),
  );
}

function buildResourceOptions(modelName: string) {
  const properties = buildHiddenProperties(modelName);
  const options = {
    navigation: {
      name: navigationByModel[modelName] ?? "Data",
    },
    properties,
    ...(readOnlyModelNames.has(modelName)
      ? {
          actions: readOnlyActions,
        }
      : {}),
  };

  if (modelName === "LiveAiPrompt") {
    return {
      ...options,
      listProperties: ["key", "category", "title", "updatedAt"],
      editProperties: ["category", "title", "description", "content"],
      showProperties: [
        "key",
        "category",
        "title",
        "description",
        "content",
        "createdAt",
        "updatedAt",
      ],
      filterProperties: ["key", "category", "title"],
      properties: {
        ...properties,
        key: {
          isVisible: {
            list: true,
            filter: true,
            show: true,
            edit: false,
          },
        },
        content: {
          type: "textarea" as const,
          props: {
            rows: 18,
          },
        },
      },
    };
  }

  if (modelName === "LegalDocumentVersion") {
    return {
      ...options,
      listProperties: ["slug", "title", "version", "active", "updatedAt"],
      editProperties: [
        "kind",
        "slug",
        "version",
        "title",
        "summary",
        "content",
        "active",
        "publishedAt",
      ],
      showProperties: [
        "id",
        "kind",
        "slug",
        "version",
        "title",
        "summary",
        "content",
        "active",
        "publishedAt",
        "createdAt",
        "updatedAt",
      ],
      filterProperties: ["kind", "slug", "version", "active"],
      properties: {
        ...properties,
        content: {
          type: "textarea" as const,
          props: {
            rows: 24,
          },
        },
        summary: {
          type: "textarea" as const,
          props: {
            rows: 4,
          },
        },
      },
    };
  }

  if (modelName === "UserPrivacyRequest") {
    return {
      ...options,
      listProperties: ["kind", "status", "userId", "createdAt", "updatedAt"],
      editProperties: ["status", "message", "metadata", "completedAt"],
      showProperties: [
        "id",
        "userId",
        "kind",
        "status",
        "message",
        "metadata",
        "createdAt",
        "updatedAt",
        "completedAt",
      ],
      filterProperties: ["kind", "status", "userId", "createdAt"],
    };
  }

  if (modelName !== "Plan") {
    return options;
  }

  return {
    ...options,
    listProperties: [
      "name",
      "priceRub",
      "subscriptionType",
      "durationDays",
      "active",
      "updatedAt",
    ],
    editProperties: [
      "name",
      "priceRub",
      "subscriptionType",
      "durationDays",
      "description",
      "active",
      "code",
    ],
    showProperties: [
      "id",
      "code",
      "name",
      "description",
      "priceRub",
      "subscriptionType",
      "durationDays",
      "active",
      "createdAt",
      "updatedAt",
    ],
    filterProperties: ["name", "subscriptionType", "active", "priceRub"],
    properties: {
      ...properties,
      id: {
        isVisible: {
          list: false,
          filter: true,
          show: true,
          edit: false,
        },
      },
    },
  };
}

function buildResources(): ResourceWithOptions[] {
  return Prisma.dmmf.datamodel.models.map((model) => ({
    resource: {
      model: getModelByName(model.name, prismaClientModule),
      client: prisma,
      clientModule: prismaClientModule,
    },
    options: buildResourceOptions(model.name),
  }));
}

async function authenticateAdmin(
  email: string,
  password: string,
): Promise<CurrentAdmin | null> {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    include: {
      accounts: true,
      roleAssignments: true,
    },
  });

  if (!user) {
    return null;
  }

  const hasAdminRole = user.roleAssignments.some((assignment) =>
    adminRoles.has(assignment.role),
  );

  if (!hasAdminRole) {
    return null;
  }

  const credentialAccount = user.accounts.find(
    (account) => account.providerId === "credential" && account.password,
  );

  if (!credentialAccount?.password) {
    return null;
  }

  const isPasswordValid = await verifyPassword({
    hash: credentialAccount.password,
    password,
  });

  if (!isPasswordValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    title: user.name,
  };
}

export async function mountDataAdmin(app: INestApplication) {
  AdminJS.registerAdapter({ Database, Resource });

  const admin = new AdminJS({
    rootPath,
    loginPath: `${rootPath}/login`,
    logoutPath: `${rootPath}/logout`,
    resources: buildResources(),
    branding: {
      companyName: "offerGO Admin",
      withMadeWithLove: false,
    },
    locale: {
      language: "en",
      translations: {
        labels: {
          loginWelcome: "offerGO Data Admin",
        },
        messages: {
          loginWelcome: "Sign in as a user with the admin role.",
        },
      },
    },
  });

  const sessionOptions: SessionOptions = {
    store: new PgSessionStore({
      conString: env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: "adminjs_session",
      pruneSessionInterval: 60 * 15,
    }),
    secret: env.BETTER_AUTH_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "offergo_adminjs",
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookies,
      maxAge: 1000 * 60 * 60 * 8,
    },
  };

  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate: authenticateAdmin,
      cookieName: "offergo_adminjs",
      cookiePassword: env.BETTER_AUTH_SECRET,
    },
    null,
    sessionOptions,
  );

  const express = app.getHttpAdapter().getInstance() as Express;
  express.use(admin.options.rootPath, router);

  return admin.options.rootPath;
}
