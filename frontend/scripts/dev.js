// Arranca Vite con el caché de compilación de Node deshabilitado.
//
// En Node 22.8+/24, `module.enableCompileCache()` (que Vite llama en su
// propio bin/vite.js) se queda colgado para siempre en esta máquina al
// intentar escribir el caché en disco — "npm run dev" nunca imprimía nada,
// ni siquiera el banner de Vite. NODE_DISABLE_COMPILE_CACHE=1 lo desactiva.
// Como los scripts de npm en Windows corren por cmd.exe (no soporta
// "VAR=valor comando"), se fija la variable acá en vez de en package.json.
process.env.NODE_DISABLE_COMPILE_CACHE = '1'
await import('../node_modules/vite/bin/vite.js')
