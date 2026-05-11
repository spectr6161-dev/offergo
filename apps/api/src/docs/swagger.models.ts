import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  appRoles,
  entitlementStatuses,
  paymentStatuses,
  plategaStatusSchema,
} from "@offergo/shared";

export class AuthenticatedUserAccountDto {
  @ApiProperty({ type: String })
  providerId!: string;

  @ApiProperty({ type: String })
  accountId!: string;
}

export class AuthenticatedUserDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  image!: string | null;

  @ApiProperty({ type: String, enum: appRoles, isArray: true })
  roles!: string[];

  @ApiPropertyOptional({
    type: () => AuthenticatedUserAccountDto,
    isArray: true,
  })
  accounts!: AuthenticatedUserAccountDto[];
}

export class AuthMeResponseDto {
  @ApiProperty({ type: () => AuthenticatedUserDto })
  user!: AuthenticatedUserDto;
}

export class AdminPingResponseDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;

  @ApiProperty({ type: String, example: "admin" })
  scope!: string;

  @ApiProperty({ type: () => AuthenticatedUserDto })
  user!: AuthenticatedUserDto;
}

export class MobileLegalDocumentSummaryDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({
    type: String,
    example: "privacy_policy",
  })
  kind!: string;

  @ApiProperty({ type: String, example: "privacy-policy" })
  slug!: string;

  @ApiProperty({ type: String, example: "2026-05-06" })
  version!: string;

  @ApiProperty({
    type: String,
    example: "Политика обработки персональных данных",
  })
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  summary!: string | null;

  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  publishedAt!: string;
}

export class MobileLegalStatusDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;

  @ApiProperty({ type: () => MobileLegalDocumentSummaryDto, isArray: true })
  missingDocuments!: MobileLegalDocumentSummaryDto[];
}

export class MobileUserAccountDto {
  @ApiProperty({ type: String })
  providerId!: string;

  @ApiProperty({ type: String })
  accountId!: string;
}

export class MobileUserDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String, format: "email" })
  email!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  image!: string | null;

  @ApiProperty({ type: String, enum: appRoles, isArray: true })
  roles!: string[];

  @ApiProperty({ type: () => MobileUserAccountDto, isArray: true })
  accounts!: MobileUserAccountDto[];
}

export class MobileSignUpRequestDto {
  @ApiProperty({
    type: String,
    format: "email",
    example: "user@example.com",
  })
  email!: string;

  @ApiProperty({
    type: String,
    minLength: 8,
    example: "StrongPass123",
  })
  password!: string;

  @ApiPropertyOptional({
    type: String,
    example: "Максим Дружинин",
  })
  name?: string;

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      "IDs of all active required legal document versions shown to the user in the native app.",
    example: ["clv_terms_id", "clv_privacy_id"],
  })
  acceptedDocumentIds!: string[];
}

export class MobileSignInRequestDto {
  @ApiProperty({
    type: String,
    format: "email",
    example: "user@example.com",
  })
  email!: string;

  @ApiProperty({
    type: String,
    example: "StrongPass123",
  })
  password!: string;
}

export class MobileSocialSignInRequestDto {
  @ApiProperty({
    type: String,
    enum: ["yandex"],
    example: "yandex",
    description:
      "Social auth provider. Only yandex is supported in this version.",
  })
  provider!: "yandex";

  @ApiProperty({
    type: String,
    example: "AQAAAA...",
    description:
      "Access token received by the native mobile app from Yandex ID SDK.",
  })
  providerAccessToken!: string;
}

export class MobileSocialSignUpRequestDto extends MobileSocialSignInRequestDto {
  @ApiProperty({
    type: String,
    isArray: true,
    description:
      "IDs of all active required legal document versions shown to the user in the native app.",
    example: ["clv_terms_id", "clv_privacy_id"],
  })
  acceptedDocumentIds!: string[];
}

export class MobileAuthResponseDto {
  @ApiProperty({ type: String })
  accessToken!: string;

  @ApiProperty({ type: String, example: "Bearer" })
  tokenType!: "Bearer";

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt!: string;

  @ApiProperty({ type: () => MobileUserDto })
  user!: MobileUserDto;

  @ApiProperty({ type: () => MobileLegalStatusDto })
  legal!: MobileLegalStatusDto;
}

export class MobileSessionResponseDto extends MobileAuthResponseDto {}

export class MobileLogoutResponseDto {
  @ApiProperty({ type: Boolean, example: true })
  ok!: boolean;
}

export class AcceptConsentsRequestDto {
  @ApiPropertyOptional({
    type: String,
    example: "mobile_register",
  })
  source?: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description:
      "Optional exact active legal document version IDs accepted by the client. If omitted, all active required documents are accepted for backward compatibility.",
    example: ["clv_terms_id", "clv_privacy_id"],
  })
  documentIds?: string[];
}

export class AcceptConsentsResponseDto {
  @ApiProperty({ type: Boolean, example: true })
  ok!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  acceptedAt!: string;
}

