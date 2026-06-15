const PATTERNS = [
    { type: "google-api-key", provider: "google", severity: "review", regex: /\bAIzaSy[0-9A-Za-z_-]{33}\b/g },
    { type: "aws-access-key-id", provider: "aws", severity: "critical", regex: /\bAKIA[0-9A-Z]{16}\b/g },
    { type: "stripe-secret-key", provider: "stripe", severity: "critical", regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/g },
    { type: "stripe-publishable-key", provider: "stripe", severity: "review", regex: /\bpk_live_[0-9a-zA-Z]{24,}\b/g },
    { type: "github-token", provider: "github", severity: "critical", regex: /\bgh[posru]_[0-9A-Za-z]{36,}\b/g },
    {
        type: "private-key",
        provider: "generic",
        severity: "critical",
        regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
        display: "[PRIVATE KEY BLOCK]",
    },
    {
        type: "generic-secret",
        provider: "generic",
        severity: "critical",
        regex: /["']?(?:secret|password|api[_-]?secret)["']?\s*[:=]\s*["']([^"'\s]{8,})["']/gi,
        group: 1,
        generic: true,
    },
    {
        type: "generic-api-key",
        provider: "generic",
        severity: "review",
        regex: /["']?(?:api[_-]?key|access[_-]?token|auth[_-]?token)["']?\s*[:=]\s*["']([^"'\s]{12,})["']/gi,
        group: 1,
        generic: true,
    },
];
export function maskSecret(value) {
    if (value.length <= 10) {
        return `${value.slice(0, 2)}…${value.slice(-2)}`;
    }
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
export function scanText(text, source, reveal = false) {
    const findings = [];
    const seen = new Set(); // dedup: type + raw value
    const specificValues = new Set(); // raw values from non-generic patterns
    const collect = (pattern) => {
        const re = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match;
        while ((match = re.exec(text)) !== null) {
            const raw = pattern.group ? match[pattern.group] : match[0];
            if (!raw)
                continue;
            if (pattern.generic && specificValues.has(raw))
                continue;
            const key = `${pattern.type}:${raw}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            if (!pattern.generic)
                specificValues.add(raw);
            findings.push({
                type: pattern.type,
                provider: pattern.provider,
                severity: pattern.severity,
                masked: pattern.display ?? (reveal ? raw : maskSecret(raw)),
                source,
            });
        }
    };
    for (const pattern of PATTERNS.filter((p) => !p.generic))
        collect(pattern);
    for (const pattern of PATTERNS.filter((p) => p.generic))
        collect(pattern);
    return findings;
}
