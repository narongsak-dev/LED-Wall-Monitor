export interface Tariff {
  siteId: number;
  rate: number;        // THB per kWh
  currency: string;    // 'THB'
  name: string | null;
  /** When false the cost card stays hidden even if rate > 0. Lets the
   *  operator turn the feature off without losing the configured rate. */
  enabled: boolean;
  updatedAt: string;   // ISO-8601
}
