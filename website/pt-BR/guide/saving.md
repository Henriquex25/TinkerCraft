# Salvar e restaurar trechos

## Abas salvas automaticamente

As abas abertas preservam nome, código e conexão neste dispositivo. São restauradas ao reabrir o TinkerCraft, inclusive quando você nunca executou o trecho.

Pressione **Ctrl+S** para solicitar uma gravação imediata de todas as abas. O indicador confirma quando terminou. O fechamento normal da janela aguarda o último rascunho; encerramento forçado ou queda de energia ainda podem perder edições recentes.

## Nomear abas

Pressione **F2**, dê dois cliques no título da aba ou use sua ação de renomear. Enter confirma; Escape cancela.

Use **Ctrl+N** para nova aba, **Ctrl+W** para fechar e **Ctrl+Tab** / **Ctrl+Shift+Tab** para navegar.

Fechar uma aba a remove do workspace aberto. Exporte trechos que deseja manter independentemente das abas.

## Salvar um arquivo PHP

**Ctrl+Shift+S** exporta a aba atual pelo seletor de arquivos do sistema. O TinkerCraft adiciona a tag de abertura do PHP quando necessário. **Ctrl+O** abre um arquivo PHP em nova aba.

Salvar abas no aplicativo e exportar um arquivo são ações diferentes. A exportação fornece um arquivo que você pode incluir nos seus backups ou no seu repositório.

## Histórico e projetos

O histórico mantém as últimas 50 execuções. Ele ajuda a retomar uma execução, mas não substitui arquivos salvos nem rascunhos ainda não executados.

Os perfis de conexão identificam seus projetos e runtimes. Ainda não há biblioteca separada de snippets ou gerenciador de projetos em disco.

## Seu workspace

O diretório padrão é `~/.config/tinkercraft`. Instalações anteriores podem reutilizar `~/.config/lume`. Faça backup do workspace ativo com o aplicativo fechado. Ele guarda trechos, histórico, perfis, preferências e caches localmente; os arquivos são privados, mas não criptografados. Segredos escritos nos trechos podem ficar salvos ali.

Atualizar ou remover o pacote do aplicativo preserva esse workspace.
