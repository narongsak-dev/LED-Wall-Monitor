export interface Board {
  id: number;
  siteId: number;
  zoneId: number | null;
  code: string;
  name: string | null;
  hardware: string | null;
  firmware: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  lastSeenAt: string | null;
  isActive: boolean;
}

export interface BoardWithSensors extends Board {
  siteCode?: string;
  siteName?: string;
  zoneCode?: string;
  zoneName?: string;
  sensors: { id: number; code: string; name: string | null }[];
}

export interface CreateBoardPayload {
  siteId: number;
  zoneId?: number | null;
  code: string;
  name?: string;
  hardware?: string;
  firmware?: string;
  macAddress?: string;
  ipAddress?: string;
  isActive?: boolean;
}

export interface UpdateBoardPayload {
  code?: string;
  name?: string;
  zoneId?: number | null;
  hardware?: string;
  firmware?: string;
  macAddress?: string;
  ipAddress?: string;
  isActive?: boolean;
}
