import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({});
const TOPIC_ARN = process.env.SNS_TOPIC_ARN!;
const APP_URL = process.env.APP_URL ?? "";
const GITHUB_REPO_URL = process.env.GITHUB_REPO_URL ?? "";

interface CodeBuildPhase {
  "phase-type": string;
  "phase-status"?: string;
  "duration-in-seconds"?: number;
  "phase-context"?: string[];
  "start-time"?: string;
  "end-time"?: string;
}

interface CodeBuildEvent {
  detail: {
    "build-status": string;
    "project-name": string;
    "build-id": string;
    "additional-information": {
      "build-number": number;
      "build-start-time": string;
      "source-version": string;
      initiator: string;
      logs: { "deep-link": string };
      phases: CodeBuildPhase[];
    };
  };
  time: string;
  region: string;
  account: string;
}

function statusIcon(status: string): string {
  switch (status) {
    case "SUCCEEDED": return "✅";
    case "FAILED": return "❌";
    default: return "⚠️";
  }
}

async function fetchCommitMessage(sha: string): Promise<string> {
  if (!GITHUB_REPO_URL || !sha || sha === "unknown") return "";
  try {
    const match = GITHUB_REPO_URL.match(/github\.com\/([^/]+\/[^/]+)/);
    if (!match) return "";
    const apiUrl = `https://api.github.com/repos/${match[1]}/commits/${sha}`;
    const res = await fetch(apiUrl, { headers: { "User-Agent": "build-notification-formatter" } });
    if (!res.ok) return "";
    const data = await res.json() as { commit: { message: string } };
    return data.commit.message.split("\n")[0];
  } catch {
    return "";
  }
}

function formatDuration(phases: CodeBuildPhase[]): string {
  const totalSeconds = phases.reduce((sum, p) => sum + (p["duration-in-seconds"] ?? 0), 0);
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatPhaseTable(phases: CodeBuildPhase[]): string {
  return phases
    .filter((p) => p["phase-status"] && p["phase-type"] !== "COMPLETED")
    .map((p) => {
      const icon = statusIcon(p["phase-status"]!);
      const dur = p["duration-in-seconds"] ?? 0;
      const name = p["phase-type"].padEnd(16);
      return `  ${icon} ${name} ${dur}s`;
    })
    .join("\n");
}

function getFailedPhaseDetails(phases: CodeBuildPhase[]): string {
  const failed = phases.filter((p) => p["phase-status"] === "FAILED");
  if (failed.length === 0) return "";
  const details = failed
    .map((p) => {
      const context = (p["phase-context"] ?? []).filter((c) => c.trim() !== ":" && c.trim() !== "").join("\n    ");
      return context ? `  ${p["phase-type"]}: ${context}` : "";
    })
    .filter(Boolean)
    .join("\n");
  return details ? `\nError Details:\n${details}` : "";
}

export async function handler(event: CodeBuildEvent): Promise<void> {
  const detail = event.detail;
  const info = detail["additional-information"];
  const status = detail["build-status"];
  const project = detail["project-name"];
  const buildNum = info["build-number"];
  const fullCommit = info["source-version"] ?? "unknown";
  const commit = fullCommit.substring(0, 7);
  const initiator = info.initiator ?? "unknown";
  const logsLink = info.logs?.["deep-link"] ?? "";
  const phases = info.phases ?? [];
  const icon = statusIcon(status);
  const duration = formatDuration(phases);
  const projectLink = `https://${event.region}.console.aws.amazon.com/codesuite/codebuild/${event.account}/projects/${project}/history`;
  const commitLink = GITHUB_REPO_URL ? `${GITHUB_REPO_URL}/commit/${fullCommit}` : "";
  const commitMsg = await fetchCommitMessage(fullCommit);
  const commitDisplay = commitMsg ? `${commit} — ${commitMsg}` : commit;
  const subject = `${icon} ${project} build #${buildNum} ${status}`;
  const message = [
    `${icon} Build ${status}`,
    `${"─".repeat(40)}`,
    `Project:   ${project}`,
    `Build:     #${buildNum}`,
    `Status:    ${status}`,
    `Duration:  ${duration}`,
    `Commit:    ${commitDisplay}`,
    `Initiator: ${initiator}`,
    ``,
    `Phases:`,
    formatPhaseTable(phases),
    getFailedPhaseDetails(phases),
    ``,
    `URL:      ${APP_URL}`,
    `Project:  ${projectLink}`,
    ...(commitLink ? [`Commit:   ${commitLink}`] : []),
    `Logs:     ${logsLink}`,
  ].join("\n").trim();
  await sns.send(new PublishCommand({ TopicArn: TOPIC_ARN, Subject: subject.substring(0, 100), Message: message }));
}
