export function formatAmount(value: string) {
  const digits = value.replace(/\D/g, "");

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function parseAmount(value: string) {
  return value.replace(/\D/g, "");
}

export function formatRussianPhone(value: string) {
  const rawDigits = value.replace(/\D/g, "");

  if (!rawDigits) {
    return "";
  }

  let digits = rawDigits;

  if (digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  } else if (!digits.startsWith("7")) {
    digits = `7${digits}`;
  }

  digits = digits.slice(0, 11);

  const local = digits.startsWith("7") ? digits.slice(1) : digits;
  const parts = ["+7"];
  const operator = local.slice(0, 3);
  const first = local.slice(3, 6);
  const second = local.slice(6, 8);
  const third = local.slice(8, 10);

  if (operator) parts.push(operator);
  if (first) parts.push(first);

  let formatted = parts.join(" ");

  if (second) {
    formatted += `-${second}`;
  }

  if (third) {
    formatted += `-${third}`;
  }

  return formatted;
}
