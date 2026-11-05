# Validação desta entrega

Estado atualizado em 4 de novembro de 2026. Este documento distingue testes executados de integrações implementadas que ainda precisam de validação no desktop/infraestrutura do usuário.

Após a renomeação para TinkerCraft, passaram novamente os testes Go (incluindo Laravel e Phpactor reais), vet, TypeScript/Vite, renderização React, testes de interface WebKit e build Wails. O teste de interface verifica explicitamente o título TinkerCraft e sua identificação visual; o título da janela Wails nativa também foi conferido. Os testes de localização do workspace verificam a precedência das variáveis novas, a reutilização dos dados antigos e sua preservação. O diretório e o executável antigos são aliases para os novos caminhos. Essas verificações não alteram as pendências de Docker/SSH reais descritas abaixo.

Na revisão de interface e autocomplete, o WebKit validou o editor sem tags PHP, as fontes maiores e o select Bootstrap com fundo escuro e aparência nativa desativada. O fluxo completo criou uma conexão Docker de teste, detectou uma aplicação abaixo da montagem, preparou o cache pelo Go/PHP e exibiu uma sugestão de método de uma classe desse cache com Phpactor real. O executável Docker era uma simulação isolada: isso valida a integração da interface com a coleta/indexação, sem comprovar uso de um daemon Docker real.

A janela Wails da revisão foi aberta com `TINKERCRAFT_DATA_DIR` apontando para um playground isolado. O botão de execução e Ctrl+Enter retornaram o array de demonstração sem tags PHP e registraram sucesso no histórico. Foram conferidos visualmente o editor, a saída, as fontes maiores e o formulário com Bootstrap escuro e seta visível. Para automação de janelas, confirmar o PID e usar correspondência conjunta dos filtros; o título sozinho não distingue instâncias antigas.

## Revisão de autocomplete remoto e produtividade

O perfil SSH + Docker já cadastrado foi utilizado apenas para leitura de fontes, sem bootstrap ou execução de código de negócio. A falha foi reproduzida: o projeto ultrapassava o limite anterior de 100 MiB/40.000 arquivos e a preparação abortava antes de iniciar a linguagem. Após a correção, a coleta real produziu cerca de 187 MiB/54 mil arquivos dentro do novo orçamento, sem cache parcial. O Phpactor real forneceu tanto métodos de `DateTimeImmutable` quanto um método herdado do Eloquent para um model da aplicação em cache. A primeira localização do model dependia de indexar todo o projeto; os mapas PSR gerados a partir de JSON resolveram essa espera sem executar os loaders remotos.

Também passaram testes de cache parcial com prioridade da aplicação, exclusão dos loaders remotos, mapas JSON limitados ao cache e fallback de sugestões PHP quando a coleta SSH falha. O teste de persistência reabre o serviço e verifica nome/código de uma aba não executada e bindings personalizados. A suíte de bindings verifica conflitos por contexto, atalhos alternativos, teclas reservadas e a manutenção do acesso à paleta.

O fluxo completo WebKit também passou com renomeação por F2, cancelamento de renomeação, rascunho nunca executado restaurado após recarga, exportação PHP, navegação de abas, conflitos e remapeamento persistente, tooltips atualizados, execução por atalho personalizado, CSV por teclado, cópia JSON e sugestões automáticas ao digitar. O clipboard usa um adaptador isolado que consome os ClipboardItems diferidos do WebKit, sem tocar no clipboard do usuário. O teste ignora exclusivamente rejeições `Canceled: Canceled` com origem no bundle Monaco ao cancelar tarefas de modelos; outros erros JavaScript continuam reprovando a suíte.

A versão desktop final passou também em Xvfb, num display separado das janelas do usuário. O teste percorreu execução explícita, paleta, preferências e F2, digitou um rascunho e enviou imediatamente o protocolo normal de fechamento da janela. O processo saiu após a gravação; ao abrir novamente, o nome, o código completo e a conexão foram restaurados, sem executar esse rascunho. O teste detectou e motivou a troca do import dinâmico do worker por import estático, o carregamento inicial do CSS Monaco e a estabilização da fila de entrada antes da gravação final. Screenshots: `tinkercraft-native-commands.png`, `tinkercraft-native-shortcuts.png` e `tinkercraft-native-restored.png` em `test-results/`.

## Pacote e atualização — versão 0.2.0

