export function issue(id, severity, message, fix) {
    return fix === undefined ? { id, severity, message } : { id, severity, message, fix };
}
