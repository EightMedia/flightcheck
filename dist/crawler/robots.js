import robotsParser from "robots-parser";
import { DEFAULT_USER_AGENT } from "./defaults.js";
export async function loadRobotsPolicy(origin, timeoutMs) {
    const createRobotsParser = robotsParser;
    const robotsUrl = `${origin}/robots.txt`;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(robotsUrl, {
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "user-agent": DEFAULT_USER_AGENT,
            },
        });
        clearTimeout(timeout);
        if (!response.ok) {
            return null;
        }
        const body = await response.text();
        const parsed = createRobotsParser(robotsUrl, body);
        return {
            isAllowed: (url) => parsed.isAllowed(url, DEFAULT_USER_AGENT) !== false,
        };
    }
    catch {
        return null;
    }
}
