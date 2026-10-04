// Production build: minify JS, copy assets to dist/ (run: npm run build)
import {minify} from 'terser';import fs from 'fs';
fs.rmSync('dist',{recursive:true,force:true});for(const d of ['js','css'])fs.mkdirSync('dist/'+d,{recursive:true});
const out=await minify(fs.readFileSync('js/main.js','utf8'),{compress:{passes:2},mangle:true});
fs.writeFileSync('dist/js/main.min.js',out.code);
fs.writeFileSync('dist/index.html',fs.readFileSync('index.html','utf8').replace('js/main.js','js/main.min.js'));
fs.copyFileSync('css/style.css','dist/css/style.css');
console.log('built dist/ ('+out.code.length+' bytes JS)');