Foi gerado `build/dist/tinkercraft_0.2.0_linux_amd64_webkit40.deb`, com aproximadamente 10,22 MiB, em Pop!_OS 22.04 x86-64. O pacote contém o Phpactor adjacente ao binário, launcher, entrada desktop, ícones e licenças. Foram conferidos SHA-256 e tamanho contra os metadados, propriedade root, permissões sem escrita de grupo/outros, dependências nativas e ausência de caminhos de instalação em pastas pessoais. `desktop-file-validate` passou. O `.env` tem permissão `0600` e é ignorado pelo Git.

O pacote foi **extraído, sem instalação no sistema**, e seu executável abriu a partir de `/tmp`, usando um workspace temporário e o Phpactor incluído. `--version-json` informou `0.2.0`, distribuição `deb` e variante `linux-amd64-webkit40`. A suíte Wails nativa passou com execução PHP, paleta, preferências, tela de atualização sem fonte configurada, salvamento da última edição no fechamento normal e restauração do rascunho nunca executado. A tela de atualização nativa foi conferida em `test-results/tinkercraft-native-updates.png`.

Também passaram:

- `go test ./...` e `go vet ./...`.
- `go test -race ./internal/updates ./internal/service`: versões, fontes HTTPS, servidor TLS local com manifesto/download, verificação de SHA-256, rejeição de arquivo alterado/truncado, limpeza de temporários, vínculo com a fonte, fallback do checksum GitHub, ausência de downgrade e rejeição de redirecionamento para HTTP.
- Testes reais do Phpactor em fontes locais e em cache, sem bootstrap remoto.
- TypeScript/Vite, renderização React e suíte completa WebKit. A extensão da suíte validou preferências de atualização persistidas, opção de consulta ao iniciar, indicador sem modal automático, notas, download explícito e abertura explícita do instalador. Nesse trecho, API de releases e instalador foram fixtures isoladas; nenhum instalador real foi aberto. O transporte HTTPS e os hashes foram testados no backend com TLS real de teste.
- `python3 tests/distribution.test.py`: parser de `.env` sem execução de comandos, rejeição de chaves duplicadas, agregação de duas variantes de release e rejeição de artefato corrompido.
- Sintaxe Bash, compilação dos scripts Python e formatação/sintaxe do YAML de workflow.

Reproduzir o teste nativo do payload extraído:

```bash
dpkg-deb -x build/dist/tinkercraft_0.2.0_linux_amd64_webkit40.deb .data/package-validation
TINKERCRAFT_NATIVE_BINARY="$PWD/.data/package-validation/usr/lib/tinkercraft/tinkercraft" \
TINKERCRAFT_NATIVE_CWD=/tmp TINKERCRAFT_NATIVE_TEST=1 \
  xvfb-run -a -s '-screen 0 1440x1000x24' /usr/bin/python3 tests/native.test.py
```

Na entrega inicial, o repositório remoto ainda não existia. Na revisão atual, `https://github.com/Henriquex25/TinkerCraft` foi confirmado como público e incorporado à configuração de build. Não há releases publicados e os workflows desta revisão não foram executados no GitHub. A variante WebKit 4.1 em Ubuntu 24.04 está prevista na matriz, mas não foi gerada/executada aqui. A instalação/atualização pelo gerenciador de pacotes, a associação gráfica de `.deb` via `xdg-open` e o fluxo completo contra um release público ficam pendentes. O teste por extração não comprova esses passos do sistema operacional.

## Logo PNG — 4 de novembro de 2026

A imagem fornecida em `build/appicon.png` tem 1254 × 1254 pixels e canal alpha. O original foi preservado. O build gera uma cópia de 128 × 128 para a interface e a janela Wails; o `.deb` contém dez tamanhos PNG, de 16 a 1024 pixels, no tema hicolor. Não inclui o SVG provisório anterior. O bundle da interface usa a cópia de aproximadamente 12 KiB.

Passaram TypeScript/Vite, renderização React e a suíte WebKit completa com a logo no menu lateral e na janela de atualização. O pacote reconstruído foi extraído para uma pasta temporária: cada tamanho foi conferido pixel a pixel contra o redimensionamento da fonte com GdkPixbuf, incluindo transparência, além da validação desktop e SHA-256.

O binário extraído abriu em Xvfb com workspace isolado e diretório de trabalho `/tmp`. A propriedade X11 `_NET_WM_ICON` foi comparada pixel a pixel com a derivada de 128 pixels e o fechamento normal terminou com sucesso. O teste inicial com o original de 1254 pixels revelou que GTK/X11 omitia esse ícone; a derivada corrigiu o problema. Screenshot conferido em `test-results/tinkercraft-native-logo.png`. Não houve instalação no sistema nem alteração de janelas do usuário.

## Revisão comunitária, segurança e idiomas — 4 de novembro de 2026

