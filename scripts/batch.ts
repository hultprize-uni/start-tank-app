// Procesos batch de Start Tank. Uso: pnpm batch <proceso> [argumento]
// Lee DATABASE_URL de .env y escribe sus archivos en batch-out/ (o BATCH_OUT_DIR).
import { PROCESSES } from "../src/server/batch/index.ts";

const [name, arg] = process.argv.slice(2);
const proc = name ? PROCESSES[name] : undefined;

if (!proc) {
  console.log("Uso: pnpm batch <proceso> [argumento]\n");
  for (const [key, value] of Object.entries(PROCESSES)) console.log(`  ${key.padEnd(15)} ${value.help}`);
  process.exit(name ? 1 : 0);
}

try {
  console.log(JSON.stringify(await proc.run(arg), null, 2));
} catch (error) {
  console.error(`Falló ${name}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
