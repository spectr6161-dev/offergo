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
const adminRoles = new Set<AppRole>(["admin", "support"]);
const useSecureCookies = new URL(env.API_URL).protocol === "https:";
const PgSessionStore = connectPgSimple(session);

const navigationByModel: Record<string, string> = {
  User: "Доступ",
  Session: "Доступ",
  Account: "Доступ",
  Verification: "Доступ",
  Jwks: "Доступ",
  PasswordResetToken: "Доступ",
  RoleAssignment: "Доступ",
  Plan: "Биллинг",
  Payment: "Биллинг",
  Entitlement: "Биллинг",
  Resume: "Продукт",
  ResumeVersion: "Продукт",
  Question: "Продукт",
  QuestionTag: "Продукт",
  TrainerSession: "Продукт",
  TrainerMessage: "Продукт",
  FileAsset: "Файлы",
  Job: "Очереди",
  JobAttempt: "Очереди",
  AuditLog: "Аудит",
};

const sensitivePropertiesByModel: Record<string, string[]> = {
  Account: ["accessToken", "refreshToken", "idToken", "password"],
  Session: ["token"],
  Verification: ["value"],
  Jwks: ["privateKey"],
  PasswordResetToken: ["token"],
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
      name: navigationByModel[modelName] ?? "Данные",
    },
    properties,
  };

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
      language: "ru",
      translations: {
        labels: {
          loginWelcome: "Управление данными offerGO",
        },
        messages: {
          loginWelcome: "Войдите под пользователем с ролью admin или support.",
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
