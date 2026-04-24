import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  appRoles,
  entitlementStatuses,
  paymentStatuses,
  plategaStatusSchema,
} from "@offergo/shared";

export class AuthenticatedUserDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ type: String, enum: appRoles, isArray: true })
  roles!: string[];
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
  confirmedAt!: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  canceledAt!: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  chargebackedAt!: string | null;
}

export class CheckoutResponseDto {
  @ApiProperty({ type: () => PaymentDto })
  payment!: PaymentDto;

  @ApiProperty({ type: String })
  paymentUrl!: string;
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
