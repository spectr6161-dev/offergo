import type { OpenAPIObject } from "@nestjs/swagger";

type OpenApiPathItem = NonNullable<OpenAPIObject["paths"]>[string];

function addPath(document: OpenAPIObject, path: string, item: OpenApiPathItem) {
  document.paths[path] = item;
}

function ensureAuthEngineSchemas(document: OpenAPIObject) {
  document.components ??= {};
  document.components.schemas ??= {};

  document.components.schemas.BetterAuthUser = {
    type: "object",
    properties: {
      id: { type: "string" },
      email: { type: "string", format: "email" },
      emailVerified: { type: "boolean" },
      name: { type: "string" },
      image: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: [
      "id",
      "email",
      "emailVerified",
      "name",
      "createdAt",
      "updatedAt",
    ],
  };

  document.components.schemas.BetterAuthSession = {
    type: "object",
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      expiresAt: { type: "string", format: "date-time" },
      token: { type: "string" },
      ipAddress: { type: "string", nullable: true },
      userAgent: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: ["id", "userId", "expiresAt", "token", "createdAt", "updatedAt"],
  };

  document.components.schemas.BetterAuthSignUpRequest = {
    type: "object",
    properties: {
      name: { type: "string", example: "Maxim Ivanov" },
      email: { type: "string", format: "email", example: "maxim@example.com" },
      password: { type: "string", minLength: 8, example: "StrongPass123" },
      image: { type: "string", nullable: true },
      callbackURL: {
        type: "string",
        nullable: true,
        example: "http://localhost:3000/dashboard",
      },
      rememberMe: { type: "boolean", nullable: true, example: true },
    },
    required: ["name", "email", "password"],
  };

  document.components.schemas.BetterAuthSignUpResponse = {
    type: "object",
    properties: {
      token: { type: "string", nullable: true },
      user: { $ref: "#/components/schemas/BetterAuthUser" },
    },
    required: ["token", "user"],
  };

  document.components.schemas.BetterAuthSignInRequest = {
    type: "object",
    properties: {
      email: { type: "string", format: "email", example: "maxim@example.com" },
      password: { type: "string", minLength: 8, example: "StrongPass123" },
      callbackURL: {
        type: "string",
        nullable: true,
        example: "http://localhost:3000/dashboard",
      },
      rememberMe: { type: "boolean", nullable: true, example: true },
    },
    required: ["email", "password"],
  };

  document.components.schemas.BetterAuthSignInResponse = {
    type: "object",
    properties: {
      redirect: { type: "boolean" },
      token: { type: "string" },
      url: { type: "string", nullable: true },
      user: { $ref: "#/components/schemas/BetterAuthUser" },
    },
    required: ["redirect", "token", "user"],
  };

  document.components.schemas.BetterAuthSignOutResponse = {
    type: "object",
    properties: {
      success: { type: "boolean" },
    },
    required: ["success"],
  };

  document.components.schemas.BetterAuthRequestPasswordResetRequest = {
    type: "object",
    properties: {
      email: { type: "string", format: "email", example: "maxim@example.com" },
      redirectTo: {
        type: "string",
        nullable: true,
        example: "http://localhost:3000/reset-password",
      },
    },
    required: ["email"],
  };

  document.components.schemas.BetterAuthRequestPasswordResetResponse = {
    type: "object",
    properties: {
      status: { type: "boolean" },
      message: { type: "string" },
    },
    required: ["status", "message"],
  };

  document.components.schemas.BetterAuthResetPasswordRequest = {
    type: "object",
    properties: {
      token: { type: "string", example: "verification-token-from-email" },
      newPassword: {
        type: "string",
        minLength: 8,
        example: "NewStrongPass123",
      },
    },
    required: ["token", "newPassword"],
  };

  document.components.schemas.BetterAuthStatusResponse = {
    type: "object",
    properties: {
      status: { type: "boolean" },
    },
    required: ["status"],
  };

  document.components.schemas.BetterAuthSendVerificationEmailRequest = {
    type: "object",
    properties: {
      email: { type: "string", format: "email", example: "maxim@example.com" },
      callbackURL: {
        type: "string",
        nullable: true,
        example: "http://localhost:3000/verify-email",
      },
    },
    required: ["email"],
  };

  document.components.schemas.BetterAuthGetSessionResponse = {
    type: "object",
    nullable: true,
    properties: {
      session: { $ref: "#/components/schemas/BetterAuthSession" },
      user: { $ref: "#/components/schemas/BetterAuthUser" },
    },
    required: ["session", "user"],
  };

  document.components.schemas.JwtTokenResponse = {
    type: "object",
    properties: {
      token: { type: "string" },
    },
    required: ["token"],
  };

  document.components.schemas.Jwk = {
    type: "object",
    properties: {
      kid: { type: "string" },
      kty: { type: "string" },
      alg: { type: "string" },
      use: { type: "string", nullable: true, enum: ["sig"] },
      n: { type: "string", nullable: true },
      e: { type: "string", nullable: true },
      crv: { type: "string", nullable: true },
      x: { type: "string", nullable: true },
      y: { type: "string", nullable: true },
    },
    required: ["kid", "kty", "alg"],
  };

  document.components.schemas.JwksResponse = {
    type: "object",
    properties: {
      keys: {
        type: "array",
        items: { $ref: "#/components/schemas/Jwk" },
      },
    },
    required: ["keys"],
  };
}

export function enhanceOpenApiDocument(document: OpenAPIObject) {
  document.tags = [
    {
      name: "platform",
      description: "Платформенные операционные и health-check endpoints.",
    },
    {
      name: "auth",
      description: "Прикладные аутентифицированные endpoints под /api/v1/auth.",
    },
    {
      name: "auth-engine",
      description: "Endpoints движка Better Auth, смонтированные под /api/auth.",
    },
    {
      name: "billing",
      description:
        "Тарифы, checkout, entitlements и обработка webhook от Platega.",
    },
    {
      name: "admin",
      description:
        "Операционные admin-only endpoints, защищённые глобальными ролями.",
    },
    {
      name: "storage",
      description:
        "Контрактные storage-endpoints, зарезервированные под будущую реализацию.",
    },
  ];

  ensureAuthEngineSchemas(document);

  addPath(document, "/api/auth/sign-up/email", {
    post: {
      tags: ["auth-engine"],
      summary: "Регистрация пользователя по email и паролю",
      description:
        "Создаёт пользователя Better Auth и выставляет cookie браузерной сессии при успешном auto sign-in. Подтверждение email остаётся доступным, но не является обязательным.",
      operationId: "BetterAuth_signUpEmail",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/BetterAuthSignUpRequest" },
          },
        },
      },
      responses: {
        "200": {
          description: "Пользователь создан, сессия и токен выданы.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BetterAuthSignUpResponse" },
            },
          },
        },
        "422": {
          description: "Невалидный запрос или email уже зарегистрирован.",
        },
      },
    },
  });

  addPath(document, "/api/auth/sign-in/email", {
    post: {
      tags: ["auth-engine"],
      summary: "Вход по email и паролю",
      description:
        "Аутентифицирует пользователя, выставляет cookie браузерной сессии и возвращает payload с bearer-совместимым токеном.",
      operationId: "BetterAuth_signInEmail",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/BetterAuthSignInRequest" },
          },
        },
      },
      responses: {
        "200": {
          description: "Пользователь аутентифицирован.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BetterAuthSignInResponse" },
            },
          },
        },
        "401": {
          description: "Неверные учётные данные.",
        },
      },
    },
  });

  addPath(document, "/api/auth/sign-out", {
    post: {
      tags: ["auth-engine"],
      summary: "Выход из текущей сессии",
      description:
        "Инвалидирует активную сессию Better Auth. В Swagger UI это также очищает same-origin cookie сессии, если включена передача credentials.",
      operationId: "BetterAuth_signOut",
      security: [{ session: [] }, { bearer: [] }],
      responses: {
        "200": {
          description: "Сессия завершена.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/BetterAuthSignOutResponse",
              },
            },
          },
        },
      },
    },
  });

  addPath(document, "/api/auth/request-password-reset", {
    post: {
      tags: ["auth-engine"],
      summary: "Запрос письма для сброса пароля",
      description:
        "Генерирует токен сброса пароля и отправляет письмо через mailer-интеграцию проекта.",
      operationId: "BetterAuth_requestPasswordReset",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/BetterAuthRequestPasswordResetRequest",
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Запрос на сброс пароля принят.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/BetterAuthRequestPasswordResetResponse",
              },
            },
          },
        },
      },
    },
  });

  addPath(document, "/api/auth/reset-password", {
    post: {
      tags: ["auth-engine"],
      summary: "Сброс пароля по токену из письма",
      description:
        "Меняет пароль по reset-токену. Обычно токен берётся из ссылки в email.",
      operationId: "BetterAuth_resetPassword",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/BetterAuthResetPasswordRequest",
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Пароль обновлён.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BetterAuthStatusResponse" },
            },
          },
        },
      },
    },
  });

  addPath(document, "/api/auth/verify-email", {
    get: {
      tags: ["auth-engine"],
      summary: "Подтверждение email по токену",
      description:
        "Подтверждает email пользователя по токену из письма с верификацией.",
      operationId: "BetterAuth_verifyEmail",
      parameters: [
        {
          name: "token",
          in: "query",
          required: true,
          description: "Токен подтверждения из письма.",
          schema: { type: "string" },
        },
        {
          name: "callbackURL",
          in: "query",
          required: false,
          description: "Необязательный callback URL после успешного подтверждения.",
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "Email подтверждён.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "boolean" },
                  user: { $ref: "#/components/schemas/BetterAuthUser" },
                },
                required: ["status"],
              },
            },
          },
        },
      },
    },
  });

  addPath(document, "/api/auth/send-verification-email", {
    post: {
      tags: ["auth-engine"],
      summary: "Отправка письма подтверждения email",
      description:
        "Отправляет или повторно отправляет письмо подтверждения email для аккаунта.",
      operationId: "BetterAuth_sendVerificationEmail",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/BetterAuthSendVerificationEmailRequest",
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Письмо подтверждения поставлено в очередь на отправку.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BetterAuthStatusResponse" },
            },
          },
        },
      },
    },
  });

  addPath(document, "/api/auth/get-session", {
    get: {
      tags: ["auth-engine"],
      summary: "Получение текущей сессии Better Auth",
      description:
        "Читает активную сессию из browser cookie или преобразованного bearer-контекста и возвращает сессию вместе с пользователем.",
      operationId: "BetterAuth_getSession",
      security: [{ session: [] }, { bearer: [] }],
      responses: {
        "200": {
          description: "Текущая сессия или null, если пользователь не аутентифицирован.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/BetterAuthGetSessionResponse",
              },
            },
          },
        },
      },
    },
  });

  addPath(document, "/api/auth/token", {
    get: {
      tags: ["auth-engine"],
      summary: "Выпуск JWT для текущей аутентифицированной сессии",
      description:
        "Возвращает подписанный JWT для текущей сессии Better Auth. Полезно для mobile, bot и service-to-service клиентов.",
      operationId: "BetterAuth_getToken",
      security: [{ session: [] }],
      responses: {
        "200": {
          description: "JWT выпущен для текущей сессии.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/JwtTokenResponse" },
            },
          },
        },
        "401": {
          description: "Нет активной cookie-сессии.",
        },
      },
    },
  });

  addPath(document, "/api/auth/jwks", {
    get: {
      tags: ["auth-engine"],
      summary: "Получение публичных ключей JWKS",
      description:
        "Возвращает JSON Web Key Set, используемый для проверки JWT, выпущенных Better Auth в этой платформе.",
      operationId: "BetterAuth_getJwks",
      responses: {
        "200": {
          description: "Публичные ключи для проверки JWT.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/JwksResponse" },
            },
          },
        },
      },
    },
  });
}
