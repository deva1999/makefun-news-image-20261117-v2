// Entry program for make.fun news-image-20261117 (variant 2).
// The front page is rendered ahead of time and bundled as entry.png;
// this program only copies it to the grader's output directory, after
// checking it the way the competition's own gate does: PNG signature
// plus a real IHDR chunk, dimensions within 1024x1024, at most 1 MiB.
// The write is atomic (a temp file in the same directory, then rename)
// and the SHA-256 of the written file must match the source, so the
// grader's two runs produce exactly the same bytes. Any failed check
// exits non-zero with a message on stderr.
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR = Buffer.from("IHDR", "ascii");
const MAX_BYTES = 1048576;
const MAX_SIDE = 1024;

function die(message: string): never {
  console.error(`entry failed: ${message}`);
  process.exit(1);
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function pngSize(data: Buffer): { width: number; height: number } {
  if (data.length < 33) die("entry.png is too short to be a PNG");
  if (!data.subarray(0, 8).equals(PNG_MAGIC)) {
    die("entry.png has a bad PNG signature");
  }
  if (!data.subarray(12, 16).equals(IHDR)) {
    die("entry.png has no IHDR chunk where one belongs");
  }
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = join(here, "entry.png");
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const target = join(outDir, "entry.png");

  const bytes = readFileSync(source);
  if (bytes.length > MAX_BYTES) {
    die(`entry.png is ${bytes.length} bytes, over the 1048576-byte cap`);
  }
  const { width, height } = pngSize(bytes);
  if (width > MAX_SIDE || height > MAX_SIDE) {
    die(`entry.png is ${width}x${height}, over the 1024x1024 cap`);
  }

  const digest = sha256(bytes);
  mkdirSync(outDir, { recursive: true });
  // Temp file in the output directory itself: the rename never crosses
  // filesystems, which matters when /output is a separate mount.
  const temp = join(outDir, `.entry-${process.pid}.tmp.png`);
  try {
    writeFileSync(temp, bytes);
    renameSync(temp, target);
  } catch (error) {
    rmSync(temp, { force: true });
    die(`could not write ${target}: ${(error as Error).message}`);
  }

  const written = readFileSync(target);
  if (sha256(written) !== digest) {
    die("written entry.png does not match the source SHA-256");
  }
  console.log(
    `wrote ${target} (${width}x${height}, ${statSync(target).size} bytes, sha256 ${digest})`,
  );
}

main();
