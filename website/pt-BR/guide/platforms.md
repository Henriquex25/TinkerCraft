# Sistemas operacionais e diferenças entre plataformas

O Linux é o alvo de distribuição estabelecido. Windows e macOS têm **suporte experimental de compilação e empacotamento**; os jobs nativos da CI e os fluxos desktop ainda precisam de validação antes de tratá-los como versões suportadas. Preparar um pacote não o publica.

::: warning Windows e macOS experimentais
**O suporte a Windows e macOS é experimental e ainda não tem validação nativa concluída.** O ZIP Windows foi gerado por compilação cruzada no Linux, mas ainda não foi testado no Windows. No macOS, os scripts e jobs de CI estão preparados; a compilação nativa e a validação desktop continuam pendentes. Nenhuma dessas plataformas deve ser tratada como versão estável ou validada.
:::

| Sistema                | Alvo                                                     | Pacote                                               | Atualização                         | Autocomplete do projeto            |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------- | ---------------------------------- |
| Ubuntu / Pop!_OS 22.04 | x86-64                                                   | `.deb`, WebKitGTK 4.0                                | Atualizar no app via APT            | Phpactor com fallback AST          |
| Ubuntu 24.04           | x86-64                                                   | `.deb`, WebKitGTK 4.1; validação de runtime pendente | Atualizar no app via APT            | Phpactor com fallback AST          |
| Windows 10/11          | x64; experimental                                        | ZIP portátil                                         | Substituir os arquivos manualmente  | Indexador AST; sem Phpactor nativo |
| macOS 13+              | Intel (`amd64`) ou Apple Silicon (`arm64`); experimental | `.app` em ZIP                                        | Substituir o aplicativo manualmente | Phpactor incluído com fallback AST |

