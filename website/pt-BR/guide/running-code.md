# Executar PHP e Laravel

Selecione uma conexão, escreva PHP e pressione **Ctrl+Enter** ou clique em **Executar**. O TinkerCraft só executa quando você solicita. Digitar, completar e formatar não executa o trecho.

## Retorno e dumps

A última expressão é retornada automaticamente:

```php
collect([1, 2, 3])->map(fn ($numero) => $numero * 2);
```

Você também pode usar `return`, `dump()` e `dd()`. Dumps aparecem separados do retorno final. `dd()` encerra a execução.

Cada execução inicia um processo PHP novo. Inclua todas as variáveis e instruções necessárias; variáveis de uma execução anterior não permanecem na próxima.

## Classes Laravel e container

Com bootstrap Laravel, use o nome completo:

```php
\App\Models\User::count();
```

Classes da aplicação com nomes curtos únicos também recebem aliases:

```php
User::count();
```

Se duas classes da aplicação tiverem o mesmo nome curto, escolha explicitamente:

```php
use App\Models\User;

User::count();
```

Aliases de classes são separados da injeção de dependências. O container Laravel inicializado está disponível por `app()` e `resolve()`:

```php
app(\App\Models\User::class)->newQuery()->count();
```

O runner respeita `tinker.alias` e `tinker.dont_alias`. Use o nome completo quando o nome curto estiver excluído ou for ambíguo. Aliases Laravel só são ativados com bootstrap Laravel.

## Parar uma execução

Clique em **Cancelar** ou use o atalho de executar/cancelar durante a execução. O timeout pode ser configurado nas opções avançadas da conexão.

::: warning Acesso real à aplicação
Um trecho usa as permissões, serviços e banco reais do projeto escolhido. Não há sandbox nem rollback automático. Cancelar encerra o processo/transporte local; isso não garante encerrar um trabalho já iniciado remotamente nem desfazer seus efeitos.
:::