O README de apresentação está em inglês, com guias de contribuição, segurança e atribuição de dependências. A revisão detalhada e as pendências estão em [review-2026-11-04.md](review-2026-11-04.md). Foram removidos comentários comuns do código próprio, preservando diretivas, shebangs e licenças.

Passaram `./scripts/check.sh` com `TINKERCRAFT_PHPACTOR_REAL` apontando para o PHAR fixado e `TINKERCRAFT_LARAVEL_VENDOR` para a fixture Composer Laravel 12.71.0. Isso inclui formatação, sintaxe, TypeScript/Vite, Go com race detector/cobertura, vet, renderização/CSV e distribuição. A cobertura Go total foi **61,9%**, com pacotes de backend entre **48,5% e 78,2%**; GUI/main e contratos sem testes diretos reduzem o total. Essa medida não é garantia de ausência de regressões.

As auditorias npm da raiz e frontend, Composer da fixture e `govulncheck` não reportaram vulnerabilidades conhecidas nas dependências analisadas. `actionlint`, `git diff --check` e o ledger SHA-256 do parser passaram. O instalador real do Phpactor verificou o hash antes de executar a versão 2026.10.07.0. A migração Monaco ESM inclui assertion de build para usar o DOMPurify corrigido.

Inglês é o idioma inicial, inclusive para workspaces antigos sem preferência. Português do Brasil pode ser selecionado em Preferências. Os testes verificam persistência e rejeição de idiomas desconhecidos, preservação de parâmetros e texto do usuário, além da tradução dos controles internos do Monaco. A geração reproduzível de **2.146 mensagens** a partir das fontes oficiais Microsoft passou; sete posições sem mensagens no índice do upstream são preservadas. Fontes, commits e licença estão em [translations.md](translations.md).

O teste nativo Wails em Xvfb passou com inglês → português → inglês, preferências persistidas, execução explícita, renomeação, fechamento logo após editar e reabertura de rascunho sem executá-lo. Os testes usam display e workspace isolados e verificam o PID antes de interagir. Diálogos nativos têm títulos traduzidos; os botões seguem o idioma do sistema operacional.

A suíte WebKit completa passou novamente com idioma inicial inglês, execução e screenshot em inglês, troca para português, controle de busca Monaco traduzido, todos os fluxos existentes e retorno ao inglês preservando nome/código da aba e atalhos remapeados. A captura em `docs/images/workspace.png` usa somente dados da demonstração isolada.

O `.deb` WebKit 4.0 atualizado foi extraído em uma pasta temporária nova. Foram verificados metadados, URL do repositório embutida, dez ícones PNG, desktop entry, licença das traduções e ausência de `.env`, CSVs e SVG antigo. O binário desse payload passou a suíte nativa com diretório de trabalho `/tmp`, usando o Phpactor incluído. O fluxo terminou em português, fechou logo após a última edição e reabriu com o idioma e o rascunho preservados, sem execução automática. Não houve instalação no sistema, publicação de release ou interação com janelas do usuário.

## Preparação do GitHub para a comunidade — 4 de novembro de 2026

Consulta pública confirmou Issues habilitadas, Discussions desabilitadas, nenhum ruleset e nenhum release publicado. O workflow de release anterior está no remoto; CI e a revisão local ainda precisam ser enviados. A máquina não tem `gh` instalado, sessão `gh` ou token GitHub no ambiente. Nenhuma configuração remota foi aplicada, nenhum post criado e nenhum commit/push/release realizado nesta preparação.

Foram preparados formulários de issues e discussões, labels, CODEOWNERS, política de conduta/suporte, categorias de notas de release, ruleset para `main`, guia do mantenedor e helper de configuração. `python3 tests/community.test.py` passou os testes de preview sem rede/autenticação, rejeição de outro origin e impedimento de ativar proteção sem CI aprovado. `actionlint` passou nos workflows; Prettier verificou YAML/JSON. O preflight de release foi executado localmente com versão consistente e rejeitou branch incorreta, versão divergente e entrada malformada. As APIs de escrita permanecem sem teste integrado por falta de autenticação; categorias e notificações precisam ser verificadas após setup.

`git check-ignore` confirmou executável, `.deb` e assets frontend gerados fora do Git, sem arquivos rastreados nesses diretórios. O pacote foi reempacotado com os novos guias de comunidade sem alterar o executável já validado.

## Convite para estrela no GitHub — 4 de novembro de 2026