export class StartCheckoutBodyDto {
  @ApiProperty({
    type: String,
    description: "Внутренний идентификатор тарифа для покупки.",
    example: "cm0offergoexampleplan123456",
  })
  planId!: string;
}

export class PlanDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: Number })
  priceRub!: number;

  @ApiProperty({
    type: String,
    description: "Бизнес-тип пакета услуг/лимитов тарифа.",
    example: "pro",
  })
  subscriptionType!: string;

  @ApiProperty({ type: Number })
  durationDays!: number;
}

export class PlansResponseDto {
  @ApiProperty({ type: () => PlanDto, isArray: true })
  items!: PlanDto[];
}

export class EntitlementPlanDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class UserEntitlementDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String, enum: entitlementStatuses })
  status!: string;

  @ApiProperty({ type: String, format: "date-time" })
  startsAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  endsAt!: string;

  @ApiProperty({ type: () => EntitlementPlanDto })
  plan!: EntitlementPlanDto;
}

export class EntitlementsResponseDto {
  @ApiProperty({ type: () => UserEntitlementDto, isArray: true })
  items!: UserEntitlementDto[];
}

export class PaymentDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String, example: "platega" })
  provider!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  providerTransactionId!: string | null;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  planId!: string;

  @ApiProperty({ type: String, enum: paymentStatuses })
  status!: string;

  @ApiProperty({ type: Number })
  amountRub!: number;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  paymentUrl!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  expiresAt!: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  confirmedAt!: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  canceledAt!: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  chargebackedAt!: string | null;
}

export class PaymentWithPlanDto extends PaymentDto {
  @ApiProperty({ type: () => PlanDto })
  plan!: PlanDto;
}

export class PaymentsResponseDto {
  @ApiProperty({ type: () => PaymentWithPlanDto, isArray: true })
  items!: PaymentWithPlanDto[];
}

export class CheckoutResponseDto {
  @ApiProperty({ type: () => PaymentDto })
  payment!: PaymentDto;

  @ApiProperty({ type: String })
  paymentUrl!: string;
}

export class PaymentStatusResponseDto {
  @ApiProperty({ type: String, enum: paymentStatuses })
  status!: string;

  @ApiProperty({ type: () => PaymentDto })
  payment!: PaymentDto;

  @ApiProperty({ type: () => PlanDto })
  plan!: PlanDto;

  @ApiPropertyOptional({ type: String, nullable: true })
  paymentUrl!: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  expiresAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  providerSyncError?: string | null;
}

export class PlategaWebhookBodyDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: Number })
  amount!: number;

  @ApiProperty({ type: String, example: "RUB" })
  currency!: string;

  @ApiProperty({ type: String, enum: plategaStatusSchema.options })
  status!: string;

  @ApiProperty({
    type: String,
    oneOf: [{ type: "number" }, { type: "string" }],
    example: 1,
  })
  paymentMethod!: number | string;
}

export class PlategaWebhookResponseDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;

  @ApiProperty({ type: String, format: "uuid" })
  transactionId!: string;

  @ApiProperty({ type: String, enum: plategaStatusSchema.options })
  status!: string;
}

export class HealthDependencyCheckDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;

  @ApiPropertyOptional({ type: String })
  error?: string;
}

export class HealthChecksDto {
  @ApiProperty({ type: () => HealthDependencyCheckDto })
  db!: HealthDependencyCheckDto;

  @ApiProperty({ type: () => HealthDependencyCheckDto })
  redis!: HealthDependencyCheckDto;

  @ApiProperty({ type: String, format: "date-time" })
  timestamp!: string;
}

export class HealthResponseDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;

  @ApiProperty({ type: String, example: "offergo-api" })
  app!: string;

  @ApiProperty({ type: [String], example: ["session", "bearer", "jwt"] })
  authModes!: string[];

  @ApiProperty({ type: String, example: "platega" })
  billingProvider!: string;

  @ApiProperty({ type: String, format: "date-time" })
  timestamp!: string;

  @ApiProperty({ type: String, example: "http://localhost:3001" })
  apiUrl!: string;

  @ApiProperty({ type: () => HealthChecksDto })
  checks!: HealthChecksDto;
}

export class StorageUploadResponseDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({
    type: [String],
    example: ["resume_source", "resume_export", "screenshot", "temp_ai_output"],
  })
  acceptedPurpose!: string[];
}

export class AdminSummaryResponseDto {
  @ApiProperty({ type: Number })
  users!: number;

  @ApiProperty({ type: Number })
  payments!: number;

  @ApiProperty({ type: Number })
  activeEntitlements!: number;

  @ApiProperty({ type: Number })
  jobs!: number;
}

export class AdminUserDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ type: Boolean })
  emailVerified!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, enum: appRoles, isArray: true })
  roles!: string[];
}

export class AdminUsersResponseDto {
  @ApiProperty({ type: () => AdminUserDto, isArray: true })
  items!: AdminUserDto[];
}
