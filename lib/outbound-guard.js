// Outbound request guard (SSRF protection).
//
// Several features fetch URLs chosen by a user, a web page or an AI agent (Proxy Browser,
// NewsHunt feeds, Crawler, YT Downloader). None of them may reach this server itself or any
// other private address - that is how a hostile page would get at Jupyter, DietPlan or cloud
// metadata. Every outbound URL is checked here, and the HTTP agents re-check the resolved IP at
// connect time so a DNS answer that changes between the check and the request (DNS rebinding)
// is still refused.

const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');

// Kept as two separate lists: Node's BlockList lets IPv6 rules match IPv4 addresses, so mixing
// them (e.g. ::ffff:0:0/96) would block every IPv4 host. IPv4-mapped IPv6 is unwrapped manually.
const privateIPv4 = new net.BlockList();
[
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
    ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
    ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
].forEach(([address, prefix]) => privateIPv4.addSubnet(address, prefix, 'ipv4'));
const privateIPv6 = new net.BlockList();
[
    ['::', 96], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32],
    ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]
].forEach(([address, prefix]) => privateIPv6.addSubnet(address, prefix, 'ipv6'));

// Returns the IPv4 address hidden inside an IPv4-mapped IPv6 address (::ffff:a.b.c.d), if any.
function embeddedIPv4(ipv6) {
    let canonical;
    try {
        canonical = new URL(`http://[${ipv6}]/`).hostname.slice(1, -1).toLowerCase();
    } catch {
        return null;
    }
    const match = /^::ffff:(?:([0-9a-f]{1,4}):([0-9a-f]{1,4})|(\d+\.\d+\.\d+\.\d+))$/.exec(canonical);
    if (!match) return null;
    if (match[3]) return match[3];
    const high = parseInt(match[1], 16);
    const low = parseInt(match[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

const BLOCKED_HOSTNAMES = /^(localhost|localhost\.localdomain|.+\.localhost|.+\.local|.+\.internal|metadata|metadata\.google\.internal)\.?$/i;

class OutboundUrlError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OutboundUrlError';
        this.code = 'OUTBOUND_BLOCKED';
    }
}

function isPrivateAddress(address) {
    const ip = String(address || '').replace(/^\[|\]$/g, '').split('%')[0];
    const family = net.isIP(ip);
    if (family === 4) return privateIPv4.check(ip, 'ipv4');
    if (family === 6) {
        const mapped = embeddedIPv4(ip);
        if (mapped) return privateIPv4.check(mapped, 'ipv4');
        return privateIPv6.check(ip, 'ipv6');
    }
    return true; // Not an IP at all: never treat it as safe.
}

// Validates a user-supplied URL and resolves its host. Throws OutboundUrlError when the URL is not
// plain http(s) or when any address it resolves to is private/loopback/link-local.
async function assertPublicHttpUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(String(rawUrl || '').trim());
    } catch {
        throw new OutboundUrlError('Invalid URL.');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new OutboundUrlError('Only http:// and https:// URLs are allowed.');
    }

    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    if (!host || BLOCKED_HOSTNAMES.test(host)) {
        throw new OutboundUrlError('Requests to local or internal hosts are not allowed.');
    }

    if (net.isIP(host)) {
        if (isPrivateAddress(host)) throw new OutboundUrlError('Requests to private network addresses are not allowed.');
        return parsed;
    }

    let addresses;
    try {
        addresses = await dns.promises.lookup(host, { all: true, verbatim: true });
    } catch {
        throw new OutboundUrlError(`Could not resolve host "${host}".`);
    }
    if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) {
        throw new OutboundUrlError('Requests to private network addresses are not allowed.');
    }
    return parsed;
}

// Synchronous check for URLs that point at a private host by name or IP literal (no DNS lookup).
// Used where an async check is not possible, e.g. every sub-request of a headless browser page.
function isObviouslyPrivateUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(String(rawUrl || ''));
    } catch {
        return false;
    }
    if (parsed.protocol === 'file:') return true;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') return false;
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    if (!host || BLOCKED_HOSTNAMES.test(host)) return true;
    return Boolean(net.isIP(host)) && isPrivateAddress(host);
}

// dns.lookup replacement used by the guarded agents: refuses to hand a private address to the socket.
function guardedLookup(hostname, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    const lookupOptions = typeof options === 'number' ? { family: options } : { ...(options || {}) };
    const wantsAll = Boolean(lookupOptions.all);

    dns.lookup(hostname, { ...lookupOptions, all: true }, (error, addresses) => {
        if (error) return callback(error);
        const list = Array.isArray(addresses) ? addresses : [];
        if (!list.length || list.some(entry => isPrivateAddress(entry.address))) {
            const blocked = new OutboundUrlError(`Blocked connection to a private address for ${hostname}.`);
            return callback(blocked);
        }
        if (wantsAll) return callback(null, list);
        return callback(null, list[0].address, list[0].family);
    });
}

const guardedHttpAgent = new http.Agent({ lookup: guardedLookup });
const guardedHttpsAgent = new https.Agent({ lookup: guardedLookup });

// Options to spread into an axios request so it can only ever connect to public addresses.
const guardedAxiosOptions = Object.freeze({
    httpAgent: guardedHttpAgent,
    httpsAgent: guardedHttpsAgent,
    proxy: false
});

module.exports = {
    OutboundUrlError,
    assertPublicHttpUrl,
    isObviouslyPrivateUrl,
    isPrivateAddress,
    guardedLookup,
    guardedHttpAgent,
    guardedHttpsAgent,
    guardedAxiosOptions
};
