import { spawn } from "node:child_process";

export type ExecResult = { stdout: string; stderr: string };

export function execGit(args: string[], opts: { cwd: string }): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        const error = new Error(`git ${args.join(" ")} failed (code ${code})\n${stderr}`.trim());
        (error as any).stdout = stdout;
        (error as any).stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

