export interface Tariff {
  siteId: number;
  rate: number;        // THB per kWh
  currency: string;    // 'THB'
  name: string | null;
  updatedAt: string;   // ISO-8601
}
