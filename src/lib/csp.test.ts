import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * La politique de sécurité (netlify.toml) n'autorise que les scripts intégrés dont elle connaît l'empreinte.
 * Si le script d'index.html change sans que l'empreinte suive, le navigateur le bloque sans prévenir.
 */
describe("politique de sécurité du site", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const toml = readFileSync(new URL("../../netlify.toml", import.meta.url), "utf8");
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  it("autorise chaque script intégré d'index.html par son empreinte", () => {
    expect(inline.length).toBeGreaterThan(0);
    for (const body of inline) {
      const hash = `sha256-${createHash("sha256").update(body).digest("base64")}`;
      expect(toml, `empreinte manquante dans netlify.toml : '${hash}'`).toContain(`'${hash}'`);
    }
  });

  it("interdit l'affichage du site dans un autre site", () => {
    expect(toml).toContain("frame-ancestors 'none'");
  });
});
