import { Prisma } from "@prisma/client";

const MAX_MONEY_AMOUNT = new Prisma.Decimal("9999999999.99");

const toMoneyDecimal = (value, errorMessage) => {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (typeof value !== "string" &&
      typeof value !== "number" &&
      !Prisma.Decimal.isDecimal(value))
  ) {
    throw new Error(errorMessage);
  }

  let amount;

  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new Error(errorMessage);
  }

  if (
    !amount.isFinite() ||
    !amount.greaterThan(0) ||
    amount.decimalPlaces() > 2 ||
    amount.greaterThan(MAX_MONEY_AMOUNT)
  ) {
    throw new Error(errorMessage);
  }

  return amount;
};

export { toMoneyDecimal };
