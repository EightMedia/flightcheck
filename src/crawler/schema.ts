export type TrackingItem = {
  provider: string;
  id: string;
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
  };
}