O cartão não modal aparece ao abrir um workspace que ainda não respondeu ao convite. As duas respostas salvam permanentemente `starPromptDismissed`; a positiva abre o repositório oficial no navegador, sem autenticar ou adicionar estrelas pelo aplicativo. A preferência permanece após reiniciar e não pode ser desfeita por um formulário de configurações antigo. A interface está traduzida para inglês/português e as ações estão disponíveis na paleta e no remapeamento de atalhos.

Passaram `./scripts/check.sh` com Phpactor e Laravel reais, a suíte WebKit existente e os novos testes `tests/invitation.test.mjs`. Eles verificam os dois caminhos em workspaces separados, ausência do convite em nova sessão, preservação do foco e do histórico, tradução, erro de persistência com nova tentativa e abertura somente da URL oficial. A abertura do navegador é simulada: não foi visitado GitHub nem alterada qualquer conta.

O `.deb` foi reconstruído, extraído em diretório temporário e seu binário passou a suíte nativa Xvfb. O convite foi dispensado pela paleta, a escolha sobreviveu às trocas de idioma e à reabertura e o último rascunho continuou preservado. A aparência foi conferida em `test-results/tinkercraft-native-star-invitation.png`. O pacote usa o executável testado e inclui a documentação atualizada; não houve instalação no sistema, commit, push ou publicação de release.

## Visibilidade da saída e apoio voluntário — 4 de novembro de 2026

O X da saída agora oculta o painel inteiro, mesmo vazio. Ctrl+J e o botão na barra de abas alternam a visibilidade; o atalho é remapeável. A saída permanece montada e preserva resultado, modo e filtros, enquanto o editor ocupa toda a largura. A largura anterior é restaurada ao mostrar o painel. Executar código e Alt+2 também mostram a saída. Limpar continua disponível por Ctrl+Shift+Delete e paleta. Ações internas de saída/tabela ficam indisponíveis enquanto o painel está oculto.

O link fixo de Buy Me a Coffee informado pelo mantenedor foi incluído em Sobre, paleta, README e `.github/FUNDING.yml`. O convite é elegível apenas na inicialização do serviço, a partir da quinta abertura, com histórico existente e convite de estrela respondido antes da sessão. Consultas Bootstrap e reloads de idioma não contam como aberturas; o contador local para em cinco. As duas respostas e a abertura manual do link dispensam o convite permanentemente, inclusive contra salvamento de um formulário antigo. Não foram feitas consultas à conta ou pagamentos. A ferramenta web não conseguiu carregar a página externa; os testes verificam a URL configurada e simulam a abertura do navegador.

Passaram `./scripts/check.sh` com Laravel/Phpactor reais e a suíte WebKit completa. Foram testados X com saída vazia, editor em largura total, restauração do tamanho, preservação do filtro/tabela, abertura ao executar e remapeamento para Ctrl+Shift+J. Testes de serviço cobriram limiar de abertura, ausência de histórico, não mostrar dois convites na mesma sessão, configurações antigas e reabertura. Os fluxos WebKit de apoio cobriram aceitar, recusar, tradução, erro ao salvar, nova sessão e abertura manual em Sobre antes do limiar.

O pacote WebKit 4.0 foi reconstruído e seu payload extraído passou a suíte nativa em Xvfb com diretório de trabalho `/tmp`: Ctrl+J, execução, reloads de idioma, persistência do rascunho, convite de apoio na quinta abertura, dispensa pelo teclado e nova reabertura. As imagens `test-results/tinkercraft-native-editor-only.png` e `tinkercraft-native-support-invitation.png` foram conferidas visualmente. O teste usa só fixtures e simula condições de uso no workspace temporário; não altera perfis ou janelas do usuário. Não houve instalação no sistema, commit, push ou publicação.

## Cancelamento durante análise PHP — 4 de novembro de 2026

O CI expôs um erro de classificação: cancelar enquanto `compile.php` ainda estava rodando retornava `CompilerError` com `context canceled`, sem marcar a execução como cancelada. O teste WebKit aguardava corretamente a mensagem de cancelamento. A correção verifica o contexto após a análise local, antes de classificar falhas do compilador, e retorna `ExecutionError`, `cancelled=true`, duração e a mensagem própria de cancelamento.

O novo teste reproduziu a falha antes da correção tanto com contexto previamente cancelado quanto durante análise em um processo PHP real. A sincronização usa um arquivo de prontidão em fixture temporária, sem depender de uma espera arbitrária; um arquivo sentinela verifica que o trecho não executou. Após a correção, os testes de cancelamento/timeout passaram cinco vezes com race detector. Passaram também `./scripts/check.sh` com Phpactor/Laravel reais e `npm run test:ui` completo, mantendo a asserção original de cancelamento e seu timeout.

