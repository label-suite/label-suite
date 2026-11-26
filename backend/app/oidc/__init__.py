"""Google OIDC entry package (backend-agent-rules B12; login-auth-guard design D5).

The only place under ``app`` allowed to import ``authlib``. It reaches ``httpx`` only
through ``authlib.integrations.httpx_client`` and never imports it directly.
"""
