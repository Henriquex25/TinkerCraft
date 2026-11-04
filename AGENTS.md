# TinkerCraft — instruções do projeto

## Objetivo

Aplicativo desktop pessoal para Linux, inspirado nas funcionalidades públicas do Tinkerwell, com implementação independente. O fluxo principal é escrever PHP com autocomplete/IntelliSense, executar o trecho no contexto de um projeto PHP/Laravel e explorar o resultado visualmente.

Prioridades: editor responsivo; execução local, Docker, SSH e Docker por SSH; bootstrap Laravel/Composer; saída em árvore, JSON e tabela. O cache seletivo de fontes para autocomplete foi solicitado pelo usuário e faz parte do escopo. Não ampliar para um IDE completo, IA, debugger, sincronização completa de repositórios ou outros frameworks sem necessidade da tarefa solicitada. Não copiar código, marca ou assets proprietários do Tinkerwell; usar documentação pública e projetos abertos.

## Arquitetura e localização

- Desktop Wails 2, backend Go e WebKitGTK no Linux.
- React/TypeScript/Vite em `frontend/`; Monaco ESM oficial e ponte do editor em `frontend/src/editor.tsx`; contribuições em `frontend/src/monaco.ts`. DOMPurify corrigido é fixado no npm e substitui o módulo interno via Vite, com assertion de build.
- Phpactor local via LSP/stdio e fallback de indexação AST em `internal/language/`.
- Comandos, transportes, timeout, cancelamento e protocolo em `internal/execution/`.
- Compilador, runner, indexador e snapshot seletivo PHP em `runtime/`, embutidos no binário Go.
- Detecção do diretório do container e montagens em `internal/execution/container.go`; cache de fontes com expiração em `internal/language/cache.go`.
- Serviços em `internal/service/`; bindings Wails explícitos em `app.go`.
- Metadados de versão/ABI em `internal/buildinfo/`; consulta e download de atualizações em `internal/updates/`; interface em `frontend/src/updates.tsx`. Empacotamento Debian em `scripts/package-linux.*`; release em rascunho em `.github/workflows/release.yml`.
- Logo original em `build/appicon.png`, fornecida pelo usuário. `scripts/prepare-icons.py`, chamado pelo build, gera a derivada `build/appicon-small.png` (128 px), usada pela janela Wails e por `frontend/src/brand.tsx`; manter essa derivada no checkout para compilações Go diretas. O empacotador gera os tamanhos PNG do tema hicolor com GdkPixbuf. Preservar o original e a transparência; não depender do SVG provisório anterior. Ícones muito grandes podem ser omitidos silenciosamente pelo GTK/X11.
- Persistência atômica em `internal/storage/`; workspace em `~/.config/tinkercraft`, substituível por `TINKERCRAFT_DATA_DIR`.
- A renomeação de Lume para TinkerCraft preserva workspaces antigos em `~/.config/lume` e aliases `LUME_DATA_DIR`/`LUME_PHPACTOR`. As variáveis novas têm prioridade. O caminho anterior do repositório é um symlink para a pasta nova; preservar essa compatibilidade enquanto houver caminhos antigos salvos.
- `cmd/tinkercraft-devserver` é um harness HTTP autenticado restrito a loopback, não o backend de produção do desktop.

## Funcionamento

O compilador local usa `nikic/php-parser` para analisar o trecho, sem executá-lo. Insere `return` antes da última expressão por posição de AST, preservando as linhas originais. O Go envia JSON por stdin a um runner iniciado por `php -r` no ambiente escolhido.

| Modo | Transporte |
| --- | --- |
| Local | PHP CLI no diretório local do projeto |
| Docker | `docker exec -i --workdir` no container PHP selecionado |
| SSH | OpenSSH não interativo executando PHP remoto |
| SSH + Docker | OpenSSH executando `docker exec` no servidor |

O runner carrega o bootstrap, captura dumps/stdout/avisos/erros, inspeciona valores e retorna um envelope delimitado por marcador aleatório. Cada execução inicia um processo novo. Não há persistência de variáveis, sandbox de código ou rollback de efeitos.

