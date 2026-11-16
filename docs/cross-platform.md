# Windows e macOS — builds experimentais

O caminho adotado é manter Wails 2, Go, React e Monaco e compilar nativamente em cada sistema. Migrar o framework junto com a portabilidade ampliaria a mudança sem eliminar as diferenças de processos, PHP, caminhos, assinatura e testes. O desktop Linux continua no fluxo Debian existente; a primeira entrega Windows/Mac usa pacotes de teste, sem publicação automática.

> **Estado experimental:** Windows e macOS ainda não são versões estáveis nem têm suporte nativo validado. O ZIP Windows foi gerado por compilação cruzada no Linux e aguarda teste no Windows. No Mac, os scripts/jobs estão preparados, mas a compilação nativa e a validação desktop ainda estão pendentes.

## Alvos e limites

| Alvo | Empacotamento inicial | WebView | Linguagem | Estado |
| --- | --- | --- | --- | --- |
| Windows x64 | ZIP portátil | WebView2 externo | AST, sem Phpactor | Build experimental; validação nativa pendente |
| macOS Intel | `.app` em ZIP | WKWebView do sistema | Phpactor nos recursos do bundle | Build experimental; validação nativa pendente |
| macOS Apple Silicon | `.app` em ZIP | WKWebView do sistema | Mesmo PHAR fixado | Build experimental; validação nativa pendente |

Windows ARM64 e bundle Mac universal ficam para uma etapa posterior. O mínimo Mac destes builds é macOS 13, devido ao Go 1.27.4 usado na CI. Não confundir o mínimo genérico do Wails com o mínimo do toolchain do aplicativo. O Windows requer PHP CLI local de 64 bits. Os transportes SSH pressupõem shell POSIX no servidor; Docker usa containers Linux.

A restrição principal no Windows é o Phpactor: o projeto documenta Linux/macOS e indica WSL para Windows. O preview mantém o fallback AST explícito, sem tentar iniciar o PHAR nativamente. Uma ponte WSL exigirá tradução de caminhos, URIs, configuração privada de análise e isolamento dos autoloaders/configurações do projeto, além de testes próprios. Não basta trocar `php` por `wsl.exe php`, pois os campos atuais recebem executável e argv separados. Não distribuir outro LSP com licença ou comportamento diferente sem uma decisão específica.

## Build nativo

Pré-requisitos comuns: Git, Go compatível com `go.mod` (CI: 1.27.4), Node.js 22.12+, npm, Python 3 e PHP CLI 8.2+. Use o Wails CLI da mesma versão declarada no módulo (atualmente 2.17.1). Os comandos de build precisam baixar dependências quando não estão em cache.

### Windows x64

No Windows nativo, instale as ferramentas e o WebView2. No PowerShell, na raiz do checkout:

```powershell
$wailsVersion = go list -m -f '{{.Version}}' github.com/wailsapp/wails/v2
go install "github.com/wailsapp/wails/v2/cmd/wails@$wailsVersion"
python scripts/build-desktop.py --arch amd64
```

Garanta que os diretórios de Go/bin, npm e PHP estão no PATH da sessão. O script aceita apenas Windows amd64 nesta etapa. Não gera NSIS/MSI, não registra o programa no sistema e não inclui PHP ou Phpactor.

No Linux/macOS também é possível gerar o ZIP Windows por compilação cruzada, com `python3 scripts/build-desktop.py --target windows --arch amd64`. Isso não executa o aplicativo nem os testes Windows: a validação continua dependendo do job Windows e da interface real. O build Mac exige um Mac com Xcode.

Resultado: `build/dist/windows-amd64/tinkercraft_<VERSION>_windows_amd64_preview.zip` e `checksums.txt`. O ZIP inclui apenas o executável, orientações de teste, LICENSE, THIRD_PARTY_NOTICES e as licenças originais das dependências; não copia o checkout nem `.env`.

### macOS

No Mac, instale as ferramentas comuns, as Xcode Command Line Tools (`xcode-select --install`) e o PHP CLI com mbstring e demais extensões exigidas pelo Phpactor/projeto. Na raiz do checkout:

```bash
wails_version="$(go list -m -f '{{.Version}}' github.com/wailsapp/wails/v2)"
go install "github.com/wailsapp/wails/v2/cmd/wails@$wails_version"
python3 scripts/build-desktop.py --arch arm64
```

Use `--arch amd64` em um Mac Intel. Os jobs de CI compilam e executam os testes no processador correspondente, sem depender de Rosetta para validar o alvo.

O script confere o PHAR em `.tools/phpactor.phar` contra `scripts/phpactor.sha256`; se necessário, baixa a versão de `scripts/phpactor.version` por HTTPS para um temporário e confere o hash antes de substituir a cópia anterior. Não executa um download não verificado. Copia o PHAR para `TinkerCraft.app/Contents/Resources/phpactor.phar`, onde o macOS sela-o como recurso do bundle; o aplicativo resolve esse caminho no bundle. Inclui as licenças Go/npm/PHP-Parser/Monaco/DOMPurify/tradução e a licença/digest do Phpactor, refaz a assinatura ad hoc após a composição do bundle e verifica-a com `codesign`.

Resultado: `build/dist/darwin-<arch>/tinkercraft_<VERSION>_darwin_<arch>_preview.zip` e `checksums.txt`. `ditto` preserva atributos e permissões do bundle. Developer ID, hardened runtime, notarização e stapling ainda não estão configurados.

### Versão, ícones e configurações

