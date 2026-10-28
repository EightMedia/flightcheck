import { describe, expect, it } from "vitest";
import {
  analyzeUrlTree,
  classifyCrawlUrl,
  createDiscoveryGate,
  detailCapPerSection,
  selectSmartCrawlUrls,
  sortByCrawlPriority,
} from "./smartPageSelection.js";

function archiveSite(): string[] {
  return [
    "https://example.com/",
    "https://example.com/about",
    "https://example.com/contact",
    "https://example.com/stories",
    "https://example.com/agenda",
    ...Array.from({ length: 50 }, (_, i) => `https://example.com/stories/item-${i}`),
    ...Array.from({ length: 50 }, (_, i) => `https://example.com/agenda/item-${i}`),
  ];
}

describe("analyzeUrlTree", () => {
  it("detects list parents from fan-out shape, not slug names", () => {
    const tree = analyzeUrlTree(archiveSite());
    expect(tree.listParents.has("/stories")).toBe(true);
    expect(tree.listParents.has("/agenda")).toBe(true);
    expect(tree.listParents.has("/about")).toBe(false);
    expect(tree.listParents.has("/")).toBe(false);
  });

  it("does not treat a small service tree as a list", () => {
    const urls = [
      "https://example.com/",
      "https://example.com/services",
      "https://example.com/services/web",
      "https://example.com/services/web/design",
      "https://example.com/services/app",
      "https://example.com/about",
    ];
    const tree = analyzeUrlTree(urls);
    expect(tree.listParents.size).toBe(0);
  });
});

describe("classifyCrawlUrl", () => {
  it("classifies from tree shape", () => {
    const tree = analyzeUrlTree(archiveSite());
    expect(classifyCrawlUrl("https://example.com/", tree).kind).toBe("home");
    expect(classifyCrawlUrl("https://example.com/about", tree).kind).toBe("root");
    expect(classifyCrawlUrl("https://example.com/stories", tree).kind).toBe("list");
    expect(classifyCrawlUrl("https://example.com/stories/item-1", tree).kind).toBe("detail");
    expect(classifyCrawlUrl("https://example.com/stories/item-1", tree).section).toBe("/stories");
  });

  it("ranks home above root above list above detail", () => {
    const tree = analyzeUrlTree(archiveSite());
    const home = classifyCrawlUrl("https://example.com/", tree);
    const root = classifyCrawlUrl("https://example.com/about", tree);
    const list = classifyCrawlUrl("https://example.com/stories", tree);
    const detail = classifyCrawlUrl("https://example.com/stories/item-1", tree);
    expect(home.priority).toBeGreaterThan(root.priority);
    expect(root.priority).toBeGreaterThan(list.priority);
    expect(list.priority).toBeGreaterThan(detail.priority);
  });
});

describe("selectSmartCrawlUrls", () => {
  it("keeps all URLs when under the limit, ordered by priority", () => {
    const urls = [
      "https://example.com/about/team",
      "https://example.com/about",
      "https://example.com/",
    ];
    expect(selectSmartCrawlUrls(urls, 10).urls).toEqual([
      "https://example.com/",
      "https://example.com/about",
      "https://example.com/about/team",
    ]);
  });

  it("prefers structural pages and samples leaf tails under list parents", () => {
    const { urls: selected, tree } = selectSmartCrawlUrls(archiveSite(), 20);

    expect(tree.listParents.has("/stories")).toBe(true);
    expect(tree.listParents.has("/agenda")).toBe(true);

    expect(selected).toContain("https://example.com/");
    expect(selected).toContain("https://example.com/about");
    expect(selected).toContain("https://example.com/contact");
    expect(selected).toContain("https://example.com/stories");
    expect(selected).toContain("https://example.com/agenda");
    expect(selected).toHaveLength(20);

    const storyDetails = selected.filter((url) => url.includes("/stories/item-"));
    const agendaDetails = selected.filter((url) => url.includes("/agenda/item-"));
    // Remaining 15 slots shared round-robin across the two list parents.
    expect(storyDetails.length).toBe(8);
    expect(agendaDetails.length).toBe(7);
    expect(storyDetails[0]).toBe("https://example.com/stories/item-0");
    expect(agendaDetails[0]).toBe("https://example.com/agenda/item-0");
  });

  it("includes startUrl even when not first in the input list", () => {
    const { urls: selected } = selectSmartCrawlUrls(
      ["https://example.com/about/x", "https://example.com/about"],
      2,
      { startUrl: "https://example.com/" }
    );
    expect(selected[0]).toBe("https://example.com/");
    expect(selected).toHaveLength(2);
    expect(selected).toContain("https://example.com/about/x");
  });

  it("deduplicates URLs", () => {
    const { urls: selected } = selectSmartCrawlUrls(
      ["https://example.com/", "https://example.com/", "https://example.com/about"],
      10
    );
    expect(selected).toEqual(["https://example.com/", "https://example.com/about"]);
  });
});

describe("sortByCrawlPriority", () => {
  it("is stable for equal priority", () => {
    const urls = ["https://example.com/a", "https://example.com/b"];
    const tree = analyzeUrlTree(urls);
    expect(sortByCrawlPriority(urls, tree)).toEqual(urls);
  });
});

describe("detailCapPerSection", () => {
  it("scales with maxPages", () => {
    expect(detailCapPerSection(100)).toBeGreaterThanOrEqual(2);
    expect(detailCapPerSection(100)).toBeLessThanOrEqual(20);
    expect(detailCapPerSection(8)).toBe(2);
  });
});

describe("createDiscoveryGate", () => {
  it("caps further details under a detected list parent", () => {
    const seeds = archiveSite().slice(0, 5 + 8); // structural + first 8 story items → list detected
    const gate = createDiscoveryGate(seeds, 20);
    for (const seed of seeds) gate.remember(seed);

    expect(gate.isStructural("https://example.com/about")).toBe(true);
    expect(gate.isStructural("https://example.com/stories/item-0")).toBe(false);

    // After remembering seeds, additional story details may hit the cap.
    let allowed = 0;
    for (let i = 100; i < 120; i += 1) {
      const url = `https://example.com/stories/extra-${i}`;
      if (gate.allowEnqueue(url)) {
        allowed += 1;
        gate.remember(url);
      }
    }
    expect(allowed).toBeLessThan(20);
  });
});