Não houve commit, push, mudança de versão ou disparo de workflow remoto durante esta correção; essas etapas permanecem sob execução do mantenedor no aprendizado da publicação.

## Foco e seleção no teste desktop nativo — 4 de novembro de 2026

Foram inspecionadas as capturas do run GitHub `41825015503` no commit `b756e17`. Na etapa que deveria selecionar português, o inglês permanecia selecionado e o foco estava no botão de fechar Preferências; depois do atalho de salvar, o diálogo fechava sem alterar o idioma. A sequência anterior enviava teclas após pausas fixas, sem confirmar o foco do seletor.

O app agora registra as ações e aplica o foco inicial de modais/paleta em `useLayoutEffect`. O modal usa uma referência ao próprio elemento, evitando selecionar outro diálogo presente na página. O teste observa foco, seleção, abertura e confirmação do popup nativo via AT-SPI antes de enviar a próxima ação e aguarda o fechamento dos diálogos. Ele continua usando teclas reais, display/workspace temporários e verificação de PID; os buses D-Bus de sessão/acessibilidade também são privados. Falhas guardam screenshot e diagnóstico de foco em JSON nos artefatos do CI, que recebeu as dependências AT-SPI.

Passaram TypeScript/Vite, build Wails WebKit 4.0, renderização React, `npm run test:ui` completo, sintaxe Python, actionlint, Prettier dos arquivos alterados e `git diff --check`. A suíte nativa completa passou localmente: inglês → português → inglês → português, execução, atalhos, renomeação, última edição no fechamento, restauração sem executar o rascunho e dispensa persistente dos convites. A suíte completa também passou com a aplicação e seus processos limitados a um núcleo de CPU e prioridade reduzida. Nessa condição, o envio anterior de caracteres sintéticos mais rápido que o processamento do WebKit expôs uma fila de entrada no fechamento; o teste passou a usar 50 ms entre caracteres, mantendo o fechamento imediato após digitar e a verificação do código completo persistido, sem aguardar autosave.

Não foi executado novo workflow remoto, nem houve commit, push, alteração da versão `0.2.0`, instalação ou publicação. A confirmação no runner do GitHub depende do envio destas alterações pelo mantenedor.

## Preferências internas e formatação PHP — 4 de novembro de 2026

O input da paleta recebeu padding próprio; a versão do build aparece discretamente no rodapé. Foram removidos das preferências e do contrato JSON os campos de fonte de atualização e caminho do Phpactor, incluindo as ações de selecionar/instalar o servidor pela interface. Preferências antigas são ignoradas e descartadas no próximo salvamento. O updater usa a fonte embutida no build, sem override por ambiente em runtime. Pacotes usam apenas o Phpactor adjacente; o build verifica o pin e inclui esse arquivo em `build/bin`. Caminho do PHP local, cache, idioma, atalhos, formatação e consulta automática continuam configuráveis.

A formatação usa Prettier 3.9.10 e o plugin PHP 0.26.0 embutidos num worker inline, sem executar PHP, ler regras de projetos ou usar a conexão selecionada. Funciona por Alt+Shift+F, botão, paleta e comando do Monaco; preserva undo e rejeita resultados se o código foi alterado durante a tarefa. Limites: 1 MiB e dez segundos por formatação. O padrão é quatro espaços, largura preferida de 80 caracteres, aspas simples, vírgulas finais e PER-CS; o teste verifica que uma cadeia Laravel longa recebe alinhamento vertical. Essas escolhas se inspiram nas convenções PHP-FIG e não significam conformidade integral com Pint ou PSR-12.

Preferências → Formatação permite ajustar opções ou importar JSON de até 64 KiB com allowlist de campos escalares. Os valores são copiados para o workspace ao salvar; o arquivo original não é modificado nem observado. Plugins, parser externo, PHP/JavaScript, tipos inválidos e valores fora dos limites são rejeitados. Arquivos de configuração do Pint/PHP-CS-Fixer não são compatíveis.

Passaram `./scripts/check.sh` com Phpactor real e dependências da fixture Laravel, a suíte WebKit completa, testes específicos de formatação e testes Go com race detector de serviço/linguagem. Os testes de formatação comparam ASTs antes/depois, preservam comentários, strings, Unicode, heredocs e nowdocs, verificam idempotência e tratamento de expressões sem tags/sem ponto e vírgula. A interface validou worker real, atalho, botão, paleta, undo, rascunho persistido, PHP inválido intacto, ausência de execução implícita, importação segura, indentação personalizada, persistência após reload e restauração do padrão. O teste de serviço reproduz um workspace antigo e ambiente com overrides maliciosos: não altera a fonte nem inicia o script Phpactor fornecido pelo workspace.

