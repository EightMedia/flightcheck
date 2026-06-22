export type SecretSeverity = "critical" | "review";

export type SecretFinding = {
  type: string;
  provider: string;
  severity: SecretSeverity;
  masked: string;
  source: string;
};

export type TrackingItem = {
  provider: string;
  id: string;
};

export type CrawlIssueSeverity = "critical" | "error" | "warning" | "review";

export type CrawlIssue = {
  id: string;
  severity: CrawlIssueSeverity;
  message: string;
};

export type VerificationRecord = {
  url: string;
  status: number | null;
  h1: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  robots: string;
  template: string;
  mainCount: number | null;
  charset: string;
  language: string;
  colorScheme: string;
  themeColor: string;
  doctype: string;
  viewport: string;
  canonical: string;
  favicon: string;
  icons: Array<{
    rel: string;
    href: string;
    type: string;
    sizes: string;
    media: string;
  }>;
  og: {
    title: string;
    description: string;
    image: string;
    url: string;
    type: string;
    siteName: string;
  };
  twitter: {
    card: string;
    title: string;
    description: string;
    image: string;
  };
  tracking: {
    tagManager: TrackingItem[];
    analytics: TrackingItem[];
  };
  security: {
    secrets: SecretFinding[];
    scannedAssets: number;
  };
  images?: {
    issues: CrawlIssue[];
  };
  a11yStatic?: {
    issues: CrawlIssue[];
  };
  note?: string;
  error?: string;
};

export function createEmptyVerificationRecord(url: string, status: number | null): VerificationRecord {
  return {
    url,
    status,
    h1: "",
    title: "",
    metaTitle: "",
    metaDescription: "",
    robots: "",
    template: "",
    mainCount: null,
    charset: "",
    language: "",
    colorScheme: "",
    themeColor: "",
    doctype: "",
    viewport: "",
    canonical: "",
    favicon: "",
    icons: [],
    og: {
      title: "",
      description: "",
      image: "",
      url: "",
      type: "",
      siteName: "",
    },
    twitter: {
      card: "",
      title: "",
      description: "",
      image: "",
    },
    tracking: {
      tagManager: [],
      analytics: [],
    },
    security: {
      secrets: [],
      scannedAssets: 0,
    },
  };
}
