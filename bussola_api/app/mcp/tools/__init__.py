"""Tools MCP por módulo. Cada módulo expõe `register(mcp)`."""

from mcp_types import ToolAnnotations

LEITURA = ToolAnnotations(read_only_hint=True)
ESCRITA = ToolAnnotations(read_only_hint=False, destructive_hint=False)
DESTRUTIVA = ToolAnnotations(read_only_hint=False, destructive_hint=True)


def registrar(mcp, leitura=(), escrita=(), destrutivas=()):
    for fn in leitura:
        mcp.tool(annotations=LEITURA)(fn)
    for fn in escrita:
        mcp.tool(annotations=ESCRITA)(fn)
    for fn in destrutivas:
        mcp.tool(annotations=DESTRUTIVA)(fn)