O pacote `build/dist/tinkercraft_0.2.0_linux_amd64_webkit40.deb` foi reconstruído e extraído em uma pasta temporária. Foram conferidos metadados, SHA-256, pin do Phpactor, licenças dos novos componentes e fonte oficial mesmo com variável de ambiente adversarial. Seu executável passou a suíte nativa Xvfb a partir de `/tmp`: Phpactor incluído pronto, troca de idiomas, formatação por worker, undo, nenhuma execução implícita, fechamento/restauração e convites. Também passaram Prettier, sintaxe Bash/Python, actionlint, `git diff --check` e auditoria npm das dependências de produção sem vulnerabilidades conhecidas reportadas.

Uma repetição da suíte WebKit encontrou um timeout intermitente na sugestão manual `format` do Phpactor, após a sugestão automática já ter funcionado. O diagnóstico de falhas agora inclui o tooltip de status do autocomplete; não foram removidas as asserções nem ampliados os timeouts. A repetição isolada completa passou. Essa ocorrência não comprova uma correção adicional do autocomplete e deve ser investigada se voltar a ocorrer.

Não houve instalação no sistema, commit, push, mudança da versão `0.2.0` ou publicação. O rascunho já existente no GitHub contém o build anterior e precisa ser reconstruído com o novo commit antes de ser publicado. A variante WebKit 4.1 e a confirmação remota destas mudanças continuam pendentes.

## Dependabot e auditoria da fixture Laravel — 4 de novembro de 2026

O log ERESOLVE informado veio do PR Dependabot #6, run `41926723855`, que elevou `react-dom` para 19.3.1 e `@types/react-dom` para 19.3.0 mantendo `react` 19.2.8 e `@types/react` 19.2.18. O novo tipo DOM requer `@types/react ^19.3.0`; não se trata de falha de instalação no commit `797f921` da main. `npm ci` na raiz e no frontend passou localmente com os manifests/lockfiles atuais, sem force ou legacy-peer-deps. A configuração do Dependabot agora agrupa React, React DOM e ambos os tipos, separadamente para atualizações de versão e de segurança. Isso orienta futuras propostas, sem alterar ou corrigir automaticamente o PR #6 existente; nenhum PR foi fechado, comentado, atualizado ou mesclado nesta revisão.

O run da main `41926345288` passou a instalação e os testes de backend, mas falhou em `composer audit`, com seis avisos publicados em 4 de novembro afetando `symfony/http-foundation`, `symfony/http-kernel` e `symfony/routing` da fixture. Apenas esses três pacotes foram atualizados no lockfile de 7.4.22 para 7.4.23, mantendo Laravel 12.71.0, o alvo PHP 8.2 e os demais pacotes. A fixture é uma dependência de testes; não foi alterado nenhum projeto Laravel do usuário, nem foram desabilitados avisos, auditorias ou verificações de peer dependencies.

Passaram instalação Composer pelo lockfile sem scripts/plugins, `composer validate --strict`, auditoria Composer de pacotes instalados e do lockfile sem advisories, auditorias npm da raiz/frontend e `govulncheck` v1.9.0 sem vulnerabilidades conhecidas reportadas. O teste `TestRealLaravelBootstrapAndInspection` passou com race detector nas dependências atualizadas. Prettier do Dependabot, actionlint, testes de configuração comunitária e `git diff --check` também passaram. Não houve alteração de assets/backend desktop, rebuild do app, commit, push, nova execução remota ou publicação; a versão continua 0.2.0.

## Dependências explícitas dos testes Node — 4 de novembro de 2026

O erro de módulo esbuild ausente veio do PR Dependabot #10, run `41936214140`, que propõe Vite 8.3.5. Essa versão não declara mais esbuild como dependência; `render.test.mjs` e `formatter.test.mjs` usavam um caminho físico dentro de `frontend/node_modules`, dependendo indiretamente da implementação do Vite. O último push da main (`e4e1512`, run `41936003488`) terminou com sucesso. A atualização proposta do Vite não foi aplicada nesta revisão.

As ferramentas de teste esbuild 0.28.2 e php-parser 3.7.0 foram declaradas explicitamente nas devDependencies da raiz, com lockfile e imports pelos nomes públicos dos pacotes. O teste de formatação também deixou de buscar o parser por meio da árvore transitiva do plugin PHP. O workflow de release agora instala o lockfile da raiz e o do frontend antes dos testes e inclui ambos no cache npm; o CI já instalava os dois.

