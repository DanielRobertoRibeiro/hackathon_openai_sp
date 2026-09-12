"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Approval, MaestroEvent, MaestroReport, SessionState } from "@/src/core/types";

interface SessionReference {
  project_id: string;
  session_id: string;
  task_id: string;
}

const eventLabels: Record<string, string> = {
  "task.started": "Tarefa iniciada",
  "prompt.submitted": "Prompt enviado",
  "plan.proposed": "Plano proposto",
  "tool.completed": "Ferramenta concluída",
  "file.change.proposed": "Mudança proposta",
  "risk.detected": "Risco detectado",
  "approval.requested": "Aprovação solicitada",
  "approval.resolved": "Aprovação resolvida",
  "verification.completed": "Verificação concluída",
};

export function MaestroDashboard() {
  const [session, setSession] = useState<SessionReference | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    const response = await fetch(
      `/api/state?project_id=${encodeURIComponent(session.project_id)}&session_id=${encodeURIComponent(session.session_id)}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(await readError(response));
    setState((await response.json()) as SessionState);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const refreshTimer = window.setTimeout(() => {
      void refresh().catch((cause) => setError(messageOf(cause)));
    }, 0);
    const stream = new EventSource("/api/stream");
    stream.addEventListener("update", (message) => {
      const payload = JSON.parse((message as MessageEvent<string>).data) as {
        project_id: string;
        session_id: string;
      };
      if (payload.project_id === session.project_id && payload.session_id === session.session_id) {
        void refresh().catch((cause) => setError(messageOf(cause)));
      }
    });
    stream.onerror = () => setError("Atualização em tempo real indisponível. Recarregue o painel.");
    return () => {
      window.clearTimeout(refreshTimer);
      stream.close();
    };
  }, [refresh, session]);

  async function runDemo() {
    await perform("demo", async () => {
      const response = await fetch("/api/demo", { method: "POST" });
      if (!response.ok) throw new Error(await readError(response));
      const result = (await response.json()) as SessionReference & { report: MaestroReport };
      setSession(result);
      setState(null);
    });
  }

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform("session", async () => {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: form.get("project_id"),
          task_id: form.get("task_id"),
          objective: form.get("objective"),
          prompt: form.get("prompt"),
          developer_id: "developer-ui",
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setSession((await response.json()) as SessionReference);
      setState(null);
    });
  }

  async function analyze() {
    if (!session) return;
    await perform("analyze", async () => {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });
      if (!response.ok) throw new Error(await readError(response));
      await refresh();
    });
  }

  async function resolve(approval: Approval, decision: "approved" | "rejected") {
    await perform(approval.approval_id, async () => {
      const response = await fetch(`/api/approvals/${approval.approval_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, resolved_by: "tech-lead-ui", role: "tech_lead" }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await refresh();
    });
  }

  async function perform(name: string, operation: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">OPERAÇÃO HUMANO–IA</p>
          <h1>Maestro</h1>
          <p className="hero-copy">
            O que foi planejado, o que aconteceu e o que ainda precisa de decisão.
          </p>
        </div>
        <button className="primary" onClick={runDemo} disabled={busy !== null}>
          {busy === "demo" ? "Preparando…" : "Executar cenário demo"}
        </button>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <strong>Não foi possível concluir a ação.</strong> {error}
        </div>
      )}

      {!session ? (
        <SessionForm onSubmit={createSession} busy={busy === "session"} />
      ) : (
        <DashboardContent
          session={session}
          state={state}
          busy={busy}
          onAnalyze={analyze}
          onResolve={resolve}
        />
      )}
    </main>
  );
}

