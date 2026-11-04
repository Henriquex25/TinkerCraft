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

Ainda não existe repositório remoto: a fonte permanece vazia. Não houve publicação nem execução do workflow no GitHub. A variante WebKit 4.1 em Ubuntu 24.04 está prevista na matriz, mas não foi gerada/executada aqui. A instalação/atualização pelo gerenciador de pacotes, a associação gráfica de `.deb` via `xdg-open` e o fluxo completo contra um release público ficam pendentes. O teste por extração não comprova esses passos do sistema operacional.

## Logo PNG — 4 de novembro de 2026

A imagem fornecida em `build/appicon.png` tem 1254 × 1254 pixels e canal alpha. O original foi preservado. O build gera uma cópia de 128 × 128 para a interface e a janela Wails; o `.deb` contém dez tamanhos PNG, de 16 a 1024 pixels, no tema hicolor. Não inclui o SVG provisório anterior. O bundle da interface usa a cópia de aproximadamente 12 KiB.

Passaram TypeScript/Vite, renderização React e a suíte WebKit completa com a logo no menu lateral e na janela de atualização. O pacote reconstruído foi extraído para uma pasta temporária: cada tamanho foi conferido pixel a pixel contra o redimensionamento da fonte com GdkPixbuf, incluindo transparência, além da validação desktop e SHA-256.

O binário extraído abriu em Xvfb com workspace isolado e diretório de trabalho `/tmp`. A propriedade X11 `_NET_WM_ICON` foi comparada pixel a pixel com a derivada de 128 pixels e o fechamento normal terminou com sucesso. O teste inicial com o original de 1254 pixels revelou que GTK/X11 omitia esse ícone; a derivada corrigiu o problema. Screenshot conferido em `test-results/tinkercraft-native-logo.png`. Não houve instalação no sistema nem alteração de janelas do usuário.

## Passou

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
TINKERCRAFT_LARAVEL_VENDOR=/media/henrique/hdd/Projects/Clinicker/vendor \
  GOCACHE=/tmp/tinkercraft-go-cache GOPROXY=off go test ./...
GOCACHE=/tmp/tinkercraft-go-cache GOPROXY=off go vet ./...
npm --prefix frontend run build
GOCACHE=/tmp/tinkercraft-go-cache GOPROXY=off ./scripts/build.sh
TINKERCRAFT_PHPACTOR_REAL="$PWD/.tools/phpactor.phar" go test ./internal/language -run RealPhpactor -v
TINKERCRAFT_PHPACTOR_REAL="$PWD/.tools/phpactor.phar" go test -race ./internal/...
npm run test:ui
TINKERCRAFT_NATIVE_TEST=1 xvfb-run -a -s '-screen 0 1440x1000x24' /usr/bin/python3 tests/native.test.py
```

O teste Laravel lê apenas as dependências abertas do framework instaladas nesse diretório e cria um bootstrap separado em diretório temporário. O aplicativo Clinicker, seu autoload raiz, `.env`, providers, helpers e código de negócio não são executados nem modificados.

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
