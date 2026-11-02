# Security Policy

## Reporting a Vulnerability

If you find a security issue in Roundtable, please report it privately instead of opening a public issue.

Use GitHub's private vulnerability reporting:
https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/security/advisories/new

Please include what you found, steps to reproduce it, and the version or commit you tested. I'll acknowledge reports as soon as I can and credit you in the fix if you'd like.

## Scope

Roundtable runs a local proxy bound to 127.0.0.1 and handles API keys on the client side. Issues involving key exposure, the local proxy, or cross-site requests to it are especially welcome.

## Supported Versions

Only the latest release on the `main` branch is supported with security fixes.