Windows ARM64 e macOS universal ainda não são empacotados. Os pacotes Linux continuam em [GitHub Releases](https://github.com/Henriquex25/TinkerCraft/releases). Os pacotes de teste Windows/Mac são **artefatos da CI** chamados `tinkercraft-preview-windows-amd64`, `tinkercraft-preview-darwin-amd64` e `tinkercraft-preview-darwin-arm64`, somente após o sucesso dos respectivos jobs. Expiram em 14 dias e exigem login no GitHub para download. Não são anexados automaticamente a um release. Se não houver artefato aprovado, [compile o código-fonte](https://github.com/Henriquex25/TinkerCraft/blob/main/docs/cross-platform.md).

## Windows

### Instalar uma versão de teste

1. Baixe o artefato de um job **CI → Desktop preview (windows-amd64)** aprovado para o commit que deseja testar. Extraia o artefato para encontrar o ZIP do pacote e `checksums.txt`.
2. No PowerShell, execute `Get-FileHash .\tinkercraft_<version>_windows_amd64_preview.zip -Algorithm SHA256` e compare o resultado com `checksums.txt`.
3. Extraia esse pacote em uma pasta do seu usuário. Abra `TinkerCraft\tinkercraft.exe` na pasta extraída.

O executável precisa do [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). Se estiver ausente, o app oferece a página oficial de download; instale o runtime e reabra o TinkerCraft. O ZIP não cria atalho no menu Iniciar, associação de arquivos nem entrada no desinstalador. Para remover, apague a pasta extraída do aplicativo; o workspace fica separado.

Esses builds não têm certificado de publicador. O Windows pode mostrar aviso de publicador desconhecido ou SmartScreen. Confira a origem e o checksum; a assinatura de publicador ainda está pendente. Não é necessário desativar globalmente as proteções do Windows.

### Configurar o PHP

Instale separadamente o **PHP CLI 8.2+ de 64 bits**, com as extensões exigidas pelo seu projeto. Localize-o no PowerShell:

```powershell
(Get-Command php.exe).Source
php.exe -v
```

Se não estiver no PATH, selecione o `php.exe` instalado, por exemplo `C:\tools\php\php.exe`, em **Preferências → Geral → Executável PHP local**. Informe somente o caminho, sem aspas adicionais nem argumentos. O executável PHP da conexão é outra configuração: uma conexão local pode usar o mesmo caminho; um container/servidor Linux normalmente usa `php` ou `/usr/bin/php`.

O diretório do projeto local é um caminho nativo, por exemplo `C:\Users\Ana\projects\shop`. Não selecione `wsl.exe` como PHP: o campo de executável não aceita um comando com argumentos. Executar PHP dentro do WSL ou abrir um workspace WSL não é um modo integrado nesta versão experimental.

### Autocomplete, Docker e SSH

[O Phpactor exige Linux/macOS ou WSL](https://github.com/phpactor/phpactor#requirements). Esta versão Windows usa explicitamente o indexador AST existente e não inclui/inicia o Phpactor. Sugere funções, classes e membros públicos/herdados básicos; não oferece inferência equivalente de cadeias, generics ou diagnósticos do Phpactor. O status de autocomplete identifica o fallback. Não há ponte WSL nem outro servidor de linguagem incluído.

Para Docker, instale o Docker Desktop separadamente, use **containers Linux** e disponibilize a CLI Docker para a sessão gráfica. Informe um diretório POSIX do container, como `/var/www/html`, mesmo quando os arquivos do host ficam em `C:\Users\...`. Caminhos das montagens da VM Docker podem não ser acessíveis pelo Windows; nesse caso o app usa o cache seletivo de fontes. O autocomplete continua exigindo PHP local no Windows.

Para SSH, habilite/instale o cliente OpenSSH do Windows, configure `%USERPROFILE%\.ssh\config`, confira a impressão digital do servidor no terminal e disponibilize chaves criptografadas no agente SSH usado pelo app. O TinkerCraft chama `ssh.exe` do PATH, não uma sessão PuTTY. O destino SSH deve fornecer shell POSIX; Docker por SSH usa containers Linux. Não há prompts de senha.

### Atualizar

Salve as abas e feche o TinkerCraft normalmente. Baixe o novo pacote de teste da mesma arquitetura, compare o checksum, extraia em uma pasta nova e abra o novo executável. Guarde a pasta anterior até confirmar a abertura do novo build. O workspace é preservado porque fica fora da pasta do aplicativo. Não há instalador Windows dentro do app nem reinício automático após atualização.

## macOS

### Instalar uma versão de teste

1. Baixe um artefato **Desktop preview** aprovado para seu processador: `darwin-arm64` para Apple Silicon ou `darwin-amd64` para Intel. Extraia o artefato para encontrar o ZIP do pacote e `checksums.txt`.
2. Execute `shasum -a 256 tinkercraft_<version>_darwin_<arch>_preview.zip` e compare com `checksums.txt`.
3. Extraia o ZIP, mova `TinkerCraft.app` para Aplicativos (ou a pasta Aplicativos do seu usuário) e abra pelo Finder.

O toolchain Go atual exige macOS 13 ou mais recente. O app usa o WKWebView do sistema; não precisa instalar GTK nem WebView2. O Phpactor está dentro do bundle do aplicativo e deve permanecer ali.

Os bundles de teste usam **assinatura ad hoc** para integridade local. Ela não equivale a uma assinatura Apple Developer ID nem à notarização, e o Gatekeeper pode bloquear um bundle baixado. Para um build cuja origem você verificou, siga os controles por aplicativo documentados pela [Apple](https://support.apple.com/pt-br/102445); Macs gerenciados podem impedir a abertura. Não desative o Gatekeeper globalmente. A distribuição pública com Developer ID e notarização está pendente. Para desinstalar, mova o app para o Lixo; o workspace é preservado.

### Configurar o PHP

Instale o **PHP CLI 8.2+** separadamente. O macOS não fornece o PHP CLI exigido pelo app. Use seu gerenciador PHP atual ou instale uma versão adequada e confira:

```bash
command -v php
php -v
```

Aplicativos abertos pelo Finder não necessariamente herdam o PATH do terminal. Selecione o caminho absoluto em **Preferências → Geral → Executável PHP local**. Exemplos comuns são `/opt/homebrew/bin/php` no Apple Silicon e `/usr/local/bin/php` no Intel; confira o caminho na sua máquina. Configure também o executável PHP da conexão local se o padrão `php` não for encontrado. Um caminho local de projeto pode ser `/Users/ana/projects/shop`.

Docker Desktop e cliente OpenSSH devem estar disponíveis ao processo desktop para essas conexões. Diretórios do servidor/container continuam POSIX. Uma montagem inacessível da VM Docker usa o cache seletivo de fontes. SSH mantém conferência estrita de chave do host e autenticação não interativa, com configuração em `~/.ssh`.

### Atualizar

Salve as abas e encerre normalmente. Baixe e confira o novo ZIP do seu processador, extraia e substitua o `TinkerCraft.app` inteiro. Não substitua arquivos individualmente dentro do bundle assinado. Reabra e preserve o app anterior até conferir o novo build. Esta versão experimental não tem Sparkle, instalador dentro do app nem reinício automático após atualização.

## Dados, atalhos e comportamento comum

| Sistema | Workspace padrão                                            |
| ------- | ----------------------------------------------------------- |
| Linux   | `~/.config/tinkercraft` (ou `$XDG_CONFIG_HOME/tinkercraft`) |
| Windows | `%APPDATA%\tinkercraft`                                     |
| macOS   | `~/Library/Application Support/tinkercraft`                 |

Um workspace `lume` existente na mesma pasta de configuração do sistema é reaproveitado se não houver workspace atual. `TINKERCRAFT_DATA_DIR` substitui o local; o alias antigo `LUME_DATA_DIR` continua aceito. Defina a variável antes de iniciar o app; atalhos desktop não herdam variáveis de um terminal separado. Para testes isolados, execute o binário pelo terminal com um diretório de dados exclusivo.

Faça backup do workspace ativo com o aplicativo fechado. Remover ou substituir os arquivos do aplicativo não remove trechos, preferências, histórico ou caches. Os arquivos não são criptografados. Mantenha-os no perfil protegido da sua conta; no Windows, o acesso é controlado por ACLs do sistema de arquivos, e não por bits de permissão Unix.

A [tabela de atalhos](./keyboard-shortcuts) usa a notação `Ctrl`. Windows e Linux usam Ctrl. No macOS, o despacho de comandos aceita **Command no lugar de Ctrl**, e a interface atualmente ainda identifica esses atalhos como Ctrl. Option corresponde a Alt. O sistema pode interceptar algumas combinações; remapeie-as nas Preferências. Teste copiar/colar nativo, diálogos de salvar/exportar, foco e fechamento com rascunhos antes de depender de um build experimental.

Código só executa por ação explícita. O cancelamento local encerra o grupo/job de processos local; interromper o transporte Docker/SSH não garante encerrar o trabalho remoto nem reverter efeitos no banco. A formatação funciona offline em todas as plataformas. PHP local continua necessário mesmo em projetos remotos.
