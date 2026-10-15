import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architecture guardrail: screens and components consume data through the
 * shared client seams only. Direct imports of the sample backend from UI
 * code would couple presentation to mock data and break the api switch.
 */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("mock boundary", () => {
  it("keeps UI code free of direct sample-backend imports", () => {
    const roots = [join(__dirname, "..", "src", "app"), join(__dirname, "..", "src", "components")];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        // The BFF route is a sanctioned data seam, not UI code.
        if (file.includes(join("app", "api"))) continue;
        const text = readFileSync(file, "utf8");
        const lines = text.split("\n");
        lines.forEach((line, i) => {
          if (/^\s*import\b/.test(line) && /lib\/mock\//.test(line)) {
            offenders.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
