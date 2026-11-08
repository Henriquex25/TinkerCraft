# Solução de problemas

## Executável PHP não encontrado

**Sintoma:** `Could not parse code with local PHP (php)` ou `executable file not found in $PATH`.

O projeto pode estar acessível mesmo quando falta o PHP da análise local. Configure um caminho absoluto para PHP 8.2+ em **Preferências → Geral → Executável PHP local**. Veja [PHP local](./local-php).

## A conexão funciona, mas não há autocomplete

Confira o PHP local, solicite sugestões com **Ctrl+Espaço** e abra o diagnóstico com **Ctrl+Alt+I**. Depois, use **Ctrl+Alt+R** para atualizar o cache dos fontes.

Verifique se o diretório da conexão é a raiz do projeto. Em Docker, precisa ser o caminho do container. O primeiro snapshot/índice pode demorar mais; avisos de fontes parciais e fallback explicam a cobertura reduzida.

Uma propriedade do schema ou macro de runtime pode precisar de metadados IDE Helper existentes. Os helpers automáticos não consultam o banco.

## Class "User" not found

Escolha bootstrap Laravel ou automático e confira se o caminho contém sua aplicação Laravel. Tente o nome completo:

```php
\App\Models\User::count();
```

Use um import explícito para nomes curtos duplicados ou exclusões em `tinker.dont_alias`. Aliases automáticos exigem a versão que inclui esse suporte Laravel.

## SSH pede senha ou rejeita o host

Teste o mesmo host/usuário/chave com OpenSSH no terminal. Verifique uma nova chave de host e carregue uma chave criptografada no agente SSH acessível à sessão gráfica. O TinkerCraft não oferece autenticação por senha interativa nem ignora a verificação do host.

## Docker não encontra o projeto

Confira o container, seu estado, as permissões Docker e o PHP CLI dentro dele. Use **Detectar diretório** e revise o resultado. O caminho no host e o caminho do container são locais diferentes.

## Faltam linhas no CSV

O CSV contém os dados inspecionados, após o filtro da tabela. Confira limites da consulta e indicadores de resultado parcial. Avançar páginas na tabela não busca mais linhas do banco. [Veja os limites de saída](./output#resultados-parciais).

## O instalador diz que a versão já está instalada

Uma janela antiga pode continuar executando depois de seu executável ser atualizado no disco. Feche e abra o app. A implementação nova do atualizador detecta esse caso e usa Atualizar para reiniciar diretamente.

## Pedir ajuda

Consulte [issues](https://github.com/Henriquex25/TinkerCraft/issues) e [discussões](https://github.com/Henriquex25/TinkerCraft/discussions). Informe a versão do app no rodapé, o Linux, o modo de conexão e um exemplo mínimo. Remova credenciais, fontes privados e dados pessoais antes de compartilhar logs ou capturas.

Se o app ajudar, você pode [dar uma estrela ao repositório](https://github.com/Henriquex25/TinkerCraft) ou [pagar um café ao mantenedor](https://www.buymeacoffee.com/henriquemiranda). Apoio é opcional; recursos não dependem de doações.