`VERSION` permanece a única fonte da versão do aplicativo. O Go continua usando embed. O script gera temporariamente os recursos de versão Windows e o Info.plist Mac a partir do mesmo arquivo, sem editar `wails.json`; remove esses metadados ao sair, inclusive em falha normal. Se encontrar metadados personalizados nos caminhos de geração, recusa sobrescrevê-los. Artefatos ficam ignorados pelo Git.

O Wails gera ICO/ICNS da logo original `build/appicon.png`. A imagem derivada `build/appicon-small.png` continua no checkout, portanto esses builds não exigem GdkPixbuf/Python GI. Nenhuma logo original é editada.

Builds têm `Distribution=preview`, variante `windows-amd64`/`darwin-amd64`/`darwin-arm64` e campo WebKit vazio fora do Linux. O canal oficial de consulta permanece embutido; o script não lê `.env` nem aplica override de runtime. Pacotes Windows/Mac não são oferecidos como `.deb` e não habilitam instalação ou reinício por APT. Atualizações são manuais, documentadas no guia público.

## CI e distribuição

`.github/workflows/ci.yml` mantém o job Linux completo e acrescenta `desktop-preview` em `windows-2025`, `macos-15-intel` e `macos-15` (arm64). Os jobs têm somente leitura, rodam também em PRs e não usam secrets, publicação ou `pull_request_target`. Cada job instala ambos os lockfiles npm antes dos testes Node, compila o pacote nativo e executa:

- Testes de argv, cancelamento com descendentes, persistência/substituição do workspace, diretórios de configuração e validação de perfis.
- Execução PHP real, dumps/erros, limites, bootstrap Composer e timeout/cancelamento em projetos temporários.
- Indexador AST real, caminhos Unicode e URIs; no Mac, teste do Phpactor real incluído no bundle.
- Renderização React, formatação e testes das fronteiras de empacotamento, hash e versão.

Essa seleção portátil não substitui os testes Linux completos nem simula integração real Docker/SSH ou automação gráfica nativa. Os artefatos só são enviados se o job passar, duram 14 dias e não criam release. O fluxo de release Debian e seu preflight de CI no SHA exato continuam preservados. O mantenedor faz commit/push e executa/revisa os resultados; não foi autorizado publicar versões automaticamente.

## Adaptações de runtime

`internal/process` é compartilhado pela execução e pelo LSP. Linux/macOS preservam grupos de processos POSIX. No Windows, um Job Object privado usa `KILL_ON_JOB_CLOSE`; o processo nasce suspenso, é associado ao job e só então é retomado, evitando que crie descendentes antes da associação. Falhas nessa preparação encerram o filho e retornam erro, sem executar uma alternativa sem controle. Cancelamento termina o job; fechar o handle após Wait também recolhe descendentes Windows restantes. Janelas de console dos subprocessos são ocultadas.

Caminhos locais seguem o sistema do desktop; caminhos Docker/SSH são POSIX independentemente do host. A resolução de bind mounts compara destinos POSIX antes de convertê-los para o caminho local, preservando limites de diretório e maiúsculas/minúsculas. URIs LSP usam barras, prefixo de unidade e autoridade UNC apropriados. `os.UserConfigDir` já fornece AppData no Windows e Application Support no Mac; os testes agora isolam essas variáveis por sistema. A compatibilidade com Lume e os overrides de dados continuam preservados.

A interface explica que atualizações Windows/Mac são manuais. Os atalhos já aceitam Meta/Command como Ctrl; as legendas ainda mostram Ctrl. Uma revisão de ergonomia Mac deve validar atalhos do sistema e menus nativos sem introduzir handlers paralelos ao catálogo central.

## Antes de promover a suporte público

1. Rodar os três jobs nativos no commit definitivo e inspecionar os artefatos/checksums/versões. Confirmar o `.app` e o executável fora do checkout, em diretório com espaços e Unicode.
2. Em usuários/workspaces de teste isolados, validar inicialização, Monaco/worker, editar e executar, formatar, autocomplete/diagnósticos, copiar/colar, idioma/reload, foco, paleta, atalhos, exportar CSV/PHP e diálogos nativos. Confirmar a preservação dos últimos caracteres no fechamento normal e nos pedidos de saída do sistema.
3. Validar Docker Desktop local e OpenSSH reais (incluindo Docker por SSH), bootstrap Laravel temporário e cache seletivo sem execução de autoload remoto/configuração do projeto.
4. Conferir instalação manual, remoção, troca de versão e preservação dos dados. Testar falhas e avisos de WebView2, PATH, permissões e arquitetura, sem instalar/elevar no host pessoal Linux.
5. Definir assinatura Windows e Apple Developer ID/notarização; avaliar NSIS e DMG após a primeira validação. Integração de atualização por plataforma é outra etapa, sem reaproveitar APT nesses sistemas.
6. Atualizar o status no README/guias com a evidência efetiva, preparar release em rascunho e deixar publicação ao mantenedor.

## Referências

- [Wails 2: builds em GitHub Actions](https://v2.wails.io/docs/guides/crossplatform-build/).
- [Wails 2: WebView2 no Windows](https://v2.wails.io/docs/guides/windows/).
- [Wails 2: assinatura](https://v2.wails.io/docs/guides/signing/).
- [Phpactor: requisitos e WSL](https://github.com/phpactor/phpactor#requirements).
- [Go 1.27: mínimo macOS 13](https://go.dev/doc/go1.27#darwin).
- [Microsoft: Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).
- [GitHub: runners e arquiteturas](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
