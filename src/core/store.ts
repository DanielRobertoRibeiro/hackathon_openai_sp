import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Approval, MaestroEvent, MaestroReport } from "./types";

interface Database {
  events: MaestroEvent[];
  approvals: Approval[];
  reports: MaestroReport[];
}

const EMPTY_DATABASE: Database = { events: [], approvals: [], reports: [] };

export class MaestroStore {
  private data: Database | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string | null = null) {}

  async appendEvent(event: MaestroEvent): Promise<{ event: MaestroEvent; duplicate: boolean }> {
    return this.mutate((database) => {
      const duplicate = database.events.find(
        (item) =>
          item.event_id === event.event_id ||
          (event.idempotency_key !== null && item.idempotency_key === event.idempotency_key &&
            item.project_id === event.project_id && item.session_id === event.session_id &&
            item.source === event.source && item.actor.id === event.actor.id),
      );
      if (duplicate) return { event: duplicate, duplicate: true };
      database.events.push(event);
      return { event, duplicate: false };
    });
  }

  async listEvents(projectId: string, sessionId?: string): Promise<MaestroEvent[]> {
    const database = await this.read();
    return database.events
      .filter(
        (event) => event.project_id === projectId && (!sessionId || event.session_id === sessionId),
      )
      .sort((left, right) =>
        `${left.occurred_at}:${left.received_at}:${left.event_id}`.localeCompare(
          `${right.occurred_at}:${right.received_at}:${right.event_id}`,
        ),
      );
  }

  async saveApproval(approval: Approval): Promise<Approval> {
    return this.mutate((database) => {
      const index = database.approvals.findIndex(
        (item) => item.approval_id === approval.approval_id,
      );
      if (index >= 0) database.approvals[index] = approval;
      else database.approvals.push(approval);
      return approval;
    });
  }

  async getApproval(approvalId: string): Promise<Approval | null> {
    const database = await this.read();
    return database.approvals.find((item) => item.approval_id === approvalId) ?? null;
  }

  async listApprovals(projectId: string, sessionId?: string): Promise<Approval[]> {
    const database = await this.read();
    return database.approvals.filter(
      (item) => item.project_id === projectId && (!sessionId || item.session_id === sessionId),
    );
  }

  async saveReport(report: MaestroReport): Promise<MaestroReport> {
    return this.mutate((database) => {
      database.reports.push(report);
      return report;
    });
  }

  async latestReport(projectId: string, sessionId: string): Promise<MaestroReport | null> {
    const database = await this.read();
    return (
      database.reports
        .filter((item) => item.project_id === projectId && item.session_id === sessionId)
        .sort((left, right) => right.generated_at.localeCompare(left.generated_at))[0] ?? null
    );
  }

  async clearSession(projectId: string, sessionId: string): Promise<void> {
    await this.mutate((database) => {
      database.events = database.events.filter(
        (item) => item.project_id !== projectId || item.session_id !== sessionId,
      );
      database.approvals = database.approvals.filter(
        (item) => item.project_id !== projectId || item.session_id !== sessionId,
      );
      database.reports = database.reports.filter(
        (item) => item.project_id !== projectId || item.session_id !== sessionId,
      );
    });
  }

  private async read(): Promise<Database> {
    if (this.data) return structuredClone(this.data);
    if (!this.filePath) {
      this.data = structuredClone(EMPTY_DATABASE);
      return structuredClone(this.data);
    }

    try {
      const content = await readFile(this.filePath, "utf8");
      this.data = JSON.parse(content) as Database;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.data = structuredClone(EMPTY_DATABASE);
    }
    return structuredClone(this.data);
  }

  private async mutate<T>(operation: (database: Database) => T | Promise<T>): Promise<T> {
    const task = this.queue.then(async () => {
      const database = await this.read();
      const result = await operation(database);
      await this.persist(database);
      this.data = database;
      return result;
    });
    this.queue = task.catch(() => undefined);
    return task;
  }

  private async persist(database: Database): Promise<void> {
    if (!this.filePath) return;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

export function resolveStoragePath(input: string): string {
  const normalized = input.replaceAll("\\", "/");
  const filename = path.posix.basename(normalized);
  if (!filename.endsWith(".json") || normalized !== `.data/${filename}`) {
    throw new Error("MAESTRO_STORAGE_FILE must be a JSON file directly inside .data");
  }
  return path.join(process.cwd(), ".data", filename);
}
