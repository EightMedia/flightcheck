export function createEmptyVerificationRecord(url, status) {
    return {
        url,
        status,
        h1: "",
        title: "",
        metaTitle: "",
        metaDescription: "",
        robots: "",
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
