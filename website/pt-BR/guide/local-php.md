# Configurar o PHP local

O TinkerCraft tem duas configurações de PHP:

| Configuração                                            | Finalidade                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| **Preferências → Geral → Executável PHP local**         | Analisa trechos e fornece suporte de linguagem no seu computador |
| **Configurações avançadas → Executável PHP** da conexão | Executa trechos no diretório, container ou servidor escolhido    |

Executáveis e versões podem ser diferentes. Mesmo uma conexão SSH + Docker precisa de PHP local para a análise.

## Encontrar o executável

No terminal, execute:

```bash
command -v php
php -v
```

O PHP local precisa ser 8.2 ou superior. Use o caminho absoluto caso a sessão gráfica não encontre `php`.

1. Abra **Preferências** com **Ctrl+,**.
2. Selecione **Geral**.
3. Informe o caminho em **Executável PHP local**, ou use o seletor de arquivos.
4. Salve as preferências.

Por exemplo, o Herd Lite pode instalar o PHP em:

```text
/home/seu-usuario/.config/herd-lite/bin/php
```

Substitua `seu-usuario` pelo seu usuário do Linux e confira se o arquivo existe. Outros gerenciadores de PHP usam caminhos diferentes.

## Funciona no terminal, mas não no app

O terminal pode adicionar o PHP ao `PATH` pela configuração do shell. Um aplicativo aberto pelo menu do desktop pode receber outro `PATH`.

O caminho absoluto nas Preferências resolve essa diferença sem alterar o PHP da conexão remota/container. Mantenha o executável remoto como `php`, a menos que aquele ambiente exija outro caminho.

Se o autocomplete continuar indisponível, use **Atualizar autocomplete** (**Ctrl+Alt+R**) e consulte o [diagnóstico](./autocomplete#diagnostico).