function SessionForm({ onSubmit, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return (
    <section className="panel setup-panel" aria-labelledby="new-session-title">
      <div>
        <p className="section-label">NOVA SESSÃO</p>
        <h2 id="new-session-title">Instrumente o próximo fluxo</h2>
        <p className="muted">O Maestro registra somente o contexto profissional fornecido nesta sessão.</p>
      </div>
      <form onSubmit={onSubmit}>
        <div className="form-row">
          <label>Projeto<input name="project_id" defaultValue="maestro-demo" required /></label>
          <label>Tarefa<input name="task_id" defaultValue="TASK-001" required /></label>
        </div>
        <label>Objetivo aprovado<textarea name="objective" rows={2} required defaultValue="Implementar uma fatia segura e verificável do projeto." /></label>
        <label>Prompt do desenvolvedor<textarea name="prompt" rows={4} required placeholder="Descreva o trabalho solicitado ao agente…" /></label>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Iniciando…" : "Iniciar sessão"}</button>
      </form>
    </section>
  );
}

function DashboardContent({
  session,
  state,
  busy,
  onAnalyze,
  onResolve,
}: {
  session: SessionReference;
  state: SessionState | null;
  busy: string | null;
  onAnalyze: () => void;
  onResolve: (approval: Approval, decision: "approved" | "rejected") => void;
}) {
  if (!state) return <div className="loading" role="status">Consolidando contexto operacional…</div>;
  const pending = state.approvals.filter((approval) => approval.status === "pending");
  return (
    <>
      <section className="session-heading">
        <div>
          <p className="section-label">{session.project_id} / {session.task_id}</p>
          <h2>{state.objective}</h2>
        </div>
        <button className="secondary" onClick={onAnalyze} disabled={busy !== null}>
          {busy === "analyze" ? "Analisando…" : "Gerar análise"}
        </button>
      </section>

      <section className="metrics" aria-label="Métricas da sessão">
        <Metric label="Estado" value={state.status} tone={state.status === "blocked" ? "danger" : "good"} />
        <Metric label="Eventos" value={String(state.event_count)} />
        <Metric label="Aprovações" value={String(pending.length)} tone={pending.length ? "warning" : "good"} />
        <Metric label="Verificação" value={state.verification_status} tone={state.verification_status === "verified" ? "good" : "warning"} />
      </section>

      <div className="dashboard-grid">
        <section className="panel timeline-panel">
          <p className="section-label">TIMELINE</p>
          <h3>Fluxo observado</h3>
          <ol className="timeline">
            {[...state.events].reverse().map((event) => <EventItem key={event.event_id} event={event} />)}
          </ol>
        </section>

        <aside className="side-stack">
          <section className="panel">
            <p className="section-label">GATES</p>
            <h3>Aprovações</h3>
            {pending.length === 0 ? <Empty text="Nenhuma decisão pendente." /> : pending.map((approval) => (
              <div className="approval" key={approval.approval_id}>
                <strong>{approval.action}</strong>
                <p>{approval.reason}</p>
                <span>Requer: {approval.required_role}</span>
                <div className="approval-actions">
                  <button onClick={() => onResolve(approval, "approved")} disabled={busy !== null}>Aprovar</button>
                  <button className="reject" onClick={() => onResolve(approval, "rejected")} disabled={busy !== null}>Rejeitar</button>
                </div>
              </div>
            ))}
          </section>

          <section className="panel">
            <p className="section-label">MAESTRO</p>
            <h3>Análise atual</h3>
            {state.latest_report ? <ReportView report={state.latest_report} /> : <Empty text="Gere uma análise para consolidar a sessão." />}
          </section>
        </aside>
      </div>
    </>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: string }) {
  return <div className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function EventItem({ event }: { event: MaestroEvent }) {
  const description = String(event.payload.description ?? eventLabels[event.event_type] ?? event.event_type);
  return (
    <li>
      <div className="event-dot" />
      <div>
        <span className="event-type">{eventLabels[event.event_type] ?? event.event_type}</span>
        <p>{description}</p>
        <small>{event.actor.id} · {new Date(event.received_at).toLocaleTimeString("pt-BR")}</small>
      </div>
    </li>
  );
}

function ReportView({ report }: { report: MaestroReport }) {
  return (
    <div className="report">
      <p>{report.summary}</p>
      {report.risks.length > 0 && <><h4>Riscos</h4><ul>{report.risks.map((risk, index) => <li key={`${risk.description}-${index}`}><span className={`severity ${risk.severity}`}>{risk.severity}</span>{risk.description}</li>)}</ul></>}
      {report.recommendations.length > 0 && <><h4>Próximos passos</h4><ul>{report.recommendations.map((item, index) => <li key={`${item.action}-${index}`}>{item.action}</li>)}</ul></>}
      <small>Confiança: {Math.round(report.overall_confidence * 100)}% · {report.verification_status}</small>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
  return body?.message ?? body?.error ?? `Erro HTTP ${response.status}`;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Erro inesperado";
}