Passaram `npm ci` da raiz, testes de renderização/CSV e formatação, auditoria npm sem vulnerabilidades conhecidas reportadas, Prettier, actionlint e `git diff --check`. Uma reprodução em diretório temporário omitiu esbuild da árvore do frontend: ambos os testes anteriores falharam com o mesmo ERR_MODULE_NOT_FOUND; as versões corrigidas passaram nessa condição. Não foram alterados app, versões do frontend, assets ou PHP de projetos do usuário. Não houve commit, push, merge de PR, execução de workflow remoto ou publicação; a versão continua 0.2.0.

## Nome de arquivo exportado no WebKit novo — 4 de novembro de 2026

Os dois logs enviados são execuções da mesma proposta de atualização Playwright 1.58.2 → 1.64.1. Uma reprodução mínima com um link Blob e atributo `download="Consulta de amanhã.php"` retornou `Consulta de amanhã.php` no WebKit 26.0 e `Consulta_de_amanhã.php` no WebKit 27.2. A aplicação solicitava o nome correto nas duas versões; a diferença ocorre no nome sugerido pelo navegador, comportamento cuja variação é documentada no Playwright.

O harness agora observa o atributo `download` enviado ao clique real do link. O teste exige exatamente o nome original com espaços e acentos e mantém a verificação byte a byte do arquivo PHP exportado. Para o nome final sugerido, aceita somente o original ou a substituição de espaços por underscores observada no WebKit novo, preservando extensão e Unicode. Não foi alterado código de produção, nome de aba, diálogo Wails ou regra de exportação do app.

As suítes completas de interface e convites foram executadas com a versão fixada 1.58.2/WebKit 26.0 e com 1.64.1/WebKit 27.2 instalada em diretório de ferramentas isolado. Os testes com a versão nova usam cópias temporárias dos scripts que alteram apenas o import do Playwright; manifests/lockfiles e a versão usada pelo projeto permanecem iguais. Não houve alteração de PR, commit, push ou publicação. O workflow de build `41954317455` foi confirmado como concluído com sucesso no commit `fae3aab`, antes desta correção restrita aos testes. Não foi necessário reconstruir o executável para validar esta mudança.

## Evidências anteriores por área

| Área | Evidência |
| --- | --- |
| PHP puro real | Expressões com/sem `;` e com/sem `<?php`, strings com delimitadores, closures, namespace, retorno explícito e controle de fluxo |
| Diagnóstico de execução | Erros de sintaxe e exceções, preservação das linhas originais, saída não zero |
| Dumps e saída | `dump`, `dd`, stdout capturado e escrito diretamente, warnings, protocolo de shutdown |
| Bootstrap Composer | Helper carregado por autoloader de uma aplicação isolada |
| Laravel real | Laravel 11.45.3 e PHP 8.4.1; bootstrap do kernel, helpers, Collections, VarDumper/Symfony `dd`, modelos Eloquent |
| Eloquent | Atributos `hidden` omitidos, getter que lança exceção não invocado durante inspeção |
| Limites | Referências circulares, quantidade de filhos, strings, stdout e orçamento total preservando envelope válido |
| Processos | Timeout, cancelamento e montagem de argumentos de comandos |
| Transporte SSH/Docker | Validação de entradas e decodificação por shell POSIX real do comando remoto, com binário Docker simulado que registra argv |
| Autocomplete básico | Leitura real de AST PHP; funções internas, classes, propriedades e métodos públicos/herdados; privados excluídos |
| Ponte LSP | Servidor de protocolo de teste por stdio: UTF-8/framing, request do servidor, diagnósticos, completion, hover e ajuste de linhas |
| Phpactor real | Release 2026.10.07.0 instalado; completions de métodos, hover e assinatura de DateTimeImmutable verificados com o servidor real |
| Phpactor em fontes remotas em cache | Sugestão de membro de classe da aplicação, autoload remoto não executado e análise em diretório privado do cache |
| Cache automático | Coleta PHP real com SSH/Docker simulados nos três modos; reaproveitamento, atualização forçada, cancelamento preservando cópia anterior, permissões e rejeição de caminhos/transferências inválidos |
| Exclusões e expiração | `.env`, arquivos ocultos/configuração remota, symlinks e dados excluídos; dependência `vendor/psr/cache` preservada; cache inativo removido sem apagar fonte original ou sessão ativa |
| Montagem e detecção Docker | Reuso de bind mount local; descoberta de projeto em subpasta de montagem quando o WorkingDir é `/`, com CLI simulada e PHP real |
| Persistência | Reabertura, isolamento de snapshots, permissão `0600` e preservação de JSON inválido |
| Frontend | TypeScript e bundle Vite de produção |
| Renderização React sem navegador | Conversão de valores, arrays/objetos vazios, inteiros grandes sem perda, seleção de dumps e escaping de conteúdo/erros em HTML |
| Distribuição desktop | Build Wails de produção Linux x86-64 gerado em `build/bin/tinkercraft` |
| Desktop Wails nativo | Janela aberta em workspace isolado; edição exibida, Phpactor conectado e execução por Ctrl+Enter com resultado em árvore conferido visualmente |
| Interface WebKit Playwright | Monaco sem tags, sugestões reais do Phpactor local e em cache, execução Go/PHP, tabela/filtro/ordenação/CSV, erros, cancelamento, abas, formulário SSH + Docker, select escuro, detecção, histórico e restauração passaram |

