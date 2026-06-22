export type WappalyzerCategory = {
  id: number;
  name: string;
  priority: number;
  groups: number[];
  slug: string;
};

export type ParsedPattern = {
  value: string;
  regex: RegExp;
  confidence: number;
  version: string;
};

export type WappalyzerTechnology = {
  name: string;
  slug: string;
  categories: number[];
  description: string | null;
  website: string | null;
  html: ParsedPattern[];
  text: ParsedPattern[];
  scripts: ParsedPattern[];
  scriptSrc: ParsedPattern[];
  url: ParsedPattern[];
  meta: Record<string, ParsedPattern[]>;
  headers: Record<string, ParsedPattern[]>;
  cookies: Record<string, ParsedPattern[]>;
  dns: Record<string, ParsedPattern[]>;
  robots: ParsedPattern[];
  css: ParsedPattern[];
  js: Record<string, ParsedPattern[]>;
  dom: Record<string, DomPattern>;
  excludes: Array<{ name: string }>;
  implies: Array<{ name: string; confidence: number; version: string }>;
};

export type DomPattern = {
  exists?: ParsedPattern;
  attributes?: Record<string, ParsedPattern>;
  properties?: Record<string, ParsedPattern>;
  text?: ParsedPattern;
};

export type RawPatternMatch = {
  technology: WappalyzerTechnology;
  pattern: ParsedPattern & { type: string; value: string; match: string };
  version: string;
};

export type ResolvedTechnology = {
  name: string;
  categories: WappalyzerCategory[];
  confidence: number;
  version: string;
  website: string | null;
  description: string | null;
  evidence: string[];
};

export type AnalyzeItems = {
  html?: string;
  text?: string[];
  scripts?: string[];
  scriptSrc?: string[];
  url?: string;
  meta?: Record<string, string[]>;
  headers?: Record<string, string[]>;
  cookies?: Record<string, string[]>;
  dns?: Record<string, string[]>;
  robots?: string;
  css?: string[];
  dom?: boolean;
};
