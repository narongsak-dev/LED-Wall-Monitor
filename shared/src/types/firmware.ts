/** Metadata for a single firmware image stored on the platform. */
export interface FirmwareRelease {
  id: number;
  version: string;
  description: string | null;
  filename: string;
  fileSize: number;
  sha256: string;
  isActive: boolean;
  uploadedBy: number | null;
  uploadedAt: string;
}

/** Returned by `GET /api/firmware/latest` — what the board sees when it polls
 *  for updates. Includes everything needed to download + verify the file. */
export interface FirmwareLatestResponse {
  hasUpdate: boolean;
  /** Set when `hasUpdate` is true. */
  version?: string;
  /** Set when `hasUpdate` is true. */
  fileSize?: number;
  /** Set when `hasUpdate` is true. */
  sha256?: string;
  /** Absolute URL the board should GET to stream the .bin into Update.write(). */
  downloadUrl?: string;
}

/** Command published by backend to `sites/<site>/boards/<board>/cmd`.
 *  Boards subscribe to their own cmd topic and act on these. */
export interface BoardOtaCommand {
  action: 'ota_install';
  version: string;
  downloadUrl: string;
}

/** OTA progress event published by board to `sites/<site>/boards/<board>/ota-status`.
 *  Backend forwards to frontend via Socket.IO. */
export interface BoardOtaStatus {
  boardId: number;
  /** Empty string when board is idle (no OTA in progress). */
  targetVersion: string;
  state: 'idle' | 'downloading' | 'applying' | 'success' | 'failed';
  /** Bytes written so far (downloading) or `total` (applying/success). */
  done: number;
  /** Total firmware size in bytes; 0 when not yet known. */
  total: number;
  /** Optional human-readable note from the board. */
  message: string;
  /** ISO-8601 timestamp the backend stamped on receipt. */
  receivedAt: string;
}
