import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { TelemetryService } from '../telemetry/telemetry.service';
import { BoardsService } from '../boards/boards.service';
import { SensorsService } from '../sensors/sensors.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { BoardOtaCommand, BoardOtaStatus } from '@monitor/shared';

interface SensorReading {
  voltage?: number;
  current?: number;
  power?: number;
  energy?: number;
  temperature?: number;
  humidity?: number;
  raw?: Record<string, unknown>;
}

interface BoardTelemetryPayload {
  boardCode: string;
  time?: string;
  ipAddress?: string;
  firmware?: string;
  sensors: Record<string, SensorReading>;
}

interface BoardOtaStatusPayload {
  state: BoardOtaStatus['state'];
  targetVersion?: string;
  done?: number;
  total?: number;
  message?: string;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client?: mqtt.MqttClient;
  private topicPrefix = 'sites';
  // Latest OTA status per board (in-memory). Lets the REST endpoint return
  // the current state without waiting for the next MQTT event.
  private readonly latestOtaStatus = new Map<number, BoardOtaStatus>();

  constructor(
    private readonly config: ConfigService,
    private readonly telemetry: TelemetryService,
    @Inject(forwardRef(() => BoardsService))
    private readonly boards: BoardsService,
    private readonly sensors: SensorsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  onModuleInit() {
    const url = this.config.get<string>('MQTT_URL')!;
    this.topicPrefix = this.config.get<string>('MQTT_TOPIC_PREFIX', 'sites');
    const username = this.config.get<string>('MQTT_USERNAME');
    const password = this.config.get<string>('MQTT_PASSWORD');

    this.client = mqtt.connect(url, {
      username: username || undefined,
      password: password || undefined,
      reconnectPeriod: 5_000,
      clean: false,
      clientId: `monitor-backend-${process.pid}`,
    });

    this.client.on('connect', () => {
      this.logger.log(`MQTT connected to ${url}`);
      // sites/<site>/boards/<board>/telemetry — sensor data + heartbeat
      this.client!.subscribe(`${this.topicPrefix}/+/boards/+/telemetry`, { qos: 1 });
      // sites/<site>/boards/<board>/ota-status — OTA progress events
      this.client!.subscribe(`${this.topicPrefix}/+/boards/+/ota-status`, { qos: 1 });
    });

    this.client.on('error', (err) => this.logger.error(`MQTT error: ${err.message}`));
    this.client.on('reconnect', () => this.logger.warn('MQTT reconnecting...'));

    this.client.on('message', async (topic, payload) => {
      try {
        await this.handleMessage(topic, payload);
      } catch (err) {
        this.logger.error(`Failed to handle ${topic}: ${(err as Error).message}`);
      }
    });
  }

  onModuleDestroy() {
    this.client?.end();
  }

  private async handleMessage(topic: string, payload: Buffer) {
    // Dispatch by topic suffix. Both topics carry a {site, board} pair
    // baked into the path; the body schema differs by type.
    if (topic.endsWith('/ota-status')) {
      await this.handleOtaStatus(topic, payload);
      return;
    }
    await this.handleTelemetry(payload);
  }

  private async handleTelemetry(payload: Buffer) {
    const parsed = JSON.parse(payload.toString()) as BoardTelemetryPayload;
    if (!parsed.boardCode || !parsed.sensors) {
      this.logger.warn(`Invalid telemetry payload: missing boardCode/sensors`);
      return;
    }

    const board = await this.boards.findByCode(parsed.boardCode);
    if (!board) {
      this.logger.warn(`Unknown board: ${parsed.boardCode}`);
      return;
    }

    const time = parsed.time ? new Date(parsed.time) : new Date();
    await this.boards.touchLastSeen(
      board.id,
      time,
      parsed.ipAddress,
      parsed.firmware,
    );

    // OTA reconciliation: if we triggered an update on this board, and the
    // board has now rebooted and is reporting telemetry with the target
    // firmware, the update is done. Emit a final `success` event so the UI
    // un-sticks the "applying / rebooting" state and re-enables the trigger
    // button. Without this the cache would hold the last in-progress event
    // forever — the modal would look frozen even though the board recovered.
    this.reconcileOtaOnTelemetry(Number(board.id), parsed.firmware);

    const sensorsByCode = new Map(board.sensors.map((s) => [s.code, s]));

    for (const [sensorCode, reading] of Object.entries(parsed.sensors)) {
      const sensor = sensorsByCode.get(sensorCode);
      if (!sensor) {
        this.logger.warn(
          `Unknown sensor ${sensorCode} on board ${parsed.boardCode} - skipping`,
        );
        continue;
      }
      if (!sensor.isActive) {
        continue; // sensor disabled by admin - drop the reading silently
      }

      await this.telemetry.insert({
        time,
        sensorId: sensor.id,
        boardId: board.id,
        siteId: board.siteId,
        voltage: reading.voltage,
        current: reading.current,
        power: reading.power,
        energy: reading.energy,
        temperature: reading.temperature,
        humidity: reading.humidity,
        raw: reading.raw,
      });

      this.realtime.broadcastTelemetry({
        siteId: Number(board.siteId),
        deviceId: Number(sensor.id),
        point: {
          time: time.toISOString(),
          deviceId: Number(sensor.id),
          siteId: Number(board.siteId),
          voltage: reading.voltage ?? null,
          current: reading.current ?? null,
          power: reading.power ?? null,
          energy: reading.energy ?? null,
          temperature: reading.temperature ?? null,
          raw: reading.raw,
        },
        receivedAt: new Date().toISOString(),
      });
    }
  }

  /** Handle an `ota-status` event from a board. The topic carries the board
   *  code; we look the board up, normalise the payload, cache the latest
   *  state per board, then push it to subscribed sockets. */
  private async handleOtaStatus(topic: string, payload: Buffer) {
    // Topic shape: sites/<site>/boards/<board>/ota-status
    const m = topic.match(/^[^/]+\/[^/]+\/boards\/([^/]+)\/ota-status$/);
    const boardCode = m?.[1];
    if (!boardCode) return;

    const board = await this.boards.findByCode(boardCode);
    if (!board) {
      this.logger.warn(`ota-status from unknown board: ${boardCode}`);
      return;
    }

    let p: BoardOtaStatusPayload;
    try {
      p = JSON.parse(payload.toString()) as BoardOtaStatusPayload;
    } catch {
      this.logger.warn(`ota-status bad JSON from ${boardCode}`);
      return;
    }

    const status: BoardOtaStatus = {
      boardId: Number(board.id),
      targetVersion: p.targetVersion ?? '',
      state: p.state ?? 'idle',
      done: p.done ?? 0,
      total: p.total ?? 0,
      message: p.message ?? '',
      receivedAt: new Date().toISOString(),
    };
    this.latestOtaStatus.set(status.boardId, status);
    this.realtime.broadcastBoardOtaStatus(status);
    // Reset the watchdog: in-flight events extend the window, terminal
    // events (success/failed) cancel it entirely.
    if (status.state === 'success' || status.state === 'failed') {
      this.disarmOtaWatchdog(status.boardId);
    } else {
      this.armOtaWatchdog(status.boardId, status.targetVersion);
    }
  }

  /** Returns the last-seen status for a board, or undefined if we've never
   *  received one. Used by the REST endpoint to seed the UI before any
   *  realtime events arrive. */
  getOtaStatus(boardId: number): BoardOtaStatus | undefined {
    return this.latestOtaStatus.get(boardId);
  }

  /** Publish a `cmd` message to a single board. The board has an outbound
   *  MQTT connection to the broker, so this works through NAT without any
   *  port-forward / VPN — the broker pushes the cmd down the link the
   *  board itself opened. */
  async publishCommand(
    siteCode: string,
    boardCode: string,
    cmd: BoardOtaCommand,
  ): Promise<void> {
    if (!this.client || !this.client.connected) {
      throw new BadRequestException('MQTT broker is not connected');
    }
    const topic = `${this.topicPrefix}/${siteCode}/boards/${boardCode}/cmd`;
    return new Promise((resolve, reject) => {
      this.client!.publish(topic, JSON.stringify(cmd), { qos: 1 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  /** Resolve a board + firmware version, compose the download URL, and
   *  publish the OTA command. The board's own MQTT handler will pick it
   *  up and run its existing fwDownloadAndApplyCloud path. */
  async triggerBoardOta(
    boardId: bigint,
    version: string,
    downloadUrl: string,
  ): Promise<void> {
    const board = await this.boards.findOne(boardId);
    if (!board) throw new NotFoundException('Board not found');
    await this.publishCommand(board.siteCode, board.code, {
      action: 'ota_install',
      version,
      downloadUrl,
    });
    // Seed the cache with a pending state so the UI shows immediate
    // feedback before the board's first ota-status event arrives.
    const seed: BoardOtaStatus = {
      boardId: Number(board.id),
      targetVersion: version,
      state: 'idle',
      done: 0,
      total: 0,
      message: 'Command sent — waiting for board',
      receivedAt: new Date().toISOString(),
    };
    this.latestOtaStatus.set(seed.boardId, seed);
    this.realtime.broadcastBoardOtaStatus(seed);
    this.armOtaWatchdog(seed.boardId, version);
  }

  // Per-board watchdog timer. Fires if no progress event arrives within the
  // window — turns the cached state into `failed` so the UI un-sticks and
  // the trigger button re-enables. Cleared on every legit ota-status event
  // (handleOtaStatus calls disarmOtaWatchdog).
  private readonly otaWatchdogs = new Map<number, NodeJS.Timeout>();
  private static readonly OTA_WATCHDOG_MS = 5 * 60 * 1000;

  private armOtaWatchdog(boardId: number, targetVersion: string) {
    this.disarmOtaWatchdog(boardId);
    const t = setTimeout(() => {
      const last = this.latestOtaStatus.get(boardId);
      // Only flip to failed if we're still in a not-yet-finished state — the
      // board may have completed and the success event simply hasn't arrived
      // (e.g. it dropped during reboot). The telemetry reconciler handles
      // that case instead.
      if (
        last &&
        (last.state === 'idle' ||
          last.state === 'downloading' ||
          last.state === 'applying')
      ) {
        const status: BoardOtaStatus = {
          ...last,
          state: 'failed',
          message: 'Timed out — no progress for 5 minutes',
          receivedAt: new Date().toISOString(),
        };
        this.latestOtaStatus.set(boardId, status);
        this.realtime.broadcastBoardOtaStatus(status);
        this.logger.warn(`OTA watchdog fired for board ${boardId} (target ${targetVersion})`);
      }
      this.otaWatchdogs.delete(boardId);
    }, MqttService.OTA_WATCHDOG_MS);
    this.otaWatchdogs.set(boardId, t);
  }

  private disarmOtaWatchdog(boardId: number) {
    const t = this.otaWatchdogs.get(boardId);
    if (t) {
      clearTimeout(t);
      this.otaWatchdogs.delete(boardId);
    }
  }

  // Marker we drop in the message field once telemetry has confirmed the new
  // firmware. Lets the next telemetry ticks short-circuit without re-emitting
  // the same event over and over (boards report ~once per second).
  private static readonly OTA_CONFIRMED_PREFIX = 'Confirmed running ';

  // Called from handleTelemetry whenever a board ticks. The board's own
  // pre-reboot publish of FW_SUCCESS often arrives — but with the message
  // still saying "Update complete — rebooting", and (worse) it may not flush
  // at all before ESP.restart(). So telemetry is the AUTHORITATIVE success
  // signal: when the board is back online and reporting the target firmware
  // version, the update is genuinely done, regardless of what the OTA cache
  // currently says. We overwrite the cache so the UI shows a clean
  // "Confirmed running vX" state and the trigger button re-enables.
  private reconcileOtaOnTelemetry(boardId: number, firmware?: string) {
    if (!firmware) return;
    const last = this.latestOtaStatus.get(boardId);
    if (!last) return;
    // If we previously failed (e.g. watchdog fired) and the board still
    // hasn't moved off the old version, leave the failure visible.
    if (last.state === 'failed' && last.targetVersion !== firmware) return;
    // If there was no target (cache from a board-side self-update we never
    // triggered), still confirm so the UI doesn't sit on a stale state.
    if (last.targetVersion && firmware !== last.targetVersion) return;
    // Already confirmed by a previous telemetry tick — skip re-broadcasting.
    if (
      last.state === 'success' &&
      last.message.startsWith(MqttService.OTA_CONFIRMED_PREFIX)
    ) {
      return;
    }

    const done: BoardOtaStatus = {
      ...last,
      state: 'success',
      done: last.total || last.done,
      message: `${MqttService.OTA_CONFIRMED_PREFIX}${firmware}`,
      receivedAt: new Date().toISOString(),
    };
    this.latestOtaStatus.set(boardId, done);
    this.realtime.broadcastBoardOtaStatus(done);
    this.disarmOtaWatchdog(boardId);
    this.logger.log(`OTA reconciled for board ${boardId} via telemetry → ${firmware}`);
  }
}
