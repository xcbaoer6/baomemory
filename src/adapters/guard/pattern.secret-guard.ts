import type { SecretGuard } from '../../core/ports';

interface Rule {
  readonly reason: string;
  readonly test: (text: string) => boolean;
}

const regex = (reason: string, pattern: RegExp): Rule => ({ reason, test: (t) => pattern.test(t) });

const luhn = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

const cardNumber: Rule = {
  reason: '疑似银行卡号',
  test: (t) => [...t.matchAll(/(?:\d[ -]?){13,19}/g)].some((m) => luhn(m[0].replace(/\D/g, ''))),
};

export const DEFAULT_RULES: readonly Rule[] = [
  regex('疑似私钥', /-----BEGIN [A-Z ]*PRIVATE KEY-----/),
  regex('疑似助记词', /(?:seed phrase|mnemonic|助记词)\s*[:：=]/i),
  regex(
    '疑似 API 密钥',
    /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[abpr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|sbp_[A-Za-z0-9]{30,})\b/,
  ),
  regex('疑似 JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/),
  regex('疑似密码', /(?:password|passwd|pwd|密码|口令)\s*[:：=]\s*\S+/i),
  cardNumber,
];

export class PatternSecretGuard implements SecretGuard {
  constructor(private readonly rules: readonly Rule[] = DEFAULT_RULES) {}

  inspect(text: string) {
    const hit = this.rules.find((r) => r.test(text));
    return hit ? ({ ok: false, reason: `拒绝写入：${hit.reason}` } as const) : ({ ok: true } as const);
  }
}