Monaco é o componente de edição, com linguagem `tinkercraft-php` iniciada no estado PHP para não exigir tags. Tags de abertura são inseridas internamente para LSP, compilação e arquivos exportados; preservar o ajuste de linhas. A inferência PHP avançada depende do Phpactor local. O autocomplete automático usa a pasta local, uma montagem bind acessível ou um cache seletivo de fontes obtido pelo transporte de execução. A cópia permanece somente para leitura/análise: sem upload nem escrita no projeto de origem. Fontes em cache não devem executar o autoload, mapas PHP Composer ou a configuração remota do Phpactor no host. `autoload.go` gera mapas PSR-4/PSR-0 a partir de JSON para o Phpactor (`composer.class_maps_only=true`, caminho próprio em `analysis`). Preservar essa separação também para os processos de indexação. Preservar exclusões, limites de transferência, permissões privadas, substituição atômica e a cópia anterior em falhas. Expiração padrão: 7 dias sem uso, configurável; preservar sessões ativas. Pasta manual e modo desativado ficam nas configurações avançadas, com compatibilidade para perfis antigos.

Cache de fontes: priorizar a aplicação; limite de 256 MiB/80.000 arquivos/4 MiB por arquivo e três minutos. Excesso produz cache parcial com aviso; falha na transferência mantém autocomplete PHP sem fontes do projeto. Formato 2 exclui loaders PHP Composer; versões antigas devem ser recoletadas.

O fallback sugere funções, classes e membros públicos/herdados, mas não equivale à inferência de cadeias, generics e métodos mágicos. A interface deve distinguir Phpactor, fallback e erro. Arquivos IDE Helper fornecidos pelo usuário podem complementar os tipos Laravel. A interface prioriza editor e resultado, preto/cinza/laranja, fontes legíveis e detalhes técnicos em menus/tooltip/configurações avançadas.

## Teclado e persistência de edição

- Idioma inicial/padrão inglês (`en`), com português do Brasil (`pt-BR`) em Preferências. Persistir em Settings.Language. Mensagens próprias em `frontend/src/i18n.ts` e `locales/`; preservar código, nomes e saídas do usuário. A troca salva rascunhos e recarrega a interface para inicializar também o Monaco traduzido; manter o handshake de fechamento funcional após reload. Traduções Monaco fixadas à versão e fontes Microsoft, com licença MIT em `docs/licenses` e gerador em `scripts/update-monaco-locale.py`; consultar `docs/translations.md`.

- Catálogo e validação de atalhos em `frontend/src/shortcuts.ts`; despacho, contextos e paleta em `commands.tsx`; remapeamento em `keybindings.tsx`.
- Registrar ações no sistema central; não adicionar handlers fixos em paralelo no Monaco. Tooltips e indicadores usam os bindings configurados. Ações raras ficam acessíveis na paleta e controles aceitam navegação por teclado.
- Respeitar escopos editor/conexões/preferências; capturas de atalhos não devem executar comandos nem fechar o modal. Verificar conflitos e preservar teclas de edição.
- Ctrl+S salva abas no aplicativo; Ctrl+Shift+S exporta PHP. Abas guardam nome, código e vínculo de conexão.
- Preservar gravação atômica e a fila de autosave. O handshake `OnBeforeClose` → `app:before-close` → gravação → `ConfirmClose` aguarda a estabilização da entrada GTK/WebKit, lê os models Monaco e evita perder os últimos 350 ms no fechamento normal; falha deve manter a janela aberta.

## Regras de implementação

- Preservar a separação entre editor, linguagem e execução, com foco PHP/Laravel no Linux.
- Executar código somente por ação explícita, nunca automaticamente ao digitar.
- Comandos locais usam executável e argv separados. Escapar individualmente cada argumento do shell remoto POSIX; não interpolar entradas diretamente.
- Preservar validação dos perfis, `BatchMode=yes` e `StrictHostKeyChecking=yes`. Não salvar senhas nem ignorar a chave do host para resolver falhas.
- Inspeção Eloquent respeita `hidden`/`visible` e relações já carregadas. Não chamar accessors, `toArray()`, `jsonSerialize()` ou consultas apenas para exibir valores.
- Preservar limites de saída/inspeção, indicação de resultados parciais e precisão de inteiros grandes.
- Cancelamento encerra processo/transporte local; não prometer encerramento remoto garantido ou reversão de efeitos.
- Persistir estado atomicamente e preservar JSON corrompido para recuperação.
- Exibir valores e erros como dados, sem injetar HTML; manter Markdown de hover não confiável e HTML desativado.
- Preservar licenças e origem das dependências em `THIRD_PARTY_NOTICES.md`. Não reformatar casualmente código vendorizado.
- Não modificar projetos do usuário ou executar seu código de negócio como fixture sem autorização para esse uso. Preferir aplicações, containers e chaves de teste isolados.
- Em automação gráfica, usar workspace isolado e confirmar `_NET_WM_PID` antes de cada interação. Combinar filtros do `xdotool search` com `--all`: o padrão pode aceitar qualquer filtro e selecionar uma janela antiga do usuário.
- Diferenciar implementação, transporte simulado e integração real. Não afirmar que Docker, SSH, Phpactor ou desktop foram validados apenas porque testes simulados/build passaram.
- Registrar evidência e pendências em `docs/validation.md`. As limitações de uma sessão anterior podem deixar de existir; verificar o ambiente atual.
- Atualizações: preservar HTTPS, limites, seleção por versão/arquitetura/ABI, SHA-256 e arquivo temporário privado. Download e abertura do instalador exigem ação do usuário. O app delega instalação/elevação ao sistema por `xdg-open`; não executa sudo, não substitui o próprio binário e não instala ao iniciar. Não inventar repositório nem publicar release sem autorização. `.env` é privado e lido como dados, apenas na raiz deste checkout; preferências permitem configurar o app instalado.