Os testes dos três transportes não locais também passaram pelo runner PHP real com executáveis SSH/Docker simulados, verificando stdin, diretório, envelope de resposta, listagem e inspeção. Isso não valida daemon, autenticação, rede ou infraestrutura real.

Comandos principais:

```bash
TINKERCRAFT_LARAVEL_VENDOR=/caminho/dependencias-laravel/vendor \
  GOCACHE=/tmp/tinkercraft-go-cache GOPROXY=off go test ./...
GOCACHE=/tmp/tinkercraft-go-cache GOPROXY=off go vet ./...
npm --prefix frontend run build
GOCACHE=/tmp/tinkercraft-go-cache GOPROXY=off ./scripts/build.sh
TINKERCRAFT_PHPACTOR_REAL="$PWD/.tools/phpactor.phar" go test ./internal/language -run RealPhpactor -v
TINKERCRAFT_PHPACTOR_REAL="$PWD/.tools/phpactor.phar" go test -race ./internal/...
npm run test:ui
TINKERCRAFT_NATIVE_TEST=1 xvfb-run -a -s '-screen 0 1440x1000x24' /usr/bin/python3 tests/native.test.py
```

O teste Laravel lê apenas as dependências abertas do framework instaladas nesse diretório e cria um bootstrap separado em diretório temporário. A aplicação de origem, seu autoload raiz, `.env`, providers, helpers e código de negócio não são executados nem modificados.

## Implementado, mas não validado integralmente aqui

| Área | Limitação concreta |
| --- | --- |
| Diálogos e clipboard nativos | A janela e a execução Wails foram verificadas, mas os seletores de arquivo e o clipboard não foram percorridos integralmente |
| Docker local real | O contexto ativo `desktop-linux` aponta para socket inexistente. No contexto `default`, o usuário atual não tem acesso ao socket do Engine; sudo exige senha. Não foram alterados grupos, contextos ou permissões do sistema |
| SSH e Docker por SSH | A coleta de fontes via SSH + Docker e o autocomplete usando esses fontes foram validados no destino cadastrado. PHP por SSH fora de Docker e a execução de código de negócio nesse destino não foram exercitados nesta revisão |
| Comparativo de desempenho | Nenhum benchmark Wails versus Electron foi executado |

Na primeira etapa, restrições da sessão impediram rede, GUI e testes em navegador. Depois da alteração efetiva das permissões, a rede e a interface gráfica passaram a funcionar: o Phpactor foi instalado e a validação nativa/WebKit foi realizada. Os bloqueios antigos de DNS e GTK não descrevem mais o estado atual. A limitação atual de Docker é do contexto/daemon e das permissões do usuário do sistema.

Screenshots da aplicação: `test-results/tinkercraft-native-ux.png` e `test-results/tinkercraft-native-connections.png` (revisão no Wails nativo), `test-results/tinkercraft-table.png` e `test-results/tinkercraft-connections.png` (WebKit/HTTP). O diretório de resultados é ignorado pelo Git. O WebKit Playwright anuncia user-agent macOS mesmo no Linux; o teste usa o modificador de teclado correspondente ao que o Monaco identifica.

## Próxima validação no ambiente gráfico normal

1. Cadastrar os projetos desejados e verificar tipos específicos do Laravel, incluindo os arquivos IDE Helper quando necessários.
2. Fazer `docker ps` funcionar como o usuário que inicia o TinkerCraft e então validar um container PHP real.
3. Verificar execução PHP fora de Docker e outros destinos SSH conforme o uso; coleta e autocomplete de SSH + Docker já foram exercitados com o perfil cadastrado.
4. Percorrer seletores de arquivo, exportação e clipboard no shell Wails nativo; o teste HTTP de exportação não substitui esses diálogos.

As integrações verificadas não estabelecem equivalência integral com o Tinkerwell nem cobertura de todos os ambientes.
