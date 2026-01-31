import { readFileSync } from "node:fs";

const getVersion = () => {
  try {
    const packageJson = new URL("../package.json", import.meta.url);
    const raw = readFileSync(packageJson, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.version === "string") {
      return parsed.version;
    }
  } catch (error) {
    return "unknown";
  }
  return "unknown";
};

const getCommitHash = () =>
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null;

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({
      ok: false,
      status: "method_not_allowed",
      timestamp: new Date().toISOString(),
      version: getVersion(),
    });
  }

  const commitHash = getCommitHash();
  const payload = {
    ok: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    version: getVersion(),
    ...(commitHash ? { commit: commitHash } : {}),
  };

  return response.status(200).json(payload);
}