## Desenvolvimento e verificação

```bash
npm --prefix frontend ci
./scripts/install-phpactor.sh

# Go tests, vet, TypeScript/Vite e renderização React sem navegador
./scripts/check.sh
go test -race ./internal/...
TINKERCRAFT_PHPACTOR_REAL="$PWD/.tools/phpactor.phar" go test ./internal/language -run RealPhpactor -v

# Laravel real em aplicação temporária, usando apenas dependências abertas
TINKERCRAFT_LARAVEL_VENDOR=/caminho/projeto/vendor go test ./internal/execution -run RealLaravel -v

# Build e execução desktop
./scripts/build.sh
./scripts/start.sh
TINKERCRAFT_DATA_DIR="$PWD/.data/manual" ./scripts/start.sh

# Desenvolvimento com recarga
wails dev

# Interface por WebKit Playwright e backend Go real em loopback
npm ci
npx playwright-core install webkit
npm run test:ui

# Teste nativo em outro display, sem interagir com janelas do usuário
TINKERCRAFT_NATIVE_TEST=1 xvfb-run -a -s '-screen 0 1440x1000x24' /usr/bin/python3 tests/native.test.py
```

Aplicar `gofmt` em Go alterado e manter TypeScript compilando. Executar verificações proporcionais à mudança. Recompilar o executável após alterar backend ou assets embutidos: `start.sh` não recompila se o binário já existir. O build detecta WebKit2GTK 4.0/4.1. O Monaco usa imports ESM estáticos; seu worker é embutido com `?worker&inline` e Blob para `wails://`. Não reintroduzir o bundle AMD antigo nem o sanitizador inline vulnerável. Testes HTTP não substituem verificação dos bindings e diálogos Wails.

## Documentação de referência

- `README.md`: instalação, configuração, uso e limites.
- `docs/architecture.md`: decisão da stack e fronteiras dos componentes.
- `docs/research.md`: funcionalidades públicas de referência e fontes.
- `docs/validation.md`: testes efetivamente executados e pendências.
- `docs/releases.md`: `.env`, pacotes, integração Linux, variantes WebKit e fluxo GitHub Releases.
- `THIRD_PARTY_NOTICES.md` e `docs/vendor-sha256.txt`: origem, licenças e identidade dos arquivos vendorizados.

## Comunidade e revisão

Configuração inicial e releases em `docs/github-maintainer.md`. Formulários em `.github/ISSUE_TEMPLATE` e `DISCUSSION_TEMPLATE`, labels em `.github/labels.json`, regras propostas em `.github/main-ruleset.json`; `scripts/configure-github.py` apenas simula sem `--apply`, exige autenticação própria via gh para alterações e valida origin/permissões. Não exigir aprovação independente enquanto houver só um mantenedor. Proteção deve esperar CI verde no main atual. Release deve verificar versão consistente e CI aprovado no mesmo SHA, gerar rascunho e deixar a publicação explícita ao mantenedor. Binaries gerados ficam ignorados no Git e são assets de Releases, não arquivos fonte.

README, CONTRIBUTING e SECURITY em inglês. Documentação de uso detalhada em `docs/usage.pt-BR.md`; revisão em `docs/review-2026-11-04.md`. CI em `.github/workflows/ci.yml` deve testar PRs sem secrets ou permissões de escrita; não usar `pull_request_target` para executar código contribuído. Scripts executam dados baixados somente após conferir o pin (`scripts/phpactor.sha256`). Comentários comuns foram removidos a pedido do usuário; preservar diretivas de build, shebangs e avisos de terceiros. Regressões de limites, CSV, transporte, persistência e segurança exigem testes. Não afirmar ausência de vulnerabilidades ou liberação jurídica da marca.
