export type MemberThermalStatement = {
  churchName: string;
  logoDataUri: string | null;
  congregationName: string | null;
  memberName: string;
  period: string;
  category: string | null;
  issuedAt: string;
  totalCents: number;
  items: { date: string; category: string; amountCents: number }[];
};
