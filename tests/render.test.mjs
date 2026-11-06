import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const temp = await mkdtemp(path.join(tmpdir(), "tinkercraft-render-"));
try {
  await build({
    stdin: {
      resolveDir: path.join(root, "frontend"),
      loader: "tsx",
      contents: `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';
import { Output, plain } from './src/output';
import { snippetBody } from './src/php';
import { ReleaseNotes } from './src/release-notes';
const markdown = renderToStaticMarkup(<ReleaseNotes notes={'## Changes\\n\\n- **Fixed** '+String.fromCharCode(96)+'PHP'+String.fromCharCode(96)+'\\n\\n<script>alert(1)</script>\\n\\n![track](https://evil.example/x) [bad](javascript:alert(1))'} />);
assert(markdown.includes('<h2>Changes</h2>'));
assert(markdown.includes('<li><strong>Fixed</strong> <code>PHP</code></li>'));
assert(!/<(script|img|a)[ >]/.test(markdown));

import { csv } from './src/csv';
import { setUILanguage, t, uiLanguage, translateStatus } from './src/i18n';
import portuguese from './src/locales/pt-BR.json';
import backendPortuguese from './src/locales/messages.pt-BR.json';
assert.equal(uiLanguage(), 'en');
assert.equal(t('Run'), 'Run');
assert.equal(translateStatus('Phpactor conectado'), 'Phpactor connected');
for (const [en,pt] of Object.entries({...portuguese,...backendPortuguese})) {
 assert.deepEqual((en.match(/\\{\\d+\\}/g)||[]).sort(), (pt.match(/\\{\\d+\\}/g)||[]).sort(), en);
}
setUILanguage('pt-BR');
assert.equal(t('Run'),'Executar');
assert.equal(t('Edit {0}', ['History']), 'Editar History');
assert.equal(t('constructor'),'constructor');
import { bindingErrors, keysFor, shortcutFromEvent, validateShortcut } from './src/shortcuts';
assert.deepEqual(bindingErrors({}), []);
assert(bindingErrors({run:'Ctrl+S'}).some(message => message.includes('mesmo atalho')));
assert.deepEqual(bindingErrors({run:'Ctrl+Shift+Enter'}), []);
assert.deepEqual(keysFor('run', {run:'Ctrl+Shift+Enter'}), ['Ctrl+Shift+Enter']);
assert.equal(keysFor('run', {}).includes('Ctrl+R'), true);
assert(validateShortcut('A'));
assert(validateShortcut('Ctrl+V'));
assert.equal(shortcutFromEvent({key:'!',code:'Digit1',ctrlKey:true,metaKey:false,altKey:false,shiftKey:true}), 'Ctrl+Shift+1');
assert(bindingErrors({commands:''}).some(message => message.includes('paleta')));

assert.equal(snippetBody('<?php\\n\\n42;\\n?>'), '42;\\n');
assert.equal(snippetBody('<?php\\r\\n42;'), '42;');
assert.equal(snippetBody('42;'), '42;');
assert.equal(snippetBody('$tag = "?>";'), '$tag = "?>";');
assert.equal(csv([{name:'Ana',balance:-42}],['name','balance']), '\\uFEFF"name","balance"\\r\\n"Ana","-42"');
const apostrophe=String.fromCharCode(39), doubleQuote=String.fromCharCode(34);
for (const value of ['=1+1','  =1+1','+SUM(A1)','-1+2','@SUM(A1)','\\t=1','\\r=1','\\n=1']) {
 const result=csv([{value}],['value']);
 assert(result.includes(doubleQuote+apostrophe+value+doubleQuote), 'formula was not neutralized: '+JSON.stringify(value));
}
assert.equal(csv([],['=1+1','  @SUM(A1)']).slice(1), doubleQuote+apostrophe+'=1+1'+doubleQuote+','+doubleQuote+apostrophe+'  @SUM(A1)'+doubleQuote);
assert(csv([{value:'a,"b"\\nc'}],['value']).includes('"a,""b""\\nc"'));
const scalar = (value, type = 'string') => ({ type, value });
assert.deepEqual(plain({ type:'array', list:true }), []);
assert.deepEqual(plain({ type:'array', list:false }), {});
assert.equal(plain({type:'null'}), null);
assert.equal(plain(scalar(false, 'bool')), false);
assert.equal(plain(scalar('9223372036854775807','int')), '9223372036854775807');
assert.deepEqual(plain({type:'object', children:[{key:'name',value:scalar('Ana')},{key:'active',value:scalar(false,'bool')}]}), {name:'Ana',active:false});
const base = {success:true,value:scalar('<img src=x onerror=alert(1)>'),dumps:[],stdout:'<script>bad()</script>',stderr:'',warnings:[],error:null,durationMs:2.5,memoryBytes:1024,framework:'PHP',phpVersion:'8.4',truncated:false,cancelled:false};
let html = renderToStaticMarkup(<Output result={base} running={false} clear={()=>{}} hide={()=>{}} notify={()=>{}} />);
assert(!html.includes('<img src=x'));
assert(!html.includes('<script>bad()'));
assert(html.includes('&lt;script&gt;bad()'));
assert(html.includes('Execução concluída'));
html = renderToStaticMarkup(<Output result={{...base,value:null,dumps:[scalar(42,'int')],haltedByDump:true}} running={false} clear={()=>{}} hide={()=>{}} notify={()=>{}} />);
assert(html.includes('DUMP 1'));
assert(!html.includes('VALOR RETORNADO'));
html = renderToStaticMarkup(<Output result={{...base,success:false,error:{class:'RuntimeException',message:'<b>boom</b>',file:'',line:3,trace:''}}} running={false} clear={()=>{}} hide={()=>{}} notify={()=>{}} />);
assert(html.includes('&lt;b&gt;boom&lt;/b&gt;'));
assert(html.includes('linha 3'));
setUILanguage('en');
html = renderToStaticMarkup(<Output result={{...base,success:false,error:{class:'RuntimeException',message:'Phpactor conectado',file:'',line:3,trace:''}}} running={false} clear={()=>{}} hide={()=>{}} notify={()=>{}} />);
assert(html.includes('Phpactor conectado'));
assert(!html.includes('Phpactor connected'));
html = renderToStaticMarkup(<Output result={{...base,success:false,error:{class:'TinkerCraft'+String.fromCharCode(92)+'Runtime'+String.fromCharCode(92)+'BootstrapError',message:'vendor/autoload.php não encontrado. Execute composer install no projeto.',file:'',line:0,trace:''}}} running={false} clear={()=>{}} hide={()=>{}} notify={()=>{}} />);
assert(html.includes('vendor/autoload.php not found'));
html = renderToStaticMarkup(<Output result={{...base,value:scalar('Executar')}} running={false} clear={()=>{}} hide={()=>{}} notify={()=>{}} />);
assert(html.includes('Executar'));
assert(html.includes('Execution completed'));
console.log('PASS: PHP tag normalization, structured value conversion, empty values, bigint precision, dump selection, React escaping and structured errors.');
`,
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(temp, "render.cjs"),
    jsx: "automatic",
    banner: {
      js: 'globalThis.window = {}; globalThis.location = { hash: "" };',
    },
  });
  await import(pathToFileURL(path.join(temp, "render.cjs")).href);
} finally {
  await rm(temp, { recursive: true, force: true });
}
