import Decimal from "decimal.js";

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type RateType = "Bid" | "Ask" | "Mid";

export interface FeeConfig {
  applyImtt: boolean;
  imttRate: number; // percent, e.g. 2 = 2%
  applyBankFees: boolean;
  feeModel: "Flat" | "Percentage" | "PercentageWithMin";
  flatFee: number;
  percentFee: number;
  minFee: number;
}

export const calculateConversion = (amount: number | string, rate: number | string) => {
  return new Decimal(amount || 0).mul(rate || 0);
};

export const calculateIMTT = (amount: Decimal, rate: number, enabled: boolean) => {
  if (!enabled) return new Decimal(0);
  return amount.mul(rate).div(100);
};

export const calculateBankFees = (amount: Decimal, cfg: FeeConfig) => {
  if (!cfg.applyBankFees) return new Decimal(0);
  switch (cfg.feeModel) {
    case "Flat":
      return new Decimal(cfg.flatFee || 0);
    case "Percentage":
      return amount.mul(cfg.percentFee || 0).div(100);
    case "PercentageWithMin": {
      const pct = amount.mul(cfg.percentFee || 0).div(100);
      const min = new Decimal(cfg.minFee || 0);
      return Decimal.max(pct, min);
    }
  }
};

export const calculateNetSettlement = (
  converted: Decimal,
  bankFees: Decimal,
  imtt: Decimal,
) => converted.minus(bankFees).minus(imtt);

export const calculateEffectiveRate = (gross: Decimal, net: Decimal) => {
  if (gross.eq(0)) return new Decimal(0);
  return net.div(gross);
};

export const fmtMoney = (d: Decimal | number, ccy = "", decimals = 2) => {
  const v = new Decimal(d || 0).toFixed(decimals);
  const [int, dec] = v.split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const num = dec ? `${withCommas}.${dec}` : withCommas;
  return ccy ? `${ccy} ${num}` : num;
};

export const fmtRate = (d: Decimal | number) =>
  new Decimal(d || 0).toFixed(4);
