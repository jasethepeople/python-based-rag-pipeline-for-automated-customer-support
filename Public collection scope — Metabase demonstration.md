# Public collection scope — Metabase demonstration

Checked: 2026-08-20

| Source | Public endpoint | Permitted collection scope used by this project | Exclusions |
| --- | --- | --- | --- |
| Official documentation | https://www.metabase.com/docs/latest/ | Canonical public `docs/latest` pages discovered through the published sitemap, subject to the site robots policy. | Versioned documentation paths matching `/docs/v*`, premium help, `.html` paths, and any non-public page. |
| Community forum | https://discourse.metabase.com/ | Public topic pages and the public FAQ category discovered through the forum sitemap, subject to robots policy. | Administrative, authentication, email, user/session/key pages; badge/profile/private content; search endpoints; RSS endpoints listed as disallowed. |

The included collector rechecks `robots.txt`, honors a configured per-request delay, uses a clear user-agent, avoids authentication, and limits requests by an explicit page cap. It does not bypass access controls or collect private data.

The target corpus is illustrative, not an assertion of partnership with Metabase. Community content is marked separately from official documentation and is ranked lower at answer time.
