import { ensureLocalBuild, startLocalServer } from "./local-build.mjs";

const args = process.argv.slice(2);
let host = "127.0.0.1";
let port = 3000;
let buildOnly = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--host" && args[i + 1]) host = args[++i];
  else if (args[i] === "--port" && args[i + 1]) port = Number(args[++i]);
  else if (args[i] === "--build-only") buildOnly = true;
  else if (args[i] === "--help") {
    console.log(
      "Usage: pnpm start [--host 127.0.0.1] [--port 3000]\n       pnpm build:local"
    );
    process.exit(0);
  } else {
    console.error(`Unknown argument: ${args[i]}`);
    process.exit(1);
  }
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Port must be an integer between 1 and 65535.");
  process.exit(1);
}

try {
  if (buildOnly) {
    await ensureLocalBuild();
    console.log("Local build is ready.");
  } else {
    const service = await startLocalServer({ host, port });
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => service.kill(signal));
    }
    await new Promise((done, reject) => {
      service.once("error", reject);
      service.once("exit", (code) => {
        process.exitCode = code ?? 0;
        done();
      });
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
