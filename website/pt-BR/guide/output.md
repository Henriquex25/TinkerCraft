# Explorar a saída e exportar CSV

O painel de saída oferece **Inspecionar**, **Tabela** e **JSON**. Alterne com **Ctrl+Alt+1**, **Ctrl+Alt+2** e **Ctrl+Alt+3**.

## Inspecionar

Expanda arrays, objetos, Collections e atributos Eloquent em árvore. Use as setas com um item focado. Selecione um dump para inspecioná-lo separadamente do retorno.

A inspeção Eloquent respeita `hidden` e `visible` e inclui relações já carregadas. Evita accessors e consultas adicionais por lazy loading. O resultado pode diferir da serialização JSON normal da aplicação.

## Tabela e CSV

Retorne uma coleção ou array de linhas semelhantes. Por exemplo, com bootstrap Laravel e um model User padrão:

```php
\App\Models\User::query()
    ->select(['id', 'name'])
    ->limit(100)
    ->get();
```

Abra **Tabela**, filtre ou ordene as linhas e use **Exportar CSV** ou **Ctrl+Shift+E**. A exportação inclui as linhas filtradas e ordenadas de todas as páginas da tabela, não apenas da página visível.

O CSV contém os dados já recebidos e inspecionados pelo TinkerCraft. Ele não faz outra consulta ao banco nem busca linhas omitidas pelos limites de inspeção. Para exportar um grande volume do banco, prepare uma exportação na sua aplicação.

## JSON e outras saídas

Use **JSON** para o valor estruturado. **Copiar JSON** (**Ctrl+Shift+C**) copia o valor inspecionado selecionado. Saída padrão, avisos, erros e stack traces aparecem separadamente quando presentes.

## Ocultar ou limpar

**Ctrl+J** e o X do painel ocultam a saída e ampliam o editor. O resultado e a visualização são preservados. Executar código ou focar a saída mostra o painel novamente.

**Ctrl+Shift+Delete** limpa o resultado atual.

## Resultados parciais

A inspeção tem limites: até 300 filhos por nó, profundidade 8, 50 dumps e orçamento compartilhado de aproximadamente 2 MiB para valores. Cada inspeção também tem orçamento de 5.000 nós. A saída padrão é limitada a 256 KiB. Indicadores de resultado parcial significam que árvore, tabela, JSON copiado e CSV podem conter apenas parte dos dados originais.
